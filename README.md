# Sealed

A local encrypted secrets manager for developers. Store secrets once, inject them into any project without touching your code.

## Features

- **Encrypted vault** — AES-256-GCM encryption with scrypt key derivation. Your master password never leaves your machine.
- **Per-app secrets** — Group secrets by project. Each app has its own isolated vault.
- **Auto-inject** — Link project folders and Sealed writes a git-ignored `.env` or `launchSettings.json` automatically.
- **Two storage backends** — Local encrypted file (default) or MongoDB (ciphertext only).
- **Cross-platform** — Windows (NSIS), macOS (DMG), and Linux (AppImage / deb).

## Getting Started

### Install

Download the latest installer from **[GitHub Releases](https://github.com/Myrafy/sealed/releases/latest)**:

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `Sealed-*-mac-arm64.dmg` |
| macOS (Intel) | `Sealed-*-mac-x64.dmg` |
| Windows | `Sealed-*-win-x64.exe` |
| Linux | `Sealed-*-linux-x64.AppImage` or `.deb` |

**macOS note:** builds are currently unsigned. After download, right-click the app → **Open** the first time (Gatekeeper).

### Publish a release (maintainers)

1. Bump `"version"` in `package.json` (e.g. `1.0.1`).
2. Commit, then tag and push:

```bash
git tag v1.0.1
git push origin v1.0.1
```

3. GitHub Actions builds macOS / Windows / Linux packages and uploads them to the release for that tag.

You can also run **Actions → Release → Run workflow** manually.

### First run

1. Choose a strong master password (this encrypts everything — there is no recovery if lost).
2. Optionally provide a MongoDB connection URI for cross-machine sync. Skip to store locally.
3. Create your first App and add secrets.

### Adding secrets to a project

1. Open an App and click **Link project**.
2. Choose the injection format:
   - `.env` — for Node.js (Next.js, Express, etc.)
   - `launchSettings.json` — for .NET Core
3. Pick the project folder. Sealed writes the file immediately and keeps it in sync.

## Usage in your projects

### Next.js

Nothing needed. Add this to `.env.local` or just use `.env`. Next.js auto-loads it at startup.

```js
// Access secrets via process.env
const url = process.env.DATABASE_URL
```

### Express / Node.js

```js
// If using a package like dotenv, call it at the top of your entry file.
// Or just use process.env directly — Sealed writes the .env file, Node picks it up.
require('dotenv').config()  // optional, for non-Next projects
const port = process.env.PORT
```

### .NET Core — Option A: DotNetEnv

```sh
dotnet add package DotNetEnv
```

```csharp
// Program.cs (top of file)
DotNetEnv.Env.Load();

// Then use anywhere
var connStr = Environment.GetEnvironmentVariable("DATABASE_URL");
```

### .NET Core — Option B: launchSettings.json

Choose **launchSettings.json** format when linking the project. Sealed merges secrets into `Properties/launchSettings.json`. Visual Studio and `dotnet run` inject these automatically — no code changes needed.

## Building from source

```sh
npm install
npm run dev         # Development mode
npm run test        # Run unit tests
npm run build:mac   # macOS DMG
npm run build:win   # Windows NSIS installer
```

### Troubleshooting: "Electron uninstall" error

If `npm run dev` fails with `Error: Electron uninstall`, the Electron binary did not download during install. Run:

```sh
npm run electron:install
```

If that still fails, remove and reinstall:

```sh
rm -rf node_modules/electron
npm install
```

### Troubleshooting: macOS blocks the app (Gatekeeper)

macOS may show **"Apple could not verify … is free of malware"** when running unsigned Electron apps in dev mode. The project handles this automatically — `npm run dev` runs a script that removes the quarantine flag and ad-hoc signs the Electron binary.

If you still see the block dialog:

1. Run the fix manually:
   ```sh
   npm run electron:install
   ```
2. Open **System Settings → Privacy & Security** and click **Open Anyway** next to the blocked app message.
3. Alternatively, right-click the app in Finder and choose **Open** (bypasses Gatekeeper once).

If the app window never opens and the terminal shows `Cannot read properties of undefined (reading 'whenReady')`, your shell may have `ELECTRON_RUN_AS_NODE=1` set (common in some IDE terminals). The dev script clears this automatically, but you can also run:

```sh
unset ELECTRON_RUN_AS_NODE
npm run dev
```

For production builds, sign with a Developer ID certificate and notarize via `electron-builder` (see [Electron docs](https://www.electronjs.org/docs/latest/tutorial/code-signing)).

## Architecture

```
src/
  main/
    crypto/         # kdf.ts (scrypt), cipher.ts (AES-256-GCM)
    storage/        # provider.ts (interface), fileProvider.ts, mongoProvider.ts
    sync/           # envWriter.ts, launchSettingsWriter.ts, gitignore.ts
    index.ts        # Electron main process
    ipc.ts          # All IPC handlers
  preload/
    index.ts        # contextBridge API (window.api)
  renderer/
    src/
      pages/        # Setup, Unlock, AppDetail, Settings
      store/        # Zustand store
      components/   # Toast, Modal, PasswordInput
shared/
  types.ts          # All IPC contracts and data models
```

## Security

- Master key is held only in main-process memory; never exposed to the renderer.
- The renderer never receives secret values unless the user explicitly clicks "Reveal" or "Copy".
- MongoDB stores only ciphertext + IV + auth tag. The connection string is stored via Electron `safeStorage`.
- Each secret value uses a random IV — no IV reuse.
- Wrong master password is detected via a verifier check, not garbage output.
- `.env` and `launchSettings.json` are automatically added to `.gitignore` when a project is linked.

## Future roadmap

- Local agent + language SDKs for zero-file injection
- Multiple environments (dev / staging / prod) per App
- Team secret sharing
- CLI (`sealed sync`, `sealed add`)
- More language support (Python, Go, Ruby)
