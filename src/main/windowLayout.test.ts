import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockScreen, createWindow } = vi.hoisted(() => {
  const mockScreen = {
    getDisplayMatching: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    }))
  }

  function createWindow(overrides: Partial<{
    destroyed: boolean
    maximized: boolean
    fullScreen: boolean
    bounds: { x: number; y: number; width: number; height: number }
  }> = {}) {
    const state = {
      destroyed: overrides.destroyed ?? false,
      maximized: overrides.maximized ?? false,
      fullScreen: overrides.fullScreen ?? false,
      bounds: overrides.bounds ?? { x: 10, y: 20, width: 800, height: 600 },
      minSize: [0, 0] as [number, number]
    }
    return {
      isDestroyed: () => state.destroyed,
      isMaximized: () => state.maximized,
      isFullScreen: () => state.fullScreen,
      getBounds: () => state.bounds,
      setMinimumSize: vi.fn((w: number, h: number) => {
        state.minSize = [w, h]
      }),
      setBounds: vi.fn((bounds: typeof state.bounds) => {
        state.bounds = bounds
      }),
      _state: state
    }
  }

  return { mockScreen, createWindow }
})

vi.mock('electron', () => ({
  BrowserWindow: class {},
  screen: mockScreen
}))

import { applyWindowLayout, WINDOW_LAYOUTS } from './windowLayout'

describe('applyWindowLayout', () => {
  beforeEach(() => {
    mockScreen.getDisplayMatching.mockClear()
  })

  it('exposes auth and main layouts', () => {
    expect(WINDOW_LAYOUTS.auth.width).toBeLessThan(WINDOW_LAYOUTS.main.width)
  })

  it('does nothing when the window is destroyed', () => {
    const win = createWindow({ destroyed: true })
    applyWindowLayout(win as never, 'auth')
    expect(win.setBounds).not.toHaveBeenCalled()
  })

  it('does nothing when maximized or fullscreen', () => {
    const max = createWindow({ maximized: true })
    applyWindowLayout(max as never, 'main')
    expect(max.setBounds).not.toHaveBeenCalled()

    const full = createWindow({ fullScreen: true })
    applyWindowLayout(full as never, 'main')
    expect(full.setBounds).not.toHaveBeenCalled()
  })

  it('centers the window and applies min size for auth layout', () => {
    const win = createWindow()
    applyWindowLayout(win as never, 'auth')

    const { width, height, minWidth, minHeight } = WINDOW_LAYOUTS.auth
    expect(win.setMinimumSize).toHaveBeenCalledWith(minWidth, minHeight)
    expect(mockScreen.getDisplayMatching).toHaveBeenCalled()
    expect(win.setBounds).toHaveBeenCalledWith(
      {
        x: Math.round((1920 - width) / 2),
        y: Math.round((1080 - height) / 2),
        width,
        height
      },
      true
    )
  })
})
