'use client'

export type OptionState = 'default' | 'correct' | 'incorrect' | 'faded'

interface Props {
  index: number
  label: string
  state: OptionState
  disabled: boolean
  onClick: () => void
}

const STYLES: Record<OptionState, string> = {
  default: 'border-gray-200 bg-white hover:border-gray-400',
  correct: 'border-green-600 bg-green-50 text-green-900',
  incorrect: 'border-red-500 bg-red-50 text-red-900',
  faded: 'border-gray-100 bg-gray-50 text-gray-400',
}

export default function OptionButton({ index, label, state, disabled, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-xl border-2 p-3 text-left text-sm transition-colors ${STYLES[state]} ${
        disabled ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <span className="mr-2 font-bold">{String.fromCharCode(65 + index)}.</span>
      {label}
    </button>
  )
}
