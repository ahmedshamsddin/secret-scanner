'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, Scan, Finding } from '@/lib/api';
import { SeverityBadge } from '@/components/SeverityBadge';
import { StatCard } from '@/components/StatCard';
import { ArrowLeft, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Trash2, Flag } from 'lucide-react';

export default function ScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params['id'] as string;

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    api.scans.get(id).then(({ scan, findings }) => {
      setScan(scan);
      setFindings(findings);
      setLoading(false);
    }).catch(() => { router.replace('/dashboard'); });
  }, [id]);

  const toggleFinding = (findingId: string) => {
    setExpandedFindings(prev => {
      const next = new Set(prev);
      if (next.has(findingId)) next.delete(findingId); else next.add(findingId);
      return next;
    });
  };

  const handleFalsePositive = async (finding: Finding) => {
    const updated = await api.findings.markFalsePositive(finding.id, !finding.is_false_positive);
    setFindings(prev => prev.map(f => f.id === finding.id ? { ...f, is_false_positive: updated.is_false_positive } : f));
  };

  const handleDelete = async () => {
    if (!confirm('Delete this scan and all its findings?')) return;
    await api.scans.delete(id);
    router.replace('/dashboard/history');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-[#6b7280] font-mono text-sm animate-pulse">LOADING SCAN...</div>
      </div>
    );
  }

  if (!scan) return null;

  const activeFindings = findings.filter(f => !f.is_false_positive);

  return (
    <div className="p-8 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="mt-1 text-[#6b7280] hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Scan Report</div>
            <h1 className="text-2xl font-bold text-white mb-1">{scan.title}</h1>
            <div className="flex items-center gap-3 text-xs font-mono text-[#6b7280]">
              <span>{new Date(scan.created_at).toLocaleString()}</span>
              <span>· ID: {scan.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-2 text-[#6b7280] hover:text-[#ff4444] transition-colors text-sm"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <StatCard label="Total" value={scan.total_findings} color="#e2e8f0" />
        <StatCard label="Critical" value={scan.critical_count} color="#ff4444" />
        <StatCard label="High" value={scan.high_count} color="#ff8c00" />
        <StatCard label="Medium" value={scan.medium_count} color="#ffd700" />
        <StatCard label="Low" value={scan.low_count} color="#4caf50" />
      </div>

      {/* Status banner */}
      {activeFindings.length === 0 ? (
        <div className="bg-[rgba(0,255,157,0.05)] border border-[rgba(0,255,157,0.2)] rounded-xl p-5 flex items-center gap-4 mb-6">
          <CheckCircle size={22} className="text-[#00ff9d]" />
          <div>
            <div className="text-white font-semibold text-sm mb-0.5">
              {findings.length === 0 ? 'No secrets detected' : 'All findings marked as false positives'}
            </div>
            <div className="text-[#6b7280] text-xs">This scan appears clean.</div>
          </div>
        </div>
      ) : (
        <div className="bg-[rgba(255,68,68,0.05)] border border-[rgba(255,68,68,0.2)] rounded-xl p-5 flex items-center gap-4 mb-6">
          <AlertCircle size={22} className="text-[#ff4444]" />
          <div>
            <div className="text-white font-semibold text-sm mb-0.5">
              {activeFindings.length} active finding{activeFindings.length !== 1 ? 's' : ''} require attention
            </div>
            <div className="text-[#6b7280] text-xs">Review and remediate the secrets listed below.</div>
          </div>
        </div>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-[#1e1e2e]">
            <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">Findings</h2>
          </div>
          <div className="divide-y divide-[#1e1e2e]">
            {findings.map(finding => (
              <div key={finding.id} className={`hover:bg-[#0a0a0f] transition-colors ${finding.is_false_positive ? 'opacity-40' : ''}`}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFinding(finding.id)}
                    className="flex-1 flex items-center justify-between px-6 py-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <SeverityBadge severity={finding.severity} />
                      <div>
                        <div className="text-white text-sm font-medium">
                          {finding.secret_type}
                          {finding.is_false_positive && (
                            <span className="ml-2 text-xs text-[#6b7280] font-normal">[false positive]</span>
                          )}
                        </div>
                        <div className="text-[#6b7280] text-xs font-mono mt-0.5">Line {finding.line_number}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <code className="text-[#ffd700] text-xs font-mono bg-[#0a0a0f] px-2 py-1 rounded">
                        {finding.raw_match}
                      </code>
                      {expandedFindings.has(finding.id) ? (
                        <ChevronUp size={14} className="text-[#6b7280]" />
                      ) : (
                        <ChevronDown size={14} className="text-[#6b7280]" />
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => handleFalsePositive(finding)}
                    className="px-4 py-4 text-[#6b7280] hover:text-[#ffd700] transition-colors"
                    title={finding.is_false_positive ? 'Unmark false positive' : 'Mark as false positive'}
                  >
                    <Flag size={14} />
                  </button>
                </div>
                {expandedFindings.has(finding.id) && (
                  <div className="px-6 pb-4 animate-slide-up">
                    <div className="bg-[#0a0a0f] rounded-lg p-4 space-y-3 border border-[#1e1e2e]">
                      <div>
                        <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Description</div>
                        <p className="text-[#c9d1d9] text-sm">{finding.description}</p>
                      </div>
                      <div>
                        <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Remediation</div>
                        <p className="text-[#00ff9d] text-sm">{finding.remediation}</p>
                      </div>
                      <div>
                        <div className="text-xs font-mono text-[#6b7280] uppercase tracking-wider mb-1">Pattern</div>
                        <code className="text-[#6b7280] text-xs">{finding.pattern_name}</code>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source code toggle */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <button
          onClick={() => setShowCode(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-[#0a0a0f] transition-colors"
        >
          <span className="text-sm font-semibold text-white font-mono uppercase tracking-wider">Source Code</span>
          {showCode ? <ChevronUp size={14} className="text-[#6b7280]" /> : <ChevronDown size={14} className="text-[#6b7280]" />}
        </button>
        {showCode && (
          <div className="border-t border-[#1e1e2e]">
            {activeFindings.length === 0 ? (
              <div className="p-4 text-xs text-[#6b7280] font-mono">No active findings to show.</div>
            ) : (
              <pre className="code-area w-full p-4 overflow-x-auto text-xs max-h-96 overflow-y-auto rounded-none">
                {activeFindings.map((finding) => `# ${finding.file_path}:${finding.line_number}\n${finding.code_snippet ?? '[snippet unavailable]'}\n`).join('\n')}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
