'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Shield, Terminal, Zap } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden border-r border-[#1e1e2e]">
        {/* Background grid */}
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(0,255,157,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,157,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        
        {/* Glowing orb */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #00ff9d 0%, transparent 70%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-8 h-8 rounded border border-[#00ff9d] flex items-center justify-center">
              <Shield size={16} className="text-[#00ff9d]" />
            </div>
            <span className="font-mono text-[#00ff9d] text-sm font-semibold tracking-wider">SECRETSCAN</span>
          </div>

          <h1 className="text-5xl font-bold leading-tight mb-6 text-white">
            Find secrets<br />
            before attackers<br />
            <span className="text-[#00ff9d]">do.</span>
          </h1>
          <p className="text-[#6b7280] text-lg max-w-sm leading-relaxed">
            Scan code for leaked API keys, tokens, and credentials. Powered by 20+ detection patterns.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { icon: Shield, label: '20+ patterns', sub: 'Detection rules' },
            { icon: Zap, label: 'Instant scan', sub: 'Real-time results' },
            { icon: Terminal, label: 'MCP ready', sub: 'AI integration' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4">
              <Icon size={20} className="text-[#00ff9d] mb-2" />
              <div className="font-mono text-white text-sm font-semibold">{label}</div>
              <div className="text-[#6b7280] text-xs">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Shield size={20} className="text-[#00ff9d]" />
            <span className="font-mono text-[#00ff9d] text-sm font-semibold">SECRETSCAN</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-[#6b7280] text-sm mb-8">
            {mode === 'login' ? 'Sign in to your scanner dashboard' : 'Start scanning for leaked secrets'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[#6b7280] mb-2 uppercase tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#111118] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff9d] focus:shadow-[0_0_0_1px_#00ff9d] transition-all"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-[#6b7280] mb-2 uppercase tracking-wider">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#111118] border border-[#1e1e2e] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00ff9d] focus:shadow-[0_0_0_1px_#00ff9d] transition-all"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="bg-[rgba(255,68,68,0.1)] border border-[rgba(255,68,68,0.3)] text-[#ff4444] text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.3)] text-[#00ff9d] text-sm px-4 py-3 rounded-lg">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#00ff9d] text-[#0a0a0f] font-bold py-3 rounded-lg hover:bg-[#00cc7d] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono tracking-wider text-sm"
            >
              {loading ? 'LOADING...' : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }}
              className="text-[#6b7280] text-sm hover:text-[#00ff9d] transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
