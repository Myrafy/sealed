import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore, SecretMeta } from '../store/appStore'
import type { App, ProjectLink, SyncFormat } from '@shared/types'
import { Modal } from '../components/Modal'

interface Props {
  app: App
  onUpdated: () => void
}

export function AppDetail({ app, onUpdated }: Props): React.ReactElement {
  const { addToast } = useAppStore()
  const [secrets, setSecrets] = useState<SecretMeta[]>([])
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [revealedValue, setRevealedValue] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'secrets' | 'links'>('secrets')

  // Secret modal
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [editSecret, setEditSecret] = useState<SecretMeta | null>(null)
  const [sKey, setSKey] = useState('')
  const [sValue, setSValue] = useState('')
  const [sLoading, setSLoading] = useState(false)

  // Import modal
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  // Link modal
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [linkFormat, setLinkFormat] = useState<SyncFormat>('dotenv')
  const [linkLoading, setLinkLoading] = useState(false)

  // Clipboard timeout tracker
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const loadSecrets = useCallback(async () => {
    const list = await window.api['secrets:list'](app.id)
    setSecrets(list)
  }, [app.id])

  useEffect(() => {
    loadSecrets()
  }, [loadSecrets])

  // Auto-clear clipboard after 30s
  useEffect(() => {
    if (!copiedId) return
    const t = setTimeout(() => {
      navigator.clipboard.writeText('')
      setCopiedId(null)
    }, 30000)
    return () => clearTimeout(t)
  }, [copiedId])

  async function handleReveal(s: SecretMeta): Promise<void> {
    if (revealedId === s.id) {
      setRevealedId(null)
      setRevealedValue('')
      return
    }
    const val = await window.api['secrets:reveal'](s.id)
    setRevealedId(s.id)
    setRevealedValue(val)
  }

  async function handleCopy(s: SecretMeta): Promise<void> {
    const val = await window.api['secrets:reveal'](s.id)
    await navigator.clipboard.writeText(val)
    setCopiedId(s.id)
    addToast(`Copied ${s.key} (clears in 30s)`, 'info')
  }

  function openNewSecret(): void {
    setEditSecret(null)
    setSKey('')
    setSValue('')
    setShowSecretModal(true)
  }

  async function openEditSecret(s: SecretMeta): Promise<void> {
    const val = await window.api['secrets:reveal'](s.id)
    setEditSecret(s)
    setSKey(s.key)
    setSValue(val)
    setShowSecretModal(true)
  }

  async function handleSaveSecret(): Promise<void> {
    if (!sKey.trim() || !sValue.trim()) return
    setSLoading(true)
    await window.api['secrets:set'](app.id, sKey.trim(), sValue.trim(), editSecret?.id)
    setSLoading(false)
    setShowSecretModal(false)
    await loadSecrets()
    onUpdated()
    addToast(editSecret ? 'Secret updated' : 'Secret added', 'success')
  }

  async function handleDeleteSecret(s: SecretMeta): Promise<void> {
    if (!confirm(`Delete secret "${s.key}"?`)) return
    await window.api['secrets:delete'](s.id)
    await loadSecrets()
    onUpdated()
    addToast('Secret deleted', 'success')
  }

  async function handleImport(): Promise<void> {
    if (!importText.trim()) return
    setImportLoading(true)
    const count = await window.api['secrets:import'](app.id, importText)
    setImportLoading(false)
    setShowImport(false)
    setImportText('')
    await loadSecrets()
    onUpdated()
    addToast(`Imported ${count} secret(s)`, 'success')
  }

  async function handleAddLink(): Promise<void> {
    const folder = await window.api['dialog:openFolder']()
    if (!folder) return
    setLinkLoading(true)
    try {
      await window.api['links:add'](app.id, folder, linkFormat)
      onUpdated()
      setShowLinkModal(false)
      addToast('Project linked and synced', 'success')
    } catch (e) {
      addToast(String(e), 'error')
    }
    setLinkLoading(false)
  }

  async function handleRemoveLink(link: ProjectLink): Promise<void> {
    if (!confirm(`Remove link to "${link.folderPath}"?`)) return
    await window.api['links:remove'](link.id)
    onUpdated()
    addToast('Link removed', 'success')
  }

  async function handleSync(link: ProjectLink): Promise<void> {
    const res = await window.api['links:sync'](link.id)
    if (res.ok) {
      onUpdated()
      addToast('Synced', 'success')
    } else {
      addToast(res.error, 'error')
    }
  }

  async function handleSyncAll(): Promise<void> {
    await window.api['links:syncAll'](app.id)
    onUpdated()
    addToast('All links synced', 'success')
  }

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <div className="page-title">{app.name}</div>
          <div className="page-subtitle">{secrets.length} secret{secrets.length !== 1 ? 's' : ''} · {app.linkedProjects.length} linked project{app.linkedProjects.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleSyncAll}>↺ Sync all</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['secrets', 'links'] as const).map((tab) => (
          <button
            key={tab}
            className="btn btn-ghost"
            style={{
              borderRadius: 0,
              borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--primary)' : undefined,
              fontWeight: activeTab === tab ? 700 : undefined,
              paddingBottom: 10,
              textTransform: 'capitalize'
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'secrets' ? `Secrets (${secrets.length})` : `Linked Projects (${app.linkedProjects.length})`}
          </button>
        ))}
      </div>

      {/* Secrets tab */}
      {activeTab === 'secrets' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ flex: 1 }}>Secrets</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(true)}>Import .env</button>
            <button className="btn btn-primary btn-sm" onClick={openNewSecret}>+ Add secret</button>
          </div>

          {secrets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔑</div>
              <div className="empty-state-title">No secrets yet</div>
              <div className="empty-state-desc">Add secrets or import from a .env file</div>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Updated</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {secrets.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{s.key}</td>
                    <td>
                      <span className={`secret-value ${revealedId === s.id ? 'revealed' : ''}`}>
                        {revealedId === s.id ? revealedValue : '••••••••'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          title={revealedId === s.id ? 'Hide' : 'Reveal'}
                          onClick={() => handleReveal(s)}
                        >
                          {revealedId === s.id ? '🙈' : '👁️'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          title={copiedId === s.id ? 'Copied!' : 'Copy'}
                          onClick={() => handleCopy(s)}
                        >
                          {copiedId === s.id ? '✓' : '📋'}
                        </button>
                        <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => openEditSecret(s)}>✏️</button>
                        <button className="btn btn-danger btn-sm" title="Delete" onClick={() => handleDeleteSecret(s)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Links tab */}
      {activeTab === 'links' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ flex: 1 }}>Linked Projects</div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowLinkModal(true)}>+ Link project</button>
          </div>

          {app.linkedProjects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <div className="empty-state-title">No linked projects</div>
              <div className="empty-state-desc">Link a project folder to auto-sync secrets as .env or launchSettings.json</div>
            </div>
          ) : (
            app.linkedProjects.map((link) => (
              <div className="link-row" key={link.id}>
                <div>
                  <span className="badge badge-neutral">{link.format === 'dotenv' ? '.env' : 'launchSettings'}</span>
                </div>
                <div className="link-path">{link.folderPath}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {link.lastSyncAt ? `Synced ${new Date(link.lastSyncAt).toLocaleTimeString()}` : 'Not synced'}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleSync(link)}>↺ Sync</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleRemoveLink(link)}>Remove</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Secret add/edit modal */}
      {showSecretModal && (
        <Modal
          title={editSecret ? 'Edit Secret' : 'Add Secret'}
          onClose={() => setShowSecretModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowSecretModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSecret} disabled={!sKey.trim() || !sValue.trim() || sLoading}>
                {sLoading ? 'Saving…' : 'Save'}
              </button>
            </>
          }
        >
          <div className="form">
            <div className="form-group">
              <label className="form-label">Key</label>
              <input
                type="text"
                value={sKey}
                onChange={(e) => setSKey(e.target.value)}
                placeholder="DATABASE_URL"
                autoFocus
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input
                type="text"
                value={sValue}
                onChange={(e) => setSValue(e.target.value)}
                placeholder="secret value"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {showImport && (
        <Modal
          title="Import from .env"
          onClose={() => setShowImport(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!importText.trim() || importLoading}>
                {importLoading ? 'Importing…' : 'Import'}
              </button>
            </>
          }
        >
          <div className="form">
            <div className="form-group">
              <label className="form-label">Paste .env content</label>
              <textarea
                rows={10}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=abc123'}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }}
              />
              <span className="form-hint">Existing keys with the same name will be overwritten.</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Link project modal */}
      {showLinkModal && (
        <Modal
          title="Link Project Folder"
          onClose={() => setShowLinkModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowLinkModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddLink} disabled={linkLoading}>
                {linkLoading ? 'Linking…' : 'Choose folder & link'}
              </button>
            </>
          }
        >
          <div className="form">
            <div className="form-group">
              <label className="form-label">Injection Format</label>
              <select value={linkFormat} onChange={(e) => setLinkFormat(e.target.value as SyncFormat)}>
                <option value="dotenv">.env file (Next.js, Express, Node)</option>
                <option value="launchSettings">Properties/launchSettings.json (.NET Core)</option>
              </select>
              {linkFormat === 'dotenv' && (
                <span className="form-hint">
                  A .env file will be written to the project root. Next.js and Express pick it up automatically. .env will be added to .gitignore.
                </span>
              )}
              {linkFormat === 'launchSettings' && (
                <span className="form-hint">
                  Secrets are merged into Properties/launchSettings.json. Install DotNetEnv or use your IDE's built-in launchSettings support. File will be added to .gitignore.
                </span>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
