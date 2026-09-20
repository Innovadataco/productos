"use client";

interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  animated?: boolean;
}

export default function Logo({ width = 120, height = 132, className = "", animated = true }: LogoProps) {
  return (
    <div className={animated ? `logo-anim ${className}` : className} style={{ width, height }}>
      <svg viewBox="0 0 100 110" width="100%" height="100%">
        <defs>
          <linearGradient id="sg1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a6f" />
            <stop offset="100%" stopColor="#1a365d" />
          </linearGradient>
          <linearGradient id="sgb1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1a365d" />
          </linearGradient>
          <linearGradient id="sgg1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <clipPath id="sc1">
            <path d="M50 6 L90 21 V56 C90 80 72 97 50 106 C28 97 10 80 10 56 V21 L50 6Z" />
          </clipPath>
        </defs>
        <path
          fill="rgba(59,130,246,0.15)"
          stroke="url(#sgb1)"
          strokeWidth="2.5"
          d="M50 6 L90 21 V56 C90 80 72 97 50 106 C28 97 10 80 10 56 V21 L50 6Z"
        />
        <g clipPath="url(#sc1)">
          <rect x="30" y="64" width="9" height="22" rx="2.5" fill="url(#sgb1)" />
          <rect x="44" y="52" width="9" height="34" rx="2.5" fill="url(#sgb1)" />
          <rect x="58" y="58" width="9" height="28" rx="2.5" fill="url(#sgb1)" />
          <rect x="72" y="36" width="9" height="50" rx="2.5" fill="url(#sgb1)" />
          <path
            d="M25 62 L39.5 51.5 L53.5 57.5 L76 34"
            stroke="url(#sgg1)"
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="25" cy="62" r="4" fill="#3b82f6" />
          <circle cx="39.5" cy="51.5" r="4" fill="#60a5fa" />
          <circle cx="53.5" cy="57.5" r="4" fill="#fbbf24" />
          <circle cx="76" cy="34" r="5" fill="#f59e0b" />
        </g>
      </svg>
    </div>
  );
}
