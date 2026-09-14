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
    <div className="w-full">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="group relative block h-[300px] w-full"
        style={{ perspective: '1000px' }}
        aria-label="Voltear flashcard"
      >
        <div
          className="relative h-full w-full transition-transform duration-500 ease-ios"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Frente */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-ios-2xl bg-ios-surface p-6 shadow-ios"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            <span className="text-ios-caption-1 font-semibold uppercase tracking-wide text-ios-primary">
              Frente
            </span>
            <p className="mt-4 text-center text-ios-title-3 font-semibold text-ios-label text-balance">
              {frente}
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-ios-caption-1 text-ios-label-tertiary">
              <RotateCw size={14} />
              Toca para voltear
            </div>
          </div>

          {/* Reverso */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-ios-2xl bg-ios-primary-light p-6 shadow-ios"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            <span className="text-ios-caption-1 font-semibold uppercase tracking-wide text-ios-primary">
              Reverso
            </span>
            <p className="mt-4 text-center text-ios-title-3 font-semibold text-ios-label text-balance">
              {reverso}
            </p>
            {norma && (
              <div className="mt-4 inline-flex max-w-full items-center gap-1.5 rounded-ios bg-ios-surface/80 px-3 py-1.5 text-ios-caption-1 font-medium text-ios-primary">
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
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ios-gray-6 text-ios-primary transition-all active:scale-[0.97] active:bg-ios-gray-5 disabled:opacity-40"
        >
          <ChevronLeft size={24} />
        </button>

        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="ios-button-secondary flex-1"
        >
          {flipped ? 'Ver frente' : 'Ver reverso'}
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Siguiente"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ios-gray-6 text-ios-primary transition-all active:scale-[0.97] active:bg-ios-gray-5 disabled:opacity-40"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}

export default Flashcard;
export { Flashcard };
