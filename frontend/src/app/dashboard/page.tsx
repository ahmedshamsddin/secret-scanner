'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Scan } from '@/lib/api';
import { StatCard } from '@/components/StatCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { ScanLine, ChevronRight, AlertTriangle, Github, FileArchive } from 'lucide-react';

export default function DashboardPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.scans.list(10).then(({ scans }) => { setScans(scans); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const totals = scans.reduce(
    (acc, s) => ({ scans: acc.scans + 1, critical: acc.critical + s.critical_count, high: acc.high + s.high_count, findings: acc.findings + s.total_findings }),
    { scans: 0, critical: 0, high: 0, findings: 0 }
  );

  function timeAgo(d: string) {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-[#6b7280] text-sm">Overview of your secret scanning activity</p>
        </div>
        <Link href="/dashboard/scan" className="flex items-center gap-2 bg-[#00ff9d] text-[#0a0a0f] font-bold px-5 py-2.5 rounded-lg hover:bg-[#00cc7d] transition-colors font-mono text-sm">
          <ScanLine size={16} /> NEW SCAN
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Scans" value={totals.scans} color="#e2e8f0" />
        <StatCard label="Total Findings" value={totals.findings} color="#e2e8f0" />
        <StatCard label="Critical" value={totals.critical} color="#ff4444" />
        <StatCard label="High" value={totals.high} color="#ff8c00" />
      </div>

      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e2e]">
          <h2 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">Recent Scans</h2>
          <Link href="/dashboard/history" className="text-[#6b7280] text-xs hover:text-[#00ff9d] transition-colors">View all →</Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[#6b7280] text-sm font-mono animate-pulse">LOADING...</div>
          </div>
        ) : scans.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <AlertTriangle size={32} className="text-[#1e1e2e] mb-3" />
            <p className="text-[#6b7280] text-sm mb-4">No scans yet</p>
            <Link href="/dashboard/scan" className="text-[#00ff9d] text-sm hover:underline">Run your first scan →</Link>
          </div>
        ) : (
          <div className="divide-y divide-[#1e1e2e]">
            {scans.map(scan => (
              <Link key={scan.id} href={`/dashboard/scan/${scan.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[#0a0a0f] transition-colors group">
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    scan.critical_count > 0 ? 'bg-[#ff4444]' : scan.high_count > 0 ? 'bg-[#ff8c00]' :
                    scan.total_findings > 0 ? 'bg-[#ffd700]' : 'bg-[#4caf50]'
                  }`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {scan.source_type === 'github'
                        ? <Github size={12} className="text-[#6b7280] flex-shrink-0" />
                        : <FileArchive size={12} className="text-[#6b7280] flex-shrink-0" />}
                      <span className="text-white text-sm font-medium truncate">{scan.title}</span>
                    </div>
                    <div className="text-[#6b7280] text-xs font-mono">
                      {scan.scanned_files} files · {timeAgo(scan.created_at)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex gap-2">
                    {scan.critical_count > 0 && <SeverityBadge severity="critical" />}
                    {scan.high_count > 0 && <SeverityBadge severity="high" />}
                    {scan.medium_count > 0 && <SeverityBadge severity="medium" />}
                  </div>
                  <div className="text-[#6b7280] text-xs font-mono w-20 text-right">
                    {scan.total_findings} finding{scan.total_findings !== 1 ? 's' : ''}
                  </div>
                  <ChevronRight size={14} className="text-[#1e1e2e] group-hover:text-[#00ff9d] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
