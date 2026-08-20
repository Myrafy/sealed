/**
 * Notarize after signing when Apple credentials are present.
 * Skips cleanly for local/unsigned CI builds.
 */
exports.default = async function notarizeMac(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const hasApiKey = Boolean(process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID && process.env.APPLE_API_ISSUER)
  const hasAppleId = Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID)

  if (!hasApiKey && !hasAppleId) {
    console.log('Skipping notarization (no Apple credentials in env).')
    return
  }

  // Signing must have succeeded for notarization to make sense
  if (!process.env.CSC_LINK && process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
    console.log('Skipping notarization (unsigned build).')
    return
  }

  const { notarize } = require('@electron/notarize')
  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`Notarizing ${appPath}…`)

  if (hasApiKey) {
    // APPLE_API_KEY may be a path or base64 contents — electron-builder usually expects a path.
    // If base64, write a temp file.
    let apiKeyPath = process.env.APPLE_API_KEY
    if (apiKeyPath && !apiKeyPath.includes('/') && !apiKeyPath.endsWith('.p8')) {
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const tmp = path.join(os.tmpdir(), `AuthKey_${process.env.APPLE_API_KEY_ID}.p8`)
      fs.writeFileSync(tmp, Buffer.from(apiKeyPath, 'base64'))
      apiKeyPath = tmp
    }

    await notarize({
      tool: 'notarytool',
      appPath,
      appleApiKey: apiKeyPath,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      appleApiIssuer: process.env.APPLE_API_ISSUER
    })
  } else {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    })
  }

  console.log('Notarization complete.')
}
