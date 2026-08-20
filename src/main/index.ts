import { app, BrowserWindow, shell, ipcMain, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { WINDOW_LAYOUTS } from './windowLayout'

function getAppIcon(): Electron.NativeImage {
  const candidates = [
    join(__dirname, '../../resources/icon.png'),
    join(process.cwd(), 'resources/icon.png'),
    join(app.getAppPath(), 'resources/icon.png')
  ]
  for (const path of candidates) {
    if (existsSync(path)) {
      const img = nativeImage.createFromPath(path)
      if (!img.isEmpty()) return img
    }
  }
  return nativeImage.createEmpty()
}

function createWindow(): BrowserWindow {
  const icon = getAppIcon()
  const auth = WINDOW_LAYOUTS.auth
  const mainWindow = new BrowserWindow({
    width: auth.width,
    height: auth.height,
    minWidth: auth.minWidth,
    minHeight: auth.minHeight,
    show: false,
    title: 'Sealed',
    center: true,
    autoHideMenuBar: true,
    icon,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Name shown in the macOS menu bar / About (Dock tooltip may still say Electron in pure dev)
app.setName('Sealed')

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.sealed.app')
  }

  // Dev builds run as Electron.app — set Dock icon so Sealed branding shows
  if (process.platform === 'darwin') {
    const icon = getAppIcon()
    if (!icon.isEmpty()) app.dock.setIcon(icon)
  }

  registerIpcHandlers(ipcMain)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
