interface Props {
  onClose: () => void
}

export default function CoffeeModal({ onClose }: Props) {
  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>Thanks for your support.</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <p style={s.subtitle}>Helps keep the lights on and the coffee flowing.</p>
        <iframe
          id="kofiframe"
          src="https://ko-fi.com/carlmanson/?hidefeed=true&widget=true&embed=true&preview=true"
          style={{ border: 'none', width: '100%', padding: 4, background: '#f9f9f9' }}
          height={712}
          title="carlmanson"
        />
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: '#fff', borderRadius: 10, padding: 20, width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: 8 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif', color: '#1a1a1a' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#666', padding: 0, lineHeight: 1 },
  subtitle: { margin: '0 0 8px', fontSize: 13, fontFamily: 'sans-serif', color: '#6b7280' },
}
