import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeEnvFile, parseEnvText } from './envWriter'
import { ensureGitignored } from './gitignore'

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'sealed-sync-test-'))
}

describe('parseEnvText', () => {
  it('parses basic key=value', () => {
    const result = parseEnvText('FOO=bar\nBAZ=qux')
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' })
  })

  it('strips surrounding double and single quotes', () => {
    expect(parseEnvText('KEY="hello world"')).toEqual({ KEY: 'hello world' })
    expect(parseEnvText("KEY='hello world'")).toEqual({ KEY: 'hello world' })
  })

  it('ignores comments and blank lines', () => {
    const result = parseEnvText('# comment\n\nKEY=value')
    expect(result).toEqual({ KEY: 'value' })
  })

  it('handles values with equals signs', () => {
    const result = parseEnvText('URL=http://example.com?foo=bar')
    expect(result['URL']).toBe('http://example.com?foo=bar')
  })

  it('skips lines without a key before equals', () => {
    expect(parseEnvText('=novalue\n=')).toEqual({})
  })
})

describe('writeEnvFile', () => {
  let dir: string

  beforeEach(() => {
    dir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('writes .env with header comment', () => {
    writeEnvFile(dir, { API_KEY: 'secret', DB_URL: 'postgres://localhost' })
    const content = readFileSync(join(dir, '.env'), 'utf-8')
    expect(content).toContain('Sealed')
    expect(content).toContain('API_KEY=secret')
    expect(content).toContain('DB_URL=postgres://localhost')
  })

  it('quotes values with spaces and special characters, escaping quotes', () => {
    writeEnvFile(dir, {
      GREETING: 'hello world',
      HASH: 'a#b',
      QUOTED: 'say "hi"'
    })
    const content = readFileSync(join(dir, '.env'), 'utf-8')
    expect(content).toContain('GREETING="hello world"')
    expect(content).toContain('HASH="a#b"')
    expect(content).toContain('QUOTED="say \\"hi\\""')
  })

  it('writes header only for an empty secrets map', () => {
    writeEnvFile(dir, {})
    const content = readFileSync(join(dir, '.env'), 'utf-8')
    expect(content).toContain('Sealed')
    expect(content.trim().split('\n').some((l) => l.includes('='))).toBe(false)
  })
})

describe('ensureGitignored', () => {
  let dir: string

  beforeEach(() => {
    dir = makeTmpDir()
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates .gitignore if absent', () => {
    ensureGitignored(dir, '.env')
    const content = readFileSync(join(dir, '.gitignore'), 'utf-8')
    expect(content).toContain('.env')
  })

  it('appends to existing .gitignore', () => {
    const gitignorePath = join(dir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules\n', 'utf-8')
    ensureGitignored(dir, '.env')
    const content = readFileSync(gitignorePath, 'utf-8')
    expect(content).toContain('node_modules')
    expect(content).toContain('.env')
  })

  it('adds a leading newline when file has no trailing newline', () => {
    const gitignorePath = join(dir, '.gitignore')
    writeFileSync(gitignorePath, 'node_modules', 'utf-8')
    ensureGitignored(dir, '.env')
    expect(readFileSync(gitignorePath, 'utf-8')).toBe('node_modules\n.env\n')
  })

  it('does not duplicate existing entry', () => {
    ensureGitignored(dir, '.env')
    ensureGitignored(dir, '.env')
    const content = readFileSync(join(dir, '.gitignore'), 'utf-8')
    const count = content.split('\n').filter((l) => l.trim() === '.env').length
    expect(count).toBe(1)
  })
})
