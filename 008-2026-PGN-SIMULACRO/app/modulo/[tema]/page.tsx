import { generateTopicParams } from '@/lib/static'
import ModuleLandingClient from './ModuleLandingClient'

export async function generateStaticParams() {
  return generateTopicParams()
}

export default function ModulePage({ params }: { params: { tema: string } }) {
  return <ModuleLandingClient temaKey={decodeURIComponent(params.tema)} />
}
