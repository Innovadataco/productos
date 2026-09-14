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

  const color = porcentaje >= 0.7 ? '#34C759' : porcentaje >= 0.65 ? '#FF9500' : '#FF3B30';
  const trackColor = '#E5E5EA';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="transparent"
        />
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
          className="transition-all duration-700 ease-ios"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-ios-title-1 text-ios-label">{Math.round(porcentaje * 100)}</span>
        <span className="text-ios-footnote text-ios-label-secondary">de {total}</span>
      </div>
    </div>
  );
}
