import { generateTopicParams } from '@/lib/static'
import FlashcardsClient from './FlashcardsClient'

export async function generateStaticParams() {
  return generateTopicParams()
}

export default function FlashcardsPage({ params }: { params: { tema: string } }) {
  return <FlashcardsClient temaKey={decodeURIComponent(params.tema)} />
}
