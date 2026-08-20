import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { PasswordInput } from '../components/PasswordInput'
import { AppIcon } from '../components/AppIcon'

type Step = 'password' | 'mongodb'

export function SetupPage(): React.ReactElement {
  const { setIsSetup, setIsUnlocked, setPage, addToast } = useAppStore()

  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mongoUri, setMongoUri] = useState('')
  const [testResult, setTestResult] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleTestMongo(): Promise<void> {
    if (!mongoUri.trim()) return
    setTestResult('testing')
    const res = await window.api['vault:testMongo'](mongoUri.trim())
    if (res.ok) {
      setTestResult('ok')
      setTestError('')
    } else {
      setTestResult('fail')
      setTestError(res.error)
    }
  }

  async function handleFinish(): Promise<void> {
    setLoading(true)
    setError('')
    const uri = testResult === 'ok' ? mongoUri.trim() : undefined
    const res = await window.api['vault:setup'](password, uri)
    if (res.ok) {
      setIsSetup(true)
      setIsUnlocked(true)
      setPage('main')
      addToast('Vault created successfully', 'success')
    } else {
      setError(res.error)
    }
    setLoading(false)
  }

  const passwordMismatch = confirm && password !== confirm
  const canNext = password.length >= 8 && !passwordMismatch

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <AppIcon size={52} className="auth-logo-icon" />
          <div className="auth-logo-name">Sealed</div>
          <div className="auth-logo-tagline">Local encrypted secrets manager</div>
        </div>

        <div className="wizard-steps">
          <div className={`wizard-step ${step === 'password' ? 'active' : 'done'}`} />
          <div className={`wizard-step ${step === 'mongodb' ? 'active' : step === 'password' ? '' : 'done'}`} />
        </div>

        {step === 'password' && (
          <div className="form">
            <div style={{ fontWeight: 700, fontSize: 16 }}>Create a master password</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              This password encrypts all your secrets. It is never sent anywhere.
            </div>
            <div className="form-group">
              <label className="form-label">Master Password</label>
              <PasswordInput
                showStrength
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a strong password"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
              />
              {passwordMismatch && <span className="form-error">Passwords do not match</span>}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setStep('mongodb')}
              disabled={!canNext}
            >
              Continue →
            </button>
          </div>
        )}

        {step === 'mongodb' && (
          <div className="form">
            <div style={{ fontWeight: 700, fontSize: 16 }}>Storage (optional)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Connect a MongoDB database to sync secrets across machines. Skip to store locally.
            </div>
            <div className="form-group">
              <label className="form-label">MongoDB Connection URI</label>
              <div className="input-row">
                <input
                  type="text"
                  value={mongoUri}
                  onChange={(e) => { setMongoUri(e.target.value); setTestResult('idle') }}
                  placeholder="mongodb+srv://user:pass@cluster.mongodb.net/db"
                />
                <button
                  className="btn btn-ghost"
                  onClick={handleTestMongo}
                  disabled={!mongoUri.trim() || testResult === 'testing'}
                >
                  {testResult === 'testing' ? '…' : 'Test'}
                </button>
              </div>
              {testResult === 'ok' && <span style={{ fontSize: 12, color: 'var(--success)' }}>✓ Connected successfully</span>}
              {testResult === 'fail' && <span className="form-error">{testError}</span>}
              <span className="form-hint">Leave empty to store secrets in an encrypted local file.</span>
            </div>
            {error && <span className="form-error">{error}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setStep('password')}>← Back</button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleFinish}
                disabled={loading}
              >
                {loading ? 'Creating vault…' : mongoUri && testResult !== 'ok' ? 'Use local file & finish' : 'Finish setup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
