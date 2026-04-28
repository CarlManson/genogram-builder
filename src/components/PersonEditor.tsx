import { useState, useEffect, useRef } from 'react'
import { Person, Sex, DateDisplay, Settings, DEFAULT_SETTINGS, RelContext, RelContextType, OUTLINE_COLORS } from '../lib/types'
import { M } from '../lib/modalTheme'

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

// OUTLINE_COLORS is shared with Settings → Design (defined in lib/types.ts).
// Index 0 (#1a1a1a) is the default ink — picking it clears any custom colour
// here rather than persisting the explicit value.

export interface ParentIds {
  fatherId?: string
  motherId?: string
}

export type AddNextKind = 'spouse' | 'sibling' | 'child' | 'parent'

interface Props {
  person: Person | null
  people?: Person[]
  settings?: Settings
  initialParents?: ParentIds
  initialRelContext?: RelContext
  getParentsOf?: (personId: string) => ParentIds
  onSave: (person: Person, relContext?: RelContext, parents?: ParentIds) => void
  onSaveAndAddNext?: (person: Person, relContext: RelContext | undefined, parents: ParentIds, kind: AddNextKind) => void
  onDelete: (id: string) => void
  onClose: () => void
}

export default function PersonEditor({
  person, people = [], settings = DEFAULT_SETTINGS,
  initialParents, initialRelContext, getParentsOf,
  onSave, onSaveAndAddNext, onDelete, onClose,
}: Props) {
  const [form, setForm] = useState<Person>(
    person ?? { id: crypto.randomUUID(), firstName: '', lastName: '', sex: 'unknown', deceased: false }
  )
  const [relType, setRelType] = useState<RelContextType | ''>(initialRelContext?.relType ?? '')
  const [relatedPersonId, setRelatedPersonId] = useState(initialRelContext?.relatedPersonId ?? '')
  const [fatherId, setFatherId] = useState(initialParents?.fatherId ?? '')
  const [motherId, setMotherId] = useState(initialParents?.motherId ?? '')
  const [saveMenuOpen, setSaveMenuOpen] = useState(false)
  const saveMenuRef = useRef<HTMLDivElement>(null)
  const [colorMenuOpen, setColorMenuOpen] = useState(false)
  const colorMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!saveMenuOpen) return
    function handle(e: MouseEvent) {
      if (saveMenuRef.current && !saveMenuRef.current.contains(e.target as HTMLElement)) {
        setSaveMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [saveMenuOpen])

  useEffect(() => {
    if (!colorMenuOpen) return
    function handle(e: MouseEvent) {
      if (colorMenuRef.current && !colorMenuRef.current.contains(e.target as HTMLElement)) {
        setColorMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [colorMenuOpen])

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

  function buildPayload() {
    const relContext: RelContext | undefined =
      relType && relatedPersonId ? { relatedPersonId, relType: relType as RelContextType } : undefined
    const parents: ParentIds = {
      fatherId: fatherId || undefined,
      motherId: motherId || undefined,
    }
    return { relContext, parents }
  }

  function handleSave() {
    const { relContext, parents } = buildPayload()
    onSave(form, relContext, parents)
    onClose()
  }

  function handleSaveAndAddNext(kind: AddNextKind) {
    if (!onSaveAndAddNext) return
    const { relContext, parents } = buildPayload()
    setSaveMenuOpen(false)
    onSaveAndAddNext(form, relContext, parents, kind)
  }

  const isNew = !person
  const otherPeople = people.filter(p => p.id !== form.id)

  function personLabel(p: Person) {
    return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unnamed'
  }

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.headerBar}>
          <h2 style={s.title}>{isNew ? 'Add Person' : 'Edit Person'}</h2>
          <div style={s.headerActions}>
            <div ref={colorMenuRef} style={s.colorWrap}>
              <button
                type="button"
                style={{
                  ...s.swatch,
                  background: form.outlineColor ?? '#fff',
                  borderColor: form.outlineColor ?? '#d1d5db',
                }}
                onClick={() => setColorMenuOpen(o => !o)}
                title="Outline colour"
                aria-label="Choose outline colour"
              />
              {colorMenuOpen && (
                <div style={s.colorMenu}>
                  <div style={s.colorGrid}>
                    {OUTLINE_COLORS.map(c => {
                      const selected = c === (form.outlineColor ?? OUTLINE_COLORS[0])
                      return (
                        <button
                          key={c}
                          type="button"
                          style={{
                            ...s.colorCell,
                            background: c,
                            boxShadow: selected ? '0 0 0 2px #fff, 0 0 0 4px #1a1a1a' : undefined,
                          }}
                          onClick={() => {
                            setForm(f => ({ ...f, outlineColor: c === OUTLINE_COLORS[0] ? undefined : c }))
                            setColorMenuOpen(false)
                          }}
                          aria-label={`Set outline colour ${c}`}
                          title={c}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* Position in tree — new persons only (no "Child of" — use Parents section below) */}
        {isNew && otherPeople.length > 0 && (
          <div style={s.relSection}>
            <span style={s.sectionLabel}>Position in tree</span>
            <div style={s.relRow}>
              <select
                style={{ ...s.input, flex: '0 0 auto', width: 'auto' }}
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
                  style={{ ...s.input, flex: 1, minWidth: 0 }}
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
              <label style={{ ...s.label, flex: 1 }}>Parent 1
                <select style={s.input} value={fatherId} onChange={e => setFatherId(e.target.value)}>
                  <option value="">– none –</option>
                  <ParentOptions people={otherPeople} excludeId={motherId} primarySex="male" />
                </select>
              </label>
              <label style={{ ...s.label, flex: 1 }}>Parent 2
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
            <option value="unknown">Unknown (△)</option>
            <option value="other">Other (◇)</option>
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

        <label style={s.label}>{form.deceased ? 'Lived in' : 'Lives in'}
          <input
            style={s.input}
            placeholder="e.g. Perth, WA"
            value={form.residence ?? ''}
            onChange={e => set('residence', e.target.value || undefined)}
          />
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
          {onSaveAndAddNext ? (
            <div ref={saveMenuRef} style={s.saveSplit}>
              <button style={s.saveMain} onClick={handleSave}>Save</button>
              <button
                style={s.saveCaret}
                onClick={() => setSaveMenuOpen(o => !o)}
                title="Save and add another related person"
                aria-label="Save and add another"
              >▾</button>
              {saveMenuOpen && (
                <div style={s.saveMenu}>
                  <button style={s.saveMenuItem} onClick={() => handleSaveAndAddNext('spouse')}>Save &amp; add spouse</button>
                  <button style={s.saveMenuItem} onClick={() => handleSaveAndAddNext('sibling')}>Save &amp; add sibling</button>
                  <button style={s.saveMenuItem} onClick={() => handleSaveAndAddNext('child')}>Save &amp; add child</button>
                  <button style={s.saveMenuItem} onClick={() => handleSaveAndAddNext('parent')}>Save &amp; add parent</button>
                </div>
              )}
            </div>
          ) : (
            <button style={s.saveBtn} onClick={handleSave}>Save</button>
          )}
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
  overlay: { position: 'fixed', inset: 0, background: M.overlayBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: M.panelBg, borderRadius: 10, padding: 24, width: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 12 },
  headerBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: M.headerBarBg, borderBottom: `1px solid ${M.border}`,
    padding: '12px 16px', margin: '-24px -24px 0',
    borderRadius: '10px 10px 0 0',
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { margin: 0, fontSize: 16, fontWeight: 600, fontFamily: 'sans-serif', color: M.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: M.textSubtle, padding: 0, lineHeight: 1 },
  colorWrap: { position: 'relative', display: 'inline-flex' },
  swatch: { width: 22, height: 22, borderRadius: 6, border: '1px solid', cursor: 'pointer', padding: 0 },
  colorMenu: {
    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
    background: M.inputBg, border: `1px solid ${M.border}`, borderRadius: 8,
    boxShadow: '0 6px 20px rgba(0,0,0,0.4)', zIndex: 200, padding: 8,
  },
  colorGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 22px)', gap: 6 },
  colorCell: { width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 },
  relSection: { display: 'flex', flexDirection: 'column', gap: 6, background: M.inputBg, border: `1px solid ${M.border}`, borderRadius: 8, padding: '10px 12px' },
  sectionLabel: { fontSize: 12, fontWeight: 600, fontFamily: 'sans-serif', color: M.textMuted, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  relRow: { display: 'flex', gap: 8 },
  row: { display: 'flex', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: M.textSubtle, minWidth: 0 },
  input: { padding: '6px 10px', borderRadius: 6, border: `1px solid ${M.border}`, fontSize: 14, fontFamily: 'sans-serif', outline: 'none', background: M.inputBg, color: M.text, width: '100%', boxSizing: 'border-box' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  saveBtn: { padding: '8px 20px', background: M.accent, color: M.text, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
  deleteBtn: { padding: '8px 20px', background: 'transparent', color: M.danger, border: `1px solid ${M.danger}`, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
  saveSplit: { position: 'relative', display: 'inline-flex' },
  saveMain: { padding: '8px 20px', background: M.accent, color: M.text, border: 'none', borderRadius: '6px 0 0 6px', cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
  saveCaret: { padding: '8px 10px', background: M.accent, color: M.text, border: 'none', borderLeft: '1px solid rgba(255,255,255,0.25)', borderRadius: '0 6px 6px 0', cursor: 'pointer', fontSize: 12, fontFamily: 'sans-serif', lineHeight: 1 },
  saveMenu: { position: 'absolute', bottom: 'calc(100% + 5px)', right: 0, minWidth: 200, background: M.inputBg, border: `1px solid ${M.border}`, borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.4)', zIndex: 200, padding: '4px 0' },
  saveMenuItem: { display: 'block', width: '100%', textAlign: 'left', padding: '7px 14px', border: 'none', cursor: 'pointer', background: 'transparent', color: M.text, fontSize: 13, fontFamily: 'sans-serif' },
}
