import type { WASocket } from '@whiskeysockets/baileys'

export const presenceSimulator = {
  async simulateBeforeSend(sock: WASocket, jid: string): Promise<void> {
    await sock.sendPresenceUpdate('available', jid)
    await sleep(randomBetween(500, 2000))

    await sock.sendPresenceUpdate('composing', jid)
    await sleep(randomBetween(1500, 4000))

    await sock.sendPresenceUpdate('paused', jid)
    await sleep(randomBetween(200, 800))
  },

  shouldAbandone(): boolean {
    return Math.random() < 0.05
  },

  applyEntropy(planned: number): number {
    const factor = 1 + (Math.random() - 0.5) * 0.30
    return Math.round(planned * factor)
  },

  shouldSkipDay(): boolean {
    return Math.random() < 0.03
  },

  jitterStartTime(scheduledMs: number): number {
    const jitter = (Math.random() - 0.5) * 2 * 90 * 60 * 1000
    return scheduledMs + jitter
  },
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
