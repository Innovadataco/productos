interface ScoreRingProps {
  score: number;
  total: number;
  size?: number;
}

export default function ScoreRing({ score, total, size = 120 }: ScoreRingProps) {
  const porcentaje = total > 0 ? score / total : 0;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - porcentaje * circumference;
  const color = porcentaje >= 0.7 ? '#10b981' : porcentaje >= 0.65 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e2e8f0" strokeWidth={stroke} fill="transparent" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-bold text-slate-900">{Math.round(porcentaje * 100)}</span>
        <span className="text-xs text-slate-500">de {total}</span>
      </div>
    </div>
  );
}
