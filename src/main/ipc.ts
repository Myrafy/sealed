import { IpcMain, BrowserWindow, app, dialog, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'

import { deriveKey, generateSalt, KDF_PARAMS } from './crypto/kdf'
import { encrypt, decrypt, VERIFIER_PLAINTEXT } from './crypto/cipher'
import { FileStorageProvider } from './storage/fileProvider'
import { MongoStorageProvider } from './storage/mongoProvider'
import { SimpleStore } from './storage/simpleStore'
import { ensureGitignored } from './sync/gitignore'
import { writeEnvFile, parseEnvText } from './sync/envWriter'
import { writeLaunchSettings } from './sync/launchSettingsWriter'
import { applyWindowLayout, type WindowLayout } from './windowLayout'

import type { StorageProvider } from './storage/provider'
import type { VaultMeta, App, Secret, ProjectLink, Settings, SyncFormat } from '@shared/types'

// ─── In-memory session state (main process only) ──────────────────────────────

let sessionKey: Buffer | null = null
let lockTimer: NodeJS.Timeout | null = null
let provider: StorageProvider | null = null

type SettingsFile = Settings & { mongoUriEncrypted?: string } & Record<string, unknown>

// Lazily initialized so app.getPath('userData') is available
let settingsStore: SimpleStore<SettingsFile> | null = null

function getSettingsStore(): SimpleStore<SettingsFile> {
  if (!settingsStore) {
    settingsStore = new SimpleStore<SettingsFile>({
      name: 'settings',
      userDataPath: app.getPath('userData'),
      defaults: { storageMode: 'file', autoLockMinutes: 15, theme: 'system' }
    })
  }
  return settingsStore
}

function resetLockTimer(): void {
  if (lockTimer) clearTimeout(lockTimer)
  const minutes = getSettingsStore().get('autoLockMinutes', 15)
  if (minutes > 0) {
    lockTimer = setTimeout(() => {
      sessionKey = null
      lockTimer = null
    }, minutes * 60 * 1000)
  }
}

/** Decrypt stored Mongo URI, or null if missing/corrupt (clears bad ciphertext). */
function readMongoUri(): string | null {
  const store = getSettingsStore()
  const encUri = store.get('mongoUriEncrypted')
  if (!encUri || !safeStorage.isEncryptionAvailable()) return null
  try {
    return safeStorage.decryptString(Buffer.from(encUri, 'base64'))
  } catch {
    // Keychain / Electron identity changed — ciphertext is no longer readable
    store.delete('mongoUriEncrypted')
    if (store.get('storageMode', 'file') === 'mongodb') {
      store.set('storageMode', 'file')
    }
    return null
  }
}

async function getProvider(): Promise<StorageProvider> {
  if (provider) return provider
  const mode = getSettingsStore().get('storageMode', 'file')
  if (mode === 'mongodb') {
    const uri = readMongoUri()
    if (uri) {
      try {
        provider = await MongoStorageProvider.connect(uri)
        return provider
      } catch {
        getSettingsStore().set('storageMode', 'file')
      }
    }
  }
  provider = new FileStorageProvider(app.getPath('userData'))
  return provider
}

// ─── IPC registration ─────────────────────────────────────────────────────────

export function registerIpcHandlers(ipcMain: IpcMain): void {
  // ── vault:isSetup ──────────────────────────────────────────────────────────
  ipcMain.handle('vault:isSetup', async () => {
    try {
      const p = await getProvider()
      const meta = await p.getVaultMeta()
      return meta !== null
    } catch {
      return false
    }
  })

  // ── vault:setup ───────────────────────────────────────────────────────────
  ipcMain.handle('vault:setup', async (_e, password: string, mongoUri?: string) => {
    try {
      if (mongoUri) {
        // Test connection before committing
        const testProvider = await MongoStorageProvider.connect(mongoUri)
        await testProvider.close()

        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(mongoUri)
          getSettingsStore().set('mongoUriEncrypted', encrypted.toString('base64'))
        }
        getSettingsStore().set('storageMode', 'mongodb')
        provider = null  // force reconnect via getProvider
      } else {
        getSettingsStore().set('storageMode', 'file')
      }

      const salt = generateSalt()
      const key = deriveKey(password, salt)
      const verifier = encrypt(key, VERIFIER_PLAINTEXT)

      const meta: VaultMeta = {
        version: 1,
        kdfSalt: salt,
        kdfParams: KDF_PARAMS,
        verifier
      }

      const p = await getProvider()
      await p.saveVaultMeta(meta)
      sessionKey = key
      resetLockTimer()
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // ── vault:unlock ──────────────────────────────────────────────────────────
  ipcMain.handle('vault:unlock', async (_e, password: string) => {
    try {
      const p = await getProvider()
      const meta = await p.getVaultMeta()
      if (!meta) return { ok: false as const, error: 'Vault not set up' }

      const key = deriveKey(password, meta.kdfSalt)
      const verified = decrypt(key, meta.verifier)
      if (verified !== VERIFIER_PLAINTEXT) {
        return { ok: false as const, error: 'Incorrect password' }
      }
      sessionKey = key
      resetLockTimer()
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: 'Incorrect password' }
    }
  })

  // ── vault:lock ────────────────────────────────────────────────────────────
  ipcMain.handle('vault:lock', () => {
    sessionKey = null
    if (lockTimer) { clearTimeout(lockTimer); lockTimer = null }
  })

  // ── vault:isUnlocked ──────────────────────────────────────────────────────
  ipcMain.handle('vault:isUnlocked', () => sessionKey !== null)

  // ── vault:testMongo ───────────────────────────────────────────────────────
  ipcMain.handle('vault:testMongo', async (_e, uri: string) => {
    try {
      const testProvider = await MongoStorageProvider.connect(uri)
      await testProvider.close()
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // ── vault:reset ───────────────────────────────────────────────────────────
  // Forgot password: permanently wipe current vault (local + MongoDB if set)
  // and clear settings so the user can run first-time setup again.
  ipcMain.handle('vault:reset', async () => {
    try {
      sessionKey = null
      if (lockTimer) { clearTimeout(lockTimer); lockTimer = null }

      if (provider) {
        try { await provider.close() } catch { /* ignore */ }
        provider = null
      }

      const store = getSettingsStore()
      const mongoUri = readMongoUri()

      // Always wipe local vault.json
      const local = new FileStorageProvider(app.getPath('userData'))
      await local.wipeAll()

      // Wipe MongoDB vault if we can still read the stored URI
      if (mongoUri) {
        try {
          const mongo = await MongoStorageProvider.connect(mongoUri)
          await mongo.wipeAll()
          await mongo.close()
        } catch {
          /* Mongo unreachable — local wipe still succeeded */
        }
      }

      store.reset({
        storageMode: 'file',
        autoLockMinutes: 15,
        theme: 'system'
      })

      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // ── apps:list ─────────────────────────────────────────────────────────────
  ipcMain.handle('apps:list', async () => {
    const p = await getProvider()
    return p.listApps()
  })

  // ── apps:create ───────────────────────────────────────────────────────────
  ipcMain.handle('apps:create', async (_e, name: string) => {
    const p = await getProvider()
    const app: App = {
      id: randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      linkedProjects: []
    }
    await p.saveApp(app)
    return app
  })

  // ── apps:rename ───────────────────────────────────────────────────────────
  ipcMain.handle('apps:rename', async (_e, id: string, name: string) => {
    const p = await getProvider()
    const existing = await p.getApp(id)
    if (!existing) throw new Error(`App ${id} not found`)
    const updated: App = { ...existing, name }
    await p.saveApp(updated)
    return updated
  })

  // ── apps:delete ───────────────────────────────────────────────────────────
  ipcMain.handle('apps:delete', async (_e, id: string) => {
    const p = await getProvider()
    await p.deleteSecretsByApp(id)
    await p.deleteApp(id)
  })

  // ── secrets:list ──────────────────────────────────────────────────────────
  ipcMain.handle('secrets:list', async (_e, appId: string) => {
    const p = await getProvider()
    const secrets = await p.listSecrets(appId)
    // Return metadata only — no values
    return secrets.map(({ id, appId, key, updatedAt }) => ({ id, appId, key, updatedAt }))
  })

  // ── secrets:reveal ────────────────────────────────────────────────────────
  ipcMain.handle('secrets:reveal', async (_e, secretId: string) => {
    if (!sessionKey) throw new Error('Vault is locked')
    resetLockTimer()
    const p = await getProvider()
    const secret = await p.getSecret(secretId)
    if (!secret) throw new Error(`Secret ${secretId} not found`)
    return decrypt(sessionKey, secret.value)
  })

  // ── secrets:set ───────────────────────────────────────────────────────────
  ipcMain.handle('secrets:set', async (_e, appId: string, key: string, value: string, existingId?: string) => {
    if (!sessionKey) throw new Error('Vault is locked')
    resetLockTimer()
    const p = await getProvider()
    const secret: Secret = {
      id: existingId ?? randomUUID(),
      appId,
      key,
      value: encrypt(sessionKey, value),
      updatedAt: new Date().toISOString()
    }
    await p.saveSecret(secret)
    // Trigger sync for all linked projects of this app
    await syncApp(appId)
    return secret
  })

  // ── secrets:delete ────────────────────────────────────────────────────────
  ipcMain.handle('secrets:delete', async (_e, secretId: string) => {
    if (!sessionKey) throw new Error('Vault is locked')
    const p = await getProvider()
    const secret = await p.getSecret(secretId)
    if (!secret) return
    await p.deleteSecret(secretId)
    await syncApp(secret.appId)
  })

  // ── secrets:import ────────────────────────────────────────────────────────
  ipcMain.handle('secrets:import', async (_e, appId: string, envText: string) => {
    if (!sessionKey) throw new Error('Vault is locked')
    resetLockTimer()
    const p = await getProvider()
    const pairs = parseEnvText(envText)
    const existing = await p.listSecrets(appId)
    let count = 0
    for (const [key, value] of Object.entries(pairs)) {
      const existingSecret = existing.find((s) => s.key === key)
      const secret: Secret = {
        id: existingSecret?.id ?? randomUUID(),
        appId,
        key,
        value: encrypt(sessionKey, value),
        updatedAt: new Date().toISOString()
      }
      await p.saveSecret(secret)
      count++
    }
    await syncApp(appId)
    return count
  })

  // ── links:add ─────────────────────────────────────────────────────────────
  ipcMain.handle('links:add', async (_e, appId: string, folderPath: string, format: SyncFormat) => {
    if (!sessionKey) throw new Error('Vault is locked')
    const p = await getProvider()
    const app = await p.getApp(appId)
    if (!app) throw new Error(`App ${appId} not found`)

    const link: ProjectLink = {
      id: randomUUID(),
      appId,
      folderPath,
      format,
      autoSync: true,
      lastSyncAt: null
    }
    await p.saveProjectLink(link)
    ensureGitignored(folderPath, format === 'dotenv' ? '.env' : 'Properties/launchSettings.json')

    // Initial sync
    await syncLink(link)
    const updated = await p.getProjectLink(link.id)
    return updated ?? link
  })

  // ── links:remove ──────────────────────────────────────────────────────────
  ipcMain.handle('links:remove', async (_e, linkId: string) => {
    const p = await getProvider()
    await p.deleteProjectLink(linkId)
  })

  // ── links:sync ────────────────────────────────────────────────────────────
  ipcMain.handle('links:sync', async (_e, linkId: string) => {
    if (!sessionKey) return { ok: false as const, error: 'Vault is locked' }
    try {
      const p = await getProvider()
      const link = await p.getProjectLink(linkId)
      if (!link) return { ok: false as const, error: 'Link not found' }
      await syncLink(link)
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // ── links:syncAll ─────────────────────────────────────────────────────────
  ipcMain.handle('links:syncAll', async (_e, appId: string) => {
    if (!sessionKey) return
    await syncApp(appId)
  })

  // ── settings:get ──────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', () => ({
    storageMode: getSettingsStore().get('storageMode', 'file'),
    autoLockMinutes: getSettingsStore().get('autoLockMinutes', 15),
    theme: getSettingsStore().get('theme', 'system')
  } as Settings))

  // ── settings:set ──────────────────────────────────────────────────────────
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    if (patch.storageMode !== undefined) getSettingsStore().set('storageMode', patch.storageMode)
    if (patch.autoLockMinutes !== undefined) {
      getSettingsStore().set('autoLockMinutes', patch.autoLockMinutes)
      resetLockTimer()
    }
    if (patch.theme !== undefined) getSettingsStore().set('theme', patch.theme)
    return {
      storageMode: getSettingsStore().get('storageMode', 'file'),
      autoLockMinutes: getSettingsStore().get('autoLockMinutes', 15),
      theme: getSettingsStore().get('theme', 'system')
    } as Settings
  })

  // ── settings:migrateStorage ───────────────────────────────────────────────
  ipcMain.handle('settings:migrateStorage', async (_e, targetMode, mongoUri?) => {
    if (!sessionKey) return { ok: false as const, error: 'Vault is locked' }
    try {
      const src = await getProvider()
      // Copy all data to target
      const apps = await src.listApps()

      if (targetMode === 'mongodb') {
        if (!mongoUri) return { ok: false as const, error: 'MongoDB URI required' }
        const dest = await MongoStorageProvider.connect(mongoUri)
        const meta = await src.getVaultMeta()
        if (meta) await dest.saveVaultMeta(meta)
        for (const app of apps) {
          await dest.saveApp(app)
          const secrets = await src.listSecrets(app.id)
          for (const s of secrets) await dest.saveSecret(s)
        }
        await dest.close()

        if (safeStorage.isEncryptionAvailable()) {
          const encrypted = safeStorage.encryptString(mongoUri)
          getSettingsStore().set('mongoUriEncrypted', encrypted.toString('base64'))
        }
        getSettingsStore().set('storageMode', 'mongodb')
      } else {
        const dest = new FileStorageProvider(app.getPath('userData'))
        const meta = await src.getVaultMeta()
        if (meta) await dest.saveVaultMeta(meta)
        for (const a of apps) {
          await dest.saveApp(a)
          const secrets = await src.listSecrets(a.id)
          for (const s of secrets) await dest.saveSecret(s)
        }
        getSettingsStore().set('storageMode', 'file')
      }

      // Switch active provider
      if (provider) await provider.close()
      provider = null
      return { ok: true as const }
    } catch (err) {
      return { ok: false as const, error: String(err) }
    }
  })

  // ── app:getInfo ───────────────────────────────────────────────────────────
  ipcMain.handle('app:getInfo', () => ({
    name: app.getName() || 'Sealed',
    version: app.getVersion()
  }))

  // ── window:setLayout ──────────────────────────────────────────────────────
  ipcMain.handle('window:setLayout', (e, layout: WindowLayout) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    applyWindowLayout(win, layout === 'main' ? 'main' : 'auth')
  })

  // ── dialog:openFolder ─────────────────────────────────────────────────────
  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function syncApp(appId: string): Promise<void> {
  if (!sessionKey) return
  const p = await getProvider()
  const app = await p.getApp(appId)
  if (!app) return
  for (const link of app.linkedProjects) {
    if (link.autoSync) {
      try { await syncLink(link) } catch { /* non-fatal */ }
    }
  }
}

async function syncLink(link: ProjectLink): Promise<void> {
  if (!sessionKey) return
  if (!existsSync(link.folderPath)) return  // folder gone, skip silently

  const p = await getProvider()
  const secrets = await p.listSecrets(link.appId)
  const plainSecrets: Record<string, string> = {}
  for (const s of secrets) {
    plainSecrets[s.key] = decrypt(sessionKey, s.value)
  }

  if (link.format === 'dotenv') {
    writeEnvFile(link.folderPath, plainSecrets)
  } else {
    writeLaunchSettings(link.folderPath, plainSecrets)
  }

  // Update lastSyncAt
  const updated: ProjectLink = { ...link, lastSyncAt: new Date().toISOString() }
  await p.saveProjectLink(updated)
}
