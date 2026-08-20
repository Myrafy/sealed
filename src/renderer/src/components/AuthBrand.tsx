import React from 'react'
import { AppIcon } from './AppIcon'

interface Props {
  subtitle: string
}

/** Centered product header for unlock / setup / reset. */
export function AuthBrand({ subtitle }: Props): React.ReactElement {
  return (
    <div className="auth-brand">
      <AppIcon size={48} className="auth-logo-icon" />
      <div className="auth-logo-name">Sealed</div>
      <div className="auth-logo-tagline">{subtitle}</div>
    </div>
  )
}
