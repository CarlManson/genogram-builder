import { M } from '../lib/modalTheme'
import { useModalShortcuts } from '../lib/useModalShortcuts'

export type ImportTargetChoice = 'replace' | 'new'

interface Props {
  sourceLabel: string          // e.g. "GEDCOM" or "JSON backup"
  activeProjectName: string
  activeHasPeople: boolean
  onChoose: (choice: ImportTargetChoice) => void
  onCancel: () => void
}

export default function ImportTargetDialog({
  sourceLabel, activeProjectName, activeHasPeople, onChoose, onCancel,
}: Props) {
  useModalShortcuts({ onClose: onCancel })
  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>Import {sourceLabel}</h2>
          <button style={s.closeBtn} onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <p style={s.body}>
          Where should this {sourceLabel.toLowerCase()} go?
        </p>

        <div style={s.choices}>
          <button
            style={{ ...s.choiceBtn, ...(activeHasPeople ? s.choiceDanger : {}) }}
            onClick={() => onChoose('replace')}
          >
            <div style={s.choiceTitle}>Replace current genogram</div>
            <div style={s.choiceSub}>
              {activeHasPeople
                ? `Overwrites "${activeProjectName}". Undoable.`
                : `Loads into "${activeProjectName}" (currently empty).`}
            </div>
          </button>

          <button style={s.choiceBtn} onClick={() => onChoose('new')}>
            <div style={s.choiceTitle}>Create new genogram</div>
            <div style={s.choiceSub}>Adds a new project, leaves "{activeProjectName}" untouched.</div>
          </button>
        </div>

        <div style={s.actions}>
          <button style={s.cancelBtn} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: M.overlayBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
  },
  panel: {
    background: M.panelBg, borderRadius: 10, padding: 24, width: 400,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 14,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif', color: M.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: M.textSubtle },
  body: { margin: 0, fontSize: 13, lineHeight: 1.5, fontFamily: 'sans-serif', color: M.textSubtle },
  choices: { display: 'flex', flexDirection: 'column', gap: 8 },
  choiceBtn: {
    textAlign: 'left', padding: '12px 14px', borderRadius: 8,
    border: `1px solid ${M.border}`, background: M.inputBg, color: M.text,
    cursor: 'pointer', fontFamily: 'sans-serif',
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  choiceDanger: { borderColor: M.danger },
  choiceTitle: { fontSize: 14, fontWeight: 600 },
  choiceSub: { fontSize: 12, color: M.textSubtle, lineHeight: 1.4 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn: {
    padding: '8px 16px', background: 'transparent', color: M.textSubtle,
    border: `1px solid ${M.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
}
