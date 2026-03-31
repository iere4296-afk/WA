export interface GateResult {
  passed: boolean
  gate: number
  reason?: string
}

function normalizeWords(content: string) {
  return content
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^\w]/g, '').trim())
    .filter(Boolean)
}

export function gate1SpamPatterns(content: string): GateResult {
  const spamPatterns = [
    /act now/i,
    /urgent!/i,
    /limited time/i,
    /\b\d{10,}\b/,
    /https?:\/\/[^\s]+/,
  ]

  const uppercaseLetters = content.match(/[A-Z]/g) || []
  const alphabeticLetters = content.match(/[A-Za-z]/g) || []
  const uppercaseWords = content.match(/\b[A-Z]{4,}\b/g) || []
  const upperRatio = alphabeticLetters.length > 0 ? uppercaseLetters.length / alphabeticLetters.length : 0

  // Allow common short acronyms like JVC, UAE, BHK, or CTA placeholders,
  // but still block obvious shouting-heavy copy.
  if (alphabeticLetters.length >= 12 && upperRatio > 0.45 && uppercaseWords.length >= 2) {
    return { passed: false, gate: 1, reason: 'Too many uppercase words for natural WhatsApp copy' }
  }

  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      return { passed: false, gate: 1, reason: `Spam pattern detected: ${pattern}` }
    }
  }

  return { passed: true, gate: 1 }
}

export function gate2EmojiDensity(content: string): GateResult {
  const emojiCount = (content.match(/\p{Emoji}/gu) || []).length
  if (emojiCount > 2) {
    return { passed: false, gate: 2, reason: `Too many emojis: ${emojiCount} (max 2)` }
  }

  return { passed: true, gate: 2 }
}

export function gate3OpeningPattern(content: string, existingMessages: string[]): GateResult {
  const opening = normalizeWords(content).slice(0, 4).join(' ')
  const isDuplicate = existingMessages.some((message) => normalizeWords(message).slice(0, 4).join(' ') === opening)

  if (opening && isDuplicate) {
    return { passed: false, gate: 3, reason: 'Duplicate opening pattern detected' }
  }

  return { passed: true, gate: 3 }
}

export function gate4LengthByIntent(content: string, intentScore: number): GateResult {
  const wordCount = content.split(/\s+/).filter(Boolean).length

  if (intentScore < 30 && wordCount > 30) {
    return { passed: false, gate: 4, reason: `Message too long for low-intent contact (${wordCount} words, max 30)` }
  }

  if (intentScore > 70 && wordCount > 150) {
    return { passed: false, gate: 4, reason: `Message too long (${wordCount} words, max 150)` }
  }

  return { passed: true, gate: 4 }
}

export function gate5SemanticSimilarity(content: string, recentMessages: string[]): GateResult {
  const words = new Set(normalizeWords(content).filter((word) => word.length > 3))

  for (const recent of recentMessages.slice(-5)) {
    const recentWords = new Set(normalizeWords(recent).filter((word) => word.length > 3))
    if (words.size === 0 || recentWords.size === 0) continue

    const intersection = [...words].filter((word) => recentWords.has(word)).length
    const union = new Set([...words, ...recentWords]).size
    const similarity = union > 0 ? intersection / union : 0

    if (similarity > 0.85) {
      return {
        passed: false,
        gate: 5,
        reason: `Too similar to recent message (${Math.round(similarity * 100)}% overlap)`,
      }
    }
  }

  return { passed: true, gate: 5 }
}

export function runAllGates(
  content: string,
  existingMessages: string[],
  intentScore: number,
  recentMessages: string[],
): { passed: boolean; results: GateResult[]; failedGates: string[] } {
  const results = [
    gate1SpamPatterns(content),
    gate2EmojiDensity(content),
    gate3OpeningPattern(content, existingMessages),
    gate4LengthByIntent(content, intentScore),
    gate5SemanticSimilarity(content, recentMessages),
  ]

  const failed = results.filter((result) => !result.passed)

  return {
    passed: failed.length === 0,
    results,
    failedGates: failed.map((result) => `Gate ${result.gate}: ${result.reason}`),
  }
}
