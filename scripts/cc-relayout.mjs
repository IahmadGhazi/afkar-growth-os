import fs from 'fs'
const p = new URL('../src/features/command-center/CommandCenter.tsx', import.meta.url)
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')
const orig = c

const gridOpen = '      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">\n'
const masterOpen = '      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">\n'

function ensureMasterOpen(src, titleText) {
  const t = src.indexOf(titleText)
  const sec = src.lastIndexOf('<section', t)
  const before = src.slice(0, sec)
  if (before.includes(masterOpen)) return src
  return before + masterOpen + src.slice(sec)
}

// tag the bare <section> immediately AFTER a comment anchor
function tagSectionAfter(src, comment, cls) {
  const cm = src.indexOf(comment)
  if (cm === -1) throw new Error('comment missing: ' + comment)
  const sec = src.indexOf('<section>', cm)
  if (sec === -1) throw new Error('section missing after: ' + comment)
  const lineEnd = src.indexOf('\n', sec)
  const opener = src.slice(sec, lineEnd)
  if (opener.includes('className=')) return src
  return src.slice(0, sec) + `<section className="${cls}">` + src.slice(sec + '<section>'.length)
}

// tag the bare <section> immediately BEFORE a text anchor
function tagSectionBefore(src, anchor, cls) {
  const t = src.indexOf(anchor)
  if (t === -1) throw new Error('anchor missing: ' + anchor)
  const sec = src.lastIndexOf('<section>', t)
  if (sec === -1) throw new Error('section missing before: ' + anchor)
  const lineEnd = src.indexOf('\n', sec)
  const opener = src.slice(sec, lineEnd)
  if (opener.includes('className=')) return src
  return src.slice(0, sec) + `<section className="${cls}">` + src.slice(sec + '<section>'.length)
}

c = ensureMasterOpen(c, 'Business Performance')
c = tagSectionBefore(c, 'Business Performance</SectionTitle>', 'xl:col-span-2 xl:order-1')
c = tagSectionBefore(c, 'Platform Results</SectionTitle>', 'xl:col-span-2 xl:order-2')
c = tagSectionBefore(c, 'Performance Trends</SectionTitle>', 'xl:col-span-2 xl:order-3')
c = tagSectionBefore(c, 'Needs Attention</SectionTitle>', 'xl:col-span-2 xl:order-4')
c = tagSectionBefore(c, 'Spend Pacing', 'xl:col-span-2 xl:order-5')
c = tagSectionAfter(c, '{/* Store Pulse', 'xl:order-6')
c = tagSectionAfter(c, '{/* AI Briefing */}', 'xl:order-7')
c = tagSectionBefore(c, 'Open cart recovery task', 'xl:order-8')
c = tagSectionBefore(c, 'Weekly Objective</SectionTitle>', 'xl:order-9')
c = tagSectionBefore(c, 'Team Execution</SectionTitle>', 'xl:order-10')

// remove the two legacy wrapper opens + closes
let idx = c.indexOf(gridOpen)
if (idx !== -1) {
  c = c.slice(0, idx) + c.slice(idx + gridOpen.length)
  const spendIdx = c.indexOf('{/* Spend Pacing')
  const closeIdx = c.lastIndexOf('    </div>', spendIdx)
  c = c.slice(0, closeIdx) + c.slice(closeIdx + '    </div>\n'.length)
}
const idx2 = c.indexOf(gridOpen)
if (idx2 !== -1) {
  c = c.slice(0, idx2) + c.slice(idx2 + gridOpen.length)
  const endM = c.lastIndexOf('</div>\n}')
  c = c.slice(0, endM) + c.slice(endM + '</div>\n}'.length) + '\n}'
}

if (!c.includes(masterOpen)) throw new Error('master open missing — abort')
if (c === orig) console.log('note: already fully applied')
fs.writeFileSync(p, c, 'utf8')
console.log('CC layout surgery complete')
