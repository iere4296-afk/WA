import crypto from 'crypto'
import { config } from './config.js'

const ALGORITHM = 'aes-256-gcm'
const KEY_VERSIONS: Record<string, Buffer> = {
  v1: Buffer.from(config.security.encryptionKey, 'hex'),
  ...(config.security.encryptionKeyOld ? {
    v0: Buffer.from(config.security.encryptionKeyOld, 'hex')
  } : {}),
}

export function encrypt(plaintext: string, version = 'v1'): string {
  const key = KEY_VERSIONS[version]
  if (!key) throw new Error(`Unknown encryption key version: ${version}`)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${version}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [version, ivHex, tagHex, dataHex] = ciphertext.split(':')
  const key = KEY_VERSIONS[version]
  if (!key) throw new Error(`Cannot decrypt: unknown key version ${version}`)
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(data) + decipher.final('utf8')
}
