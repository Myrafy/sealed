#!/usr/bin/env node
/**
 * Ensures the Electron binary is downloaded, extracted, and macOS-ready.
 * Run automatically after npm install, or manually via: npm run electron:install
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const root = path.join(__dirname, '..')
const electronDir = path.join(root, 'node_modules', 'electron')
const distDir = path.join(electronDir, 'dist')
const pathFile = path.join(electronDir, 'path.txt')
const { version } = require(path.join(electronDir, 'package.json'))

const platformPath =
  process.platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : process.platform === 'win32'
      ? 'electron.exe'
      : 'electron'

function frameworkPath() {
  return path.join(
    distDir,
    'Electron.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework'
  )
}

function isInstalled() {
  if (!fs.existsSync(pathFile)) return false
  const rel = fs.readFileSync(pathFile, 'utf-8').trim()
  const bin = path.join(distDir, rel)
  if (!fs.existsSync(bin)) return false
  if (process.platform === 'darwin') {
    const fw = frameworkPath()
    return fs.existsSync(fw) && fs.statSync(fw).size > 10_000_000
  }
  return fs.statSync(bin).size > 1_000_000
}

function writePathFile() {
  fs.writeFileSync(pathFile, platformPath) // no trailing newline
  fs.writeFileSync(path.join(distDir, 'version'), `v${version}`)
}

/** Fall back to unzip when electron/install.js leaves a partial extract. */
function extractFromCache() {
  const cacheRoot = path.join(os.homedir(), 'Library/Caches/electron')
  if (!fs.existsSync(cacheRoot)) return false

  const arch = process.arch === 'x64' && process.platform === 'darwin' ? 'x64' : process.arch
  const zipName = `electron-v${version}-darwin-${arch}.zip`
  let zipPath = null

  for (const hash of fs.readdirSync(cacheRoot)) {
    const candidate = path.join(cacheRoot, hash, zipName)
    if (fs.existsSync(candidate) && fs.statSync(candidate).size > 50_000_000) {
      zipPath = candidate
      break
    }
  }
  if (!zipPath) return false

  console.log('Extracting Electron from cache:', zipPath)
  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })
  execSync(`unzip -q -o "${zipPath}" -d "${distDir}"`, { stdio: 'inherit' })
  writePathFile()
  return isInstalled()
}

function downloadViaInstallJs() {
  console.log('Downloading Electron binary via install.js…')
  execSync('node install.js', { cwd: electronDir, stdio: 'inherit', env: { ...process.env, force_no_cache: 'true' } })
  if (fs.existsSync(pathFile)) {
    fs.writeFileSync(pathFile, fs.readFileSync(pathFile, 'utf-8').trim())
  }
}

/** macOS Gatekeeper blocks unsigned/quarantined Electron in dev — fix both. */
function prepareMacOS() {
  if (process.platform !== 'darwin') return
  const app = path.join(distDir, 'Electron.app')
  if (!fs.existsSync(app)) return

  console.log('Preparing Electron.app for macOS (remove quarantine + ad-hoc sign)…')
  try {
    execSync(`xattr -cr "${app}"`, { stdio: 'pipe' })
  } catch {
    // xattr may fail on some files; non-fatal
  }

  // Sign all nested binaries, deepest first
  const signTargets = []
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (
        !entry.name.endsWith('.pak') &&
        !entry.name.endsWith('.bin') &&
        !entry.name.endsWith('.json') &&
        !entry.name.endsWith('.plist') &&
        !entry.name.endsWith('.html') &&
        !entry.name.endsWith('.txt') &&
        !entry.name.endsWith('.icns') &&
        !entry.name.endsWith('.lproj')
      ) {
        signTargets.push(full)
      }
    }
  }
  walk(app)
  signTargets.sort((a, b) => b.length - a.length)

  for (const target of signTargets) {
    try {
      execSync(`codesign --force --sign - "${target}"`, { stdio: 'pipe' })
    } catch {
      // some resource files aren't signable; skip
    }
  }

  try {
    execSync(`codesign --force --deep --sign - "${app}"`, { stdio: 'pipe' })
    console.log('Electron.app signed for local development.')
  } catch (err) {
    console.warn('Warning: codesign failed — you may need to allow the app in System Settings → Privacy & Security.')
    console.warn(String(err.stderr || err.message || err))
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

if (!isInstalled()) {
  try {
    downloadViaInstallJs()
  } catch (err) {
    console.warn('install.js failed:', err.message)
  }
}

if (!isInstalled()) {
  if (!extractFromCache()) {
    console.error(
      'Electron install failed.\n' +
        '  Try: rm -rf node_modules/electron && npm install\n' +
        '  Or:  npm run electron:install'
    )
    process.exit(1)
  }
}

prepareMacOS()

if (isInstalled()) {
  console.log('Electron ready:', path.join(distDir, platformPath))
} else {
  console.error('Electron binary still missing after install attempts.')
  process.exit(1)
}
