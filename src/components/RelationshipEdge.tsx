import { EdgeProps, getBezierPath, getStraightPath } from '@xyflow/react'
import { RelationshipType } from '../lib/types'

interface RelEdgeData extends Record<string, unknown> {
  relationshipType: RelationshipType
}

export default function RelationshipEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const relType = (data as RelEdgeData)?.relationshipType ?? 'married'

  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  const midX = (sourceX + targetX) / 2
  const midY = (sourceY + targetY) / 2

  if (relType === 'parent-child') {
    const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
    return <path id={id} d={path} fill="none" stroke="#1a1a1a" strokeWidth={1.5} />
  }

  if (relType === 'married') {
    return <path id={id} d={edgePath} fill="none" stroke="#1a1a1a" strokeWidth={2} />
  }

  if (relType === 'divorced') {
    return (
      <g>
        <path d={edgePath} fill="none" stroke="#1a1a1a" strokeWidth={2} />
        <line x1={midX - 6} y1={midY - 8} x2={midX - 2} y2={midY + 8} stroke="#1a1a1a" strokeWidth={2} />
        <line x1={midX + 2} y1={midY - 8} x2={midX + 6} y2={midY + 8} stroke="#1a1a1a" strokeWidth={2} />
      </g>
    )
  }

  if (relType === 'separated') {
    return (
      <g>
        <path d={edgePath} fill="none" stroke="#1a1a1a" strokeWidth={2} />
        <line x1={midX - 4} y1={midY - 8} x2={midX} y2={midY + 8} stroke="#1a1a1a" strokeWidth={2} />
      </g>
    )
  }

  if (relType === 'cohabiting') {
    return <path id={id} d={edgePath} fill="none" stroke="#1a1a1a" strokeWidth={2} strokeDasharray="6,4" />
  }

  return <path id={id} d={edgePath} fill="none" stroke="#999" strokeWidth={1.5} />
}
