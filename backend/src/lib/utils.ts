const phoneShareMap = new Map<string, string>()

export function isLidJid(value?: string | null): boolean {
  return String(value || '').includes('@lid')
}

export function normalizeWhatsAppPhone(value?: string | null): string | null {
  if (!value) return null

  const raw = String(value).trim().split(':')[0]
  if (!raw || raw.includes('@g.us')) return null

  const digits = raw.split('@')[0]?.replace(/\D/g, '') || ''
  if (digits.length < 6) return null

  return `+${digits}`
}

export function normalizeWhatsAppJid(
  value?: string | null,
  fallbackServer = 's.whatsapp.net',
): string | null {
  if (!value) return null

  const raw = String(value).trim().split(':')[0]
  if (!raw || raw.includes('@g.us')) return null

  const [userPart, explicitServer] = raw.includes('@')
    ? raw.split('@')
    : [raw, fallbackServer]

  const digits = userPart.replace(/\D/g, '')
  const server = explicitServer || fallbackServer

  if (!digits || !server) return null

  return `${digits}@${server}`
}

export function rememberPhoneShare(
  identity?: string | null,
  sharedPhone?: string | null,
): string | null {
  const resolvedPhone = normalizeWhatsAppPhone(sharedPhone)
  if (!resolvedPhone) return null

  const keys = [
    identity,
    normalizeWhatsAppPhone(identity),
    normalizeWhatsAppJid(identity, isLidJid(identity) ? 'lid' : 's.whatsapp.net'),
    sharedPhone,
    normalizeWhatsAppPhone(sharedPhone),
    normalizeWhatsAppJid(sharedPhone),
  ].filter(Boolean)

  for (const key of new Set(keys.map((item) => String(item)))) {
    phoneShareMap.set(key, resolvedPhone)
  }

  return resolvedPhone
}

export function resolvePhoneShare(identity?: string | null): string | null {
  const keys = [
    identity,
    normalizeWhatsAppPhone(identity),
    normalizeWhatsAppJid(identity, isLidJid(identity) ? 'lid' : 's.whatsapp.net'),
  ].filter(Boolean)

  for (const key of keys) {
    const resolved = phoneShareMap.get(String(key))
    if (resolved) return resolved
  }

  return null
}

/**
 * Convert a WhatsApp JID into a clean E.164 phone number.
 * Falls back to in-memory phone-share mappings for LID identities.
 */
export function jidToPhone(jid: string): string | null {
  return resolvePhoneShare(jid) || normalizeWhatsAppPhone(jid)
}

/**
 * Convert a stored phone number into a preferred Baileys JID.
 * Preserves LID identities when they are known.
 */
export function phoneToJid(phone: string, preferredJid?: string | null): string {
  const normalizedPreferred = normalizeWhatsAppJid(
    preferredJid,
    isLidJid(preferredJid) ? 'lid' : 's.whatsapp.net',
  )
  if (normalizedPreferred) return normalizedPreferred

  const normalizedStored = normalizeWhatsAppJid(
    phone,
    isLidJid(phone) ? 'lid' : 's.whatsapp.net',
  )
  if (normalizedStored) return normalizedStored

  return normalizeWhatsAppJid(phone) || '@s.whatsapp.net'
}

export function buildJidCandidates(phone: string, preferredJid?: string | null): string[] {
  const primary = phoneToJid(phone, preferredJid)
  const digits = String(phone || '').split('@')[0].replace(/\D/g, '')
  const candidates = [primary]

  if (digits) {
    candidates.push(`${digits}@s.whatsapp.net`)
    candidates.push(`${digits}@lid`)
  }

  return [...new Set(candidates.filter((candidate) => candidate && candidate !== '@s.whatsapp.net'))]
}
