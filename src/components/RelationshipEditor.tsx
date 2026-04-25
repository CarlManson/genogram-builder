import { useState } from 'react'
import { Person, Relationship, RelationshipType } from '../lib/types'

interface Props {
  people: Person[]
  relationship?: Relationship
  onSave: (rel: Relationship) => void
  onDelete?: (id: string) => void
  onClose: () => void
}

export default function RelationshipEditor({ people, relationship, onSave, onDelete, onClose }: Props) {
  const [sourceId, setSourceId] = useState(relationship?.sourceId ?? '')
  const [targetId, setTargetId] = useState(relationship?.targetId ?? '')
  const [type, setType] = useState<RelationshipType>(relationship?.type ?? 'married')
  const [location, setLocation] = useState(relationship?.location ?? '')

  function handleSave() {
    if (!sourceId || !targetId || sourceId === targetId) return
    onSave({
      id: relationship?.id ?? crypto.randomUUID(),
      type,
      sourceId,
      targetId,
      location: location.trim() || undefined,
    })
    onClose()
  }

  return (
    <div style={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <h2 style={styles.title}>{relationship ? 'Edit Relationship' : 'Add Relationship'}</h2>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <label style={styles.label}>From
          <select style={styles.input} value={sourceId} onChange={e => setSourceId(e.target.value)}>
            <option value="">— select person —</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>
                {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown'}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>To
          <select style={styles.input} value={targetId} onChange={e => setTargetId(e.target.value)}>
            <option value="">— select person —</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>
                {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown'}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>Relationship type
          <select style={styles.input} value={type} onChange={e => setType(e.target.value as RelationshipType)}>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="separated">Separated</option>
            <option value="cohabiting">Cohabiting</option>
            <option value="never-married-separated">Never married, not together</option>
            <option value="parent-child">Parent → Child</option>
          </select>
        </label>

        {type !== 'parent-child' && (
          <label style={styles.label}>Location / lives
            <input style={styles.input} placeholder="e.g. Lives in Perth" value={location} onChange={e => setLocation(e.target.value)} />
          </label>
        )}

        <div style={styles.actions}>
          {relationship && onDelete && (
            <button style={styles.deleteBtn} onClick={() => { onDelete(relationship.id); onClose() }}>
              Delete
            </button>
          )}
          <button
            style={{ ...styles.saveBtn, opacity: (!sourceId || !targetId || sourceId === targetId) ? 0.5 : 1 }}
            onClick={handleSave}
            disabled={!sourceId || !targetId || sourceId === targetId}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  panel: {
    background: '#fff', borderRadius: 10, padding: 24, width: 360,
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: '#333',
  },
  input: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 14, fontFamily: 'sans-serif', outline: 'none',
  },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  saveBtn: {
    padding: '8px 20px', background: '#1a1a1a', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
  deleteBtn: {
    padding: '8px 20px', background: '#fff', color: '#dc2626',
    border: '1px solid #dc2626', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
}
