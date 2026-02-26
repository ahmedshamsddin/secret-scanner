interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

export function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4">
      <div className="text-3xl font-mono font-bold mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-[#6b7280] text-xs font-mono uppercase tracking-wider">{label}</div>
    </div>
  );
}
