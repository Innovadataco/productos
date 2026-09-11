import { generateTopicParams } from '@/lib/static'
import ResumenClient from './ResumenClient'

export async function generateStaticParams() {
  return generateTopicParams()
}

export default function ResumenPage({ params }: { params: { tema: string } }) {
  return <ResumenClient temaKey={decodeURIComponent(params.tema)} />
}
