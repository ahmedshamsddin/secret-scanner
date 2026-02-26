import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { supabase } from '../supabase.js';
import { scanFiles } from '../scanner.js';
import { extractFilesFromZip, fetchGitHubRepo } from '../extractor.js';

export const scansRouter = Router();

// ── Multer: memory storage, 50MB zip limit ────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' ||
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are accepted'));
    }
  },
});

// ── Shared: run scan and persist to DB ────────────────────────
async function runAndPersistScan(
  userId: string,
  title: string,
  source: { type: 'zip'; repoName?: string } | { type: 'github'; repoUrl: string; repoName: string; branch: string },
  files: { filePath: string; content: string; sizeBytes: number }[],
  res: Response
): Promise<void> {
  // 1. Create scan record
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .insert({
      user_id: userId,
      title,
      source_type: source.type,
      repo_url: source.type === 'github' ? source.repoUrl : null,
      repo_name: source.type === 'github' ? source.repoName : (source.repoName ?? null),
      branch: source.type === 'github' ? source.branch : null,
      status: 'scanning',
    })
    .select()
    .single();

  if (scanError || !scan) {
    res.status(500).json({ error: 'Failed to create scan', details: scanError?.message });
    return;
  }

  // 2. Scan all files
  const result = scanFiles(files);

  // 3. Persist findings (no raw source code stored — only redacted matches)
  if (result.findings.length > 0) {
    const findingsToInsert = result.findings.map(f => ({
      scan_id: scan.id,
      secret_type: f.secretType,
      severity: f.severity,
      file_path: f.filePath,
      line_number: f.lineNumber,
      column_start: f.columnStart,
      raw_match: f.rawMatch,          // already redacted by scanner
      code_snippet: f.codeSnippet,
      pattern_name: f.patternName,
      description: f.description,
      remediation: f.remediation,
    }));

    const { error: findingsError } = await supabase
      .from('findings')
      .insert(findingsToInsert);

    if (findingsError) console.error('Failed to insert findings:', findingsError);
  }

  // 4. Update scan status + counts
  const { data: updatedScan } = await supabase
    .from('scans')
    .update({
      status: 'completed',
      total_findings: result.totalFindings,
      critical_count: result.criticalCount,
      high_count: result.highCount,
      medium_count: result.mediumCount,
      low_count: result.lowCount,
      scanned_files: result.scannedFiles,
      scanned_lines: result.scannedLines,
    })
    .eq('id', scan.id)
    .select()
    .single();

  res.status(201).json({
    scan: updatedScan,
    findings: result.findings,
    summary: {
      totalFindings: result.totalFindings,
      criticalCount: result.criticalCount,
      highCount: result.highCount,
      mediumCount: result.mediumCount,
      lowCount: result.lowCount,
      scannedFiles: result.scannedFiles,
      scannedLines: result.scannedLines,
    },
  });
}

// ── POST /scans/zip — Upload a .zip of a repo ─────────────────
scansRouter.post('/zip', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  const auth = req as AuthenticatedRequest;

  if (!req.file) {
    res.status(400).json({ error: 'No zip file uploaded. Use multipart/form-data with field name "file".' });
    return;
  }

  const title = (req.body.title as string | undefined)?.trim() || req.file.originalname.replace('.zip', '');

  try {
    const files = extractFilesFromZip(req.file.buffer);

    if (files.length === 0) {
      res.status(400).json({ error: 'No scannable text files found in the zip. Check that the archive contains source code.' });
      return;
    }

    await runAndPersistScan(
      auth.userId,
      title,
      { type: 'zip', repoName: title },
      files,
      res
    );
  } catch (err) {
    console.error('Zip scan error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to process zip file' });
  }
});

// ── POST /scans/github — Scan a GitHub repo by URL ───────────
const GithubScanSchema = z.object({
  repo_url: z.string().url().includes('github.com'),
  title: z.string().max(200).optional(),
  // Token is required — used to verify the caller owns or has write access to the repo.
  // Without it we have no way to enforce ownership.
  github_token: z.string().min(1, 'A GitHub personal access token is required to verify repo ownership.'),
});

scansRouter.post('/github', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const auth = req as AuthenticatedRequest;

  const parsed = GithubScanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    return;
  }

  const { repo_url, title, github_token } = parsed.data;
  const token = github_token; // no server-side fallback — user must provide their own token

  try {
    const { files, repoName, defaultBranch } = await fetchGitHubRepo(repo_url, token);

    if (files.length === 0) {
      res.status(400).json({ error: 'No scannable files found in repository.' });
      return;
    }

    await runAndPersistScan(
      auth.userId,
      title ?? repoName,
      { type: 'github', repoUrl: repo_url, repoName, branch: defaultBranch },
      files,
      res
    );
  } catch (err) {
    console.error('GitHub scan error:', err);
    res.status(err instanceof Error && err.message.includes('not found') ? 404 : 500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch GitHub repository',
    });
  }
});

// ── GET /scans — List all scans for the user ─────────────────
scansRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const auth = req as AuthenticatedRequest;
  const limit = Math.min(parseInt(req.query['limit'] as string ?? '20'), 100);
  const offset = parseInt(req.query['offset'] as string ?? '0');

  const { data, error, count } = await supabase
    .from('scans')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.json({ scans: data ?? [], total: count ?? 0, limit, offset });
});

// ── GET /scans/:id — Get scan + findings ─────────────────────
scansRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const auth = req as AuthenticatedRequest;
  const { id } = req.params;

  const { data: scan, error } = await supabase
    .from('scans')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (error || !scan) {
    res.status(404).json({ error: 'Scan not found' });
    return;
  }

  const { data: findings } = await supabase
    .from('findings')
    .select('*')
    .eq('scan_id', id)
    .order('severity', { ascending: true })
    .order('file_path', { ascending: true })
    .order('line_number', { ascending: true });

  res.json({ scan, findings: findings ?? [] });
});

// ── DELETE /scans/:id ─────────────────────────────────────────
scansRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const auth = req as AuthenticatedRequest;
  const { id } = req.params;

  const { error } = await supabase
    .from('scans')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId);

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(204).send();
});

// ── PATCH /scans/findings/:id/false-positive ─────────────────
scansRouter.patch('/findings/:id/false-positive', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const auth = req as AuthenticatedRequest;
  const { id } = req.params;
  const { is_false_positive } = req.body;

  const { data: finding } = await supabase.from('findings').select('scan_id').eq('id', id).single();
  if (!finding) { res.status(404).json({ error: 'Finding not found' }); return; }

  const { data: scan } = await supabase.from('scans').select('user_id').eq('id', finding.scan_id).single();
  if (!scan || scan.user_id !== auth.userId) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { data, error } = await supabase
    .from('findings')
    .update({ is_false_positive })
    .eq('id', id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json(data);
});
