import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { AppVersion } from '../components/AppVersion'
import type { Settings, StorageMode } from '@shared/types'

interface Props {
  settings: Settings
  onUpdated: () => void
}

export function SettingsPage({ settings, onUpdated }: Props): React.ReactElement {
  const { addToast } = useAppStore()
  const [migrateTarget, setMigrateTarget] = useState<StorageMode>(
    settings.storageMode === 'file' ? 'mongodb' : 'file'
  )
  const [mongoUri, setMongoUri] = useState('')
  const [migrateLoading, setMigrateLoading] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')

  async function handleSetAutoLock(minutes: number): Promise<void> {
    await window.api['settings:set']({ autoLockMinutes: minutes })
    onUpdated()
  }

  async function handleSetTheme(theme: Settings['theme']): Promise<void> {
    await window.api['settings:set']({ theme })
    onUpdated()
  }

  async function handleTestMongo(): Promise<void> {
    if (!mongoUri.trim()) return
    setTestResult('testing')
    const res = await window.api['vault:testMongo'](mongoUri.trim())
    if (res.ok) { setTestResult('ok'); setTestError('') }
    else { setTestResult('fail'); setTestError(res.error) }
  }

  async function handleMigrate(): Promise<void> {
    setMigrateLoading(true)
    const res = await window.api['settings:migrateStorage'](
      migrateTarget,
      migrateTarget === 'mongodb' ? mongoUri.trim() : undefined
    )
    if (res.ok) {
      onUpdated()
      addToast(`Migrated to ${migrateTarget === 'file' ? 'local file' : 'MongoDB'} storage`, 'success')
    } else {
      addToast(res.error, 'error')
    }
    setMigrateLoading(false)
  }

  return (
    <div className="content">
      <div className="page-header">
        <div className="page-title">Settings</div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Security</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Auto-lock</div>
            <div className="settings-row-desc">Lock the vault after a period of inactivity</div>
          </div>
          <select
            value={settings.autoLockMinutes}
            onChange={(e) => handleSetAutoLock(Number(e.target.value))}
          >
            <option value={0}>Never</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Appearance</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Theme</div>
          </div>
          <select
            value={settings.theme}
            onChange={(e) => handleSetTheme(e.target.value as Settings['theme'])}
          >
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Storage</div>
        <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div className="settings-row-label">Current storage</div>
            <div className="settings-row-desc">
              {settings.storageMode === 'file'
                ? 'Encrypted local file (userData/vault.json)'
                : 'MongoDB (ciphertext only)'}
            </div>
          </div>
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Migrate to:</span>
              <select value={migrateTarget} onChange={(e) => setMigrateTarget(e.target.value as StorageMode)}>
                <option value="file">Local encrypted file</option>
                <option value="mongodb">MongoDB</option>
              </select>
            </div>
            {migrateTarget === 'mongodb' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={mongoUri}
                  onChange={(e) => { setMongoUri(e.target.value); setTestResult('idle') }}
                  placeholder="mongodb+srv://user:pass@cluster.mongodb.net/db"
                  style={{ flex: 1, fontSize: 12 }}
                />
                <button className="btn btn-ghost btn-sm" onClick={handleTestMongo} disabled={!mongoUri.trim() || testResult === 'testing'}>
                  {testResult === 'testing' ? '…' : 'Test'}
                </button>
              </div>
            )}
            {testResult === 'ok' && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Connected</span>}
            {testResult === 'fail' && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{testError}</span>}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleMigrate}
              disabled={
                migrateLoading ||
                migrateTarget === settings.storageMode ||
                (migrateTarget === 'mongodb' && testResult !== 'ok')
              }
            >
              {migrateLoading ? 'Migrating…' : 'Migrate storage'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Usage in your projects</div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Next.js / Express / Node</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Nothing needed. Sealed writes a .env file to your project root. Next.js and Express pick it up automatically at startup.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>.NET Core (DotNetEnv)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
              Install DotNetEnv and call Env.Load() in your Program.cs:
            </div>
            <pre style={{ background: 'var(--surface2)', padding: 12, borderRadius: 4, fontSize: 12, fontFamily: 'var(--font-mono)', overflowX: 'auto' }}>
{`dotnet add package DotNetEnv

// Program.cs
DotNetEnv.Env.Load();`}
            </pre>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>.NET Core (launchSettings.json)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Choose the "launchSettings" format when linking a .NET project. Secrets are merged into Properties/launchSettings.json and injected automatically by Visual Studio and dotnet run.
            </div>
          </div>
        </div>
      </div>
      <div className="settings-section">
        <div className="settings-section-title">About</div>
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Sealed</div>
            <div className="settings-row-desc">Local encrypted secrets manager</div>
          </div>
          <AppVersion className="app-version app-version-emphasis" />
        </div>
      </div>
    </div>
  )
}
