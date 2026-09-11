'use client'

interface Props {
  name: string
  subtitle: string
  icon: string
  borderColor: string
  onSelect: () => void
}

export default function ProfileCard({ name, subtitle, icon, borderColor, onSelect }: Props) {
  return (
    <button
      onClick={onSelect}
      className="w-full rounded-2xl border-2 bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
      style={{ borderColor }}
    >
      <div className="flex items-center gap-4">
        <span className="text-4xl" aria-hidden>{icon}</span>
        <div>
          <p className="text-lg font-bold text-gray-900">{name}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>
    </button>
  )
}
