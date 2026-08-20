// ─── Domain models ────────────────────────────────────────────────────────────

export type StorageMode = 'file' | 'mongodb'

export interface VaultMeta {
  version: number
  kdfSalt: string  // hex
  kdfParams: { N: number; r: number; p: number; keyLen: number }
  verifier: EncryptedBlob  // AES-256-GCM of known plaintext "SEALED_OK"
}

export interface EncryptedBlob {
  iv: string       // hex
  authTag: string  // hex
  data: string     // hex
}

export interface App {
  id: string
  name: string
  createdAt: string  // ISO date
  linkedProjects: ProjectLink[]
}

export interface Secret {
  id: string
  appId: string
  key: string
  value: EncryptedBlob
  updatedAt: string  // ISO date
}

export type SyncFormat = 'dotenv' | 'launchSettings'

export interface ProjectLink {
  id: string
  appId: string
  folderPath: string
  format: SyncFormat
  autoSync: boolean
  lastSyncAt: string | null
}

export interface Settings {
  storageMode: StorageMode
  autoLockMinutes: number
  theme: 'light' | 'dark' | 'system'
}

// ─── IPC channel map ──────────────────────────────────────────────────────────
// Convention: each key maps to { args: ..., return: ... }

export interface IpcMap {
  // Setup & unlock
  'vault:isSetup': { args: []; return: boolean }
  'vault:setup': { args: [password: string, mongoUri?: string]; return: { ok: true } | { ok: false; error: string } }
  'vault:unlock': { args: [password: string]; return: { ok: true } | { ok: false; error: string } }
  'vault:lock': { args: []; return: void }
  'vault:isUnlocked': { args: []; return: boolean }
  'vault:testMongo': { args: [uri: string]; return: { ok: true } | { ok: false; error: string } }

  // Apps
  'apps:list': { args: []; return: App[] }
  'apps:create': { args: [name: string]; return: App }
  'apps:rename': { args: [id: string, name: string]; return: App }
  'apps:delete': { args: [id: string]; return: void }

  // Secrets
  'secrets:list': { args: [appId: string]; return: Array<{ id: string; appId: string; key: string; updatedAt: string }> }
  'secrets:reveal': { args: [secretId: string]; return: string }
  'secrets:set': { args: [appId: string, key: string, value: string, existingId?: string]; return: Secret }
  'secrets:delete': { args: [secretId: string]; return: void }
  'secrets:import': { args: [appId: string, envText: string]; return: number }

  // Project links
  'links:add': { args: [appId: string, folderPath: string, format: SyncFormat]; return: ProjectLink }
  'links:remove': { args: [linkId: string]; return: void }
  'links:sync': { args: [linkId: string]; return: { ok: true } | { ok: false; error: string } }
  'links:syncAll': { args: [appId: string]; return: void }

  // Settings
  'settings:get': { args: []; return: Settings }
  'settings:set': { args: [patch: Partial<Settings>]; return: Settings }
  'settings:migrateStorage': { args: [targetMode: StorageMode, mongoUri?: string]; return: { ok: true } | { ok: false; error: string } }

  // Native helpers
  'dialog:openFolder': { args: []; return: string | null }
}

// ─── Window API exposed via contextBridge ─────────────────────────────────────

export type WindowApi = {
  [K in keyof IpcMap]: (...args: IpcMap[K]['args']) => Promise<IpcMap[K]['return']>
}
