import fs from 'fs'
// Appends the polish layer to index.css (idempotent marker check)
const p = new URL('../src/index.css', import.meta.url)
let css = fs.readFileSync(p, 'utf8')
if (css.includes('AFKAR POLISH LAYER')) { console.log('already applied'); process.exit(0) }
css += `
/* ═══════════ AFKAR POLISH LAYER ═══════════ */
::selection {
  background: color-mix(in srgb, var(--brand) 28%, transparent);
  color: var(--text-primary);
}
* {
  scrollbar-width: thin;
  scrollbar-color: var(--hairline) transparent;
}
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-thumb { background: var(--hairline); border-radius: 8px; }
*::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
*::-webkit-scrollbar-track { background: transparent; }
:where(button, a, input, select, textarea):focus-visible {
  outline: 2px solid color-mix(in srgb, var(--brand) 55%, transparent);
  outline-offset: 2px;
  border-radius: 10px;
}
body, [data-theme] .glass-card, [data-theme] .glass-strong {
  transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease;
}
@media (prefers-reduced-motion: reduce) {
  body, .glass-card, .glass-strong { transition: none; }
}
.glass-card, .glass, .glass-strong {
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.04),
    0 8px 24px -8px rgb(0 0 0 / 0.10),
    inset 0 1px 0 rgb(255 255 255 / 0.35);
}
[data-theme="dark"] .glass-card, [data-theme="dark"] .glass, [data-theme="dark"] .glass-strong {
  box-shadow:
    0 1px 2px rgb(0 0 0 / 0.4),
    0 12px 32px -12px rgb(0 0 0 / 0.55),
    inset 0 1px 0 rgb(255 255 255 / 0.06);
}
.hover-lift { transition: transform 180ms ease-out, box-shadow 180ms ease-out; }
.hover-lift:hover { transform: translateY(-2px); }
@media (prefers-reduced-motion: reduce) { .hover-lift:hover { transform: none; } }
`
fs.writeFileSync(p, css, 'utf8')
console.log('polish layer appended')
