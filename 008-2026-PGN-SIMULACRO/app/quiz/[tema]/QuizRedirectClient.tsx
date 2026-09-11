'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function QuizRedirectClient() {
  const router = useRouter()
  const params = useParams<{ tema: string }>()

  useEffect(() => {
    const tema = decodeURIComponent(params.tema)
    const query = typeof window !== 'undefined' ? window.location.search : ''
    router.replace(`/modulo/${encodeURIComponent(tema)}/quiz/${query}`)
  }, [params.tema, router])

  return null
}
