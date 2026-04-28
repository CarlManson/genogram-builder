import { useState, useRef, useCallback } from 'react'
import { useNodes, useViewport } from '@xyflow/react'
import { Person, Relationship } from '../lib/types'
import { buildFamilies } from '../lib/families'
import { useSettings } from '../lib/SettingsContext'

const NW = 80
const NH = 80
const SIBSHIP_GAP = 28
const TWIN_APEX_DROP = 12
const HOVER_COLOR = '#3b82f6'

interface Props {
  relationships: Relationship[]
  sibshipOffsets?: Record<string, number>
  onCoupleDoubleClick?: (relId: string) => void
  onParentChildDoubleClick?: (relId: string) => void
  onSibshipDragStart?: () => void
  onSibshipOffsetChange?: (familyId: string, offset: number) => void
}

export default function GenogramConnections({ relationships, sibshipOffsets, onCoupleDoubleClick, onParentChildDoubleClick, onSibshipDragStart, onSibshipOffsetChange }: Props) {
  const nodes = useNodes()
  const settings = useSettings()
  const design = settings.design
  const { x: vpX, y: vpY, zoom } = useViewport()
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [hoveredChildRelId, setHoveredChildRelId] = useState<string | null>(null)
  const [draggingSibship, setDraggingSibship] = useState<string | null>(null)

  // Track drag start in screen coords so we can compute delta
  const sibshipDragRef = useRef<{
    familyId: string
    startScreenY: number
    startOffset: number
  } | null>(null)

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

  // parent-child relationship lookup: "parentId:childId" → rel id
  const pcRelById = new Map<string, string>()
  for (const r of relationships) {
    if (r.type === 'parent-child') {
      pcRelById.set(`${r.sourceId}:${r.targetId}`, r.id)
    }
  }

  // Sibship handle drag handlers — attached to the SVG element so the drag
  // doesn't break when the cursor moves faster than the handle.
  const onSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const ref = sibshipDragRef.current
    if (!ref) return
    const deltaScreen = e.clientY - ref.startScreenY
    const deltaCanvas = deltaScreen / zoom
    onSibshipOffsetChange?.(ref.familyId, ref.startOffset + deltaCanvas)
  }, [zoom, onSibshipOffsetChange])

  const onSvgMouseUp = useCallback(() => {
    sibshipDragRef.current = null
    setDraggingSibship(null)
  }, [])

  function startSibshipDrag(e: React.MouseEvent, familyId: string, currentOffset: number) {
    e.stopPropagation()
    e.preventDefault()
    onSibshipDragStart?.()
    sibshipDragRef.current = { familyId, startScreenY: e.clientY, startOffset: currentOffset }
    setDraggingSibship(familyId)
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

  // Returns the id of the first parent-child relationship from this family to childId.
  function pcRelId(parentIds: string[], childId: string): string | undefined {
    for (const pid of parentIds) {
      const id = pcRelById.get(`${pid}:${childId}`)
      if (id) return id
    }
    return undefined
  }

  function childHitLine(key: string, familyKey: string, parentIds: string[], childId: string, x1: number, y1: number, x2: number, y2: number) {
    const relId = pcRelId(parentIds, childId)
    return (
      <line
        key={key}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="transparent"
        strokeWidth={16}
        style={{ pointerEvents: 'stroke', cursor: relId ? 'pointer' : 'default' }}
        onMouseEnter={() => { setHoveredKey(familyKey); if (relId) setHoveredChildRelId(relId) }}
        onMouseLeave={() => { setHoveredKey(null); setHoveredChildRelId(null) }}
        onDoubleClick={relId ? () => onParentChildDoubleClick?.(relId) : undefined}
      />
    )
  }

  const visibles: React.ReactNode[] = []
  const hits: React.ReactNode[] = []
  // Drag handles rendered on top of everything else
  const handles: React.ReactNode[] = []

  // --- Focal Ellipse ---
  if (settings.showFocalEllipse && settings.focalPersonId) {
    const p1Id = settings.focalPersonId
    const p1Pos = posMap.get(p1Id)
    if (p1Pos) {
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

    const familyParentIds = [p1Id, p2Id].filter(Boolean) as string[]

    const childDash = (childId: string): string | undefined => {
      const childRels = relationships.filter(r =>
        r.type === 'parent-child' && r.targetId === childId && familyParentIds.includes(r.sourceId)
      )
      if (childRels.length === 0) return undefined
      const natures = childRels.map(r => r.nature ?? 'biological')
      if (natures.every(n => n === 'adopted')) return '6,4'
      if (natures.every(n => n === 'foster')) return '2,3'
      return undefined
    }

    if (family.childIds.length > 0) {
      const childData = family.childIds.map(id => ({ id, pos: posMap.get(id), p: personMap.get(id) })).filter(d => d.pos && d.p)
      if (childData.length > 0) {
        const minChildY = Math.min(...childData.map(d => d.pos!.y))
        const baseSibshipY = Math.max(coupleY + (isSingleParent ? 10 : 20), minChildY - SIBSHIP_GAP)
        const offset = sibshipOffsets?.[family.id] ?? 0
        sibshipY = baseSibshipY + offset

        const hovered = hoveredKey === familyKey
        const isDragging = draggingSibship === family.id
        const stroke = hovered && !isSingleParent ? HOVER_COLOR : pcColor

        const dateGroups = new Map<string, string[]>()
        const nonDateChildren: string[] = []

        for (const child of childData) {
          const bd = child.p!.birthDate
          if (bd && bd.length >= 10) {
            if (!dateGroups.has(bd)) dateGroups.set(bd, [])
            dateGroups.get(bd)!.push(child.id)
          } else {
            nonDateChildren.push(child.id)
          }
        }

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
            const cRelId = pcRelId(familyParentIds, id)
            const cHovered = !!cRelId && hoveredChildRelId === cRelId
            visibles.push(<line key={`child-${familyKey}-${id}`} x1={midX} y1={sibshipY} x2={cx} y2={cp.y} stroke={cHovered ? HOVER_COLOR : pcColor} strokeWidth={cHovered ? pcWidth + 1 : pcWidth} strokeDasharray={childDash(id)} style={{ pointerEvents: 'none' }} />)
            hits.push(childHitLine(`hit-child-${familyKey}-${id}`, familyKey, familyParentIds, id, midX, sibshipY, cx, cp.y))
          }

          // Drag handle on the drop line midpoint for twins-only
          if (onSibshipOffsetChange) {
            const handleY = (coupleY + sibshipY) / 2
            handles.push(
              <SibshipHandle
                key={`sib-handle-${family.id}`}
                x={midX}
                y={handleY}
                active={isDragging}
                onMouseDown={e => startSibshipDrag(e, family.id, offset)}
              />
            )
          }
        } else {
          const sibConnectionXs: number[] = []
          for (const childId of nonDateChildren) {
            const cp = posMap.get(childId)
            if (cp) sibConnectionXs.push(cp.x + NW / 2)
          }
          const twinGroups: Array<{ ids: string[]; avgCX: number }> = []
          for (const ids of dateGroups.values()) {
            if (ids.length === 1) {
              const cp = posMap.get(ids[0])
              if (cp) sibConnectionXs.push(cp.x + NW / 2)
            } else {
              const cPositions = ids.map(id => posMap.get(id)).filter(Boolean) as { x: number; y: number }[]
              const avgCX = cPositions.reduce((sum, p) => sum + p.x + NW / 2, 0) / cPositions.length
              twinGroups.push({ ids, avgCX })
              sibConnectionXs.push(avgCX)
            }
          }
          sibLeft = Math.min(midX, ...sibConnectionXs)
          sibRight = Math.max(midX, ...sibConnectionXs)

          visibles.push(
            <line key={`drop-${familyKey}`} x1={midX} y1={coupleY} x2={midX} y2={sibshipY} stroke={stroke} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />,
            <line key={`sib-${familyKey}`} x1={sibLeft} y1={sibshipY} x2={sibRight} y2={sibshipY} stroke={stroke} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />
          )

          for (const childId of nonDateChildren) {
            const cp = posMap.get(childId)
            if (!cp) continue
            const cx = cp.x + NW / 2
            const cRelId = pcRelId(familyParentIds, childId)
            const cHovered = !!cRelId && hoveredChildRelId === cRelId
            visibles.push(<line key={`child-${familyKey}-${childId}`} x1={cx} y1={sibshipY} x2={cx} y2={cp.y} stroke={cHovered ? HOVER_COLOR : pcColor} strokeWidth={cHovered ? pcWidth + 1 : pcWidth} strokeDasharray={childDash(childId)} style={{ pointerEvents: 'none' }} />)
            hits.push(childHitLine(`hit-child-${familyKey}-${childId}`, familyKey, familyParentIds, childId, cx, sibshipY, cx, cp.y))
          }

          for (const ids of dateGroups.values()) {
            if (ids.length === 1) {
              const cp = posMap.get(ids[0])
              if (!cp) continue
              const cx = cp.x + NW / 2
              const cRelId = pcRelId(familyParentIds, ids[0])
              const cHovered = !!cRelId && hoveredChildRelId === cRelId
              visibles.push(<line key={`child-${familyKey}-${ids[0]}`} x1={cx} y1={sibshipY} x2={cx} y2={cp.y} stroke={cHovered ? HOVER_COLOR : pcColor} strokeWidth={cHovered ? pcWidth + 1 : pcWidth} strokeDasharray={childDash(ids[0])} style={{ pointerEvents: 'none' }} />)
              hits.push(childHitLine(`hit-child-${familyKey}-${ids[0]}`, familyKey, familyParentIds, ids[0], cx, sibshipY, cx, cp.y))
            }
          }

          for (const { ids, avgCX } of twinGroups) {
            const apexY = sibshipY + TWIN_APEX_DROP
            visibles.push(<line key={`twin-stem-${familyKey}-${ids[0]}`} x1={avgCX} y1={sibshipY} x2={avgCX} y2={apexY} stroke={pcColor} strokeWidth={pcWidth} style={{ pointerEvents: 'none' }} />)
            for (const id of ids) {
              const cp = posMap.get(id)
              if (!cp) continue
              const cx = cp.x + NW / 2
              const cRelId = pcRelId(familyParentIds, id)
              const cHovered = !!cRelId && hoveredChildRelId === cRelId
              visibles.push(<line key={`child-${familyKey}-${id}`} x1={avgCX} y1={apexY} x2={cx} y2={cp.y} stroke={cHovered ? HOVER_COLOR : pcColor} strokeWidth={cHovered ? pcWidth + 1 : pcWidth} strokeDasharray={childDash(id)} style={{ pointerEvents: 'none' }} />)
              hits.push(childHitLine(`hit-child-${familyKey}-${id}`, familyKey, familyParentIds, id, avgCX, apexY, cx, cp.y))
            }
          }

          // Drag handle sits at the midpoint of the sibship line
          if (onSibshipOffsetChange) {
            const handleX = (sibLeft + sibRight) / 2
            handles.push(
              <SibshipHandle
                key={`sib-handle-${family.id}`}
                x={handleX}
                y={sibshipY}
                active={isDragging}
                onMouseDown={e => startSibshipDrag(e, family.id, offset)}
              />
            )
          }
        }
      }
    }
  }

  return (
    <svg
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        overflow: 'visible', pointerEvents: draggingSibship ? 'all' : 'none', zIndex: 3,
        cursor: draggingSibship ? 'ns-resize' : undefined,
      }}
      onMouseMove={onSvgMouseMove}
      onMouseUp={onSvgMouseUp}
      onMouseLeave={onSvgMouseUp}
    >
      <g transform={`translate(${vpX},${vpY}) scale(${zoom})`}>
        {visibles}
        {hits}
        {handles}
      </g>
    </svg>
  )
}

// Small pill handle rendered on the sibship line. Has its own pointer-events
// so it can receive mouse-down even though the parent SVG is pointerEvents:none.
function SibshipHandle({ x, y, active, onMouseDown }: {
  x: number
  y: number
  active: boolean
  onMouseDown: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered] = useState(false)
  const w = 28
  const h = 8
  const show = hovered || active
  return (
    <g
      style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onMouseDown}
    >
      {/* Invisible fat hit area */}
      <rect x={x - w / 2 - 4} y={y - 10} width={w + 8} height={20} fill="transparent" />
      {/* Visible pill — only shown on hover / active drag */}
      {show && (
        <rect
          x={x - w / 2} y={y - h / 2}
          width={w} height={h}
          rx={4}
          fill={active ? HOVER_COLOR : '#94a3b8'}
          opacity={0.85}
        />
      )}
    </g>
  )
}
