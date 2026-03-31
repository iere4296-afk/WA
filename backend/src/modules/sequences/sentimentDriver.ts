const POSITIVE_WORDS = ['yes', 'great', 'good', 'interested', 'love']
const NEGATIVE_WORDS = ['no', 'stop', 'bad', 'hate', 'unsubscribe']

export function detectSentiment(text: string) {
  const lower = text.toLowerCase()
  const positiveHits = POSITIVE_WORDS.filter((word) => lower.includes(word)).length
  const negativeHits = NEGATIVE_WORDS.filter((word) => lower.includes(word)).length
  const score = positiveHits - negativeHits

  if (score > 0) return { label: 'positive' as const, score }
  if (score < 0) return { label: 'negative' as const, score }
  return { label: 'neutral' as const, score }
}

export function pickNextStep(sentiment: ReturnType<typeof detectSentiment>) {
  if (sentiment.label === 'positive') return 'accelerate'
  if (sentiment.label === 'negative') return 'pause'
  return 'continue'
}
