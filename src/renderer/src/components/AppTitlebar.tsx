import React from 'react'
import { AppIcon } from './AppIcon'

interface Props {
  actions?: React.ReactNode
}

/** Shared window chrome: brand lives here on every screen. */
export function AppTitlebar({ actions }: Props): React.ReactElement {
  return (
    <div className="titlebar">
      <AppIcon size={20} />
      <span className="titlebar-title">Sealed</span>
      <div className="titlebar-spacer" />
      {actions}
    </div>
  )
}
