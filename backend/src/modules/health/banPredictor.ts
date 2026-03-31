export interface BanPredictorInput {
  healthScore: number
  optOutRate: number
  replyRate: number
  banSignals24h: number
  sentToday: number
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value))
}

export function predictBanProbability(input: BanPredictorInput): number {
  const linear =
    -3.2
    + (1 - input.healthScore / 100) * 2.4
    + input.optOutRate * 3.1
    - input.replyRate * 1.6
    + input.banSignals24h * 1.25
    + Math.min(input.sentToday / 500, 1) * 0.8

  return Number(sigmoid(linear).toFixed(4))
}

export function classifyBanRisk(probability: number): 'low' | 'medium' | 'high' {
  if (probability >= 0.6) return 'high'
  if (probability >= 0.3) return 'medium'
  return 'low'
}
