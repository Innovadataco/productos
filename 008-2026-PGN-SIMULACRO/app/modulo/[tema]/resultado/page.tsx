import { generateTopicParams } from '@/lib/static'
import ResultadoClient from './ResultadoClient'

export async function generateStaticParams() {
  return generateTopicParams()
}

export default function ResultadoPage({ params }: { params: { tema: string } }) {
  return <ResultadoClient temaKey={decodeURIComponent(params.tema)} />
}
