import fs from 'fs'
const c = fs.readFileSync(new URL('../src/features/command-center/CommandCenter.tsx', import.meta.url), 'utf8')
const cm = c.indexOf('{/* AI Briefing */}')
const sec = c.indexOf('<section>', cm)
console.log(JSON.stringify({ cm, sec, next80: c.slice(cm, cm + 120) }))
