import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { readFileSync } from 'fs';

const API_BASE_URL = process.env.SECRET_SCANNER_API_URL ?? 'http://localhost:4000';
const API_TOKEN = process.env.SECRET_SCANNER_API_TOKEN ?? '';
const MCP_GITHUB_TOKEN = process.env.SECRET_SCANNER_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? '';

// ── API Client ────────────────────────────────────────────────
async function apiRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
  contentType = 'application/json'
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${API_TOKEN}`,
  };
  if (contentType === 'application/json') headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (contentType === 'application/json' ? JSON.stringify(body) : body as BodyInit) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }

  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

type FindingSummary = {
  secretType: string;
  severity: string;
  filePath: string;
  lineNumber: number;
  rawMatch: string;
  remediation: string;
};

type ScanApiResult = {
  scan: Record<string, unknown>;
  findings: FindingSummary[];
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    scannedFiles: number;
    scannedLines: number;
  };
};

function formatFindingsText(result: ScanApiResult): string {
  const { summary, findings } = result;
  const summaryLine = `Scan complete — ${summary.scannedFiles} files, ${summary.scannedLines} lines scanned. Found ${summary.totalFindings} secret(s): ${summary.criticalCount} critical, ${summary.highCount} high, ${summary.mediumCount} medium, ${summary.lowCount} low.`;

  if (findings.length === 0) return `${summaryLine}\n\n✅ No secrets detected.`;

  const findingLines = findings.map(f =>
    `[${f.severity.toUpperCase()}] ${f.filePath}:${f.lineNumber} — ${f.secretType}\n  Match: ${f.rawMatch}\n  Fix: ${f.remediation}`
  ).join('\n\n');

  return `${summaryLine}\n\n${findingLines}`;
}

// ── MCP Server ────────────────────────────────────────────────
const server = new McpServer({
  name: 'secret-scanner-mcp-server',
  version: '2.0.0',
});

// ── Tool: scan GitHub repo by URL ─────────────────────────────
server.registerTool(
  'scanner_scan_github',
  {
    title: 'Scan GitHub Repository for Secrets',
    description: `Scan a GitHub repository you own for leaked secrets, API keys, tokens, and credentials.

A GitHub personal access token is used to verify you own or have write access to the repository — this prevents scanning repos you don't have permission to access.

Fetches the repo via GitHub API, extracts all text files (skipping node_modules, .git, binaries, etc.), and runs 20+ detection patterns across every file.

Detected secret types include: AWS keys, GitHub tokens, OpenAI API keys, Stripe keys, Slack tokens, Google API keys, JWT tokens, PEM private keys, and more.

Args:
  - repo_url (string): Full GitHub URL, e.g. "https://github.com/owner/repo"
  - github_token (string, optional): GitHub personal access token override. If omitted, the MCP server uses SECRET_SCANNER_GITHUB_TOKEN / GITHUB_TOKEN from its environment.
  - title (string, optional): Label for this scan. Defaults to "owner/repo"

Returns: Scan summary + list of findings. All secret values are REDACTED — only file path, line number, secret type, and remediation are returned.

Errors:
  - "Access denied" → the token user doesn't own or have write access to the repo
  - "Invalid GitHub token" → token is expired or malformed
  - "Repository not found" → wrong URL or token lacks repo scope`,
    inputSchema: z.object({
      repo_url: z.string().url().describe('GitHub repository URL, e.g. https://github.com/owner/repo'),
      github_token: z.string().optional().describe('Optional GitHub personal access token override. If omitted, uses SECRET_SCANNER_GITHUB_TOKEN/GITHUB_TOKEN configured on MCP server.'),
      title: z.string().max(200).optional().describe('Label for this scan (defaults to owner/repo)'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async ({ repo_url, github_token, title }) => {
    try {
      const token = github_token?.trim() || MCP_GITHUB_TOKEN;
      if (!token) {
        throw new Error('GitHub token missing. Configure SECRET_SCANNER_GITHUB_TOKEN on the MCP server or pass github_token explicitly.');
      }

      const result = await apiRequest<ScanApiResult>('/api/scans/github', 'POST', {
        repo_url,
        github_token: token,
        title,
      });

      return {
        content: [{ type: 'text', text: formatFindingsText(result) }],
        structuredContent: {
          scan_id: result.scan['id'],
          title: result.scan['title'],
          summary: result.summary,
          findings: result.findings,
        },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error scanning repo: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// ── Tool: scan zip by base64 ──────────────────────────────────
server.registerTool(
  'scanner_scan_zip',
  {
    title: 'Scan a Zipped Repository for Secrets',
    description: `Scan a local repository zip file for leaked secrets. The zip is sent as a base64-encoded string.

