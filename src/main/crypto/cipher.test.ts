import { describe, it, expect } from 'vitest'
import { encrypt, decrypt, VERIFIER_PLAINTEXT } from './cipher'
import { deriveKey, generateSalt } from './kdf'

function makeKey(): Buffer {
  return deriveKey('test-password-123', generateSalt())
}

describe('encrypt / decrypt', () => {
  it('round-trips plaintext correctly', () => {
    const key = makeKey()
    const plaintext = 'my-secret-value'
    const blob = encrypt(key, plaintext)
    expect(decrypt(key, blob)).toBe(plaintext)
  })

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const key = makeKey()
    const a = encrypt(key, 'same value')
    const b = encrypt(key, 'same value')
    expect(a.iv).not.toBe(b.iv)
    expect(a.data).not.toBe(b.data)
  })

  it('throws on wrong key (auth tag mismatch)', () => {
    const key1 = makeKey()
    const key2 = makeKey()
    const blob = encrypt(key1, 'secret')
    expect(() => decrypt(key2, blob)).toThrow()
  })

  it('throws on tampered ciphertext', () => {
    const key = makeKey()
    const blob = encrypt(key, 'secret')
    const tampered = { ...blob, data: blob.data.slice(0, -2) + 'ff' }
    expect(() => decrypt(key, tampered)).toThrow()
  })

  it('round-trips VERIFIER_PLAINTEXT', () => {
    const key = makeKey()
    const blob = encrypt(key, VERIFIER_PLAINTEXT)
    expect(decrypt(key, blob)).toBe(VERIFIER_PLAINTEXT)
  })
})

describe('deriveKey', () => {
  it('produces 32-byte key', () => {
    const key = deriveKey('password', generateSalt())
    expect(key.length).toBe(32)
  })

  it('same password + same salt → same key', () => {
    const salt = generateSalt()
    const k1 = deriveKey('password', salt)
    const k2 = deriveKey('password', salt)
    expect(k1.toString('hex')).toBe(k2.toString('hex'))
  })

  it('same password + different salt → different key', () => {
    const k1 = deriveKey('password', generateSalt())
    const k2 = deriveKey('password', generateSalt())
    expect(k1.toString('hex')).not.toBe(k2.toString('hex'))
  })
})

describe('wrong-password rejection via verifier', () => {
  it('fails to decrypt verifier with wrong password', () => {
    const salt = generateSalt()
    const correctKey = deriveKey('correct-password', salt)
    const wrongKey = deriveKey('wrong-password', salt)
    const verifierBlob = encrypt(correctKey, VERIFIER_PLAINTEXT)
    expect(() => decrypt(wrongKey, verifierBlob)).toThrow()
  })
})
