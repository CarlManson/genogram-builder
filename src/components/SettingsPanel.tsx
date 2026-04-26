import { useState } from 'react'
import { Settings, DesignSettings, NameFormat, DateDisplay, Person, OUTLINE_COLORS, DEFAULT_DESIGN } from '../lib/types'

interface Props {
  settings: Settings
  people: Person[]
  onSave: (settings: Settings) => void
  onClose: () => void
}

type Tab = 'general' | 'design'

export default function SettingsPanel({ settings, people, onSave, onClose }: Props) {
  const [form, setForm] = useState<Settings>({ ...settings, design: { ...settings.design } })
  const [tab, setTab] = useState<Tab>('general')

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setDesign<K extends keyof DesignSettings>(key: K, value: DesignSettings[K]) {
    setForm(f => ({ ...f, design: { ...f.design, [key]: value } }))
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

        <div style={s.tabs}>
          <TabButton active={tab === 'general'} onClick={() => setTab('general')}>General</TabButton>
          <TabButton active={tab === 'design'} onClick={() => setTab('design')}>Design</TabButton>
        </div>

        {tab === 'general' && (
          <>
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
          </>
        )}

        {tab === 'design' && (
          <>
            <p style={s.sectionLabel}>Typography</p>
            <label style={s.label}>Label font size ({form.design.fontSize}px)
              <input
                type="range" min={8} max={16} step={1}
                value={form.design.fontSize}
                onChange={e => setDesign('fontSize', Number(e.target.value))}
                style={s.range}
              />
            </label>

            <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={form.design.cropNamesToShape}
                onChange={e => setDesign('cropNamesToShape', e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Crop names to shape boundary
            </label>

            <hr style={s.hr} />

            <p style={s.sectionLabel}>Shape outline</p>
            <ColourRow
              label="Default colour"
              value={form.design.outlineColor}
              onChange={c => setDesign('outlineColor', c)}
            />
            <label style={s.label}>Thickness ({form.design.outlineThickness.toFixed(1)})
              <input
                type="range" min={1} max={4} step={0.5}
                value={form.design.outlineThickness}
                onChange={e => setDesign('outlineThickness', Number(e.target.value))}
                style={s.range}
              />
            </label>

            <hr style={s.hr} />

            <p style={s.sectionLabel}>Couple / marriage line</p>
            <ColourRow
              label="Colour"
              value={form.design.coupleLineColor}
              onChange={c => setDesign('coupleLineColor', c)}
            />
            <label style={s.label}>Thickness ({form.design.coupleLineThickness.toFixed(1)})
              <input
                type="range" min={1} max={4} step={0.5}
                value={form.design.coupleLineThickness}
                onChange={e => setDesign('coupleLineThickness', Number(e.target.value))}
                style={s.range}
              />
            </label>

            <hr style={s.hr} />

            <p style={s.sectionLabel}>Parent–child line</p>
            <ColourRow
              label="Colour"
              value={form.design.parentChildLineColor}
              onChange={c => setDesign('parentChildLineColor', c)}
            />
            <label style={s.label}>Thickness ({form.design.parentChildLineThickness.toFixed(1)})
              <input
                type="range" min={1} max={4} step={0.5}
                value={form.design.parentChildLineThickness}
                onChange={e => setDesign('parentChildLineThickness', Number(e.target.value))}
                style={s.range}
              />
            </label>

            <hr style={s.hr} />

            <button
              style={s.resetBtn}
              onClick={() => setForm(f => ({ ...f, design: { ...DEFAULT_DESIGN } }))}
            >
              Reset design to defaults
            </button>
          </>
        )}

        <div style={s.actions}>
          <button style={s.saveBtn} onClick={() => { onSave(form); onClose() }}>Apply</button>
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...s.tab,
        color: active ? '#1a1a1a' : '#6b7280',
        borderBottomColor: active ? '#1a1a1a' : 'transparent',
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  )
}

function ColourRow({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <div style={s.colourRow}>
      <span style={s.colourRowLabel}>{label}</span>
      <div style={s.swatches}>
        {OUTLINE_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Set ${label.toLowerCase()} to ${c}`}
            title={c}
            style={{
              width: 18, height: 18, borderRadius: 4, border: 'none',
              background: c, cursor: 'pointer', padding: 0,
              boxShadow: c === value ? '0 0 0 2px #fff, 0 0 0 4px #1a1a1a' : undefined,
            }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ width: 22, height: 22, padding: 0, border: '1px solid #d1d5db', borderRadius: 4, background: 'none', cursor: 'pointer' }}
          title="Pick any colour"
        />
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: '#fff', borderRadius: 10, padding: 24, width: 400, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 4 },
  tab: { padding: '8px 14px', fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '2px solid', marginBottom: -1 },
  sectionLabel: { margin: 0, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: '#1a1a1a' },
  hint: { margin: 0, fontSize: 12, fontFamily: 'sans-serif', color: '#9ca3af' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: '#333' },
  input: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'sans-serif', outline: 'none' },
  range: { width: '100%' },
  hr: { border: 'none', borderTop: '1px solid #e5e7eb', margin: '4px 0' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  saveBtn: { padding: '8px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
  resetBtn: { padding: '7px 14px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif', alignSelf: 'flex-start' },
  colourRow: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontFamily: 'sans-serif', color: '#333', fontWeight: 500 },
  colourRowLabel: { minWidth: 90 },
  swatches: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' },
}
