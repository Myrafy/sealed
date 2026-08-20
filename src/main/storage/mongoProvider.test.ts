import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { App, ProjectLink, Secret, VaultMeta } from '@shared/types'

const mongoMock = vi.hoisted(() => {
  type Doc = Record<string, unknown>
  const store = new Map<string, Doc[]>()

  function matches(doc: Doc, filter: Doc): boolean {
    return Object.entries(filter).every(([k, v]) => doc[k] === v)
  }

  function docs(name: string): Doc[] {
    if (!store.has(name)) store.set(name, [])
    return store.get(name)!
  }

  class FakeCursor {
    constructor(private readonly items: Doc[]) {}
    async toArray(): Promise<Doc[]> {
      return this.items.map((d) => ({ ...d }))
    }
  }

  class FakeCollection {
    constructor(private readonly name: string) {}

    async createIndex(): Promise<string> {
      return 'ok'
    }

    async findOne(filter: Doc): Promise<Doc | null> {
      const found = docs(this.name).find((d) => matches(d, filter))
      return found ? { ...found } : null
    }

    find(filter: Doc): FakeCursor {
      const items =
        Object.keys(filter).length === 0
          ? docs(this.name)
          : docs(this.name).filter((d) => matches(d, filter))
      return new FakeCursor(items)
    }

    async replaceOne(filter: Doc, doc: Doc, opts?: { upsert?: boolean }): Promise<void> {
      const list = docs(this.name)
      const idx = list.findIndex((d) => matches(d, filter))
      if (idx >= 0) list[idx] = { ...doc }
      else if (opts?.upsert) list.push({ ...doc })
    }

    async deleteOne(filter: Doc): Promise<void> {
      const list = docs(this.name)
      const idx = list.findIndex((d) => matches(d, filter))
      if (idx >= 0) list.splice(idx, 1)
    }

    async deleteMany(): Promise<void> {
      store.set(this.name, [])
    }
  }

  class FakeDb {
    collection(name: string): FakeCollection {
      return new FakeCollection(name)
    }
    async command(): Promise<{ ok: number }> {
      return { ok: 1 }
    }
  }

  class MongoClient {
    async connect(): Promise<this> {
      return this
    }
    db(): FakeDb {
      return new FakeDb()
    }
    async close(): Promise<void> {}
  }

  return {
    MongoClient,
    reset(): void {
      store.clear()
    }
  }
})

vi.mock('mongodb', () => ({
  MongoClient: mongoMock.MongoClient
}))

import { MongoStorageProvider } from './mongoProvider'

function makeVaultMeta(): VaultMeta {
  return {
    version: 1,
    kdfSalt: 'abcdef1234',
    kdfParams: { N: 16384, r: 8, p: 1, keyLen: 32 },
    verifier: { iv: 'aabbcc', authTag: 'ddeeff', data: '001122' }
  }
}

function makeApp(id = 'app1'): App {
  return { id, name: 'Test', createdAt: new Date().toISOString(), linkedProjects: [] }
}

function makeSecret(id = 's1', appId = 'app1'): Secret {
  return {
    id,
    appId,
    key: 'DB_URL',
    value: { iv: 'iv', authTag: 'at', data: 'd' },
    updatedAt: new Date().toISOString()
  }
}

function makeLink(id = 'l1', appId = 'app1'): ProjectLink {
  return {
    id,
    appId,
    folderPath: '/tmp/project',
    format: 'dotenv',
    autoSync: true,
    lastSyncAt: null
  }
}

describe('MongoStorageProvider', () => {
  let provider: MongoStorageProvider

  beforeEach(async () => {
    mongoMock.reset()
    provider = await MongoStorageProvider.connect('mongodb://localhost:27017/test')
  })

  it('returns null vault meta when empty', async () => {
    expect(await provider.getVaultMeta()).toBeNull()
  })

  it('saves and retrieves vault meta without _id', async () => {
    const meta = makeVaultMeta()
    await provider.saveVaultMeta(meta)
    expect(await provider.getVaultMeta()).toEqual(meta)
  })

  it('supports app CRUD', async () => {
    const app = makeApp()
    await provider.saveApp(app)
    expect(await provider.listApps()).toEqual([app])
    expect(await provider.getApp('missing')).toBeNull()
    expect(await provider.getApp(app.id)).toEqual(app)

    await provider.saveApp({ ...app, name: 'Renamed' })
    expect((await provider.getApp(app.id))?.name).toBe('Renamed')

    await provider.deleteApp(app.id)
    expect(await provider.listApps()).toHaveLength(0)
  })

  it('supports secret CRUD and delete by app', async () => {
    await provider.saveApp(makeApp())
    const secret = makeSecret()
    await provider.saveSecret(secret)
    expect(await provider.listSecrets('app1')).toEqual([secret])
    expect(await provider.getSecret('missing')).toBeNull()
    expect(await provider.getSecret(secret.id)).toEqual(secret)

    await provider.saveSecret({ ...secret, key: 'UPDATED' })
    expect((await provider.getSecret(secret.id))?.key).toBe('UPDATED')

    await provider.deleteSecret(secret.id)
    expect(await provider.getSecret(secret.id)).toBeNull()

    await provider.saveSecret(makeSecret('s2'))
    await provider.deleteSecretsByApp('app1')
    expect(await provider.listSecrets('app1')).toHaveLength(0)
  })

  it('saves and updates project links and keeps app.linkedProjects in sync', async () => {
    await provider.saveApp(makeApp())
    const link = makeLink()
    await provider.saveProjectLink(link)
    expect(await provider.getProjectLink(link.id)).toEqual(link)
    expect((await provider.getApp('app1'))?.linkedProjects).toEqual([link])

    const updated = { ...link, folderPath: '/tmp/other' }
    await provider.saveProjectLink(updated)
    expect(await provider.getProjectLink(link.id)).toEqual(updated)
    expect((await provider.getApp('app1'))?.linkedProjects).toEqual([updated])
  })

  it('throws when saving a link for a missing app', async () => {
    await expect(provider.saveProjectLink(makeLink())).rejects.toThrow(/App app1 not found/)
  })

  it('deletes project links and no-ops when missing', async () => {
    await provider.saveApp(makeApp())
    await provider.saveProjectLink(makeLink())
    await provider.deleteProjectLink('missing')
    expect(await provider.getProjectLink('l1')).not.toBeNull()

    await provider.deleteProjectLink('l1')
    expect(await provider.getProjectLink('l1')).toBeNull()
    expect((await provider.getApp('app1'))?.linkedProjects).toEqual([])
  })

  it('deletes an orphaned link when the app is already gone', async () => {
    await provider.saveApp(makeApp())
    await provider.saveProjectLink(makeLink())
    await provider.deleteApp('app1')
    await provider.deleteProjectLink('l1')
    expect(await provider.getProjectLink('l1')).toBeNull()
  })

  it('wipeAll clears collections and close succeeds', async () => {
    await provider.saveVaultMeta(makeVaultMeta())
    await provider.saveApp(makeApp())
    await provider.saveSecret(makeSecret())
    await provider.saveProjectLink(makeLink())
    await provider.wipeAll()
    expect(await provider.getVaultMeta()).toBeNull()
    expect(await provider.listApps()).toHaveLength(0)
    expect(await provider.listSecrets('app1')).toHaveLength(0)
    expect(await provider.getProjectLink('l1')).toBeNull()
    await expect(provider.close()).resolves.toBeUndefined()
  })
})
