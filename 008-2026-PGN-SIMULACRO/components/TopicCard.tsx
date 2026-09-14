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

export default function TopicCard({ tema, progreso, promedio, totalPreguntas, onClick }: TopicCardProps) {
  const Icon = getIcon(tema.icono);
  const promedioTexto = promedio > 0 ? `${Math.round(promedio)}%` : '—';

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all hover:border-pgn-300 hover:shadow-md"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white ${tema.color}`}>
        <Icon size={24} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-bold text-slate-900">{tema.nombre}</h4>
          <span className="shrink-0 text-xs font-medium text-slate-500">{promedioTexto}</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar actual={progreso} total={totalPreguntas || 1} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
          <span className="rounded bg-slate-100 px-1.5 py-0.5">{tema.eje}</span>
          <span>{totalPreguntas} preguntas</span>
        </div>
      </div>
    </button>
  );
}
