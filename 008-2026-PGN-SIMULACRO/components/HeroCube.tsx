'use client';

import { BookOpen, Scale, FileText, ShieldAlert, Monitor, Landmark } from 'lucide-react';

const faces = [
  { icon: BookOpen, label: 'Estudia', rotate: 'rotateY(0deg)', gradient: 'from-teal-500 to-emerald-600' },
  { icon: Scale, label: 'Domina', rotate: 'rotateY(180deg)', gradient: 'from-blue-500 to-indigo-600' },
  { icon: FileText, label: 'Practica', rotate: 'rotateY(-90deg)', gradient: 'from-amber-500 to-orange-600' },
  { icon: ShieldAlert, label: 'Refuerza', rotate: 'rotateY(90deg)', gradient: 'from-rose-500 to-red-600' },
  { icon: Monitor, label: 'Tecnología', rotate: 'rotateX(90deg)', gradient: 'from-cyan-500 to-sky-600' },
  { icon: Landmark, label: 'Estado', rotate: 'rotateX(-90deg)', gradient: 'from-violet-500 to-purple-600' },
];

export default function HeroCube() {
  return (
    <div className="relative mx-auto h-28 w-28 sm:h-32 sm:w-32 animate-float" style={{ perspective: '600px' }}>
      <div
        className="relative h-full w-full animate-cube-spin"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {faces.map(({ icon: Icon, label, rotate, gradient }) => (
          <div
            key={label}
            className={`absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}
            style={{
              transform: `${rotate} translateZ(56px)`,
              backfaceVisibility: 'hidden',
              boxShadow: '0 0 24px rgba(13, 148, 136, 0.25), inset 0 0 0 1px rgba(255,255,255,0.25)',
            }}
          >
            <Icon className="h-10 w-10 text-white drop-shadow-md sm:h-12 sm:w-12" strokeWidth={1.8} />
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-pgn-400/20 blur-2xl animate-glow-pulse"
        aria-hidden="true"
      />
    </div>
  );
}
