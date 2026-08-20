import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

interface LaunchProfile {
  commandName: string
  environmentVariables?: Record<string, string>
  [key: string]: unknown
}

interface LaunchSettings {
  profiles?: Record<string, LaunchProfile>
  [key: string]: unknown
}

/**
 * Merge Sealed-managed secrets into Properties/launchSettings.json.
 * Creates the file if it doesn't exist. Preserves all existing profiles and
 * non-env settings; only adds/updates the environmentVariables keys.
 */
export function writeLaunchSettings(folderPath: string, secrets: Record<string, string>): void {
  const propsDir = join(folderPath, 'Properties')
  const filePath = join(propsDir, 'launchSettings.json')

  let settings: LaunchSettings = {}
  if (existsSync(filePath)) {
    try {
      settings = JSON.parse(readFileSync(filePath, 'utf-8')) as LaunchSettings
    } catch {
      settings = {}
    }
  } else {
    mkdirSync(propsDir, { recursive: true })
  }

  if (!settings.profiles) {
    settings.profiles = {}
  }

  // If no profiles exist, create a default one
  const profileNames = Object.keys(settings.profiles)
  const targetProfiles = profileNames.length > 0 ? profileNames : ['Development']

  for (const profileName of targetProfiles) {
    if (!settings.profiles[profileName]) {
      settings.profiles[profileName] = { commandName: 'Project' }
    }
    const profile = settings.profiles[profileName]
    profile.environmentVariables = {
      ...(profile.environmentVariables ?? {}),
      ...secrets
    }
  }

  writeFileSync(filePath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
}
