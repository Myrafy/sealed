import React, { useEffect, useState, useCallback } from 'react'
import { useAppStore } from './store/appStore'
import { SetupPage } from './pages/Setup'
import { UnlockPage } from './pages/Unlock'
import { AppDetail } from './pages/AppDetail'
import { SettingsPage } from './pages/Settings'
import { ToastContainer } from './components/Toast'
import { AppTitlebar } from './components/AppTitlebar'
import { AppVersion } from './components/AppVersion'
import { Modal } from './components/Modal'
import type { App } from '@shared/types'

export default function App(): React.ReactElement {
  const {
    isSetup, page, selectedAppId,
    apps, settings,
    setIsSetup, setIsUnlocked, setPage, setSelectedApp, setApps, setSettings, setAppVersion,
    addToast
  } = useAppStore()

  const [renameApp, setRenameApp] = useState<App | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newAppName, setNewAppName] = useState('')
  const [showNewApp, setShowNewApp] = useState(false)

  const loadData = useCallback(async () => {
    const [appList, cfg] = await Promise.all([
      window.api['apps:list'](),
      window.api['settings:get']()
    ])
    setApps(appList)
    setSettings(cfg)
  }, [setApps, setSettings])

  // Boot sequence: check setup + lock state
  useEffect(() => {
    async function boot(): Promise<void> {
      try {
        const info = await window.api['app:getInfo']()
        setAppVersion(info.version)

        const setup = await window.api['vault:isSetup']()
        setIsSetup(setup)
        if (!setup) {
          setPage('setup')
          return
        }
        const unlocked = await window.api['vault:isUnlocked']()
        setIsUnlocked(unlocked)
        if (unlocked) {
          setPage('main')
          await loadData()
        } else {
          setPage('unlock')
        }
      } catch {
        setIsSetup(false)
        setPage('setup')
        addToast('Could not load vault settings. Starting setup.', 'error')
      }
    }
    boot()
  }, [])  // run once on mount

  // Reload data when page becomes main
  useEffect(() => {
    if (page === 'main') loadData()
  }, [page])

  // Compact window for auth screens; full size for vault UI (user can still resize)
  useEffect(() => {
    const layout = page === 'main' || page === 'settings' ? 'main' : 'auth'
    void window.api['window:setLayout'](layout)
  }, [page])

  async function handleLock(): Promise<void> {
    await window.api['vault:lock']()
    setIsUnlocked(false)
    setPage('unlock')
  }

  async function handleCreateApp(): Promise<void> {
    if (!newAppName.trim()) return
    const app = await window.api['apps:create'](newAppName.trim())
    await loadData()
    setSelectedApp(app.id)
    setShowNewApp(false)
    setNewAppName('')
    addToast('App created', 'success')
  }

  async function handleRenameApp(): Promise<void> {
    if (!renameApp || !renameValue.trim()) return
    await window.api['apps:rename'](renameApp.id, renameValue.trim())
    await loadData()
    setRenameApp(null)
    addToast('Renamed', 'success')
  }

  async function handleDeleteApp(app: App): Promise<void> {
    if (!confirm(`Delete app "${app.name}" and all its secrets?`)) return
    await window.api['apps:delete'](app.id)
    if (selectedAppId === app.id) setSelectedApp(null)
    await loadData()
    addToast('App deleted', 'success')
  }

  if (isSetup === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    )
  }

  if (page === 'setup') return <><SetupPage /><ToastContainer /></>
  if (page === 'unlock') return <><UnlockPage /><ToastContainer /></>

  const selectedApp = apps.find((a) => a.id === selectedAppId) ?? null

  return (
    <div className="app-layout">
      <AppTitlebar
        actions={
          <>
            <button
              className="titlebar-btn"
              onClick={() => setPage(page === 'settings' ? 'main' : 'settings')}
            >
              {page === 'settings' ? '← Back' : '⚙ Settings'}
            </button>
            <button className="titlebar-btn" onClick={handleLock}>🔒 Lock</button>
          </>
        }
      />

      {/* Body */}
      {page === 'settings' && settings ? (
        <SettingsPage settings={settings} onUpdated={loadData} />
      ) : (
        <div className="main-content">
          {/* Sidebar */}
          <div className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-label">Apps</span>
              <button
                className="btn btn-ghost btn-sm btn-icon"
                title="New app"
                onClick={() => setShowNewApp(true)}
              >
                +
              </button>
            </div>
            <div className="sidebar-list">
              {apps.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-dim)' }}>
                  No apps yet
                </div>
              )}
              {apps.map((app) => (
                <div
                  key={app.id}
                  className={`sidebar-item ${selectedAppId === app.id ? 'active' : ''}`}
                  onClick={() => setSelectedApp(app.id)}
                >
                  <span className="sidebar-item-name">{app.name}</span>
                  <div className="sidebar-item-actions">
                    <button
                      className="btn btn-ghost btn-sm btn-icon"
                      title="Rename"
                      onClick={(e) => { e.stopPropagation(); setRenameApp(app); setRenameValue(app.name) }}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-danger btn-sm btn-icon"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); handleDeleteApp(app) }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="sidebar-footer">
              <div className="sidebar-footer-meta">
                <span>{settings?.storageMode === 'mongodb' ? '☁ MongoDB' : '💾 Local file'}</span>
                <AppVersion />
              </div>
            </div>
          </div>

          {/* Main panel */}
          {selectedApp ? (
            <AppDetail key={selectedApp.id} app={selectedApp} onUpdated={loadData} />
          ) : (
            <div className="content">
              <div className="empty-state">
                <div className="empty-state-icon">🔐</div>
                <div className="empty-state-title">Select or create an app</div>
                <div className="empty-state-desc">
                  Each app has its own secrets and linked project folders.
                </div>
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setShowNewApp(true)}>
                  + Create app
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ToastContainer />

      {/* New app modal */}
      {showNewApp && (
        <Modal
          title="Create New App"
          onClose={() => setShowNewApp(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setShowNewApp(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateApp} disabled={!newAppName.trim()}>Create</button>
            </>
          }
        >
          <div className="form">
            <div className="form-group">
              <label className="form-label">App Name</label>
              <input
                type="text"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                placeholder="My Project"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreateApp()}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Rename app modal */}
      {renameApp && (
        <Modal
          title="Rename App"
          onClose={() => setRenameApp(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setRenameApp(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRenameApp} disabled={!renameValue.trim()}>Save</button>
            </>
          }
        >
          <div className="form">
            <div className="form-group">
              <label className="form-label">App Name</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRenameApp()}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
