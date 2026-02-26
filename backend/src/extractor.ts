import AdmZip from 'adm-zip';

// ── Constants ─────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 1_000_000; // 1MB per file
const MAX_FILES = 500;

// Extensions we skip (binary, media, compiled)
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.tiff',
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.avi', '.mov', '.mkv',
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z', '.jar', '.war',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.class', '.pyc', '.pyd', '.pyo', '.so', '.dylib', '.dll', '.exe', '.bin',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.sum',
]);

// Directory segments to skip entirely
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', 'dist', 'build', 'out', '__pycache__',
  '.next', '.nuxt', 'venv', '.venv', 'vendor', 'coverage', '.nyc_output',
  'target', 'Pods', '.gradle', '.idea', '.vscode',
]);

export interface ExtractedFile {
  filePath: string;   // relative path within repo
  content: string;    // utf-8 text content
  sizeBytes: number;
}

function shouldSkipPath(entryPath: string): boolean {
  const parts = entryPath.replace(/\\/g, '/').split('/');
  // Skip if any directory segment is in the skip list
  for (const part of parts.slice(0, -1)) {
    if (SKIP_DIRS.has(part)) return true;
    if (part.startsWith('.') && part !== '.env' && part !== '.env.example') return true;
  }
  const filename = parts[parts.length - 1];
  if (!filename || filename.startsWith('.DS_Store')) return true;

  const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';
  if (BINARY_EXTENSIONS.has(ext)) return true;

  return false;
}

/**
 * Extract text files from a zip buffer.
 * Returns files suitable for secret scanning.
 */
export function extractFilesFromZip(zipBuffer: Buffer): ExtractedFile[] {
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const files: ExtractedFile[] = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    const entryPath = entry.entryName.replace(/\\/g, '/');

    // Strip top-level repo folder (GitHub zips add reponame-main/ prefix)
    const pathParts = entryPath.split('/');
    const relativePath = pathParts.length > 1 ? pathParts.slice(1).join('/') : entryPath;

    if (!relativePath) continue;
    if (shouldSkipPath(relativePath)) continue;
    if (entry.header.size > MAX_FILE_SIZE_BYTES) continue;
    if (files.length >= MAX_FILES) break;

    try {
      const content = entry.getData().toString('utf-8');
      // Skip files that look binary (high ratio of non-printable chars)
      const nonPrintable = (content.match(/[\x00-\x08\x0E-\x1F\x7F]/g) ?? []).length;
      if (nonPrintable / content.length > 0.02) continue;

      files.push({
        filePath: relativePath,
        content,
        sizeBytes: entry.header.size,
      });
    } catch {
      // Skip files that can't be decoded as utf-8
      continue;
    }
  }

  return files;
}

type GitHubRepoData = {
  default_branch: string;
  owner: { login: string };
  permissions?: { admin: boolean; push: boolean; pull: boolean };
};

type GitHubUserData = {
  login: string;
};

/**
 * Verify the token owner has write/admin access to the repo.
 * Throws a clear error if ownership cannot be confirmed.
 */
async function verifyRepoOwnership(
  owner: string,
  repo: string,
  githubToken: string,
  repoData: GitHubRepoData
): Promise<void> {
  // Step 1: Get the authenticated user's login
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!userRes.ok) throw new Error('Could not verify your GitHub identity. Check that your token is valid.');

  const userData = await userRes.json() as GitHubUserData;
  const authenticatedUser = userData.login.toLowerCase();
  const repoOwner = repoData.owner.login.toLowerCase();

  // Step 2: Check if they own the repo directly, or have admin/write permissions
  // (covers org repos where they have explicit access)
  const hasOwnership = authenticatedUser === repoOwner;
  const hasWriteAccess = repoData.permissions?.admin || repoData.permissions?.push;

  if (!hasOwnership && !hasWriteAccess) {
    throw new Error(
      `Access denied: You can only scan repositories you own or have write access to. ` +
      `"${owner}/${repo}" is owned by "${repoData.owner.login}", not "${userData.login}".`
    );
  }
}

/**
 * Fetch a GitHub repo as a zip and extract its files.
 * Requires a GitHub token — used to verify the caller owns or has write access to the repo.
 */
export async function fetchGitHubRepo(
  repoUrl: string,
  githubToken: string,  // now required, not optional
): Promise<{ files: ExtractedFile[]; repoName: string; defaultBranch: string }> {
  // Parse owner/repo from various URL formats
  const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/);
  if (!match) throw new Error('Invalid GitHub URL. Expected format: https://github.com/owner/repo');

  const [, owner, repo] = match;
  const repoName = `${owner}/${repo}`;

  const apiHeaders: Record<string, string> = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Fetch repo metadata (includes permissions when authenticated)
  const repoApiRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: apiHeaders,
  });

  if (!repoApiRes.ok) {
    if (repoApiRes.status === 404) throw new Error(`Repository "${repoName}" not found. Make sure the URL is correct and your token has repo access.`);
    if (repoApiRes.status === 401) throw new Error('Invalid GitHub token. Generate a new one at github.com/settings/tokens.');
    if (repoApiRes.status === 403) throw new Error('GitHub API rate limit exceeded or token lacks required permissions.');
    throw new Error(`GitHub API error: ${repoApiRes.status} ${repoApiRes.statusText}`);
  }

  const repoData = await repoApiRes.json() as GitHubRepoData;

  // ── Ownership check ───────────────────────────────────────────
  await verifyRepoOwnership(owner, repo, githubToken, repoData);

  const defaultBranch = repoData.default_branch ?? 'main';

  // Download zip archive
  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${defaultBranch}`;
  const zipRes = await fetch(zipUrl, { headers: apiHeaders });

  if (!zipRes.ok) throw new Error(`Failed to download repository archive: ${zipRes.status}`);

  const zipBuffer = Buffer.from(await zipRes.arrayBuffer());
  const files = extractFilesFromZip(zipBuffer);

  return { files, repoName, defaultBranch };
}
