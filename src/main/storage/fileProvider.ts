import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import type { VaultMeta, App, Secret, ProjectLink } from '@shared/types'
import type { StorageProvider } from './provider'

interface VaultFile {
  version: number
  meta: VaultMeta
  apps: App[]
  secrets: Secret[]
}

export class FileStorageProvider implements StorageProvider {
  private filePath: string
  private data: VaultFile | null = null

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, 'vault.json')
  }

  private load(): VaultFile {
    if (this.data) return this.data
    if (!existsSync(this.filePath)) {
      this.data = { version: 1, meta: null as unknown as VaultMeta, apps: [], secrets: [] }
      return this.data
    }
    const raw = readFileSync(this.filePath, 'utf-8')
    this.data = JSON.parse(raw) as VaultFile
    return this.data
  }

  private save(): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  async getVaultMeta(): Promise<VaultMeta | null> {
    const d = this.load()
    return d.meta ?? null
  }

  async saveVaultMeta(meta: VaultMeta): Promise<void> {
    const d = this.load()
    this.data = { ...d, meta }
    this.save()
  }

  async listApps(): Promise<App[]> {
    return this.load().apps
  }

  async getApp(id: string): Promise<App | null> {
    return this.load().apps.find((a) => a.id === id) ?? null
  }

  async saveApp(app: App): Promise<void> {
    const d = this.load()
    const idx = d.apps.findIndex((a) => a.id === app.id)
    if (idx >= 0) d.apps[idx] = app
    else d.apps.push(app)
    this.save()
  }

  async deleteApp(id: string): Promise<void> {
    const d = this.load()
    this.data = { ...d, apps: d.apps.filter((a) => a.id !== id) }
    this.save()
  }

  async listSecrets(appId: string): Promise<Secret[]> {
    return this.load().secrets.filter((s) => s.appId === appId)
  }

  async getSecret(id: string): Promise<Secret | null> {
    return this.load().secrets.find((s) => s.id === id) ?? null
  }

  async saveSecret(secret: Secret): Promise<void> {
    const d = this.load()
    const idx = d.secrets.findIndex((s) => s.id === secret.id)
    if (idx >= 0) d.secrets[idx] = secret
    else d.secrets.push(secret)
    this.save()
  }

  async deleteSecret(id: string): Promise<void> {
    const d = this.load()
    this.data = { ...d, secrets: d.secrets.filter((s) => s.id !== id) }
    this.save()
  }

  async deleteSecretsByApp(appId: string): Promise<void> {
    const d = this.load()
    this.data = { ...d, secrets: d.secrets.filter((s) => s.appId !== appId) }
    this.save()
  }

  async saveProjectLink(link: ProjectLink): Promise<void> {
    const app = await this.getApp(link.appId)
    if (!app) throw new Error(`App ${link.appId} not found`)
    const existing = app.linkedProjects.findIndex((l) => l.id === link.id)
    if (existing >= 0) app.linkedProjects[existing] = link
    else app.linkedProjects.push(link)
    await this.saveApp(app)
  }

  async deleteProjectLink(linkId: string): Promise<void> {
    const d = this.load()
    for (const app of d.apps) {
      const idx = app.linkedProjects.findIndex((l) => l.id === linkId)
      if (idx >= 0) {
        app.linkedProjects.splice(idx, 1)
        await this.saveApp(app)
        return
      }
    }
  }

  async getProjectLink(linkId: string): Promise<ProjectLink | null> {
    const d = this.load()
    for (const app of d.apps) {
      const link = app.linkedProjects.find((l) => l.id === linkId)
      if (link) return link
    }
    return null
  }

  async wipeAll(): Promise<void> {
    this.data = null
    if (existsSync(this.filePath)) unlinkSync(this.filePath)
  }

  async close(): Promise<void> {
    // no-op for file provider
  }
}
