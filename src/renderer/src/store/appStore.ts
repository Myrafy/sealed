import { create } from 'zustand'
import type { App, Settings } from '@shared/types'

export type SecretMeta = { id: string; appId: string; key: string; updatedAt: string }

interface AppState {
  // Auth state
  isSetup: boolean | null      // null = not yet checked
  isUnlocked: boolean

  // Navigation
  selectedAppId: string | null
  page: 'setup' | 'unlock' | 'main' | 'settings'

  // Data
  apps: App[]
  secrets: SecretMeta[]
  settings: Settings | null
  appVersion: string | null

  // Toast messages
  toasts: Toast[]
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface AppActions {
  setIsSetup: (v: boolean) => void
  setIsUnlocked: (v: boolean) => void
  setPage: (p: AppState['page']) => void
  setSelectedApp: (id: string | null) => void
  setApps: (apps: App[]) => void
  setSecrets: (secrets: SecretMeta[]) => void
  setSettings: (s: Settings) => void
  setAppVersion: (v: string) => void
  addToast: (message: string, type: Toast['type']) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  isSetup: null,
  isUnlocked: false,
  selectedAppId: null,
  page: 'unlock',
  apps: [],
  secrets: [],
  settings: null,
  appVersion: null,
  toasts: [],

  setIsSetup: (v) => set({ isSetup: v }),
  setIsUnlocked: (v) => set({ isUnlocked: v }),
  setPage: (page) => set({ page }),
  setSelectedApp: (id) => set({ selectedAppId: id, secrets: [] }),
  setApps: (apps) => set({ apps }),
  setSecrets: (secrets) => set({ secrets }),
  setSettings: (settings) => set({ settings }),
  setAppVersion: (appVersion) => set({ appVersion }),
  addToast: (message, type) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: Math.random().toString(36).slice(2), message, type }
      ]
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))
