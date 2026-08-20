import { BrowserWindow, screen } from 'electron'

/** Compact size for unlock / setup / reset. Larger for the main vault UI. */
export const WINDOW_LAYOUTS = {
  auth: { width: 480, height: 700, minWidth: 440, minHeight: 600 },
  main: { width: 1100, height: 720, minWidth: 800, minHeight: 560 }
} as const

export type WindowLayout = keyof typeof WINDOW_LAYOUTS

export function applyWindowLayout(win: BrowserWindow, layout: WindowLayout): void {
  if (win.isDestroyed()) return
  // Respect maximized / fullscreen — user chose a large workspace
  if (win.isMaximized() || win.isFullScreen()) return

  const { width, height, minWidth, minHeight } = WINDOW_LAYOUTS[layout]
  win.setMinimumSize(minWidth, minHeight)

  const bounds = win.getBounds()
  const display = screen.getDisplayMatching(bounds).workArea
  const x = Math.round(display.x + (display.width - width) / 2)
  const y = Math.round(display.y + (display.height - height) / 2)
  win.setBounds({ x, y, width, height }, true)
}
