# Troubleshooting

## Electron uninstall / missing binary

If `npm run dev` fails with `Error: Electron uninstall`, the Electron binary did not download during install:

```bash
npm run electron:install
```

If that still fails:

```bash
rm -rf node_modules/electron
npm install
```

## macOS Gatekeeper blocks the app

Unsigned builds may show **"Apple could not verify … is free of malware"**.

**Development:** `npm run dev` removes the quarantine flag and ad-hoc signs the Electron binary. If you still see the dialog:

1. Run `npm run electron:install`
2. Open **System Settings → Privacy & Security** and choose **Open Anyway**
3. Or right-click the app in Finder → **Open**

**Production:** installers are notarized when Apple signing secrets are configured. See [macos-signing.md](./macos-signing.md). Until then, right-click → **Open** on first launch.

## App window never opens (`whenReady`)

If the terminal shows `Cannot read properties of undefined (reading 'whenReady')`, your shell may have `ELECTRON_RUN_AS_NODE=1` set (common in some IDE terminals). The dev script clears this automatically; you can also run:

```bash
unset ELECTRON_RUN_AS_NODE
npm run dev
```
