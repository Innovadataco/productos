'use client'

interface Props {
  explicacion: string
  norma: string
}

export default function FeedbackBox({ explicacion, norma }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
      <p className="font-semibold text-gray-900">Explicación</p>
      <p className="mt-1 text-gray-700">{explicacion}</p>
      {norma && (
        <p className="mt-2 text-xs font-medium text-gray-500">
          📖 {norma}
        </p>
      )}
    </div>
  )
}
