import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

/**
 * Minimal synchronous JSON key-value store for non-secret settings.
 * Replaces electron-store to avoid ESM/CJS compatibility issues.
 */
export class SimpleStore<T extends Record<string, unknown> = Record<string, unknown>> {
  private filePath: string
  private data: Partial<T>
  private defaults: Partial<T>

  constructor(options: { name: string; userDataPath: string; defaults?: Partial<T> }) {
    this.filePath = join(options.userDataPath, `${options.name}.json`)
    this.defaults = options.defaults ?? {}
    this.data = this.load()
  }

  private load(): Partial<T> {
    if (!existsSync(this.filePath)) return {}
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<T>
    } catch {
      return {}
    }
  }

  private flush(): void {
    const dir = dirname(this.filePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  get<K extends keyof T>(key: K, fallback?: T[K]): T[K] {
    const val = this.data[key] ?? this.defaults[key] ?? fallback
    return val as T[K]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
    this.flush()
  }
}
