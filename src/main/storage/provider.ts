import type { VaultMeta, App, Secret, ProjectLink } from '@shared/types'

export interface StorageProvider {
  // Vault
  getVaultMeta(): Promise<VaultMeta | null>
  saveVaultMeta(meta: VaultMeta): Promise<void>

  // Apps
  listApps(): Promise<App[]>
  getApp(id: string): Promise<App | null>
  saveApp(app: App): Promise<void>
  deleteApp(id: string): Promise<void>

  // Secrets
  listSecrets(appId: string): Promise<Secret[]>
  getSecret(id: string): Promise<Secret | null>
  saveSecret(secret: Secret): Promise<void>
  deleteSecret(id: string): Promise<void>
  deleteSecretsByApp(appId: string): Promise<void>

  // Project links (stored on App for file provider, separately for mongo)
  saveProjectLink(link: ProjectLink): Promise<void>
  deleteProjectLink(linkId: string): Promise<void>
  getProjectLink(linkId: string): Promise<ProjectLink | null>

  /** Permanently delete vault meta, apps, secrets, and links. */
  wipeAll(): Promise<void>

  close(): Promise<void>
}
