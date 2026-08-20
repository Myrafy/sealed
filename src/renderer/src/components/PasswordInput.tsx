import React, { useState } from 'react'

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  showStrength?: boolean
}

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  if (score <= 2) return { score, label: 'Weak', color: 'var(--danger)' }
  if (score <= 3) return { score, label: 'Fair', color: 'var(--warning)' }
  if (score === 4) return { score, label: 'Good', color: 'var(--success)' }
  return { score, label: 'Strong', color: 'var(--success)' }
}

export function PasswordInput({ showStrength, ...props }: Props): React.ReactElement {
  const [visible, setVisible] = useState(false)
  const value = String(props.value ?? '')
  const strength = showStrength ? getStrength(value) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setVisible(!visible)}
          tabIndex={-1}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
      {showStrength && value && strength && (
        <>
          <div className="password-strength">
            <div
              className="password-strength-bar"
              style={{
                width: `${(strength.score / 5) * 100}%`,
                background: strength.color
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: strength.color }}>{strength.label}</span>
        </>
      )}
    </div>
  )
}
