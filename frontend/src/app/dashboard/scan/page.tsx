'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ScanResult, Finding } from '@/lib/api';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatCard } from '@/components/StatCard';
import {
  Github, Upload, ScanLine, CheckCircle,
  ChevronDown, ChevronUp, ExternalLink,
  FileArchive, AlertTriangle
} from 'lucide-react';

type Tab = 'github' | 'zip';

// ── Finding card ──────────────────────────────────────────────
function FindingRow({ finding, index }: { finding: Finding; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hover:bg-[#0a0a0f] transition-colors">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <div className="flex items-center gap-4 min-w-0">
          <SeverityBadge severity={finding.severity} />
          <div className="min-w-0">
            <div className="text-white text-sm font-medium">{finding.secret_type}</div>
            <div className="text-[#6b7280] text-xs font-mono mt-0.5 truncate">
              {finding.file_path}:{finding.line_number}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <code className="text-[#ffd700] text-xs font-mono bg-[#0a0a0f] px-2 py-1 rounded border border-[#1e1e2e]">
            {finding.raw_match}
          </code>
          {open ? <ChevronUp size={14} className="text-[#6b7280]" /> : <ChevronDown size={14} className="text-[#6b7280]" />}
        </div>
      </button>
      {open && (
        <div className="px-6 pb-4">
          <div className="bg-[#0a0a0f] rounded-lg p-4 space-y-3 border border-[#1e1e2e]">
            <div>
              <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Description</div>
              <p className="text-[#c9d1d9] text-sm">{finding.description}</p>
            </div>
            <div>
              <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Remediation</div>
              <p className="text-[#00ff9d] text-sm">{finding.remediation}</p>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">File</div>
                <code className="text-[#c9d1d9] text-xs">{finding.file_path}</code>
              </div>
              <div>
                <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Line</div>
                <code className="text-[#c9d1d9] text-xs">{finding.line_number}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Results panel ─────────────────────────────────────────────
function ScanResults({ result }: { result: ScanResult }) {
  const router = useRouter();

  // Group findings by file
  const byFile = result.findings.reduce<Record<string, Finding[]>>((acc, f) => {
    (acc[f.file_path] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Files" value={result.summary.scannedFiles} color="#6b7280" />
        <StatCard label="Total" value={result.summary.totalFindings} color="#e2e8f0" />
        <StatCard label="Critical" value={result.summary.criticalCount} color="#ff4444" />
        <StatCard label="High" value={result.summary.highCount} color="#ff8c00" />
        <StatCard label="Medium" value={result.summary.mediumCount} color="#ffd700" />
      </div>

      {/* Clean result */}
      {result.findings.length === 0 ? (
        <div className="bg-[rgba(0,255,157,0.05)] border border-[rgba(0,255,157,0.2)] rounded-xl p-6 flex items-center gap-4">
          <CheckCircle size={24} className="text-[#00ff9d] flex-shrink-0" />
          <div>
            <div className="text-white font-semibold mb-1">No secrets detected</div>
            <div className="text-[#6b7280] text-sm">
              Scanned {result.summary.scannedFiles} files ({result.summary.scannedLines.toLocaleString()} lines). Clean!
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-[rgba(255,68,68,0.05)] border border-[rgba(255,68,68,0.2)] rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle size={18} className="text-[#ff4444] flex-shrink-0" />
            <div className="text-sm text-[#c9d1d9]">
              Found <span className="text-white font-semibold">{result.findings.length} secret{result.findings.length !== 1 ? 's' : ''}</span> across{' '}
              <span className="text-white font-semibold">{Object.keys(byFile).length} file{Object.keys(byFile).length !== 1 ? 's' : ''}</span> in{' '}
              {result.summary.scannedFiles} scanned. All values are redacted below — only types and locations are shown.
            </div>
          </div>

          {/* Grouped by file */}
          <div className="space-y-3">
            {Object.entries(byFile).map(([filePath, findings]) => (
              <div key={filePath} className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
                <div className="px-6 py-3 border-b border-[#1e1e2e] flex items-center justify-between bg-[#0d0d16]">
                  <code className="text-[#00ff9d] text-xs font-mono">{filePath}</code>
                  <span className="text-[#6b7280] text-xs font-mono">{findings.length} finding{findings.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-[#1e1e2e]">
                  {findings.map((f, i) => <FindingRow key={f.id ?? i} finding={f} index={i} />)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        onClick={() => router.push(`/dashboard/scan/${result.scan.id}`)}
        className="flex items-center gap-2 text-[#6b7280] hover:text-white text-sm transition-colors"
      >
        <ExternalLink size={14} />
        Open full report
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function NewScanPage() {
  const [tab, setTab] = useState<Tab>('github');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  // GitHub fields
  const [repoUrl, setRepoUrl] = useState('');

  // Zip fields
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipTitle, setZipTitle] = useState('');
  const [dragging, setDragging] = useState(false);

  const resetResult = () => { setResult(null); setError(''); };

  const handleGitHubScan = async () => {
    if (!repoUrl.trim()) { setError('Enter a GitHub repository URL.'); return; }
    setScanning(true); setError(''); setResult(null);
    try {
      const res = await api.scans.scanGitHub({
        repo_url: repoUrl.trim(),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const handleZipScan = async () => {
    if (!zipFile) { setError('Upload a .zip file first.'); return; }
    setScanning(true); setError(''); setResult(null);
    try {
      const res = await api.scans.scanZip(zipFile, zipTitle.trim() || undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith('.zip')) { setZipFile(file); setZipTitle(file.name.replace('.zip', '')); resetResult(); }
    else setError('Only .zip files are supported.');
  }, []);

  return (
    <div className="p-8 animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">New Scan</h1>
        <p className="text-[#6b7280] text-sm">Scan an entire repository for leaked secrets across all files</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#111118] border border-[#1e1e2e] rounded-lg p-1 mb-6 w-fit">
        {([['github', Github, 'GitHub URL'], ['zip', FileArchive, 'Upload ZIP']] as const).map(([t, Icon, label]) => (
          <button
            key={t}
            onClick={() => { setTab(t); resetResult(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-all ${
              tab === t
                ? 'bg-[#00ff9d] text-[#0a0a0f] font-bold'
                : 'text-[#6b7280] hover:text-white'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* ── GitHub tab ── */}
      {tab === 'github' && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-mono text-[#6b7280] mb-2 uppercase tracking-wider">Repository URL</label>
            <input
              value={repoUrl}
              onChange={e => { setRepoUrl(e.target.value); resetResult(); }}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-[#111118] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff9d] transition-all font-mono"
            />
          </div>

          <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-3 text-xs text-[#6b7280]">
            <span className="text-white font-mono">Auth:</span> GitHub ownership is verified server-side using the token configured in backend/MCP environment.
          </div>

          {error && (
            <div className="bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.3)] text-[#ff4444] text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleGitHubScan}
            disabled={scanning || !repoUrl.trim()}
            className="flex items-center gap-2 bg-[#00ff9d] text-[#0a0a0f] font-bold px-6 py-3 rounded-lg hover:bg-[#00cc7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
          >
            <ScanLine size={16} />
            {scanning ? 'SCANNING REPO...' : 'SCAN REPOSITORY'}
          </button>
        </div>
      )}

      {/* ── ZIP tab ── */}
      {tab === 'zip' && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-mono text-[#6b7280] mb-2 uppercase tracking-wider">Scan title</label>
            <input
              value={zipTitle}
              onChange={e => setZipTitle(e.target.value)}
              placeholder="my-repo"
              className="w-full bg-[#111118] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff9d] transition-all"
            />
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
              dragging ? 'border-[#00ff9d] bg-[rgba(0,255,157,0.05)]' :
              zipFile ? 'border-[rgba(0,255,157,0.4)] bg-[rgba(0,255,157,0.03)]' :
              'border-[#1e1e2e] hover:border-[#2a2a3e]'
            }`}
            onClick={() => document.getElementById('zip-input')?.click()}
          >
            <input
              id="zip-input"
              type="file"
              accept=".zip"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) { setZipFile(file); setZipTitle(file.name.replace('.zip', '')); resetResult(); }
              }}
            />
            {zipFile ? (
              <div>
                <FileArchive size={32} className="text-[#00ff9d] mx-auto mb-3" />
                <div className="text-white font-medium text-sm">{zipFile.name}</div>
                <div className="text-[#6b7280] text-xs mt-1">{(zipFile.size / 1024 / 1024).toFixed(1)} MB — click to change</div>
              </div>
            ) : (
              <div>
                <Upload size={32} className="text-[#2a2a3e] mx-auto mb-3" />
                <div className="text-white text-sm font-medium mb-1">Drop your repo .zip here</div>
                <div className="text-[#6b7280] text-xs">or click to browse · max 50MB</div>
              </div>
            )}
          </div>

          <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-3 text-xs text-[#6b7280]">
            <span className="text-white font-mono">Tip:</span> zip your repo from terminal:{' '}
            <code className="text-[#00ff9d] font-mono">zip -r myrepo.zip ./myrepo --exclude "*/node_modules/*" "*/.git/*"</code>
          </div>

          {error && (
            <div className="bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.3)] text-[#ff4444] text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <button
            onClick={handleZipScan}
            disabled={scanning || !zipFile}
            className="flex items-center gap-2 bg-[#00ff9d] text-[#0a0a0f] font-bold px-6 py-3 rounded-lg hover:bg-[#00cc7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
          >
            <ScanLine size={16} />
            {scanning ? 'SCANNING REPO...' : 'SCAN REPOSITORY'}
          </button>
        </div>
      )}

      {/* Scanning indicator */}
      {scanning && (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-6 mb-6 scan-overlay">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse" />
            <div className="text-[#00ff9d] text-sm font-mono">
              {tab === 'github' ? 'Fetching repo and scanning files...' : 'Extracting and scanning files...'}
            </div>
          </div>
          <div className="text-[#6b7280] text-xs mt-2 font-mono">This may take 10–30 seconds for large repos.</div>
        </div>
      )}

      {/* Results */}
      {result && <ScanResults result={result} />}
    </div>
  );
}
