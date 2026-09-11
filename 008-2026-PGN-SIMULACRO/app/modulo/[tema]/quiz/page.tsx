import { generateTopicParams } from '@/lib/static'
import QuizClient from '@/app/quiz/[tema]/QuizClient'

export async function generateStaticParams() {
  return generateTopicParams()
}

export default function QuizPage({ params }: { params: { tema: string } }) {
  return <QuizClient temaKey={decodeURIComponent(params.tema)} />
}
