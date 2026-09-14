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
    trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <TrendIcon size={14} className={trendColor} />
      </div>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {sub ? <span className="mt-1 text-[10px] text-slate-400">{sub}</span> : null}
    </div>
  );
}

export default StatCard;
export { StatCard };
