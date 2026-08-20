import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeLaunchSettings } from './launchSettingsWriter'

describe('writeLaunchSettings', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sealed-launch-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates Properties/launchSettings.json with a Development profile', () => {
    writeLaunchSettings(dir, { DB_URL: 'postgres://local', EMPTY: '' })
    const filePath = join(dir, 'Properties', 'launchSettings.json')
    expect(existsSync(filePath)).toBe(true)
    const settings = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(settings.profiles.Development.commandName).toBe('Project')
    expect(settings.profiles.Development.environmentVariables).toEqual({
      DB_URL: 'postgres://local',
      EMPTY: ''
    })
  })

  it('merges secrets into every existing profile and preserves other fields', () => {
    const propsDir = join(dir, 'Properties')
    mkdirSync(propsDir, { recursive: true })
    writeFileSync(
      join(propsDir, 'launchSettings.json'),
      JSON.stringify({
        iisSettings: { windowsAuthentication: false },
        profiles: {
          http: {
            commandName: 'Project',
            applicationUrl: 'http://localhost:5000',
            environmentVariables: { ASPNETCORE_ENVIRONMENT: 'Development' }
          },
          https: { commandName: 'Project' }
        }
      }),
      'utf-8'
    )

    writeLaunchSettings(dir, { API_KEY: 'secret' })
    const settings = JSON.parse(readFileSync(join(propsDir, 'launchSettings.json'), 'utf-8'))
    expect(settings.iisSettings.windowsAuthentication).toBe(false)
    expect(settings.profiles.http.applicationUrl).toBe('http://localhost:5000')
    expect(settings.profiles.http.environmentVariables).toEqual({
      ASPNETCORE_ENVIRONMENT: 'Development',
      API_KEY: 'secret'
    })
    expect(settings.profiles.https.environmentVariables).toEqual({ API_KEY: 'secret' })
  })

  it('resets corrupt JSON and creates profiles object when missing', () => {
    const propsDir = join(dir, 'Properties')
    mkdirSync(propsDir, { recursive: true })
    writeFileSync(join(propsDir, 'launchSettings.json'), '{broken', 'utf-8')

    writeLaunchSettings(dir, { KEY: 'value' })
    const settings = JSON.parse(readFileSync(join(propsDir, 'launchSettings.json'), 'utf-8'))
    expect(settings.profiles.Development.environmentVariables.KEY).toBe('value')
  })

  it('creates profiles when file exists without profiles key', () => {
    const propsDir = join(dir, 'Properties')
    mkdirSync(propsDir, { recursive: true })
    writeFileSync(join(propsDir, 'launchSettings.json'), JSON.stringify({ other: true }), 'utf-8')

    writeLaunchSettings(dir, { A: '1' })
    const settings = JSON.parse(readFileSync(join(propsDir, 'launchSettings.json'), 'utf-8'))
    expect(settings.other).toBe(true)
    expect(settings.profiles.Development.environmentVariables.A).toBe('1')
  })
})
