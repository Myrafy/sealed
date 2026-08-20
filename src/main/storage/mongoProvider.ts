import { MongoClient, Db, Collection } from 'mongodb'
import type { VaultMeta, App, Secret, ProjectLink } from '@shared/types'
import type { StorageProvider } from './provider'

export class MongoStorageProvider implements StorageProvider {
  private client: MongoClient
  private db: Db

  private constructor(client: MongoClient, db: Db) {
    this.client = client
    this.db = db
  }

  static async connect(uri: string, dbName = 'sealed'): Promise<MongoStorageProvider> {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
    await client.connect()
    const db = client.db(dbName)
    await db.command({ ping: 1 })
    const provider = new MongoStorageProvider(client, db)
    await provider.ensureIndexes()
    return provider
  }

  private async ensureIndexes(): Promise<void> {
    await this.db.collection('secrets').createIndex({ appId: 1 })
    await this.db.collection('links').createIndex({ appId: 1 })
    await this.db.collection('links').createIndex({ id: 1 }, { unique: true })
  }

  private col<T extends object>(name: string): Collection<T> {
    return this.db.collection<T>(name)
  }

  async getVaultMeta(): Promise<VaultMeta | null> {
    const doc = await this.col<VaultMeta & { _id?: unknown }>('vault').findOne({})
    if (!doc) return null
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...meta } = doc
    return meta as VaultMeta
  }

  async saveVaultMeta(meta: VaultMeta): Promise<void> {
    await this.col('vault').replaceOne({}, meta, { upsert: true })
  }

  async listApps(): Promise<App[]> {
    const docs = await this.col<App & { _id?: unknown }>('apps').find({}).toArray()
    return docs.map(({ _id, ...a }) => a as App)
  }

  async getApp(id: string): Promise<App | null> {
    const doc = await this.col<App & { _id?: unknown }>('apps').findOne({ id })
    if (!doc) return null
    const { _id, ...app } = doc
    return app as App
  }

  async saveApp(app: App): Promise<void> {
    await this.col('apps').replaceOne({ id: app.id }, app, { upsert: true })
  }

  async deleteApp(id: string): Promise<void> {
    await this.col('apps').deleteOne({ id })
  }

  async listSecrets(appId: string): Promise<Secret[]> {
    const docs = await this.col<Secret & { _id?: unknown }>('secrets').find({ appId }).toArray()
    return docs.map(({ _id, ...s }) => s as Secret)
  }

  async getSecret(id: string): Promise<Secret | null> {
    const doc = await this.col<Secret & { _id?: unknown }>('secrets').findOne({ id })
    if (!doc) return null
    const { _id, ...secret } = doc
    return secret as Secret
  }

  async saveSecret(secret: Secret): Promise<void> {
    await this.col('secrets').replaceOne({ id: secret.id }, secret, { upsert: true })
  }

  async deleteSecret(id: string): Promise<void> {
    await this.col('secrets').deleteOne({ id })
  }

  async deleteSecretsByApp(appId: string): Promise<void> {
    await this.col('secrets').deleteMany({ appId })
  }

  async saveProjectLink(link: ProjectLink): Promise<void> {
    await this.col('links').replaceOne({ id: link.id }, link, { upsert: true })
    // Keep App.linkedProjects in sync
    const app = await this.getApp(link.appId)
    if (!app) throw new Error(`App ${link.appId} not found`)
    const idx = app.linkedProjects.findIndex((l) => l.id === link.id)
    if (idx >= 0) app.linkedProjects[idx] = link
    else app.linkedProjects.push(link)
    await this.saveApp(app)
  }

  async deleteProjectLink(linkId: string): Promise<void> {
    const link = await this.getProjectLink(linkId)
    if (!link) return
    await this.col('links').deleteOne({ id: linkId })
    const app = await this.getApp(link.appId)
    if (app) {
      app.linkedProjects = app.linkedProjects.filter((l) => l.id !== linkId)
      await this.saveApp(app)
    }
  }

  async getProjectLink(linkId: string): Promise<ProjectLink | null> {
    const doc = await this.col<ProjectLink & { _id?: unknown }>('links').findOne({ id: linkId })
    if (!doc) return null
    const { _id, ...link } = doc
    return link as ProjectLink
  }

  async wipeAll(): Promise<void> {
    await Promise.all([
      this.col('vault').deleteMany({}),
      this.col('apps').deleteMany({}),
      this.col('secrets').deleteMany({}),
      this.col('links').deleteMany({})
    ])
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}
