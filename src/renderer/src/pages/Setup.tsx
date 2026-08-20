import React, { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { PasswordInput } from '../components/PasswordInput'
import { AppTitlebar } from '../components/AppTitlebar'
import { AuthBrand } from '../components/AuthBrand'
import { MyrafyMark } from '../components/MyrafyMark'

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

  const passwordMismatch = Boolean(confirm && password !== confirm)
  const passwordTooShort = Boolean(password && password.length < 8)
  const canNext = password.length >= 8 && !passwordMismatch && Boolean(confirm)

  return (
    <div className="auth-shell">
      <AppTitlebar />
      <div className="auth-body">
        <div className="auth-panel">
          <AuthBrand subtitle="Set up your encrypted vault" />

          <div className="wizard" aria-label="Setup progress">
            <div className={`wizard-item ${step === 'password' ? 'active' : 'done'}`}>
              <span className="wizard-num">1</span>
              <span className="wizard-label">Password</span>
            </div>
            <div className="wizard-connector" aria-hidden />
            <div className={`wizard-item ${step === 'mongodb' ? 'active' : ''}`}>
              <span className="wizard-num">2</span>
              <span className="wizard-label">Storage</span>
            </div>
          </div>

          {step === 'password' && (
            <div className="form auth-form">
              <div className="auth-step-header">
                <div className="auth-step-title">Create a master password</div>
                <div className="auth-step-desc">
                  This password encrypts every secret on this device. There is no recovery if it is lost.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Master password</label>
                <PasswordInput
                  showStrength
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoFocus
                  autoComplete="new-password"
                />
                {passwordTooShort && (
                  <span className="form-hint">Use at least 8 characters.</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm password</label>
                <PasswordInput
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter master password"
                  autoComplete="new-password"
                  onKeyDown={(e) => e.key === 'Enter' && canNext && setStep('mongodb')}
                />
                {passwordMismatch && <span className="form-error">Passwords do not match</span>}
              </div>

              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => setStep('mongodb')}
                disabled={!canNext}
              >
                Continue
              </button>
            </div>
          )}

          {step === 'mongodb' && (
            <div className="form auth-form">
              <div className="auth-step-header">
                <div className="auth-step-title">Choose storage</div>
                <div className="auth-step-desc">
                  Use a local encrypted file by default, or connect MongoDB to sync ciphertext across machines.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">MongoDB connection URI (optional)</label>
                <div className="input-row">
                  <input
                    type="text"
                    value={mongoUri}
                    onChange={(e) => { setMongoUri(e.target.value); setTestResult('idle') }}
                    placeholder="mongodb+srv://user:pass@cluster…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleTestMongo}
                    disabled={!mongoUri.trim() || testResult === 'testing'}
                  >
                    {testResult === 'testing' ? 'Testing…' : 'Test'}
                  </button>
                </div>
                {testResult === 'ok' && (
                  <span className="form-ok">Connected successfully</span>
                )}
                {testResult === 'fail' && <span className="form-error">{testError}</span>}
                <span className="form-hint">
                  Leave empty to finish with local storage only.
                </span>
              </div>

              {error && <span className="form-error">{error}</span>}

              <div className="auth-actions auth-actions-spread">
                <button type="button" className="btn btn-ghost" onClick={() => setStep('password')}>
                  Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleFinish}
                  disabled={loading}
                >
                  {loading
                    ? 'Creating vault…'
                    : mongoUri.trim() && testResult !== 'ok'
                      ? 'Skip & use local file'
                      : 'Create vault'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="auth-shell-footer">
        <MyrafyMark />
      </div>
    </div>
  )
}
