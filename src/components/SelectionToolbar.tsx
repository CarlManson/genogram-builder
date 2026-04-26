import { useNodes, useViewport } from '@xyflow/react'
import {
  Pencil,
  Trash2,
  Sparkles,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
} from 'lucide-react'

const NODE_SIZE = 80
const TOOLBAR_GAP = 12

interface Props {
  onEdit: (id: string) => void
  onDelete: (ids: string[]) => void
  onCleanDescendants: (id: string) => void
  onAlignHorizontal: (ids: string[]) => void
  onAlignVertical: (ids: string[]) => void
}

export default function SelectionToolbar({
  onEdit, onDelete, onCleanDescendants, onAlignHorizontal, onAlignVertical,
}: Props) {
  const nodes = useNodes()
  const { x: vpX, y: vpY, zoom } = useViewport()

  const selected = nodes.filter(n => n.selected)
  if (selected.length === 0) return null

  const minX = Math.min(...selected.map(n => n.position.x))
  const maxX = Math.max(...selected.map(n => n.position.x + NODE_SIZE))
  const minY = Math.min(...selected.map(n => n.position.y))

  const screenLeft = minX * zoom + vpX
  const screenRight = maxX * zoom + vpX
  const screenTop = minY * zoom + vpY
  const centerX = (screenLeft + screenRight) / 2

  const ids = selected.map(n => n.id)
  const isMulti = selected.length >= 2

  return (
    <div
      style={{
        position: 'absolute',
        top: screenTop - TOOLBAR_GAP,
        left: centerX,
        transform: 'translate(-50%, -100%)',
        zIndex: 5,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
        display: 'flex',
        gap: 2,
        padding: 4,
        alignItems: 'center',
        pointerEvents: 'auto',
      }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {!isMulti ? (
        <>
          <ToolBtn label="Edit" onClick={() => onEdit(ids[0])}><Pencil size={16} /></ToolBtn>
          <ToolBtn label="Clean up descendants" onClick={() => onCleanDescendants(ids[0])}><Sparkles size={16} /></ToolBtn>
          <ToolBtn label="Delete" danger onClick={() => onDelete(ids)}><Trash2 size={16} /></ToolBtn>
        </>
      ) : (
        <>
          <ToolBtn label="Align horizontally (same row)" onClick={() => onAlignHorizontal(ids)}><AlignHorizontalSpaceAround size={16} /></ToolBtn>
          <ToolBtn label="Align vertically (same column)" onClick={() => onAlignVertical(ids)}><AlignVerticalSpaceAround size={16} /></ToolBtn>
          <ToolBtn label={`Delete ${selected.length}`} danger onClick={() => onDelete(ids)}><Trash2 size={16} /></ToolBtn>
        </>
      )}
    </div>
  )
}

function ToolBtn({
  label, onClick, danger, children,
}: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        background: 'transparent',
        border: 'none',
        padding: '6px 8px',
        cursor: 'pointer',
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        color: danger ? '#dc2626' : '#374151',
        lineHeight: 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? '#fff1f1' : '#f3f4f6' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
