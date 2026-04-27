import { useState } from 'react'
import { useNodes, useViewport } from '@xyflow/react'
import { Person, Relationship } from '../lib/types'
import { buildFamilies } from '../lib/families'
import { useSettings } from '../lib/SettingsContext'

const NW = 80
const NH = 80
const SIBSHIP_GAP = 28
// Twin signal: distance to drop below the sibship line before the V fans out,
// so the wishbone reads as its own marker instead of a flap on the sibship.
const TWIN_APEX_DROP = 12
const HOVER_COLOR = '#3b82f6'

interface Props {
  relationships: Relationship[]
  onCoupleDoubleClick?: (relId: string) => void
}

export default function GenogramConnections({ relationships, onCoupleDoubleClick }: Props) {
  const nodes = useNodes()
  const settings = useSettings()
  const design = settings.design
  const { x: vpX, y: vpY, zoom } = useViewport()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const coupleColor = design.coupleLineColor
  const coupleWidth = design.coupleLineThickness
  const pcColor = design.parentChildLineColor
  const pcWidth = design.parentChildLineThickness

  const posMap = new Map(nodes.map(n => [n.id, n.position]))
  const personMap = new Map(nodes.map(n => [n.id, n.data.person as Person]))
  const families = buildFamilies(relationships)

  const coupleRelById = new Map<string, string>()
  for (const r of relationships) {
    if (r.type !== 'parent-child') {
      coupleRelById.set([r.sourceId, r.targetId].sort().join(':'), r.id)
    }
  }

  const locationById = new Map<string, string>()
  for (const r of relationships) {
    if (r.location) locationById.set(r.id, r.location)
  }

  function hitLine(
    key: string, familyKey: string,
    props: React.SVGProps<SVGLineElement>,
    { onDoubleClick, wide }: { onDoubleClick?: () => void; wide?: boolean } = {}
  ) {
    return (
      <line
        key={key} {...props}
        stroke="transparent"
        strokeWidth={wide ? 24 : 16}
        style={{ pointerEvents: 'stroke', cursor: onDoubleClick ? 'pointer' : 'default' }}
        onMouseEnter={() => setHoveredKey(familyKey)}
        onMouseLeave={() => setHoveredKey(null)}
        onDoubleClick={onDoubleClick}
      />
    )
  }

  const visibles: React.ReactNode[] = []
  const hits: React.ReactNode[] = []

  // --- Focal Ellipse ---
  if (settings.showFocalEllipse && settings.focalPersonId) {
    const p1Id = settings.focalPersonId
    const p1Pos = posMap.get(p1Id)
    if (p1Pos) {
      // Find a spouse
      const rel = relationships.find(r => r.type !== 'parent-child' && (r.sourceId === p1Id || r.targetId === p1Id))
      const p2Id = rel ? (rel.sourceId === p1Id ? rel.targetId : rel.sourceId) : undefined
      const p2Pos = p2Id ? posMap.get(p2Id) : undefined

      let bounds: { minX: number; minY: number; maxX: number; maxY: number }
      if (p2Pos) {
        bounds = {
          minX: Math.min(p1Pos.x, p2Pos.x),
          minY: Math.min(p1Pos.y, p2Pos.y),
          maxX: Math.max(p1Pos.x, p2Pos.x) + NW,
          maxY: Math.max(p1Pos.y, p2Pos.y) + NH,
        }
      } else {
        bounds = {
          minX: p1Pos.x,
          minY: p1Pos.y,
          maxX: p1Pos.x + NW,
          maxY: p1Pos.y + NH,
        }
      }

      const marginX = 40
      const marginY = 60
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      const rx = (bounds.maxX - bounds.minX) / 2 + marginX
      const ry = (bounds.maxY - bounds.minY) / 2 + marginY

      visibles.push(
        <ellipse
          key="focal-ellipse"
          cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6,4"
          style={{ pointerEvents: 'none' }}
        />
      )
    }
  }

  for (const family of families) {
    const [p1Id, p2Id] = family.parentIds
    const p1Pos = posMap.get(p1Id)
    if (!p1Pos) continue

    const isSingleParent = !p2Id
    let coupleY = 0
    let midX = 0
    let sibshipY = 0
    let sibLeft = 0
    let sibRight = 0
    let familyKey = ''

    if (p2Id) {
      const p2Pos = posMap.get(p2Id)
      if (!p2Pos) continue
      const [leftPos, rightPos] = p1Pos.x <= p2Pos.x ? [p1Pos, p2Pos] : [p2Pos, p1Pos]
      coupleY = ((leftPos.y + NH / 2) + (rightPos.y + NH / 2)) / 2
      const x1 = leftPos.x + NW
      const x2 = rightPos.x
      midX = (x1 + x2) / 2
      familyKey = [p1Id, p2Id].sort().join(':')
      const coupleRelId = coupleRelById.get(familyKey)
      const location = coupleRelId ? locationById.get(coupleRelId) : undefined
      const isDashed = family.coupleType === 'cohabiting' || family.coupleType === 'never-married-separated'
      const dash = isDashed ? '6,4' : undefined
      const hovered = hoveredKey === familyKey
      const stroke = hovered ? HOVER_COLOR : coupleColor
      const strokeWidth = hovered ? coupleWidth + 1 : coupleWidth

      visibles.push(
        <line key={`couple-${familyKey}`} x1={x1} y1={coupleY} x2={x2} y2={coupleY} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} style={{ pointerEvents: 'none' }} />
      )
      hits.push(hitLine(`hit-couple-${familyKey}`, familyKey, { x1, y1: coupleY, x2, y2: coupleY, strokeDasharray: dash }, { wide: true, onDoubleClick: coupleRelId ? () => onCoupleDoubleClick?.(coupleRelId) : undefined }))

      // Slashes are offset 12px left of midX so they don't overlap the
      // vertical drop line which descends from exactly midX.
      const slashCx = midX - 12
      if (family.coupleType === 'divorced') {
        visibles.push(
          <line key={`div1-${familyKey}`} x1={slashCx - 6} y1={coupleY - 8} x2={slashCx - 2} y2={coupleY + 8} stroke={stroke} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />,
          <line key={`div2-${familyKey}`} x1={slashCx + 2} y1={coupleY - 8} x2={slashCx + 6} y2={coupleY + 8} stroke={stroke} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />
        )
      } else if (family.coupleType === 'separated' || family.coupleType === 'never-married-separated') {
        visibles.push(<line key={`sep-${familyKey}`} x1={slashCx - 4} y1={coupleY - 8} x2={slashCx} y2={coupleY + 8} stroke={stroke} strokeWidth={strokeWidth} style={{ pointerEvents: 'none' }} />)
      }

      if (location) {
        visibles.push(<text key={`loc-${familyKey}`} x={midX} y={coupleY - 8} textAnchor="middle" fontFamily="sans-serif" fontSize={11} fill={hovered ? HOVER_COLOR : design.locationTextColor} style={{ pointerEvents: 'none' }}>{location}</text>)
      }
    } else {
      midX = p1Pos.x + NW / 2
      coupleY = p1Pos.y + NH
      familyKey = `single-${p1Id}`
    }

    if (family.childIds.length > 0) {
      const childData = family.childIds.map(id => ({ id, pos: posMap.get(id), p: personMap.get(id) })).filter(d => d.pos && d.p)
      if (childData.length > 0) {
        const minChildY = Math.min(...childData.map(d => d.pos!.y))
        sibshipY = Math.max(coupleY + (isSingleParent ? 10 : 20), minChildY - SIBSHIP_GAP)
        const childCXs = childData.map(d => d.pos!.x + NW / 2)
        sibLeft = Math.min(midX, ...childCXs)
        sibRight = Math.max(midX, ...childCXs)

        const hovered = hoveredKey === familyKey
        const stroke = hovered && !isSingleParent ? HOVER_COLOR : pcColor

        // Group children by birthDate to detect twins
        const dateGroups = new Map<string, string[]>()
        const nonDateChildren: string[] = []

        for (const child of childData) {
          const bd = child.p!.birthDate
          if (bd && bd.length >= 10) { // Only auto-detect if full date YYYY-MM-DD
            if (!dateGroups.has(bd)) dateGroups.set(bd, [])
            dateGroups.get(bd)!.push(child.id)
          } else {
            nonDateChildren.push(child.id)
          }
        }

        // Twins-only family: every child shares the same birthdate. Render as a
        // wishbone — straight drop from couple, two diagonals out to each twin —
        // instead of drop + horizontal sibship + converging fan.
        const twinsOnlyIds = nonDateChildren.length === 0 && dateGroups.size === 1
          ? [...dateGroups.values()][0]
          : null

        if (twinsOnlyIds && twinsOnlyIds.length >= 2) {
          visibles.push(
            <line key={`drop-${familyKey}`} x1={midX} y1={coupleY} x2={midX} y2={sibshipY} stroke={stroke} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />
          )
          for (const id of twinsOnlyIds) {
            const cp = posMap.get(id)
            if (!cp) continue
            const cx = cp.x + NW / 2
            visibles.push(<line key={`child-${familyKey}-${id}`} x1={midX} y1={sibshipY} x2={cx} y2={cp.y} stroke={pcColor} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />)
          }
        } else {
          visibles.push(
            <line key={`drop-${familyKey}`} x1={midX} y1={coupleY} x2={midX} y2={sibshipY} stroke={stroke} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />,
            <line key={`sib-${familyKey}`} x1={sibLeft} y1={sibshipY} x2={sibRight} y2={sibshipY} stroke={stroke} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />
          )

          for (const childId of nonDateChildren) {
            const cp = posMap.get(childId)
            if (!cp) continue
            const cx = cp.x + NW / 2
            visibles.push(<line key={`child-${familyKey}-${childId}`} x1={cx} y1={sibshipY} x2={cx} y2={cp.y} stroke={pcColor} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />)
          }

          for (const [, ids] of dateGroups.entries()) {
            if (ids.length === 1) {
              const cp = posMap.get(ids[0])
              if (!cp) continue
              const cx = cp.x + NW / 2
              visibles.push(<line key={`child-${familyKey}-${ids[0]}`} x1={cx} y1={sibshipY} x2={cx} y2={cp.y} stroke={pcColor} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />)
            } else {
              // Twins among siblings: short vertical from the sibship to a
              // wishbone apex, then V to each twin.
              const cPositions = ids.map(id => posMap.get(id)).filter(Boolean) as { x: number; y: number }[]
              const avgCX = cPositions.reduce((sum, p) => sum + p.x + NW / 2, 0) / cPositions.length
              const apexY = sibshipY + TWIN_APEX_DROP
              visibles.push(<line key={`twin-stem-${familyKey}-${ids[0]}`} x1={avgCX} y1={sibshipY} x2={avgCX} y2={apexY} stroke={pcColor} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />)
              for (const id of ids) {
                const cp = posMap.get(id)
                if (!cp) continue
                const cx = cp.x + NW / 2
                visibles.push(<line key={`child-${familyKey}-${id}`} x1={avgCX} y1={apexY} x2={cx} y2={cp.y} stroke={pcColor} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />)
              }
            }
          }
        }
      }
    }
  }

  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 3 }}>
      <g transform={`translate(${vpX},${vpY}) scale(${zoom})`}>
        {visibles}
        {hits}
      </g>
    </svg>
  )
}
