import fs from 'fs'
const p = new URL('../src/features/report/Report.tsx', import.meta.url)
let c = fs.readFileSync(p, 'utf8')
c = c.split('#e0902e').join('#c8920b')
c = c.split('text-[#dd5a5a]').join('text-[#33373f]')
c = c.split(`'#dd5a5a'`).join(`'#33373f'`)
fs.writeFileSync(p, c, 'utf8')
console.log('report tuned safely')
