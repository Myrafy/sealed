import React, { useEffect } from 'react'
import { useAppStore } from '../store/appStore'

interface Props {
  className?: string
}

/** Subtle version label — loads once via IPC if not already in the store. */
export function AppVersion({ className = 'app-version' }: Props): React.ReactElement | null {
  const version = useAppStore((s) => s.appVersion)
  const setAppVersion = useAppStore((s) => s.setAppVersion)

  useEffect(() => {
    if (version) return
    void window.api['app:getInfo']().then((info) => setAppVersion(info.version))
  }, [version, setAppVersion])

  if (!version) return null
  return <span className={className}>v{version}</span>
}
