'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, RotateCw } from 'lucide-react';

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
    <div className="w-full animate-fade-up opacity-0">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="group relative block h-[300px] w-full"
        style={{ perspective: '1000px' }}
        aria-label="Voltear flashcard"
      >
        <div
          className="relative h-full w-full transition-transform duration-500 ease-spring"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Frente */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl glass p-6"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <span className="text-caption font-semibold uppercase tracking-wide text-pgn-600">
              Frente
            </span>
            <p className="mt-4 text-center text-title-1 font-semibold text-ink text-balance">
              {frente}
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-callout text-ink-subtle">
              <RotateCw size={14} />
              Toca para voltear
            </div>
          </div>

          {/* Reverso */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl glass bg-pgn-50/60 p-6"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <span className="text-caption font-semibold uppercase tracking-wide text-pgn-600">
              Reverso
            </span>
            <p className="mt-4 text-center text-title-1 font-semibold text-ink text-balance">
              {reverso}
            </p>
            {norma && (
              <div className="mt-4 inline-flex max-w-full items-center gap-1.5 rounded-xl glass px-3 py-1.5 text-caption font-medium text-pgn-600">
                <BookOpen size={12} />
                <span className="truncate">{norma}</span>
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Anterior"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-soft text-pgn-600 transition-all active:scale-[0.97] active:bg-surface disabled:opacity-40"
        >
          <ChevronLeft size={24} />
        </button>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="btn-secondary flex-1"
        >
          {flipped ? 'Ver frente' : 'Ver reverso'}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Siguiente"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-soft text-pgn-600 transition-all active:scale-[0.97] active:bg-surface disabled:opacity-40"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}

export default Flashcard;
export { Flashcard };
