import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { PasswordInput } from '../components/PasswordInput'
import { AppIcon } from '../components/AppIcon'

export function UnlockPage(): React.ReactElement {
  const { setIsUnlocked, setPage, addToast } = useAppStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
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
      </div>
    </div>
  )
}
