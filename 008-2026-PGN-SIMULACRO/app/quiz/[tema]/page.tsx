import { generateTopicParams } from '@/lib/static'
import QuizRedirectClient from './QuizRedirectClient'

export async function generateStaticParams() {
  return generateTopicParams()
}

export default function QuizRedirectPage() {
  return <QuizRedirectClient />
}
