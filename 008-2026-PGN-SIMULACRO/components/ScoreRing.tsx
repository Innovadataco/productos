import { useId } from 'react';

interface ScoreRingProps {
  score: number;
  total: number;
  size?: number;
}

export default function ScoreRing({ score, total, size = 120 }: ScoreRingProps) {
  const porcentaje = total > 0 ? score / total : 0;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - porcentaje * circumference;
  const gradientId = useId();

  const textColor =
    porcentaje >= 0.7 ? 'text-success' : porcentaje >= 0.65 ? 'text-warning' : 'text-danger';

  return (
    <div
      className="relative flex items-center justify-center animate-scale-in"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90 transform">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#5eead7" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-spring"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-headline font-bold ${textColor}`}>
          {Math.round(porcentaje * 100)}
        </span>
        <span className="text-footnote text-ink-subtle">de {total}</span>
      </div>
    </div>
  );
}
