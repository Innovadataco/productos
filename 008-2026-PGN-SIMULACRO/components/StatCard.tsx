import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: LucideIcon;
}

function StatCard({ label, value, sub, trend = 'neutral', icon }: StatCardProps) {
  const TrendIcon = icon ?? (trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus);
  const trendColor =
    trend === 'up' ? 'text-success' : trend === 'down' ? 'text-danger' : 'text-ink-subtle';

  return (
    <div className="glass flex flex-col p-4 animate-fade-up">
      <div className="mb-3 flex items-center justify-between">
        <span className="section-title">{label}</span>
        <TrendIcon size={16} className={trendColor} />
      </div>
      <span className="text-display font-bold text-ink">{value}</span>
      {sub ? <span className="mt-1 text-footnote text-ink-subtle">{sub}</span> : null}
    </div>
  );
}

export default StatCard;
export { StatCard };
