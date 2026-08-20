import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SimpleStore } from './simpleStore'

describe('SimpleStore', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sealed-store-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('starts empty and returns fallback / defaults', () => {
    const store = new SimpleStore<{ theme: string; count: number }>({
      name: 'settings',
      userDataPath: dir,
      defaults: { theme: 'system' }
    })
    expect(store.get('theme')).toBe('system')
    expect(store.get('count', 0)).toBe(0)
  })

  it('persists set values across instances', () => {
    const store = new SimpleStore<{ theme: string }>({ name: 'settings', userDataPath: dir })
    store.set('theme', 'dark')
    expect(existsSync(join(dir, 'settings.json'))).toBe(true)

    const again = new SimpleStore<{ theme: string }>({ name: 'settings', userDataPath: dir })
    expect(again.get('theme')).toBe('dark')
  })

  it('creates nested directories when flushing', () => {
    const nested = join(dir, 'a', 'b')
    const store = new SimpleStore<{ x: number }>({ name: 'cfg', userDataPath: nested })
    store.set('x', 1)
    expect(JSON.parse(readFileSync(join(nested, 'cfg.json'), 'utf-8'))).toEqual({ x: 1 })
  })

  it('recovers from corrupt JSON', () => {
    writeFileSync(join(dir, 'broken.json'), '{not-json', 'utf-8')
    const store = new SimpleStore<{ theme: string }>({
      name: 'broken',
      userDataPath: dir,
      defaults: { theme: 'light' }
    })
    expect(store.get('theme')).toBe('light')
  })

  it('deletes keys and resets store', () => {
    const store = new SimpleStore<{ a: string; b: string }>({ name: 'settings', userDataPath: dir })
    store.set('a', '1')
    store.set('b', '2')
    store.delete('a')
    expect(store.get('a')).toBeUndefined()
    expect(store.get('b')).toBe('2')

    store.reset({ b: 'fresh' })
    expect(store.get('b')).toBe('fresh')
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'))).toEqual({ b: 'fresh' })

    store.reset()
    expect(JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8'))).toEqual({})
  })
})
