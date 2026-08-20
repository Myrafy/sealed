import { scryptSync, randomBytes } from 'crypto'

export const KDF_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32 } as const

export function generateSalt(): string {
  return randomBytes(32).toString('hex')
}

export function deriveKey(password: string, saltHex: string): Buffer {
  const salt = Buffer.from(saltHex, 'hex')
  return scryptSync(password, salt, KDF_PARAMS.keyLen, {
    N: KDF_PARAMS.N,
    r: KDF_PARAMS.r,
    p: KDF_PARAMS.p
  })
}
