import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { FileStorageProvider } from './fileProvider'
import type { App, Secret, VaultMeta } from '@shared/types'

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'sealed-test-'))
}

function makeVaultMeta(): VaultMeta {
  return {
    version: 1,
    kdfSalt: 'abcdef1234',
    kdfParams: { N: 16384, r: 8, p: 1, keyLen: 32 },
    verifier: { iv: 'aabbcc', authTag: 'ddeeff', data: '001122' }
  }
}

describe('FileStorageProvider', () => {
  let dir: string
  let provider: FileStorageProvider

  beforeEach(() => {
    dir = makeTmpDir()
    provider = new FileStorageProvider(dir)
  })

  it('returns null vault meta for empty vault', async () => {
    expect(await provider.getVaultMeta()).toBeNull()
  })

  it('saves and retrieves vault meta', async () => {
    const meta = makeVaultMeta()
    await provider.saveVaultMeta(meta)
    const retrieved = await provider.getVaultMeta()
    expect(retrieved?.kdfSalt).toBe(meta.kdfSalt)
  })

  it('saves and lists apps', async () => {
    const app: App = { id: 'app1', name: 'Test App', createdAt: new Date().toISOString(), linkedProjects: [] }
    await provider.saveApp(app)
    const list = await provider.listApps()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Test App')
  })

  it('updates existing app', async () => {
    const app: App = { id: 'app1', name: 'Original', createdAt: new Date().toISOString(), linkedProjects: [] }
    await provider.saveApp(app)
    await provider.saveApp({ ...app, name: 'Updated' })
    const list = await provider.listApps()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Updated')
  })

  it('deletes app', async () => {
    const app: App = { id: 'app1', name: 'Test', createdAt: new Date().toISOString(), linkedProjects: [] }
    await provider.saveApp(app)
    await provider.deleteApp('app1')
    expect(await provider.listApps()).toHaveLength(0)
  })

  it('saves and lists secrets', async () => {
    const app: App = { id: 'app1', name: 'Test', createdAt: new Date().toISOString(), linkedProjects: [] }
    await provider.saveApp(app)
    const secret: Secret = {
      id: 's1', appId: 'app1', key: 'DB_URL',
      value: { iv: 'iv1', authTag: 'at1', data: 'd1' },
      updatedAt: new Date().toISOString()
    }
    await provider.saveSecret(secret)
    const list = await provider.listSecrets('app1')
    expect(list).toHaveLength(1)
    expect(list[0].key).toBe('DB_URL')
  })

  it('deletes secrets by app', async () => {
    const app: App = { id: 'app1', name: 'Test', createdAt: new Date().toISOString(), linkedProjects: [] }
    await provider.saveApp(app)
    const secret: Secret = {
      id: 's1', appId: 'app1', key: 'KEY',
      value: { iv: 'iv', authTag: 'at', data: 'd' },
      updatedAt: new Date().toISOString()
    }
    await provider.saveSecret(secret)
    await provider.deleteSecretsByApp('app1')
    expect(await provider.listSecrets('app1')).toHaveLength(0)
  })

  it('persists data across provider instances (file round-trip)', async () => {
    const meta = makeVaultMeta()
    await provider.saveVaultMeta(meta)
    const app: App = { id: 'app1', name: 'Persist Test', createdAt: new Date().toISOString(), linkedProjects: [] }
    await provider.saveApp(app)

    // New instance reading same file
    const provider2 = new FileStorageProvider(dir)
    const meta2 = await provider2.getVaultMeta()
    const apps2 = await provider2.listApps()
    expect(meta2?.kdfSalt).toBe(meta.kdfSalt)
    expect(apps2[0].name).toBe('Persist Test')
  })

  it('cleanup', () => {
    rmSync(dir, { recursive: true, force: true })
  })
})
