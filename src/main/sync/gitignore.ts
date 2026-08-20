import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export function ensureGitignored(folderPath: string, entry: string): void {
  const gitignorePath = join(folderPath, '.gitignore')
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${entry}\n`, 'utf-8')
    return
  }
  const content = readFileSync(gitignorePath, 'utf-8')
  const lines = content.split('\n').map((l) => l.trim())
  if (!lines.includes(entry)) {
    const updated = content.endsWith('\n') ? content + `${entry}\n` : content + `\n${entry}\n`
    writeFileSync(gitignorePath, updated, 'utf-8')
  }
}
