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
  'bg-blue-500': 'bg-ios-blue',
  'bg-red-500': 'bg-ios-red',
  'bg-emerald-500': 'bg-ios-green',
  'bg-green-500': 'bg-ios-green',
  'bg-indigo-500': 'bg-ios-primary',
  'bg-amber-500': 'bg-ios-orange',
  'bg-orange-500': 'bg-ios-orange',
  'bg-rose-500': 'bg-ios-red',
  'bg-cyan-500': 'bg-ios-blue',
  'bg-slate-600': 'bg-ios-gray',
  'bg-teal-500': 'bg-ios-green',
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
  const iconColor = colorMap[tema.color] || 'bg-ios-primary';

  return (
    <button
      onClick={onClick}
      className="ios-card flex w-full items-center gap-4 p-4 text-left transition-all hover:shadow-ios-lg active:scale-[0.98]"
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-ios-lg text-white ${iconColor}`}
      >
        <Icon size={24} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-ios-body font-semibold text-ios-label">{tema.nombre}</h4>
          <span className="shrink-0 text-ios-callout font-semibold text-ios-label-secondary">
            {promedioTexto}
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar actual={progreso} total={totalPreguntas || 1} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="rounded-ios bg-ios-gray-6 px-2 py-1 text-ios-caption-1 font-medium text-ios-label-secondary">
            {tema.eje}
          </span>
          <span className="text-ios-footnote text-ios-label-tertiary">
            {totalPreguntas} preguntas
          </span>
        </div>
      </div>
    </button>
  );
}
