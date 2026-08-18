import { useId } from 'react'
import { formatShort } from '../../lib/date'

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '')
}

export interface TrendDatum {
  date: string
  value: number
}

export function Sparkline({
  data,
  color = '#d29a0c',
  width = 132,
  height = 38,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
}) {
  const gid = safeId(useId())
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const pts = data.map((value, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = height - pad - ((value - min) / range) * (height - pad * 2)
    return [x, y] as const
  })
  const line = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
    </svg>
  )
}

export function TrendChart({
  data,
  mode = 'area',
  color = '#d29a0c',
  target,
  targetLabel,
  formatValue,
  height = 150,
}: {
  data: TrendDatum[]
  mode?: 'area' | 'line' | 'bar'
  color?: string
  target?: number
  targetLabel?: string
  formatValue?: (value: number) => string
  height?: number
}) {
  const gid = safeId(useId())
  if (data.length < 2) return null

  const W = 300
  const H = height
  const padL = 6
  const padR = 40
  const padT = 10
  const padB = 20
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const values = data.map((d) => d.value)
  const all = target != null ? [...values, target] : values
  const rawMin = Math.min(...all)
  const rawMax = Math.max(...all)
  const range = rawMax - rawMin
  const pad = range === 0 ? Math.max(Math.abs(rawMin) * 0.1, 1) : range * 0.18
  const min = rawMin - pad
  const max = rawMax + pad

  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * innerH
  const x = (i: number) => padL + (i / (data.length - 1)) * innerW

  const stepX = innerW / (data.length - 1)
  const barW = Math.max(6, stepX * 0.55)

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`)
    .join(' ')
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`

  const maxLabel = formatValue ? formatValue(max) : Math.round(max).toLocaleString()
  const minLabel = formatValue ? formatValue(min) : Math.round(min).toLocaleString()

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* gridlines + labels */}
      <line x1={padL} y1={y(max)} x2={padL + innerW} y2={y(max)} stroke="var(--hairline)" strokeDasharray="3 4" />
      <text x={padL + innerW + 6} y={y(max) + 3.5} fontSize="9.5" fill="var(--text-muted)">
        {maxLabel}
      </text>
      <line x1={padL} y1={y(min)} x2={padL + innerW} y2={y(min)} stroke="var(--hairline)" strokeDasharray="3 4" />
      <text x={padL + innerW + 6} y={y(min) + 3.5} fontSize="9.5" fill="var(--text-muted)">
        {minLabel}
      </text>

      {/* target line */}
      {target != null && (
        <line
          x1={padL}
          y1={y(target)}
          x2={padL + innerW}
          y2={y(target)}
          stroke="#e0902e"
          strokeWidth="1.25"
          strokeDasharray="4 4"
        />
      )}
      {target != null && targetLabel && (
        <text x={padL + innerW + 6} y={y(target) - 3} fontSize="9.5" fill="#e0902e">
          {targetLabel}
        </text>
      )}

      {/* series */}
      {mode === 'bar' ? (
        data.map((d, i) => (
          <rect
            key={i}
            x={x(i) - barW / 2}
            y={y(d.value)}
            width={barW}
            height={Math.max(1, padT + innerH - y(d.value))}
            rx={3}
            fill={color}
            fillOpacity={0.82}
          />
        ))
      ) : (
        <>
          <path d={areaPath} fill={`url(#${gid})`} />
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle
            cx={x(data.length - 1)}
            cy={y(data[data.length - 1].value)}
            r="3"
            fill={color}
            stroke="var(--surface-solid)"
            strokeWidth="1.5"
          />
        </>
      )}

      {/* x labels */}
      <text x={padL} y={H - 4} fontSize="9.5" fill="var(--text-muted)">
        {formatShort(data[0].date)}
      </text>
      <text x={padL + innerW} y={H - 4} fontSize="9.5" fill="var(--text-muted)" textAnchor="end">
        {formatShort(data[data.length - 1].date)}
      </text>
    </svg>
  )
}
