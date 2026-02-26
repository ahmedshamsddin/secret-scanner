'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, LogOut, ScanLine, Clock, Home } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return; }
      setUserEmail(user.email ?? '');
    });
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#111118] border-r border-[#1e1e2e] flex flex-col fixed h-full z-10">
        {/* Logo */}
        <div className="p-5 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded border border-[#00ff9d] flex items-center justify-center">
              <Shield size={14} className="text-[#00ff9d]" />
            </div>
            <span className="font-mono text-[#00ff9d] text-xs font-bold tracking-widest">SECRETSCAN</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7280] hover:text-white hover:bg-[#1e1e2e] transition-colors text-sm group">
            <Home size={16} className="group-hover:text-[#00ff9d] transition-colors" />
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/scan" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7280] hover:text-white hover:bg-[#1e1e2e] transition-colors text-sm group">
            <ScanLine size={16} className="group-hover:text-[#00ff9d] transition-colors" />
            <span>New Scan</span>
          </Link>
          <Link href="/dashboard/history" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#6b7280] hover:text-white hover:bg-[#1e1e2e] transition-colors text-sm group">
            <Clock size={16} className="group-hover:text-[#00ff9d] transition-colors" />
            <span>History</span>
          </Link>
        </nav>

        {/* User info */}
        <div className="p-4 border-t border-[#1e1e2e]">
          <div className="text-[#6b7280] text-xs font-mono mb-3 truncate">{userEmail}</div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-[#6b7280] hover:text-[#ff4444] text-sm transition-colors w-full"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  );
}
