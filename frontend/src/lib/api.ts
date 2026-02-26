import { createClient } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function getAuthHeader(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return `Bearer ${session.access_token}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      // Don't set Content-Type here — let caller set it (needed for multipart)
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export interface Scan {
  id: string;
  user_id: string;
  title: string;
  source_type: 'zip' | 'github';
  repo_url?: string;
  repo_name?: string;
  branch?: string;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  scanned_files: number;
  scanned_lines: number;
  created_at: string;
  updated_at: string;
}

export interface Finding {
  id: string;
  scan_id: string;
  secret_type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  file_path: string;
  line_number: number;
  column_start: number;
  raw_match: string;
  pattern_name: string;
  description: string;
  remediation: string;
  is_false_positive: boolean;
  created_at: string;
}

export interface ScanResult {
  scan: Scan;
  findings: Finding[];
  summary: {
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    scannedFiles: number;
    scannedLines: number;
  };
}

export const api = {
  scans: {
    scanGitHub: (data: { repo_url: string; title?: string; github_token?: string }) =>
      apiFetch<ScanResult>('/api/scans/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),

    scanZip: (file: File, title?: string) => {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      return apiFetch<ScanResult>('/api/scans/zip', { method: 'POST', body: formData });
    },

    list: (limit = 20, offset = 0) =>
      apiFetch<{ scans: Scan[]; total: number }>(`/api/scans?limit=${limit}&offset=${offset}`),

    get: (id: string) =>
      apiFetch<{ scan: Scan; findings: Finding[] }>(`/api/scans/${id}`),

    delete: (id: string) =>
      apiFetch<void>(`/api/scans/${id}`, { method: 'DELETE' }),
  },

  findings: {
    markFalsePositive: (id: string, isFp: boolean) =>
      apiFetch<Finding>(`/api/scans/findings/${id}/false-positive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_false_positive: isFp }),
      }),
  },
};
