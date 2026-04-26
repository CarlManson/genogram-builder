import { useState, useRef } from 'react'
import { parseGedcom, buildGenogramFromGedcom, GedcomPerson } from '../lib/gedcom'
import { GenogramData } from '../lib/types'

interface Props {
  onImport: (data: GenogramData) => void
  onClose: () => void
}

export default function GedcomImport({ onImport, onClose }: Props) {
  const [people, setPeople] = useState<GedcomPerson[]>([])
  const [rawRecords, setRawRecords] = useState<unknown[]>([])
  const [startId, setStartId] = useState('')
  const [above, setAbove] = useState(2)
  const [below, setBelow] = useState(2)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const content = ev.target?.result as string
        const { people: p, rawRecords: r } = parseGedcom(content)
        setPeople(p)
        setRawRecords(r)
        setStartId(p[0]?.id ?? '')
        setError('')
      } catch {
        setError('Could not parse GEDCOM file. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    if (!startId) return
    const data = buildGenogramFromGedcom(
      rawRecords as Parameters<typeof buildGenogramFromGedcom>[0],
      people,
      startId,
      above,
      below
    )
    onImport(data)
    onClose()
  }

  const filtered = people.filter(p =>
    p.fullName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>Import from GEDCOM</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div
          style={s.dropzone}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const file = e.dataTransfer.files[0]
            if (file) {
              const input = fileRef.current!
              const dt = new DataTransfer()
              dt.items.add(file)
              input.files = dt.files
              input.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }}
        >
          {people.length > 0 ? (
            <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ {people.length} people loaded</span>
          ) : (
            <span>Click or drag a <strong>.ged</strong> file here</span>
          )}
        </div>
        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={handleFile} />

        {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}

        {people.length > 0 && (
          <>
            <label style={s.label}>Starting person
              <input
                style={s.input}
                placeholder="Search by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div style={s.personList}>
                {filtered.slice(0, 100).map(p => (
                  <div
                    key={p.id}
                    style={{
                      ...s.personRow,
                      background: startId === p.id ? '#eff6ff' : undefined,
                      fontWeight: startId === p.id ? 600 : undefined,
                    }}
                    onClick={() => setStartId(p.id)}
                  >
                    <span style={sexBadgeStyle(p.sex)}>{p.sex === 'male' ? '□' : p.sex === 'female' ? '○' : '△'}</span>
                    <span>{p.fullName || '(no name)'}</span>
                    {p.birthDate && <span style={{ color: '#666', fontSize: 12 }}>{p.birthDate.slice(0, 4)}</span>}
                  </div>
                ))}
                {filtered.length > 100 && (
                  <div style={{ padding: '6px 12px', color: '#666', fontSize: 12 }}>
                    …{filtered.length - 100} more, refine your search
                  </div>
                )}
              </div>
            </label>

            <div style={s.row}>
              <label style={{ ...s.label, flex: 1 }}>
                Generations above
                <div style={s.stepperRow}>
                  <button style={s.stepBtn} onClick={() => setAbove(a => Math.max(0, a - 1))}>−</button>
                  <span style={s.stepVal}>{above}</span>
                  <button style={s.stepBtn} onClick={() => setAbove(a => Math.min(10, a + 1))}>+</button>
                </div>
              </label>
              <label style={{ ...s.label, flex: 1 }}>
                Generations below
                <div style={s.stepperRow}>
                  <button style={s.stepBtn} onClick={() => setBelow(b => Math.max(0, b - 1))}>−</button>
                  <span style={s.stepVal}>{below}</span>
                  <button style={s.stepBtn} onClick={() => setBelow(b => Math.min(10, b + 1))}>+</button>
                </div>
              </label>
            </div>
          </>
        )}

        <div style={s.actions}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.importBtn, opacity: !startId ? 0.5 : 1 }}
            disabled={!startId}
            onClick={handleImport}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  panel: {
    background: '#fff', borderRadius: 10, padding: 24, width: 440, maxHeight: '90vh',
    overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    display: 'flex', flexDirection: 'column', gap: 14,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
  dropzone: {
    border: '2px dashed #d1d5db', borderRadius: 8, padding: '20px 16px',
    textAlign: 'center', cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif', color: '#555',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: '#333',
  },
  input: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db',
    fontSize: 14, fontFamily: 'sans-serif', outline: 'none',
  },
  personList: {
    border: '1px solid #e5e7eb', borderRadius: 6, maxHeight: 200, overflowY: 'auto',
  },
  personRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer',
    fontSize: 13, fontFamily: 'sans-serif', borderBottom: '1px solid #f3f4f6',
  },
  row: { display: 'flex', gap: 16 },
  stepperRow: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 },
  stepBtn: {
    width: 28, height: 28, border: '1px solid #d1d5db', borderRadius: 6,
    background: '#f9fafb', cursor: 'pointer', fontSize: 16, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  },
  stepVal: { fontSize: 16, fontWeight: 600, fontFamily: 'sans-serif', minWidth: 24, textAlign: 'center' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  importBtn: {
    padding: '8px 20px', background: '#1a1a1a', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
  cancelBtn: {
    padding: '8px 20px', background: '#fff', color: '#333',
    border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
}

function sexBadgeStyle(sex: string): React.CSSProperties {
  return { fontSize: 16, color: sex === 'male' ? '#2563eb' : sex === 'female' ? '#db2777' : '#7c3aed' }
}