Use this when you have a local repo that isn't on GitHub, or for private repos without a token.

Args:
  - zip_base64 (string): Base64-encoded .zip file contents
  - title (string, optional): Label for this scan

To get the base64 string in bash: base64 -i myrepo.zip

Returns: Scan summary + findings (all secret values are REDACTED).`,
    inputSchema: z.object({
      zip_base64: z.string().describe('Base64-encoded .zip file of the repository'),
      title: z.string().max(200).optional().describe('Label for this scan'),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ zip_base64, title }) => {
    try {
      const zipBuffer = Buffer.from(zip_base64, 'base64');

      // Use multipart form to send the zip
      const formData = new FormData();
      formData.append('file', new Blob([zipBuffer], { type: 'application/zip' }), 'repo.zip');
      if (title) formData.append('title', title);

      const res = await fetch(`${API_BASE_URL}/api/scans/zip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_TOKEN}` },
        body: formData,
      });

      if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
      const result = await res.json() as ScanApiResult;

      return {
        content: [{ type: 'text', text: formatFindingsText(result) }],
        structuredContent: {
          scan_id: result.scan['id'],
          title: result.scan['title'],
          summary: result.summary,
          findings: result.findings,
        },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error scanning zip: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// ── Tool: get scan history ────────────────────────────────────
server.registerTool(
  'scanner_get_history',
  {
    title: 'Get Scan History',
    description: `List previous scans with their summaries. Returns scan IDs, titles, finding counts, and timestamps.

Args:
  - limit (number, optional): Max results 1-100 (default 20)
  - offset (number, optional): Pagination offset (default 0)`,
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ limit, offset }) => {
    try {
      const result = await apiRequest<{ scans: Record<string, unknown>[]; total: number }>(
        `/api/scans?limit=${limit}&offset=${offset}`
      );

      const text = result.scans.length === 0 ? 'No scans found.' :
        result.scans.map(s =>
          `[${s['id']}] "${s['title']}" (${s['source_type']}) — ${s['total_findings']} findings — ${s['created_at']}`
        ).join('\n');

      return {
        content: [{ type: 'text', text: `${result.total} total scan(s):\n\n${text}` }],
        structuredContent: result,
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  }
);

// ── Tool: get findings for a scan ────────────────────────────
server.registerTool(
  'scanner_get_findings',
  {
    title: 'Get Findings for a Scan',
    description: `Get detailed findings for a specific scan. Use scanner_get_history first to get a scan ID.

Args:
  - scan_id (string): UUID of the scan`,
    inputSchema: z.object({
      scan_id: z.string().uuid().describe('UUID of the scan'),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ scan_id }) => {
    try {
      const result = await apiRequest<{ scan: Record<string, unknown>; findings: FindingSummary[] }>(
        `/api/scans/${scan_id}`
      );

      const text = result.findings.length === 0 ? '✅ No findings.' :
        result.findings.map(f =>
          `[${f.severity.toUpperCase()}] ${f.filePath}:${f.lineNumber} — ${f.secretType}\n  ${f.remediation}`
        ).join('\n\n');

      return {
        content: [{ type: 'text', text }],
        structuredContent: result,
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  }
);

// ── Tool: mark false positive ─────────────────────────────────
server.registerTool(
  'scanner_mark_false_positive',
  {
    title: 'Mark Finding as False Positive',
    description: `Mark or unmark a finding as a false positive (e.g. a test key or placeholder).

Args:
  - finding_id (string): UUID of the finding
  - is_false_positive (boolean): true to mark, false to unmark`,
    inputSchema: z.object({
      finding_id: z.string().uuid(),
      is_false_positive: z.boolean(),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ finding_id, is_false_positive }) => {
    try {
      await apiRequest(`/api/scans/findings/${finding_id}/false-positive`, 'PATCH', { is_false_positive });
      return {
        content: [{ type: 'text', text: `Finding ${finding_id} ${is_false_positive ? 'marked as' : 'unmarked from'} false positive.` }],
      };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }] };
    }
  }
);

// ── Transport ─────────────────────────────────────────────────
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const port = parseInt(process.env.PORT ?? '5000');
  app.listen(port, () => console.error(`🤖 MCP server on http://localhost:${port}/mcp`));
}

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🤖 Secret Scanner MCP server running via stdio');
}

const transport = process.env.TRANSPORT ?? 'stdio';
if (transport === 'http') {
  runHTTP().catch(err => { console.error(err); process.exit(1); });
} else {
  runStdio().catch(err => { console.error(err); process.exit(1); });
}
