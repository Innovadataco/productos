'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProfileCard from '@/components/ProfileCard'
import { useProfile } from '@/hooks/useProfile'

export default function ProfileSelect() {
  const router = useRouter()
  const { perfil, ready, select } = useProfile()

  useEffect(() => {
    if (ready && perfil) router.replace('/home')
  }, [ready, perfil, router])

  if (!ready || perfil) return null

  return (
    <div className="flex min-h-[80vh] flex-col justify-center gap-6">
      <div className="text-center">
        <p className="text-sm font-semibold" style={{ color: '#0b6e5a' }}>
          INNOVADATACO
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-gray-900">
          ¿Quién estudia hoy?
        </h1>
        <p className="mt-1 text-sm text-gray-500">Simulacro PGN 2026</p>
      </div>
      <div className="space-y-4">
        <ProfileCard
          name="JELKIN ZAIR CARRILLO FRANCO"
          subtitle="Asesor TIC · Conv. 52"
          icon="⚙️"
          borderColor="#0b6e5a"
          onSelect={() => {
            select('Jelkin')
            router.push('/home')
          }}
        />
        <ProfileCard
          name="DIANA MARCELA CÁCERES VALDERRAMA"
          subtitle="Procuradora Judicial · Conv. 89"
          icon="⚖️"
          borderColor="#1d4ed8"
          onSelect={() => {
            select('Diana')
            router.push('/home')
          }}
        />
      </div>
    </div>
  )
}
