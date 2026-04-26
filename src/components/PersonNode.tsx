import { memo, useState } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Person, Settings } from '../lib/types'
import { personDateLabel } from '../lib/dateUtils'
import { useSettings } from '../lib/SettingsContext'

export const NODE_SIZE = 80
const HALF = NODE_SIZE / 2
const LABEL_WIDTH = 200   // width of the below-shape label block; wide enough that
                          // names overflow visually before they get cropped by the SVG

interface PersonNodeData extends Record<string, unknown> {
  person: Person
}

function buildLines(person: Person, settings: Settings): { lines: string[]; nameCount: number } {
  const nameLines: string[] = []
  if (settings.nameFormat === 'first-only') {
    if (person.firstName) nameLines.push(person.firstName)
  } else if (settings.nameFormat === 'married') {
    const first = [person.firstName, person.middleName].filter(Boolean).join(' ')
    if (first) nameLines.push(first)
    const surname = person.marriedName || person.lastName
    if (surname) nameLines.push(surname)
  } else {
    const first = [person.firstName, person.middleName].filter(Boolean).join(' ')
    if (first) nameLines.push(first)
    if (person.lastName) nameLines.push(person.lastName)
  }
  const d = personDateLabel(person, settings.dateDisplay)
  const lines = d ? [...nameLines, d] : [...nameLines]
  if (lines.length === 0) return { lines: ['Unknown'], nameCount: 1 }
  return { lines, nameCount: nameLines.length }
}

function PersonShape({ person, settings, hovered }: { person: Person; settings: Settings; hovered: boolean }) {
  const design = settings.design
  const baseStroke = person.outlineColor ?? design.outlineColor
  const baseStrokeWidth = person.outlineColor ? Math.max(design.outlineThickness, 2) : design.outlineThickness
  const fill = person.deceased ? design.deceasedFillColor : design.shapeFillColor
  const stroke = hovered ? '#3b82f6' : baseStroke
  const strokeWidth = hovered ? baseStrokeWidth + 1 : baseStrokeWidth
  const id = person.id.replace(/\W/g, '')

  // Text inside the shape is only rendered when the user has opted in via
  // `cropNamesToShape`. The default flow renders names as a sibling div below
  // the shape (see PersonNode below) so they're never clipped.
  const showInsideText = design.cropNamesToShape
  const { lines, nameCount } = buildLines(person, settings)
  const lineH = Math.max(12, Math.round(design.fontSize * 1.4))
  const totalTextH = lines.length * lineH
  const startY = HALF - totalTextH / 2 + lineH * 0.5

  const textEls = showInsideText ? lines.map((line, i) => (
    <text
      key={i}
      x={HALF}
      y={startY + i * lineH}
      textAnchor="middle"
      dominantBaseline="middle"
      fontFamily="sans-serif"
      fontSize={design.fontSize}
      fill={i < nameCount ? design.nameTextColor : design.dateTextColor}
      fontWeight={i < nameCount ? 'bold' : 'normal'}
    >
      {line}
    </text>
  )) : null

  const crossLines = person.deceased ? (
    <>
      <line x1={12} y1={12} x2={NODE_SIZE - 12} y2={NODE_SIZE - 12} stroke={design.deceasedCrossColor} strokeWidth={1.5} />
      <line x1={NODE_SIZE - 12} y1={12} x2={12} y2={NODE_SIZE - 12} stroke={design.deceasedCrossColor} strokeWidth={1.5} />
    </>
  ) : null

  if (person.sex === 'male') {
    return (
      <svg width={NODE_SIZE} height={NODE_SIZE} style={{ display: 'block', overflow: 'visible' }}>
        {showInsideText && (
          <defs>
            <clipPath id={`clip-text-${id}`}>
              <rect x={3} y={3} width={NODE_SIZE - 6} height={NODE_SIZE - 6} />
            </clipPath>
          </defs>
        )}
        <rect x={1} y={1} width={NODE_SIZE - 2} height={NODE_SIZE - 2} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        {crossLines}
        {showInsideText && <g clipPath={`url(#clip-text-${id})`}>{textEls}</g>}
      </svg>
    )
  }

  if (person.sex === 'female') {
    return (
      <svg width={NODE_SIZE} height={NODE_SIZE} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <clipPath id={`clip-shape-${id}`}>
            <circle cx={HALF} cy={HALF} r={HALF - 1} />
          </clipPath>
          {showInsideText && (
            <clipPath id={`clip-text-${id}`}>
              <circle cx={HALF} cy={HALF} r={HALF - 4} />
            </clipPath>
          )}
        </defs>
        <circle cx={HALF} cy={HALF} r={HALF - 1} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
        <g clipPath={`url(#clip-shape-${id})`}>{crossLines}</g>
        {showInsideText && <g clipPath={`url(#clip-text-${id})`}>{textEls}</g>}
      </svg>
    )
  }

  // Unknown → triangle (point up); Other (and any unrecognised value) → diamond
  const pts = person.sex === 'unknown'
    ? `${HALF},2 ${NODE_SIZE - 2},${NODE_SIZE - 2} 2,${NODE_SIZE - 2}`
    : `${HALF},2 ${NODE_SIZE - 2},${HALF} ${HALF},${NODE_SIZE - 2} 2,${HALF}`
  return (
    <svg width={NODE_SIZE} height={NODE_SIZE} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={`clip-shape-${id}`}>
          <polygon points={pts} />
        </clipPath>
        {showInsideText && (
          <clipPath id={`clip-text-${id}`}>
            <polygon points={pts} />
          </clipPath>
        )}
      </defs>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      <g clipPath={`url(#clip-shape-${id})`}>{crossLines}</g>
      {showInsideText && <g clipPath={`url(#clip-text-${id})`}>{textEls}</g>}
    </svg>
  )
}

