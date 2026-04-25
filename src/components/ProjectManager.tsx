import { useState } from 'react'
import { Project } from '../lib/types'

interface Props {
  projects: Project[]
  activeProjectId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function ProjectManager({
  projects, activeProjectId, onSelect, onCreate, onRename, onDelete, onClose
}: Props) {
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function handleCreate() {
    const name = newName.trim() || 'Untitled Genogram'
    onCreate(name)
    setNewName('')
  }

  function handleRename(id: string) {
    onRename(id, editName.trim() || 'Untitled Genogram')
    setEditingId(null)
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>My Genograms</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.newList}>
          <input
            style={s.input}
            placeholder="New genogram name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <button style={s.saveBtn} onClick={handleCreate}>Create New</button>
        </div>

        <div style={s.list}>
          {projects.sort((a, b) => b.lastModified - a.lastModified).map(p => (
            <div key={p.id} style={{
              ...s.item,
              background: p.id === activeProjectId ? '#eff6ff' : '#fff',
              borderColor: p.id === activeProjectId ? '#3b82f6' : '#e5e7eb',
            }}>
              <div style={s.itemMain}>
                {editingId === p.id ? (
                  <input
                    style={{ ...s.input, flex: 1 }}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => handleRename(p.id)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(p.id)}
                    autoFocus
                  />
                ) : (
                  <div style={s.itemInfo} onClick={() => { onSelect(p.id); onClose() }}>
                    <span style={s.itemName}>{p.name}</span>
                    <span style={s.itemDate}>{new Date(p.lastModified).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div style={s.itemActions}>
                <button style={s.actionBtn} onClick={() => { setEditingId(p.id); setEditName(p.name) }}>✎</button>
                <button style={{ ...s.actionBtn, color: '#dc2626' }} onClick={() => onDelete(p.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: '#fff', borderRadius: 10, padding: 24, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
  newList: { display: 'flex', gap: 8 },
  input: { padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'sans-serif', outline: 'none', flex: 1 },
  saveBtn: { padding: '8px 16px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
  list: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' },
  item: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', gap: 12 },
  itemMain: { flex: 1, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  itemInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  itemName: { fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif', color: '#1a1a1a' },
  itemDate: { fontSize: 11, color: '#9ca3af', fontFamily: 'sans-serif' },
  itemActions: { display: 'flex', gap: 4 },
  actionBtn: { background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontSize: 16, color: '#6b7280' },
}
