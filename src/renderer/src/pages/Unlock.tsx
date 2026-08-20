import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { PasswordInput } from '../components/PasswordInput'
import { AppIcon } from '../components/AppIcon'
import { AppTitlebar } from '../components/AppTitlebar'
import { AppVersion } from '../components/AppVersion'

export function UnlockPage(): React.ReactElement {
  const {
    setIsSetup, setIsUnlocked, setPage, setApps, setSelectedApp, setSettings, setSecrets, addToast
  } = useAppStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState('')

  const confirmReady = confirmText.trim().toUpperCase() === 'RESET'

  async function handleUnlock(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError('')
    const res = await window.api['vault:unlock'](password)
    if (res.ok) {
      setIsUnlocked(true)
      setPage('main')
      addToast('Vault unlocked', 'success')
    } else {
      setError('Incorrect password. Please try again.')
    }
    setLoading(false)
  }

  async function handleReset(): Promise<void> {
    if (!confirmReady) return
    setResetting(true)
    setResetError('')
    const res = await window.api['vault:reset']()
    if (res.ok) {
      setIsSetup(false)
      setIsUnlocked(false)
      setApps([])
      setSecrets([])
      setSelectedApp(null)
      setSettings({ storageMode: 'file', autoLockMinutes: 15, theme: 'system' })
      setShowReset(false)
      setConfirmText('')
      setPage('setup')
      addToast('Previous vault removed. Set up a new account.', 'info')
    } else {
      setResetError(res.error)
    }
    setResetting(false)
  }

  function openReset(): void {
    setShowReset(true)
    setConfirmText('')
    setResetError('')
  }

  if (showReset) {
    return (
      <div className="auth-shell">
        <AppTitlebar />
        <div className="auth-body">
          <div className="auth-panel">
            <div className="auth-logo auth-logo-centered">
              <AppIcon size={52} className="auth-logo-icon" />
              <div className="auth-logo-name">Sealed</div>
              <div className="auth-logo-tagline">
                Reset vault &amp; set up a new account
              </div>
            </div>

            <div className="reset-header">
              <div className="reset-header-top">
                <span className="badge badge-error">Irreversible</span>
              </div>
              <div className="reset-subtitle">
                Master passwords cannot be recovered. Resetting permanently removes this vault
                so you can create a new one on this device.
              </div>
            </div>

            <div className="callout callout-danger">
              <div className="callout-icon" aria-hidden>!</div>
              <div className="callout-body">
                <div className="callout-title">No recovery possible</div>
                <div className="callout-text">
                  Encrypted secrets will be permanently unreadable. This cannot be undone.
                </div>
              </div>
            </div>

            <div className="impact-list">
              <div className="impact-row">
                <div className="impact-mark remove" aria-hidden>×</div>
                <div className="impact-copy">
                  <div className="impact-label">Apps &amp; secrets</div>
                  <div className="impact-desc">All vault entries and encryption keys are deleted.</div>
                </div>
              </div>
              <div className="impact-row">
                <div className="impact-mark remove" aria-hidden>×</div>
                <div className="impact-copy">
                  <div className="impact-label">Local &amp; MongoDB storage</div>
                  <div className="impact-desc">Both backends from this setup are wiped when configured.</div>
                </div>
              </div>
              <div className="impact-row">
                <div className="impact-mark remove" aria-hidden>×</div>
                <div className="impact-copy">
                  <div className="impact-label">Project links</div>
                  <div className="impact-desc">Linked folders are unregistered inside Sealed.</div>
                </div>
              </div>
              <div className="impact-row">
                <div className="impact-mark keep" aria-hidden>✓</div>
                <div className="impact-copy">
                  <div className="impact-label">Project env files kept</div>
                  <div className="impact-desc">Existing .env / launchSettings.json files on disk are left unchanged.</div>
                </div>
              </div>
            </div>

            <div className="form">
              <div className="form-group">
                <label className="form-label">Type RESET to confirm</label>
                <input
                  type="text"
                  className="confirm-phrase-input"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET"
                  autoFocus
                  disabled={resetting}
                  autoComplete="off"
                  spellCheck={false}
                  onKeyDown={(e) => e.key === 'Enter' && confirmReady && handleReset()}
                />
                <span className="form-hint">Confirmation is case-insensitive.</span>
              </div>
              {resetError && <span className="form-error">{resetError}</span>}
              <div className="reset-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowReset(false)}
                  disabled={resetting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger-solid"
                  onClick={handleReset}
                  disabled={!confirmReady || resetting}
                >
                  {resetting ? 'Removing vault…' : 'Wipe vault & continue'}
                </button>
              </div>
            </div>

            <div className="auth-version-row">
              <AppVersion />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <AppTitlebar />
      <div className="auth-body">
        <div className="auth-panel">
          <div className="auth-logo auth-logo-centered">
            <AppIcon size={52} className="auth-logo-icon" />
            <div className="auth-logo-name">Sealed</div>
            <div className="auth-logo-tagline">Enter your master password to unlock</div>
          </div>

          <form className="form" onSubmit={handleUnlock}>
            <div className="form-group">
              <label className="form-label">Master Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your master password"
                autoFocus
              />
              {error && <span className="form-error">{error}</span>}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!password || loading}
            >
              {loading ? 'Unlocking…' : 'Unlock Vault'}
            </button>
          </form>

          <div className="auth-footer-link">
            <button type="button" className="auth-text-link" onClick={openReset}>
              Forgot password? Reset vault
            </button>
          </div>

          <div className="auth-version-row">
            <AppVersion />
          </div>
        </div>
      </div>
    </div>
  )
}
