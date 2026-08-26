import fs from 'fs'
const p = new URL('../src/features/command-center/CommandCenter.tsx', import.meta.url)
let c = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n')

// ── collect ALL section opener positions (bare + classed) in document order
const positions = []
let i = c.indexOf('<section')
while (i !== -1) { positions.push(i); i = c.indexOf('<section', i + 1) }
if (positions.length < 12) throw new Error('expected >=12 sections, found ' + positions.length)

// document order: S1 connections · S2 hero · S3 BP · S4 Platform · S5 Trends
// S6 Briefing · S7 CartOpp · S8 Pulse · S9 Needs · S10 Spend · S11 Objective · S12 Team
const tags = {
  2: 'xl:col-span-2 xl:order-1',
  3: 'xl:col-span-2 xl:order-2',
  4: 'xl:col-span-2 xl:order-3',
  8: 'xl:order-6',
  5: 'xl:order-7',
  6: 'xl:order-8',
  9: 'xl:col-span-2 xl:order-4',
  10: 'xl:col-span-2 xl:order-5',
  11: 'xl:order-9',
  12: 'xl:order-10',
}

// tag from last to first; skip sections that already carry a className
for (const key of Object.keys(tags).map(Number).sort((a, b) => b - a)) {
  const at = positions[key]
  const lineEnd = c.indexOf('\n', at)
  if (c.slice(at, lineEnd).includes('className=')) continue
  c = c.slice(0, at) + `<section className="${tags[key]}">` + c.slice(at + '<section>'.length)
}

// ── master grid opens before S3 (BP); recompute S3 position after nothing shifted before it
const bp = c.indexOf('<section className="xl:col-span-2 xl:order-1">')
c = c.slice(0, bp) + '      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">\n' + c.slice(bp)

// ── remove wrapper1 (before Pulse): last lg-grid open before Pulse's tagged opener
const pulseIdx = c.indexOf('<section className="xl:order-6">')
const w1 = c.lastIndexOf('      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">\n', pulseIdx)
if (w1 !== -1) c = c.slice(0, w1) + c.slice(w1 + '      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">\n'.length)

// wrapper1 close = the '    </div>' line right before the Spend comment
const spendComment = c.indexOf('{/* Spend Pacing')
const w1close = c.lastIndexOf('\n    </div>', spendComment)
if (w1close !== -1) c = c.slice(0, w1close) + c.slice(w1close + '\n    </div>'.length)

// ── remove wrapper2 (before Objective): remaining lg-grid open
const w2 = c.indexOf('      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">\n')
if (w2 !== -1) c = c.slice(0, w2) + c.slice(w2 + '      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">\n'.length)

// wrapper2 close = the last '    </div>' before end (it closed wrapper2)
const endBrace = c.lastIndexOf('\n}')
const w2close = c.lastIndexOf('\n    </div>', endBrace)
if (w2close !== -1) c = c.slice(0, w2close) + c.slice(w2close + '\n    </div>'.length)

// ── master grid closes at the very end
c = c.replace(/\n<\/div>\n\}$/, '\n      </div>\n    </div>\n}')

fs.writeFileSync(p, c, 'utf8')
console.log('positional CC surgery complete · sections:', positions.length)
