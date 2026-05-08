import { useState } from 'react'
import { M } from '../lib/modalTheme'
import { useModalShortcuts } from '../lib/useModalShortcuts'

export type ExportOrientation = 'auto' | 'portrait' | 'landscape'
export type ExportMode = 'fit' | 'native'
export type ExportFormat = 'svg' | 'pdf'

export interface ExportOptions {
  title: string
  orientation: ExportOrientation
  mode: ExportMode
  format: ExportFormat
}

interface Props {
  defaultTitle: string
  onExport: (options: ExportOptions) => void
  onClose: () => void
}

export default function ExportSvgModal({ defaultTitle, onExport, onClose }: Props) {
  const [title, setTitle] = useState(defaultTitle)
  const [orientation, setOrientation] = useState<ExportOrientation>('auto')
  const [mode, setMode] = useState<ExportMode>('fit')
  const [format, setFormat] = useState<ExportFormat>('svg')

  function handleExport() {
    onExport({ title: title.trim(), orientation, mode, format })
    onClose()
  }

  useModalShortcuts({ onClose, onEnter: handleExport })

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>Export</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <label style={s.label}>Title
          <input
            style={s.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Shown above the genogram"
          />
        </label>

        <fieldset style={s.fieldset}>
          <legend style={s.legend}>Format</legend>
          <Radio name="format" value="svg" current={format} onChange={setFormat}>
            SVG <span style={s.hint}>— vector image, opens in browsers and design tools</span>
          </Radio>
          <Radio name="format" value="pdf" current={format} onChange={setFormat}>
            PDF <span style={s.hint}>— ready to print or share</span>
          </Radio>
        </fieldset>

        <fieldset style={s.fieldset}>
          <legend style={s.legend}>Orientation</legend>
          <Radio name="orientation" value="auto" current={orientation} onChange={setOrientation}>
            Auto <span style={s.hint}>— pick portrait or landscape based on shape</span>
          </Radio>
          <Radio name="orientation" value="portrait" current={orientation} onChange={setOrientation}>
            Portrait
          </Radio>
          <Radio name="orientation" value="landscape" current={orientation} onChange={setOrientation}>
            Landscape
          </Radio>
        </fieldset>

        <fieldset style={s.fieldset}>
          <legend style={s.legend}>Page mode</legend>
          <Radio name="mode" value="fit" current={mode} onChange={setMode}>
            Scale to fit A4 <span style={s.hint}>— whole genogram on one page</span>
          </Radio>
          <Radio name="mode" value="native" current={mode} onChange={setMode}>
            Native size with A4 frame <span style={s.hint}>— frame shows what fits on a page</span>
          </Radio>
        </fieldset>

        <div style={s.actions}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={s.saveBtn} onClick={handleExport}>Export</button>
        </div>
      </div>
    </div>
  )
}

function Radio<T extends string>({
  name, value, current, onChange, children,
}: {
  name: string
  value: T
  current: T
  onChange: (v: T) => void
  children: React.ReactNode
}) {
  return (
    <label style={s.radioRow}>
      <input
        type="radio"
        name={name}
        checked={current === value}
        onChange={() => onChange(value)}
        style={s.radio}
      />
      <span style={s.radioLabel}>{children}</span>
    </label>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: M.overlayBg,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  },
  panel: {
    background: M.panelBg, borderRadius: 10, padding: 24, width: 400,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 14,
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif', color: M.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: M.textSubtle },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4,
    fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif', color: M.textSubtle,
  },
  input: {
    padding: '6px 10px', borderRadius: 6, border: `1px solid ${M.border}`,
    fontSize: 14, fontFamily: 'sans-serif', outline: 'none',
    background: M.inputBg, color: M.text, width: '100%', boxSizing: 'border-box',
  },
  fieldset: {
    border: `1px solid ${M.border}`, borderRadius: 6, padding: '8px 12px 10px',
    display: 'flex', flexDirection: 'column', gap: 6, margin: 0,
  },
  legend: {
    padding: '0 6px', fontSize: 12, fontWeight: 600, color: M.textSubtle,
    fontFamily: 'sans-serif', letterSpacing: '0.02em',
  },
  radioRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'sans-serif' },
  radio: { accentColor: M.accent, cursor: 'pointer' },
  radioLabel: { fontSize: 13, color: M.text },
  hint: { color: M.textMuted, fontSize: 12 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelBtn: {
    padding: '8px 16px', background: 'transparent', color: M.textSubtle,
    border: `1px solid ${M.border}`, borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
  saveBtn: {
    padding: '8px 20px', background: M.accent, color: M.text,
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
  },
}
