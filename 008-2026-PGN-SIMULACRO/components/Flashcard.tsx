'use client'

import { useState } from 'react'
import { Flashcard as FlashcardType } from '@/lib/types'

interface Props {
  card: FlashcardType
  index: number
  total: number
  onKnow: () => void
  onReview: () => void
}

export default function Flashcard({ card, index, total, onKnow, onReview }: Props) {
  const [flipped, setFlipped] = useState(false)

  return (
    <div>
      <p className="text-center text-xs font-medium text-gray-500">
        {index + 1} de {total}
      </p>

      <button
        onClick={() => setFlipped((f) => !f)}
        className="mt-3 w-full rounded-2xl border-2 border-gray-200 bg-white p-6 text-center shadow-sm transition-all"
        style={{ minHeight: 220 }}
      >
        <span className="text-xs font-bold uppercase tracking-wide text-gray-400">
          {flipped ? 'Reverso' : 'Frente'}
        </span>
        <p className="mt-4 text-lg font-semibold text-gray-900">
          {flipped ? card.reverso : card.frente}
        </p>
        {flipped && card.norma && (
          <p className="mt-4 text-xs font-medium text-gray-500">📖 {card.norma}</p>
        )}
        <p className="mt-6 text-xs text-gray-400">Toca para {flipped ? 'ocultar' : 'revelar'}</p>
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setFlipped(false)
            onReview()
          }}
          className="rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Repasar después 🔄
        </button>
        <button
          onClick={() => {
            setFlipped(false)
            onKnow()
          }}
          className="rounded-xl py-3 text-sm font-bold text-white"
          style={{ backgroundColor: '#0b6e5a' }}
        >
          Ya lo sé ✓
        </button>
      </div>
    </div>
  )
}
