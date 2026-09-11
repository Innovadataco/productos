'use client'

interface Props {
  badge: string
  onSwap: () => void
}

export default function Header({ badge, onSwap }: Props) {
  return (
    <header className="flex items-center justify-between gap-2 py-2">
      <p className="text-base font-extrabold tracking-tight" style={{ color: '#0b6e5a' }}>
        INNOVADATACO
      </p>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
          {badge}
        </span>
        <button
          onClick={onSwap}
          title="Cambiar perfil"
          aria-label="Cambiar perfil"
          className="rounded-full border border-gray-200 px-2.5 py-1 text-sm hover:bg-gray-50"
        >
          🔄
        </button>
      </div>
    </header>
  )
}