function PersonNode({ data, selected }: NodeProps) {
  const { person } = data as PersonNodeData
  const settings = useSettings()
  const design = settings.design
  const [hovered, setHovered] = useState(false)
  const showLabelBelow = !design.cropNamesToShape
  const { lines, nameCount } = buildLines(person, settings)

  return (
    <div
      style={{ position: 'relative', width: NODE_SIZE, cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: -3, left: -3, width: NODE_SIZE + 6, height: NODE_SIZE + 6,
          borderRadius: 4, outline: '2px solid #3b82f6', pointerEvents: 'none',
        }} />
      )}
      <PersonShape person={person} settings={settings} hovered={hovered} />
      {showLabelBelow && (
        <div style={{
          textAlign: 'center', fontFamily: 'sans-serif',
          fontSize: design.fontSize, lineHeight: 1.25,
          marginTop: 4, width: LABEL_WIDTH, marginLeft: (NODE_SIZE - LABEL_WIDTH) / 2,
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{
              fontWeight: i < nameCount ? 600 : 400,
              color: i < nameCount ? design.nameTextColor : design.dateTextColor,
            }}>
              {line}
            </div>
          ))}
        </div>
      )}
      {person.occupation && (
        <div style={{
          textAlign: 'center', fontSize: design.fontSize, fontFamily: 'sans-serif',
          color: design.occupationTextColor,
          marginTop: 3, width: LABEL_WIDTH, marginLeft: (NODE_SIZE - LABEL_WIDTH) / 2, lineHeight: 1.25,
        }}>
          {person.occupation}
        </div>
      )}
      {person.causeOfDeath && (
        <div style={{
          textAlign: 'center', fontSize: design.fontSize, fontFamily: 'sans-serif',
          color: design.causeOfDeathTextColor, fontStyle: 'italic',
          width: LABEL_WIDTH, marginLeft: (NODE_SIZE - LABEL_WIDTH) / 2, lineHeight: 1.25,
        }}>
          {person.causeOfDeath}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
    </div>
  )
}

export default memo(PersonNode)
