import React from 'react'
import { useAppStore } from '../store/appStore'

interface Props {
  className?: string
}

const MYRAFY_URL = 'https://myrafy.com'

/** Quiet studio attribution — Settings About + auth footers. */
export function MyrafyMark({ className = 'myrafy-mark' }: Props): React.ReactElement {
  const version = useAppStore((s) => s.appVersion)

  function openSite(e: React.MouseEvent): void {
    e.preventDefault()
    void window.api['app:openExternal'](MYRAFY_URL)
  }

  return (
    <div className={className}>
      <span className="myrafy-mark-label">
        A{' '}
        <button type="button" className="myrafy-mark-link" onClick={openSite}>
          Myrafy
        </button>
        {' '}open source product
      </span>
      <span className="myrafy-mark-sep" aria-hidden>·</span>
      <button type="button" className="myrafy-mark-link" onClick={openSite}>
        myrafy.com
      </button>
      {version ? <span className="myrafy-mark-sep" aria-hidden>·</span> : null}
      {version ? <span className="app-version">v{version}</span> : null}
    </div>
  )
}
