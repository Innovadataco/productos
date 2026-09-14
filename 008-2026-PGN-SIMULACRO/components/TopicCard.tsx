'use client';

import { Tema } from '../lib/types';
import { getIcon } from './icons';
import ProgressBar from './ProgressBar';

interface TopicCardProps {
  tema: Tema;
  progreso: number;
  promedio: number;
  totalPreguntas: number;
  onClick: () => void;
}

const colorMap: Record<string, string> = {
  'bg-blue-500': 'from-pgn-500 to-pgn-600',
  'bg-red-500': 'from-warning to-danger',
  'bg-emerald-500': 'from-success to-pgn-500',
  'bg-green-500': 'from-success to-pgn-500',
  'bg-indigo-500': 'from-pgn-600 to-pgn-800',
  'bg-amber-500': 'from-yellow-400 to-warning',
  'bg-orange-500': 'from-warning to-danger',
  'bg-rose-500': 'from-rose-500 to-danger',
  'bg-cyan-500': 'from-pgn-300 to-pgn-500',
  'bg-slate-600': 'from-slate-500 to-slate-700',
  'bg-teal-500': 'from-pgn-400 to-pgn-600',
};

export default function TopicCard({
  tema,
  progreso,
  promedio,
  totalPreguntas,
  onClick,
}: TopicCardProps) {
  const Icon = getIcon(tema.icono);
  const promedioTexto = promedio > 0 ? `${Math.round(promedio)}%` : '—';
  const iconColor = colorMap[tema.color] || 'from-pgn-500 to-pgn-600';

  return (
    <button
      onClick={onClick}
      className="card flex w-full items-center gap-4 p-4 text-left transition-all hover:shadow-glow active:scale-[0.98] animate-fade-up"
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-button ${iconColor}`}
      >
        <Icon size={28} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-title-2 font-semibold text-ink">{tema.nombre}</h4>
          <span className="shrink-0 text-callout font-bold text-ink-muted">
            {promedioTexto}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar actual={progreso} total={totalPreguntas || 1} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded-lg bg-surface-soft px-2 py-1 text-caption font-medium text-ink-muted">
            {tema.eje}
          </span>
          <span className="text-footnote text-ink-subtle">
            {totalPreguntas} preguntas
          </span>
        </div>
      </div>
    </button>
  );
}
