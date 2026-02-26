export function SeverityBadge({ severity }: { severity: 'critical' | 'high' | 'medium' | 'low' }) {
  return (
    <span className={`severity-${severity} text-xs font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider`}>
      {severity}
    </span>
  );
}
