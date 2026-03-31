function simpleHash(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

export function chooseVariant(contactId: string, splitPercentage = 50): 'A' | 'B' {
  return (simpleHash(contactId) % 100) < splitPercentage ? 'A' : 'B'
}
