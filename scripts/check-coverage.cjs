#!/usr/bin/env node
/**
 * Fail the process if gated coverage is below 100%, and refresh
 * badges/coverage.json for the README Shields endpoint badge.
 */
const fs = require('fs')
const path = require('path')

const MIN = 100
const summaryPath = path.join('coverage', 'coverage-summary.json')
const badgePath = path.join('badges', 'coverage.json')

if (!fs.existsSync(summaryPath)) {
  console.error('Missing coverage/coverage-summary.json. Run: npm run test:coverage')
  process.exit(1)
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
const total = summary.total
const metrics = ['lines', 'statements', 'functions', 'branches']

console.log('Coverage summary (gated modules):')
let failed = false
for (const metric of metrics) {
  const pct = total[metric]?.pct
  if (typeof pct !== 'number') {
    console.error(`Missing metric: ${metric}`)
    process.exit(1)
  }
  const mark = pct >= MIN ? 'ok' : 'FAIL'
  console.log(`  ${metric.padEnd(12)} ${pct}%  [${mark}]`)
  if (pct < MIN) failed = true
}

const pct = Math.min(...metrics.map((m) => total[m].pct))
const message = Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`
const color = pct >= 100 ? 'brightgreen' : pct >= 90 ? 'yellow' : 'red'

const badge = {
  schemaVersion: 1,
  label: 'coverage',
  message,
  color
}

fs.mkdirSync(path.dirname(badgePath), { recursive: true })
fs.writeFileSync(badgePath, `${JSON.stringify(badge, null, 2)}\n`)
console.log(`Wrote ${badgePath} → ${message}`)

if (failed) {
  console.error(`\nCoverage must be ${MIN}% on all metrics. PR cannot merge.`)
  process.exit(1)
}

console.log(`\nCoverage gate passed (${message}).`)
