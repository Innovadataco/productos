import { TOPICS } from '@/lib/types'
import QuizClient from './QuizClient'

export async function generateStaticParams() {
  const keys = new Set<string>()
  Object.values(TOPICS)
    .flat()
    .forEach((t) => keys.add(t.key))
  return Array.from(keys).map((tema) => ({ tema }))
}

export default function QuizPage({ params }: { params: { tema: string } }) {
  return <QuizClient temaKey={decodeURIComponent(params.tema)} />
}
