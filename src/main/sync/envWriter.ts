import { writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Write a .env file from a key/value map, overwriting any previous Sealed-managed content.
 * The file is marked with a header comment so users know it is auto-managed.
 */
export function writeEnvFile(folderPath: string, secrets: Record<string, string>): void {
  const lines = [
    '# This file is auto-managed by Sealed. Do not edit manually.',
    '# Add it to .gitignore to keep secrets out of source control.',
    ''
  ]
  for (const [key, value] of Object.entries(secrets)) {
    // Quote values containing spaces or special chars
    const needsQuotes = /[\s"'`$\\#]/.test(value)
    lines.push(`${key}=${needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}`)
  }
  lines.push('')
  writeFileSync(join(folderPath, '.env'), lines.join('\n'), 'utf-8')
}

/**
 * Parse a .env text string (e.g. pasted by the user) into key/value pairs.
 * Skips blank lines and comment lines.
 */
export function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx < 1) continue
    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key) result[key] = value
  }
  return result
}
