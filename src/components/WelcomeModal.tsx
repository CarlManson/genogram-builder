import { M } from '../lib/modalTheme'
import { useIsMobile } from '../lib/useIsMobile'

interface Props {
  onClose: () => void
}

export default function WelcomeModal({ onClose }: Props) {
  const isMobile = useIsMobile()
  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>Welcome to Genogram Builder</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {isMobile && (
          <div style={s.mobileNotice}>
            <strong>Heads up — this tool is built for desktop.</strong> You can pan
            and zoom on touch, but adding people, editing relationships and dragging
            nodes work much better with a mouse and keyboard.
          </div>
        )}

        <p style={s.body}>
          A free browser-based tool for drawing genograms — family diagrams
          that use shapes for people and lines to show their relationships.
        </p>

        <p style={s.sectionLabel}>Quick start</p>
        <ul style={s.list}>
          <li>Add people with <strong>+ Person</strong>, or load a GEDCOM file from the <strong>File</strong> menu.</li>
          <li>Double-click a person or relationship line to edit it.</li>
          <li>Drag to reposition; everything saves automatically in your browser.</li>
        </ul>

        <p style={s.note}>
          I built this for myself, so it's not perfect — if you spot a bug or have
          suggestions, please {' '}
          <a href="mailto:carl.manson@westnet.com.au" style={s.link}>
            reach out
          </a>.
        </p>

        <div style={s.actions}>
          <button style={s.saveBtn} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: M.overlayBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: M.panelBg, borderRadius: 10, padding: 24, width: 440, maxWidth: 'calc(100vw - 32px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif', color: M.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: M.textSubtle },
  body: { margin: 0, fontSize: 14, lineHeight: 1.5, fontFamily: 'sans-serif', color: M.textSubtle },
  sectionLabel: { margin: '4px 0 0', fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif', color: M.text },
  list: { margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, fontFamily: 'sans-serif', color: M.textSubtle },
  note: { margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, fontFamily: 'sans-serif', color: M.textMuted, fontStyle: 'italic' },
  link: { color: M.accent, textDecoration: 'underline' },
  mobileNotice: { background: 'rgba(252, 191, 71, 0.12)', border: '1px solid rgba(252, 191, 71, 0.4)', borderRadius: 6, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, fontFamily: 'sans-serif', color: '#fcbf47' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  saveBtn: { padding: '8px 20px', background: M.accent, color: M.text, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
}
