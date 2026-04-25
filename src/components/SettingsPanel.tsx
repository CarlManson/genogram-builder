import { useState } from 'react'
import { Settings, NameFormat, DateDisplay, Person } from '../lib/types'

interface Props {
  settings: Settings
  people: Person[]
  onSave: (settings: Settings) => void
  onClose: () => void
}

export default function SettingsPanel({ settings, people, onSave, onClose }: Props) {
  const [form, setForm] = useState<Settings>({ ...settings })

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const sortedPeople = [...people].sort((a, b) => {
    const na = [a.firstName, a.lastName].filter(Boolean).join(' ')
    const nb = [b.firstName, b.lastName].filter(Boolean).join(' ')
    return na.localeCompare(nb)
  })

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>Settings</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <p style={s.sectionLabel}>Member defaults</p>
        <p style={s.hint}>These apply to all members. Overridable per member in the member editor.</p>

        <label style={s.label}>Name format
          <select style={s.input} value={form.nameFormat} onChange={e => set('nameFormat', e.target.value as NameFormat)}>
            <option value="birth">Birth name (First + Birth surname)</option>
            <option value="married">Married name (First + Married surname)</option>
            <option value="first-only">First name only</option>
          </select>
        </label>

        <label style={s.label}>Birth / Death display
          <select style={s.input} value={form.dateDisplay} onChange={e => set('dateDisplay', e.target.value as DateDisplay)}>
            <option value="year">Year</option>
            <option value="date">Full date</option>
            <option value="age">Age</option>
          </select>
        </label>

        <hr style={s.hr} />

        <p style={s.sectionLabel}>Focal Person</p>
        <label style={s.label}>Focal person
          <select style={s.input} value={form.focalPersonId || ''} onChange={e => set('focalPersonId', e.target.value || undefined)}>
            <option value="">— none —</option>
            {sortedPeople.map(p => (
              <option key={p.id} value={p.id}>
                {[p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown'}
              </option>
            ))}
          </select>
        </label>

        <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <input
            type="checkbox"
            checked={!!form.showFocalEllipse}
            onChange={e => set('showFocalEllipse', e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Draw ellipse around couple
        </label>

        <div style={s.actions}>
          <button style={s.saveBtn} onClick={() => { onSave(form); onClose() }}>Apply</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: '#fff', borderRadius: 10, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
  sectionLabel: { margin: 0, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: '#1a1a1a' },
  hint: { margin: 0, fontSize: 12, fontFamily: 'sans-serif', color: '#9ca3af' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: '#333' },
  input: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'sans-serif', outline: 'none' },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  saveBtn: { padding: '8px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
}
