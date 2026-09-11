import { TOPICS } from '@/lib/types'
import ResultClient from './ResultClient'

export async function generateStaticParams() {
  const keys = new Set<string>()
  Object.values(TOPICS)
    .flat()
    .forEach((t) => keys.add(t.key))
  return Array.from(keys).map((tema) => ({ tema }))
}

export default function ResultPage({ params }: { params: { tema: string } }) {
  return <ResultClient temaKey={decodeURIComponent(params.tema)} />
}
