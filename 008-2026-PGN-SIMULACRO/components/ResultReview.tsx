'use client'

import { Question } from '@/lib/types'

export interface WrongAnswer {
  question: Question
  selectedIndex: number
}

interface Props {
  wrong: WrongAnswer[]
}

export default function ResultReview({ wrong }: Props) {
  const norms = Array.from(new Set(wrong.map((w) => w.question.norma).filter(Boolean)))

  return (
    <div className="space-y-4">
      {wrong.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Preguntas incorrectas
          </h2>
          <div className="mt-3 space-y-4">
            {wrong.map((w, i) => (
              <div key={`${w.question.id}-${i}`} className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-medium text-gray-900">
                  {i + 1}. {w.question.pregunta}
                </p>
                <p className="mt-1 text-sm text-red-600">
                  Tu respuesta: <span className="font-semibold">{w.question.opciones[w.selectedIndex]}</span>
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Correcta: <span className="font-semibold">{w.question.opciones[w.question.respuesta]}</span>
                </p>
                <p className="mt-1 text-xs text-gray-600">{w.question.explicacion}</p>
                {w.question.norma && (
                  <p className="mt-1 text-xs font-medium text-gray-500">📖 {w.question.norma}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {norms.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Normas recomendadas para repasar
          </h2>
          <ul className="mt-3 space-y-2">
            {norms.map((norma) => (
              <li key={norma} className="flex items-start gap-2 text-sm text-gray-700">
                <span>📖</span>
                <span>{norma}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
