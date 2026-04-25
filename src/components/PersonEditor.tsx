import { useState, useEffect, useRef } from 'react'
import { Person, Sex, DateDisplay, Settings, DEFAULT_SETTINGS, RelContext, RelContextType } from '../lib/types'

const DATE_DISPLAY_LABELS: Record<DateDisplay, string> = {
  year: 'Year',
  date: 'Full date',
  age: 'Age',
}

// "Child of" is removed — parents are handled by the explicit Father/Mother fields
const REL_TYPE_LABELS: Partial<Record<RelContextType, string>> = {
  'spouse': 'Spouse of',
  'parent-of': 'Parent of',
  'sibling-of': 'Sibling of',
}

export interface ParentIds {
  fatherId?: string
  motherId?: string
}

interface Props {
  person: Person | null
  people?: Person[]
  settings?: Settings
  initialParents?: ParentIds
  getParentsOf?: (personId: string) => ParentIds
  onSave: (person: Person, relContext?: RelContext, parents?: ParentIds) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function PersonEditor({
  person, people = [], settings = DEFAULT_SETTINGS,
  initialParents, getParentsOf,
  onSave, onDelete, onClose,
}: Props) {
  const [form, setForm] = useState<Person>(
    person ?? { id: crypto.randomUUID(), firstName: '', lastName: '', sex: 'unknown', deceased: false }
  )
  const [relType, setRelType] = useState<RelContextType | ''>('')
  const [relatedPersonId, setRelatedPersonId] = useState('')
  const [fatherId, setFatherId] = useState(initialParents?.fatherId ?? '')
  const [motherId, setMotherId] = useState(initialParents?.motherId ?? '')

  // Track the last auto-filled married name so we don't overwrite user edits
  const autoFilledRef = useRef<string | undefined>(undefined)
  // Track whether parents were auto-filled from sibling so we can overwrite on re-selection
  const autoParentsRef = useRef<ParentIds>({})

  useEffect(() => { if (person) setForm(person) }, [person])

  // Pre-fill married name when adding a female as spouse
  useEffect(() => {
    if (person) return
    if (relType !== 'spouse' || !relatedPersonId || form.sex !== 'female') return
    const rel = people.find(p => p.id === relatedPersonId)
    if (!rel?.lastName) return
    if (!form.marriedName || form.marriedName === autoFilledRef.current) {
      autoFilledRef.current = rel.lastName
      setForm(f => ({ ...f, marriedName: rel.lastName }))
    }
  }, [relatedPersonId, relType, form.sex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill parents from sibling's parents when "Sibling of X" is selected
  useEffect(() => {
    if (relType !== 'sibling-of' || !relatedPersonId || !getParentsOf) return
    const parents = getParentsOf(relatedPersonId)
    // Only fill each slot if it's empty or was previously auto-filled
    if (parents.fatherId && (!fatherId || fatherId === autoParentsRef.current.fatherId)) {
      setFatherId(parents.fatherId)
      autoParentsRef.current = { ...autoParentsRef.current, fatherId: parents.fatherId }
    }
    if (parents.motherId && (!motherId || motherId === autoParentsRef.current.motherId)) {
      setMotherId(parents.motherId)
      autoParentsRef.current = { ...autoParentsRef.current, motherId: parents.motherId }
    }
  }, [relType, relatedPersonId]) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof Person>(key: K, value: Person[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleSave() {
    const relContext: RelContext | undefined =
      relType && relatedPersonId ? { relatedPersonId, relType: relType as RelContextType } : undefined
    const parents: ParentIds = {
      fatherId: fatherId || undefined,
      motherId: motherId || undefined,
    }
    onSave(form, relContext, parents)
    onClose()
  }

  const isNew = !person
  const otherPeople = people.filter(p => p.id !== form.id)

  function personLabel(p: Person) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed'
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>{isNew ? 'Add Person' : 'Edit Person'}</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {/* Position in tree — new persons only (no "Child of" — use Parents section below) */}
        {isNew && otherPeople.length > 0 && (
          <div style={s.relSection}>
            <span style={s.sectionLabel}>Position in tree</span>
            <div style={s.relRow}>
              <select
                style={{ ...s.input, flex: '0 0 auto' }}
                value={relType}
                onChange={e => { setRelType(e.target.value as RelContextType | ''); setRelatedPersonId('') }}
              >
                <option value="">– standalone –</option>
                {Object.entries(REL_TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
              {relType && (
                <select
                  style={{ ...s.input, flex: 1 }}
                  value={relatedPersonId}
                  onChange={e => setRelatedPersonId(e.target.value)}
                >
                  <option value="">Select person…</option>
                  {otherPeople.map(p => (
                    <option key={p.id} value={p.id}>{personLabel(p)}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Parents section — shown always */}
        {otherPeople.length > 0 && (
          <div style={s.relSection}>
            <span style={s.sectionLabel}>Parents</span>
            <div style={s.row}>
              <label style={{ ...s.label, flex: 1 }}>Father
                <select style={s.input} value={fatherId} onChange={e => setFatherId(e.target.value)}>
                  <option value="">– none –</option>
                  <ParentOptions people={otherPeople} excludeId={motherId} primarySex="male" />
                </select>
              </label>
              <label style={{ ...s.label, flex: 1 }}>Mother
                <select style={s.input} value={motherId} onChange={e => setMotherId(e.target.value)}>
                  <option value="">– none –</option>
                  <ParentOptions people={otherPeople} excludeId={fatherId} primarySex="female" />
                </select>
              </label>
            </div>
          </div>
        )}

        <div style={s.row}>
          <label style={{ ...s.label, flex: 1 }}>First name
            <input style={s.input} value={form.firstName} onChange={e => set('firstName', e.target.value)} autoFocus />
          </label>
          <label style={{ ...s.label, flex: 1 }}>Middle name/s
            <input style={s.input} value={form.middleName ?? ''} onChange={e => set('middleName', e.target.value || undefined)} />
          </label>
        </div>

        <label style={s.label}>Birth surname
          <input style={s.input} value={form.lastName} onChange={e => set('lastName', e.target.value)} />
        </label>

        <label style={s.label}>Married surname
          <input
            style={s.input}
            placeholder="Leave blank if same as birth surname"
            value={form.marriedName ?? ''}
            onChange={e => {
              autoFilledRef.current = undefined
              set('marriedName', e.target.value || undefined)
            }}
          />
        </label>

        <label style={s.label}>Sex
          <select style={s.input} value={form.sex} onChange={e => set('sex', e.target.value as Sex)}>
            <option value="male">Male (□)</option>
            <option value="female">Female (○)</option>
            <option value="unknown">Unknown (◇)</option>
          </select>
        </label>

        <div style={s.row}>
          <label style={{ ...s.label, flex: 1 }}>Date of birth
            <input style={s.input} type="date" value={form.birthDate ?? ''} onChange={e => set('birthDate', e.target.value || undefined)} />
          </label>
          <label style={{ ...s.label, flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingTop: 20 }}>
            <input type="checkbox" checked={form.deceased} onChange={e => set('deceased', e.target.checked)} style={{ width: 16, height: 16 }} />
            Deceased
          </label>
        </div>

        {form.deceased && (
          <label style={s.label}>Date of death
            <input style={s.input} type="date" value={form.deathDate ?? ''} onChange={e => set('deathDate', e.target.value || undefined)} />
          </label>
        )}

        <label style={s.label}>Display date as
          <select style={s.input} value={form.dateDisplay ?? ''} onChange={e => set('dateDisplay', (e.target.value as DateDisplay) || undefined)}>
            <option value="">Default ({DATE_DISPLAY_LABELS[settings.dateDisplay]})</option>
            <option value="year">Year</option>
            <option value="date">Full date</option>
            <option value="age">Age</option>
          </select>
        </label>

        <label style={s.label}>Occupation
          <input style={s.input} value={form.occupation ?? ''} onChange={e => set('occupation', e.target.value || undefined)} />
        </label>

        {form.deceased && (
          <label style={s.label}>Cause of death
            <input style={s.input} value={form.causeOfDeath ?? ''} onChange={e => set('causeOfDeath', e.target.value || undefined)} />
          </label>
        )}

        <label style={s.label}>Notes
          <textarea style={{ ...s.input, height: 56, resize: 'vertical' }} value={form.notes ?? ''} onChange={e => set('notes', e.target.value || undefined)} />
        </label>

        <div style={s.actions}>
          {person && (
            <button style={s.deleteBtn} onClick={() => { onDelete(form.id); onClose() }}>Delete</button>
          )}
          <button style={s.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

function ParentOptions({ people, excludeId, primarySex }: {
  people: Person[]
  excludeId: string
  primarySex: 'male' | 'female'
}) {
  const label = (p: Person) => [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || 'Unnamed'

  const available = people.filter(p => p.id !== excludeId)
  const primary = available
    .filter(p => p.sex === primarySex)
    .sort((a, b) => label(a).localeCompare(label(b)))
  const other = available
    .filter(p => p.sex !== primarySex)
    .sort((a, b) => label(a).localeCompare(label(b)))

  const sexLabel = primarySex === 'male' ? 'Male' : 'Female'
  const otherLabel = primarySex === 'male' ? 'Female / Unknown' : 'Male / Unknown'
  return (
    <>
      {primary.length > 0 && (
        <optgroup label={sexLabel}>
          {primary.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
        </optgroup>
      )}
      {other.length > 0 && (
        <optgroup label={otherLabel}>
          {other.map(p => <option key={p.id} value={p.id}>{label(p)}</option>)}
        </optgroup>
      )}
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: '#fff', borderRadius: 10, padding: 24, width: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666' },
  relSection: { display: 'flex', flexDirection: 'column', gap: 6, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' },
  sectionLabel: { fontSize: 12, fontWeight: 600, fontFamily: 'sans-serif', color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  relRow: { display: 'flex', gap: 8 },
  row: { display: 'flex', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: '#333' },
  input: { padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'sans-serif', outline: 'none' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  saveBtn: { padding: '8px 20px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
  deleteBtn: { padding: '8px 20px', background: '#fff', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
}
