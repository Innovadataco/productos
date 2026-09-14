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
    trend === 'up' ? 'text-ios-green' : trend === 'down' ? 'text-ios-red' : 'text-ios-gray-3';

  return (
    <div className="ios-card flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-ios-footnote font-medium uppercase tracking-wide text-ios-label-secondary">
          {label}
        </span>
        <TrendIcon size={16} className={trendColor} />
      </div>
      <span className="text-ios-title-1 text-ios-label">{value}</span>
      {sub ? <span className="mt-1 text-ios-caption-2 text-ios-label-tertiary">{sub}</span> : null}
    </div>
  );
}

export default StatCard;
export { StatCard };
