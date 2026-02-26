'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Scan } from '@/lib/api';
import { SeverityBadge } from '@/components/SeverityBadge';
import { ScanLine, Trash2, ChevronRight, Search } from 'lucide-react';

export default function HistoryPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    api.scans.list(PAGE_SIZE, page * PAGE_SIZE).then(({ scans, total }) => {
      setScans(scans);
      setTotal(total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [page]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (!confirm('Delete this scan?')) return;
    await api.scans.delete(id);
    setScans(prev => prev.filter(s => s.id !== id));
    setTotal(t => t - 1);
  };

  const filtered = scans.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Scan History</h1>
          <p className="text-[#6b7280] text-sm">{total} scan{total !== 1 ? 's' : ''} total</p>
        </div>
        <Link
          href="/dashboard/scan"
          className="flex items-center gap-2 bg-[#00ff9d] text-[#0a0a0f] font-bold px-5 py-2.5 rounded-lg hover:bg-[#00cc7d] transition-colors font-mono text-sm"
        >
          <ScanLine size={16} />
          NEW SCAN
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter by title..."
          className="w-full bg-[#111118] border border-[#1e1e2e] rounded-lg pl-9 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#00ff9d] transition-all"
        />
      </div>

      {/* Table */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-[#1e1e2e] text-xs font-mono text-[#6b7280] uppercase tracking-wider">
          <span>Title</span>
          <span>Severity</span>
          <span className="text-right">Findings</span>
          <span className="text-right">When</span>
          <span></span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[#6b7280] text-sm font-mono animate-pulse">LOADING...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <p className="text-[#6b7280] text-sm">
              {search ? 'No scans match your search.' : 'No scans yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1e1e2e]">
            {filtered.map(scan => (
              <Link
                key={scan.id}
                href={`/dashboard/scan/${scan.id}`}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-4 hover:bg-[#0a0a0f] transition-colors group scan-card"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    scan.critical_count > 0 ? 'bg-[#ff4444]' :
                    scan.high_count > 0 ? 'bg-[#ff8c00]' :
                    scan.total_findings > 0 ? 'bg-[#ffd700]' : 'bg-[#4caf50]'
                  }`} />
                  <span className="text-white text-sm truncate">{scan.title}</span>
                </div>

                <div className="flex gap-1.5">
                  {scan.critical_count > 0 && <SeverityBadge severity="critical" />}
                  {scan.high_count > 0 && <SeverityBadge severity="high" />}
                  {scan.medium_count > 0 && <SeverityBadge severity="medium" />}
                  {scan.low_count > 0 && <SeverityBadge severity="low" />}
                  {scan.total_findings === 0 && <span className="text-[#4caf50] text-xs font-mono">clean</span>}
                </div>

                <span className="text-[#6b7280] text-xs font-mono text-right">
                  {scan.total_findings} finding{scan.total_findings !== 1 ? 's' : ''}
                </span>

                <span className="text-[#6b7280] text-xs font-mono text-right whitespace-nowrap">
                  {timeAgo(scan.created_at)}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={e => handleDelete(e, scan.id)}
                    className="text-[#1e1e2e] hover:text-[#ff4444] transition-colors p-1"
                  >
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={14} className="text-[#1e1e2e] group-hover:text-[#00ff9d] transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[#6b7280] text-xs font-mono">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs font-mono border border-[#1e1e2e] rounded text-[#6b7280] hover:border-[#00ff9d] hover:text-white disabled:opacity-30 transition-all"
            >
              ← PREV
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * PAGE_SIZE >= total}
              className="px-3 py-1.5 text-xs font-mono border border-[#1e1e2e] rounded text-[#6b7280] hover:border-[#00ff9d] hover:text-white disabled:opacity-30 transition-all"
            >
              NEXT →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
