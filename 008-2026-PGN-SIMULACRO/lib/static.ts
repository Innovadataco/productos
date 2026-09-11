import { TOPICS } from './types'

export function generateTopicParams() {
  const keys = new Set<string>()
  Object.values(TOPICS)
    .flat()
    .forEach((t) => keys.add(t.key))
  return Array.from(keys).map((tema) => ({ tema }))
}
