import { getAllSessions } from '../session/sessionManager.js'
import { normalizePhone } from '../importer/phoneNormalizer.js'

export const waChecker = {
  async checkPhone(phone: string) {
    const normalized = normalizePhone(phone)
    const sessionIds = [...getAllSessions().keys()]

    return {
      phone: normalized,
      exists: null as boolean | null,
      checkedByDeviceId: sessionIds[0] ?? null,
    }
  },

  async checkBatch(phones: string[]) {
    const results = await Promise.all(phones.map((phone) => this.checkPhone(phone)))
    return results
  },
}
