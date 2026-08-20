import React, { useEffect } from 'react'
import { useAppStore, Toast } from '../store/appStore'

function ToastItem({ toast }: { toast: Toast }): React.ReactElement {
  const removeToast = useAppStore((s) => s.removeToast)

  useEffect(() => {
    const t = setTimeout(() => removeToast(toast.id), 4000)
    return () => clearTimeout(t)
  }, [toast.id, removeToast])

  return (
    <div className={`toast toast-${toast.type}`}>
      <span>{toast.message}</span>
      <button className="toast-close" onClick={() => removeToast(toast.id)}>×</button>
    </div>
  )
}

export function ToastContainer(): React.ReactElement {
  const toasts = useAppStore((s) => s.toasts)
  return (
    <div className="toast-container">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  )
}
