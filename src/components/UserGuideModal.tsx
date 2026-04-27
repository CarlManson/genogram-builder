import { M } from '../lib/modalTheme'

interface Props {
  onClose: () => void
}

export default function UserGuideModal({ onClose }: Props) {
  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={s.panel}>
        <div style={s.header}>
          <h2 style={s.title}>User Guide</h2>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={s.body}>
          <Section title="What is a genogram?">
            <p style={s.p}>
              A genogram is a family diagram used in counselling, social work and
              family-history research. People are drawn as shapes (square = male,
              circle = female, triangle = unknown, diamond = other) and connected
              with lines that show marriages, partnerships and parent-child links.
              A filled shape with an X means the person is deceased.
            </p>
          </Section>

          <Section title="Getting started">
            <ul style={s.ul}>
              <li>Click <strong>+ Person</strong> to add your first family member, or use <strong>File ▸ Import GEDCOM…</strong> to load an existing family tree.</li>
              <li>The first person becomes a standalone node. Use the <strong>Save &amp; add…</strong> menu (the ▾ next to Save) to chain on a spouse, child, sibling or parent without closing the editor.</li>
              <li>Everything is saved automatically in your browser. There is no server, no signup; clearing your browser data will erase your work, so use <strong>File ▸ Save JSON</strong> for backups.</li>
            </ul>
          </Section>

          <Section title="Adding people">
            <p style={s.p}>
              Each Person editor has a <strong>Position in tree</strong> picker —
              choose Spouse of, Parent of, or Sibling of someone, then pick the
              related person. The new node is placed automatically next to the
              right anchor (spouse and sibling sit on the same row, parent goes
              above, etc.).
            </p>
            <p style={s.p}>
              The <strong>Save &amp; add ___</strong> caret menu next to Save lets
              you save the current person and immediately open a fresh editor
              seeded with the right relationship to them. Available for both new
              and existing people.
            </p>
          </Section>

          <Section title="Editing a person">
            <ul style={s.ul}>
              <li><strong>Double-click</strong> a node, or click and use the toolbar's pencil icon, to open the editor.</li>
              <li>The <strong>colour swatch</strong> in the editor's header bar overrides the default outline colour for that person — useful for highlighting probands or branches.</li>
              <li><strong>Lives in / Lived in</strong> renders above the shape; the verb auto-flips with the deceased checkbox.</li>
              <li><strong>Notes</strong> render below the shape, after occupation and cause of death.</li>
              <li><strong>Parents</strong> are picked from the Father / Mother dropdowns, not the Position in tree picker.</li>
            </ul>
          </Section>

          <Section title="Relationships">
            <p style={s.p}>
              Click <strong>+ Relationship</strong> (or double-click a couple line)
              to set the type:
            </p>
            <ul style={s.ul}>
              <li><strong>Married</strong> — solid horizontal line.</li>
              <li><strong>Cohabiting</strong> — dashed horizontal line.</li>
              <li><strong>Separated</strong> — solid line with one slash.</li>
              <li><strong>Divorced</strong> — solid line with two slashes.</li>
              <li><strong>Never married, separated</strong> — dashed line with one slash.</li>
              <li><strong>Parent–child</strong> — vertical drop from couple line to a horizontal sibship line, then verticals to each child. Twins (same exact birth date) converge to a single point on the sibship line.</li>
            </ul>
            <p style={s.p}>
              You can add a <strong>location</strong> on a couple relationship (e.g.
              "Met in Sydney") which renders just above the couple line.
            </p>
          </Section>

          <Section title="Selecting and moving people">
            <ul style={s.ul}>
              <li><strong>Click</strong> a person to select them — a floating toolbar appears with Edit, Clean up descendants, and Delete.</li>
              <li><strong>Shift+click</strong> a second person to multi-select. The toolbar switches to Align horizontal, Align vertical, and Delete.</li>
              <li><strong>Drag</strong> a person to move the entire family group (the person, their spouse network, all descendants, and descendants' spouses).</li>
              <li><strong>Click an already-selected person again</strong> to enter <em>move mode</em> (cursor turns to ↔, a "SLIDE" badge appears). The next drag slides only that person horizontally — useful for adjusting couple spacing.</li>
              <li><strong>Delete</strong> key removes the current selection. Undoable.</li>
              <li><strong>⌘Z / Ctrl+Z</strong> for undo, <strong>⌘⇧Z / Ctrl+Y</strong> for redo. Up to 50 steps, scoped per project.</li>
            </ul>
          </Section>

          <Section title="Auto-layout">
            <p style={s.p}>
              <strong>✦ Clean Up Layout</strong> in the toolbar re-arranges every
              node so spouses are adjacent and children are centred under their
              parents. Generations align to the same row. Cross-family marriages
              are handled by pulling the side family's ancestors down so they sit
              just above the marrying-in member.
            </p>
            <p style={s.p}>
              Selecting one person and pressing the <strong>sparkle</strong> icon in
              the floating toolbar runs <em>Clean up descendants</em> — only that
              person's descendants (and their spouses) are re-positioned; the
              focal person and ancestors stay put.
            </p>
            <p style={s.p}>
              For complex blended families the auto-layout is a best effort, not a
              guarantee. Run it, then nudge any awkward branches by hand.
            </p>
          </Section>

          <Section title="Files">
            <ul style={s.ul}>
              <li><strong>Import GEDCOM</strong> — drop a <code>.ged</code> file, choose the focal person, and pick how many generations to include above and below.</li>
              <li><strong>Open JSON</strong> — load a previously-saved Genogram Builder JSON file as a new project.</li>
              <li><strong>Save JSON</strong> — back up the current genogram as JSON. Round-trips losslessly.</li>
              <li><strong>Export SVG</strong> — clean vector image suitable for printing or embedding.</li>
              <li><strong>Start Over</strong> — clears the current genogram (within a project). Undoable.</li>
            </ul>
          </Section>

          <Section title="Projects">
            <p style={s.p}>
              Click the project pill next to the logo to switch between, rename,
              create or delete genograms. Each project has its own undo history;
              switching projects clears the active history.
            </p>
          </Section>

          <Section title="Settings">
            <p style={s.p}>
              The gear icon opens a tabbed Settings panel.
            </p>
            <ul style={s.ul}>
              <li><strong>General</strong> — name format (birth / married / first only), date display (year / full date / age), focal person and the optional dashed ellipse around the focal couple.</li>
              <li><strong>Design</strong> — font size, every text colour (name, date, occupation, cause of death, location), shape fill / outline / deceased fill / deceased ✕ colours, and couple- &amp; parent-child line colour and thickness. The "Crop names to shape" toggle moves names back inside the shape if you prefer the boxed look.</li>
            </ul>
          </Section>

          <Section title="Tips">
            <ul style={s.ul}>
              <li>Long names look best with the default <em>names below shape</em> mode. Turn cropping on if the names are short and you want them inside.</li>
              <li>Use the per-person colour swatch to highlight a proband, draw a branch in a different colour, or distinguish blood vs. step relationships.</li>
              <li>If <em>Clean Up Layout</em> stretches things out too much, undo and try cleaning up only the focal person's descendants instead.</li>
              <li>The app is built for desktop. You can pan and zoom on touch but editing is fiddly; expect to move to a laptop for serious authoring.</li>
            </ul>
          </Section>

          <Section title="Found a bug or have a suggestion?">
            <p style={s.p}>
              Email <a href="mailto:carl.manson@westnet.com.au" style={s.link}>carl.manson@westnet.com.au</a>.
              I built this for myself, so it isn't perfect — feedback is welcome.
            </p>
          </Section>
        </div>

        <div style={s.actions}>
          <button style={s.saveBtn} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={s.section}>
      <h3 style={s.h3}>{title}</h3>
      {children}
    </section>
  )
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: M.overlayBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  panel: { background: M.panelBg, borderRadius: 10, padding: 24, width: 600, maxWidth: 'calc(100vw - 32px)', maxHeight: '90vh', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 12 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'sans-serif', color: M.text },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: M.textSubtle, padding: 0, lineHeight: 1 },
  body: { overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingRight: 8, marginRight: -8 },
  section: { display: 'flex', flexDirection: 'column', gap: 8 },
  h3: { margin: 0, fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif', color: M.text, letterSpacing: '0.01em' },
  p: { margin: 0, fontSize: 13, lineHeight: 1.55, fontFamily: 'sans-serif', color: M.textSubtle },
  ul: { margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, fontFamily: 'sans-serif', color: M.textSubtle },
  link: { color: M.accent, textDecoration: 'underline' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  saveBtn: { padding: '8px 20px', background: M.accent, color: M.text, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif' },
}
