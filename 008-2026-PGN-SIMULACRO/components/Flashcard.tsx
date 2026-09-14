'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

interface FlashcardProps {
  frente: string;
  reverso: string;
  norma?: string;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

function Flashcard({ frente, reverso, norma, onNext, onPrev, hasNext = true, hasPrev = true }: FlashcardProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => setFlipped((f) => !f)}
        className="relative min-h-[200px] w-full rounded-2xl border-2 border-pgn-200 bg-white p-6 text-center shadow-sm transition-all hover:border-pgn-400 hover:shadow-md"
      >
        <div className="text-xs font-bold uppercase tracking-wide text-pgn-500">{flipped ? 'Reverso' : 'Frente'}</div>
        <div className="mt-4 text-lg font-medium text-slate-900">{flipped ? reverso : frente}</div>
        {norma && flipped && (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-pgn-50 px-3 py-1.5 text-xs text-pgn-700">
            <BookOpen size={12} />
            {norma}
          </div>
        )}
        <div className="mt-4 text-xs text-slate-400">Toca para voltear</div>
      </button>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={onPrev} disabled={!hasPrev} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">
          <ChevronLeft size={16} /> Anterior
        </button>
        <button onClick={() => setFlipped((f) => !f)} className="rounded-lg bg-pgn-100 px-4 py-2 text-sm font-bold text-pgn-700">
          {flipped ? 'Ver frente' : 'Ver reverso'}
        </button>
        <button onClick={onNext} disabled={!hasNext} className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-40">
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default Flashcard;
export { Flashcard };
