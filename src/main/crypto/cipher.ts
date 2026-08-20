import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import type { EncryptedBlob } from '@shared/types'

const ALGORITHM = 'aes-256-gcm'
const IV_LEN = 12   // 96-bit IV recommended for GCM

export function encrypt(key: Buffer, plaintext: string): EncryptedBlob {
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    data: encrypted.toString('hex')
  }
}

export function decrypt(key: Buffer, blob: EncryptedBlob): string {
  const iv = Buffer.from(blob.iv, 'hex')
  const authTag = Buffer.from(blob.authTag, 'hex')
  const data = Buffer.from(blob.data, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

export const VERIFIER_PLAINTEXT = 'SEALED_OK'
