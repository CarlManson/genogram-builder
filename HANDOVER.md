# Genogram Builder — Handover Notes

> Keep this file up to date as the project evolves. It is the primary context document for any AI assistant picking up this work.

---

## What this is

A browser-based genogram builder. A genogram is a clinical/family diagram that shows people as shapes (square = male, circle = female, triangle = unknown, diamond = other) connected by relationship lines. It's used in counselling, social work, and family history.

The app runs entirely in the browser — no server, no backend.

---

## How to run

```bash
cd "/Users/carlmanson/Axiom Dropbox/Sites/Playground/genogram-builder"
npm install       # first time only
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
```

---

## Deployment

- **Hosted on:** GitHub Pages, custom domain `genogram-builder.carlmanson.au`.
- **Pipeline:** `.github/workflows/deploy.yml` runs on every push to `main` — installs deps, runs `npm run build`, uploads `dist/` as a Pages artifact, and deploys via `actions/deploy-pages`.
- **Pages source must be set to "GitHub Actions"** in repo Settings → Pages (not "Deploy from a branch"). Branch-mode deploys would serve raw source and break.
- **Custom domain:** `public/CNAME` contains the domain; Vite copies it into `dist/` on build so it survives every redeploy.
- **DNS:** at Cloudflare, `CNAME genogram-builder → carlmanson.github.io`, **DNS-only (grey cloud)** so GitHub can issue the Let's Encrypt cert. Can be flipped to proxied after HTTPS is enforced.

---

## Tech stack

| Thing | What / Why |
|---|---|
| **Vite + React + TypeScript** | Standard fast SPA setup |
| **@xyflow/react v12** | Interactive canvas (pan/zoom/drag nodes). Used for node positioning only — edges are NOT used from React Flow |
| **ReactFlowProvider** | Explicitly wraps the canvas in `App.tsx` so `GenogramConnections` (a sibling of `<ReactFlow>`) can use `useNodes()` / `useViewport()` hooks |
| **Custom SVG overlay** | `GenogramConnections.tsx` renders all relationship lines as an absolutely-positioned SVG sibling of `<ReactFlow>`, at `z-index: 3` (below `.react-flow__renderer` at z-4 so node shapes + below-shape labels paint on top). Necessary because React Flow's edge system can't draw grouped orthogonal genogram lines. |
| **localStorage** | Multi-project storage. Keys: `genogram-builder-projects-v1` (array of Projects), `genogram-builder-active-id-v1`, `genogram-builder-settings`, `genogram-builder-coffee-prompted-v1` (gates the 20-min coffee prompt). Legacy key `genogram-builder-data` is migrated on first load. The empty canvas itself acts as the welcome surface — there's no separate welcome modal. |
| **JSON export format** | `{ version: 1, data: GenogramData, settings: Settings }`. The legacy bare-`GenogramData` format is still accepted on import. Importing a v1 file restores both the genogram and its design settings. |

---

## File map

```
src/
├── App.tsx                         Main component. All state lives here. Wraps in SettingsContext.Provider.
│                                   Manages multi-project state (projects[], activeProjectId).
│                                   Manages undo/redo stacks (undoStack, redoStack — GenogramData[]).
├── main.tsx                        Entry point
│
├── components/
│   ├── PersonNode.tsx              React Flow custom node. Renders shape + text inside SVG.
│   │                               NODE_SIZE = 80px. Uses clipPath to prevent text overflow.
│   │                               Reads settings from SettingsContext (name format + date display).
│   │                               Blue border on hover.
│   ├── GenogramConnections.tsx     SVG overlay for ALL relationship lines (couple lines,
│   │                               drop lines, sibship lines, child lines, location labels).
│   │                               Double-clicking a couple or parent-child line opens
│   │                               RelationshipEditor (parent-child opens the first matching
│   │                               rel for that child).
│   │                               Renders the inner-circle shape (resolved via
│   │                               lib/innerCircle.ts) — ellipse or rounded rectangle.
│   │                               Detects twins by matching full birthDate (YYYY-MM-DD).
│   │                               Twins-only families render as a wishbone (drop + V, no
│   │                               sibship line); twins among non-twin siblings drop a short
│   │                               stem below the sibship to a shared apex, then V.
│   │                               Parent-child line dasharray comes from the rel's nature
│   │                               ('adopted' = 6,4 dashed; 'foster' = 2,3 dotted).
│   │                               Sibship line is draggable via a handle at its midpoint —
│   │                               offset stored per family in GenogramData.sibshipOffsets.
│   │                               Hover turns all lines in a family group blue.
│   │                               Hit areas: 24px transparent stroke on couple lines, 16px on others.
│   │                               Separation/divorce slashes are offset 12px left of midX so they
│   │                               don't clash with the vertical drop line (which descends from midX).
│   ├── PersonEditor.tsx            Modal form: name (first + middle + birth surname + married surname),
│   │                               sex, DOB, DOD (only shown when Deceased), date display override,
│   │                               occupation, cause of death, notes.
│   │                               Father/Mother section (always shown). Position-in-tree for new persons.
│   ├── RelationshipEditor.tsx      Modal form: from/to person, type (incl. never-married-separated), location.
│   ├── GedcomImport.tsx            Drag-drop .ged file → person picker → generation sliders.
│   ├── SettingsPanel.tsx           Modal with two tabs:
│   │                               • General — name format, date display, Focal Person.
│   │                               • Design — font size + crop-names toggle, per-element
│   │                                 text colours (name, date, occupation, cause-of-death,
│   │                                 location), shape colours (outline, fill, deceased fill,
│   │                                 deceased ✕), and couple/parent-child line colour +
│   │                                 thickness. Native colour pickers throughout. Values
│   │                                 live on `Settings.design` (DesignSettings in
│   │                                 lib/types.ts) and are applied by PersonNode,
│   │                                 GenogramConnections, and exportSvg. Hover blue
│   │                                 (#3b82f6) and selection blue are intentionally NOT
│   │                                 customisable. With cropNamesToShape=false (default),
│   │                                 names are rendered as a sibling div BELOW the shape so
│   │                                 they're never clipped by the shape boundary or by
│   │                                 neighbouring nodes' fills.
│   ├── ProjectManager.tsx          Modal: list/create/rename/delete genogram projects.
│   ├── SelectionToolbar.tsx        Floating toolbar above selected node(s). Sibling of
│   │                               <ReactFlow> inside <ReactFlowProvider>; uses useNodes() +
│   │                               useViewport() to position itself in screen space.
│   │                               1 selected → Edit, Clean up descendants, Encircle, Delete.
│   │                               2+ selected → Align horizontal/vertical, Distribute (3+),
│   │                               Encircle, Delete. Icons via lucide-react. The lasso button
│   │                               sets the inner circle to the current selection (replaces).
│   ├── ExportSvgModal.tsx          Modal opened from File ▸ Export…. Inputs: title (defaults
│   │                               to the project name), Format (SVG / PDF), Orientation
│   │                               (auto / portrait / landscape), Page mode (Scale to fit A4 /
│   │                               Native size with A4 frame). Returns options to App.tsx
│   │                               which then calls exportToSvg or exportToPdf.
│   ├── ImportTargetDialog.tsx      Three-button dialog shown after a GEDCOM/JSON import has
│   │                               been parsed: "Replace current genogram" (overwrites the
│   │                               active project's data + settings; undoable) /
│   │                               "Create new genogram" (legacy flow — append a new project) /
│   │                               Cancel. Pending import data lives on `pendingImport` in
│   │                               App.tsx until the user picks.
│   └── RelationshipEdge.tsx        Unused in practice (edges={[]} in ReactFlow), kept for possible future use.
│
└── lib/
    ├── autoLayout.ts               Smart layout engine. autoLayout(people, relationships) →
    │                               nodePositions. Algorithm:
    │                               (1) BFS max-depth generation assignment from roots, then
    │                                   a fixed-point pass that enforces "spouses share a
    │                                   generation" (equalise to max within each couple) and
    │                                   "child = parent ± 1" in BOTH directions (so a
    │                                   cross-family marriage drags the side-tree's ancestors
    │                                   down with it instead of leaving them stranded above
    │                                   their now-deeper descendants);
    │                               (2) connected-components via spouse links → "couple units";
    │                               (3) effectiveBW() — dynamic block widths computed against a
    │                                   placedUnits set, so cross-family marriages (person A from
    │                                   family 1 marries person B from family 2) don't cause the
    │                                   couple unit to be double-counted and leave a gap;
    │                               (4) top-down recursive placement, centering each couple unit
    │                                   above its children; layout centred around x=0.
    │                               Constants: NW=140 (horiz spacing), NH=160 (vert), CLUSTER_GAP=10.
    │                               Used by GEDCOM import and the "✦ Clean Up Layout" button.
    ├── types.ts                    All TypeScript interfaces + Settings + DEFAULT_SETTINGS
    ├── SettingsContext.tsx          React context for global settings (consumed by PersonNode)
    ├── dateUtils.ts                Date formatting: extractYear(), personDateLabel(person, defaultDisplay?),
    │                               normalizeGedcomDate()
    ├── families.ts                 buildFamilies() — groups relationships into Family objects
    │                               (couple + shared children, or single parent + children).
    │                               Used by both GenogramConnections and exportSvg.
    ├── innerCircle.ts              resolveInnerCircle(settings, relationships) — returns
    │                               { ids, shape } for the inner-circle render, or null when
    │                               nothing should draw. Reads `innerCircleIds` first, falls
    │                               back to `[focalPersonId, firstPartner]` when only the
    │                               legacy `showFocalEllipse` flag is set so old projects keep
    │                               their ellipse without migration.
    ├── useModalShortcuts.ts        Document-level keydown hook used by every modal. Esc calls
    │                               onClose, Enter calls onEnter — except when the focused
    │                               element is a textarea/contenteditable (newlines), or a
    │                               button/link (let the focused control fire its own click,
    │                               so Enter on Cancel still cancels). IME composition is
    │                               ignored so Asian-input confirms don't fire Save.
    ├── gedcom.ts                   GEDCOM parser + buildGenogramFromGedcom() tree extractor.
    │                               After extraction, calls autoLayout() for initial positioning.
    ├── exportSvg.ts                Renders GenogramData to a standalone SVG string.
    │                               exportToSvg(data, settings, options) — uses settings for
    │                               name/date/focal rendering. Options: { title, orientation
    │                               ('auto'|'portrait'|'landscape'), mode ('fit'|'native'),
    │                               format }. Always wraps the genogram in an A4 page frame
    │                               (solid border in fit mode, dashed in native mode) with the
    │                               title centred at the top. fit mode scales the genogram into
    │                               one A4 page (and locks SVG size in mm so prints are exact);
    │                               native mode draws at full size with the A4 frame as a guide.
    └── exportPdf.ts                Lazy-loaded PDF exporter. exportToPdf(data, settings, options)
                                    runs exportToSvg, parses the result into a hidden DOM node,
                                    and uses jsPDF + svg2pdf.js to vector-render it onto an
                                    A4-sized PDF (or native-size for native mode). Code-split
                                    via dynamic import() in App.tsx so the ~480KB chunk only
                                    loads when the user picks PDF in the export dialog.
```

---

## Data model

```typescript
// src/lib/types.ts

interface Person {
  id: string
  firstName: string
  middleName?: string
  lastName: string          // birth surname
  marriedName?: string      // married surname (optional)
  sex: 'male' | 'female' | 'unknown' | 'other'
  birthDate?: string        // ISO "YYYY-MM-DD" or year string "YYYY"
  deathDate?: string
  deceased: boolean
  occupation?: string
  causeOfDeath?: string
  notes?: string
  residence?: string        // place name; rendered above the shape, prefixed
                            // "Lives in" / "Lived in" (verb flips with deceased).
  dateDisplay?: 'date' | 'year' | 'age'   // overrides global default when set
  outlineColor?: string                   // hex; overrides default ink for the shape outline.
                                          // Set via the colour swatch in the Person editor header bar
                                          // (16-colour palette in lib/types.ts:OUTLINE_COLORS, including
                                          // 4 greys). Honoured by PersonNode, GenogramConnections, exportSvg.
}

interface Project {
  id: string
  name: string
  data: GenogramData
  settings?: Settings       // Per-project override of the global Settings. Saved on every
                            // mutation by the persistence useEffect; restored by loadProject().
                            // JSON backup format bundles this so design choices round-trip.
  lastModified: number
}
// Projects stored at localStorage['genogram-builder-projects-v1']
// Active project ID at localStorage['genogram-builder-active-id-v1']

interface Settings {
  nameFormat: 'birth' | 'married' | 'first-only'
  dateDisplay: 'date' | 'year' | 'age'
  focalPersonId?: string
  showFocalEllipse?: boolean       // legacy — see lib/innerCircle.ts for the migration path
  innerCircleIds?: string[]        // people enclosed by the dashed shape
  showInnerCircle?: boolean
  innerCircleShape?: 'ellipse' | 'rounded-rect'
  design: DesignSettings           // every customisable colour / thickness / size for the
                                   // shapes, lines and text. See lib/types.ts:DEFAULT_DESIGN
                                   // for the full schema. Edited via Settings ▸ Design.
}
// Global settings persisted to localStorage['genogram-builder-settings'].
// Per-project settings live on Project.settings and override the global on load.

interface Relationship {
  id: string
  type: 'married' | 'separated' | 'divorced' | 'cohabiting' | 'never-married-separated' | 'parent-child'
  sourceId: string
  targetId: string
  location?: string                // shown above couple line, e.g. "Lives in Perth".
                                   // Couple relationships only.
  nature?: 'biological' | 'adopted' | 'foster'
                                   // Parent-child only. 'biological' (or unset) = solid line;
                                   // 'adopted' = dashed; 'foster' = dotted. Used to mark
                                   // adopted-out / fostered children who reunited with the family.
}

interface GenogramData {
  people: Person[]
  relationships: Relationship[]
  nodePositions: Record<string, { x: number; y: number }>
  sibshipOffsets?: Record<string, number>  // per-family vertical Y offset for the sibship line
                                           // key = family.id (sorted "p1:p2" or "single:pId")
}
```

---

## Key architecture decisions

### Why React Flow edges are not used
React Flow draws one edge per relationship (point-to-point). Genograms require grouped orthogonal lines: a horizontal couple line → vertical drop → horizontal sibship line → vertical lines to each child. This can't be done with individual edges. Instead, `GenogramConnections.tsx` reads node positions and draws proper SVG lines grouped by family.

### Couple network BFS (in `App.tsx`)
`getCoupleNetwork(personId)` — BFS through non-parent-child relationships (transitive). If A is married to B, and B is also married to C, all three are in the same couple network.

`getFamilyGroup(personId)` — starts with the dragged person's couple network, then BFS through parent-child relationships. For each child found, expands their full couple network (so their spouses move too), then recurses into those people's children, grandchildren, etc. Returns both sets so the drag handler knows who to Y-align (direct couple network) vs. fully translate (all descendants + their spouses).

### The families abstraction (`src/lib/families.ts`)
`buildFamilies(relationships)` converts the flat relationship list into `Family[]` objects, each with `parentIds` (1 or 2) and `childIds` (shared children). This is the core of the rendering logic and is shared between the canvas overlay and the SVG export.

### Why `ReactFlowProvider` is used explicitly
`GenogramConnections` needs `useNodes()` and `useViewport()` to track node positions and the pan/zoom transform in real time. It must be a sibling of `<ReactFlow>` (not a child) so its SVG sits above React Flow's internal pane div, allowing couple lines to receive double-click events. This requires wrapping both in an explicit `<ReactFlowProvider>`.

### Inner Circle
A user-defined group of people enclosed by a blue dashed shape (ellipse or rounded rectangle). State lives on `Settings`: `innerCircleIds: string[]`, `showInnerCircle: boolean`, `innerCircleShape: 'ellipse' | 'rounded-rect'`. The shape is computed from the bounding box of every member's node (NW × NH each) plus a 40px X / 60px Y margin so labels are covered. Resolved by `lib/innerCircle.ts:resolveInnerCircle()`, which also falls back to `[focalPersonId, firstPartner]` if `showFocalEllipse` is set without `innerCircleIds` (keeps pre-redesign projects rendering correctly). Populated via the SelectionToolbar's lasso button (sets `innerCircleIds = current selection`) or the Settings → General → Inner circle chip list (remove individuals or clear all).

### GEDCOM import
Parses `.ged` files manually (no library). Extracts INDI and FAM records. `buildGenogramFromGedcom()` does a BFS from a chosen start person, collecting ancestors (`generationsAbove` levels) and descendants (`generationsBelow` levels). Siblings at each ancestor level are also collected, with their descendants included. After extraction, `autoLayout()` is called to produce initial positions.

### Smart positioning of new persons (`getSmartPositionFor` in `App.tsx`)
When a new person is added via the editor, position is picked by priority:
1. **Spouse** (relContext = `spouse`) — sits to the right of the spouse's couple network at the spouse's y.
2. **Sibling** (relContext = `sibling-of`) — sits right of the sibling's known siblings on their row.
3. **Parents** (Father/Mother selected) — `positionFromParents()`: if the parents already have children, sit right of the rightmost on their row; otherwise drop one row below the parents' midpoint. This is the only path used by "Save & add child" (which seeds the just-saved person into the appropriate parent slot rather than using a `child-of` relContext).
4. **Parent-of** (relContext = `parent-of`) — places the new person right of the related person's other parents, or one row above if none.
5. Random fallback only when no anchor exists.

The Save split-button in the Person editor offers Save & add **spouse / sibling / child / parent**, each routed through `handleSaveAndAddNext` in `App.tsx`, which saves the current person, builds a seed (relContext or parents), bumps the editor's key to force remount, and reopens for the next person.

### Undo / Redo
Implemented as two stacks of `GenogramData` snapshots in `App.tsx` state (`undoStack`, `redoStack`), capped at 50 entries each.

`snapshot()` is called before every mutating action: save/delete person, save/delete relationship, drag start, Clean Up Layout, Start Over. It uses a `snapshotFnRef` (ref updated every render) to always capture the latest `people`, `relationships`, and node positions without needing to be in hook dependency arrays.

`handleUndo` / `handleRedo` swap the current state onto the opposite stack and restore the top of the active stack. Stacks are cleared when switching projects (history is per-project).

Keyboard shortcuts: `⌘Z` / `Ctrl+Z` (undo), `⌘⇧Z` / `Ctrl+Y` (redo). Registered once via a stable `useEffect` that reads current handlers through refs.

---

## Interaction model

| Action | Result |
|---|---|
| Drag a person | Moves entire **couple network** (all spouses, transitive) + all descendants (children, grandchildren, …) + descendants' spouses. Direct couple-network members are Y-aligned to the dragged node; everyone else moves with full dx+dy. |
| **Shift+drag** a person, or **click an already-selected person then drag** (move mode) | Slides that person horizontally only (y locked). `onNodeDragStop` re-clamps the y because React Flow commits the cursor's final y *after* the last `onNodeDrag` fires — without that re-clamp the node would jump to the cursor's row on release. |
| Hover person | Shape stroke turns blue (1.5px → 2.5px). |
| Hover couple line | All lines in the family group turn blue. Location label also highlights. |
| Double-click a person node | Opens PersonEditor |
| Double-click a couple line | Opens RelationshipEditor for that relationship. Large transparent hit area (24px wide) makes this easier. |
| Click a person | Selects it (React Flow native). A floating SelectionToolbar appears above with Edit / Clean up descendants / Delete. |
| **Shift+click** another person | Adds to multi-selection. Toolbar switches to Align horizontal / Align vertical / Delete. |
| Delete key | Deletes selected node(s). Intercepted in `handleNodesChange` so a snapshot is taken first (undo restores them) and `people`/`relationships` get cleaned up alongside the React Flow node state. |
| **+ Person** button | Opens PersonEditor. If other people exist, shows "Position in tree" section: pick Spouse of / Parent of / Sibling of + select person. Auto-places new node and creates the relationship. |
| **⌘Z / Ctrl+Z** | Undo |
| **⌘⇧Z / Ctrl+Y** | Redo |

---

## Toolbar layout

```
[Genogram Builder]  [Project name ▾]       [File ▾] [✦ Clean Up Layout] | [↩] [↪] | [+ Person] [+ Relationship] | [⚙]
```

- **Project badge** — click to open ProjectManager (switch/rename/create/delete projects)
- **File ▾** — dropdown: New blank genogram, Import GEDCOM…, Load from Backup… (JSON), Export…, Backup to JSON, Start Over (red). Export… opens ExportSvgModal (title + orientation + page mode + SVG/PDF format). Export/Start Over disabled when canvas is empty. Closes on outside click.
- **✦ Clean Up Layout** — shows a confirm dialog warning about lost custom arrangements, then runs `autoLayout()`. Undoable.
- **↩ / ↪** — Undo / Redo buttons. Greyed when stack is empty.
- **⚙** — Settings panel

Export filenames use the project name (illegal filesystem characters replaced with `-`).

**Legend bar** (below toolbar): symbol legend + keyboard hint strip.

---

## Persistence

- **Multi-project**: all genograms stored as `Project[]` at `localStorage['genogram-builder-projects-v1']`. Active project ID at `localStorage['genogram-builder-active-id-v1']`.
- Legacy single-project data (`genogram-builder-data`) is migrated to a project named "Default Genogram" on first load.
- Saves on every state change (people, relationships, node positions).
- **Start Over**: resets current project's canvas. Does not delete the project.
- **Save JSON / Open JSON**: JSON import creates a new project named after the file.
- **Import GEDCOM / Load from Backup**: parses the file, then opens `ImportTargetDialog` so the user picks "Replace current genogram" (overwrites the active project's data + settings; undoable via the regular undo stack) or "Create new genogram" (existing flow — appends a new project). Skipped only if the user cancels the dialog. GEDCOM imports run `autoLayout()` before this point.
- **Export / Save JSON**: filename = project name + extension.

---

## Genogram symbol conventions (McGoldrick notation)

| Symbol | Meaning |
|---|---|
| Square | Male |
| Circle | Female |
| Triangle (point up) | Unknown |
| Diamond | Other |
| Shape filled grey + X cross | Deceased |
| Solid horizontal line | Married |
| Dashed horizontal line | Cohabiting |
| Dashed line with single slash | Never married, not together |
| Solid line with one slash (offset left of drop) | Separated |
| Solid line with two slashes (offset left of drop) | Divorced |
| Blue dashed ellipse / rounded rectangle | Inner circle (user-nominated group) |
| Dashed parent-child line | Adopted child |
| Dotted parent-child line | Foster child |
| Vertical drop → horizontal sibship → verticals to children | Parent-child |
| Wishbone (no sibship) for twin-only families; short stem + V apex when twins are among non-twin siblings | Twins (matching full birth date) |
| Text above couple line | Location / "lives in" |
| Italic text above shape ("Lives in X" / "Lived in X") | Person's residence |

---

## Known issues / things to be aware of

- `RelationshipEdge.tsx` exists but is never rendered (`edges={[]}` in ReactFlow). Can be deleted.
- Shift+drag only constrains the dragged person. The couple line updates in real time as the node moves.
- Date inputs use HTML `type="date"` (YYYY-MM-DD). GEDCOM dates like "15 JAN 1945" are normalised to ISO on import via `normalizeGedcomDate()`.
- The `dateDisplay` setting is per-person. Default is `'year'` if unset.
- All dropdowns for person selection (Father/Mother/Focal) are sorted alphabetically by full name.
- `Node` from `@xyflow/react` shadows the DOM `Node` type — use `HTMLElement` for `contains()` casts (see `FileMenu` in App.tsx).
- Auto-layout handles most trees well but complex blended families (many cross-family marriages) may still need manual nudging after Clean Up Layout.

---

## What hasn't been built yet (possible next steps)

- Multi-select drag
- Relationship lines between non-couple adults (e.g. estranged, close)
- Notes visible on the canvas (currently only in editor)
- Auto-layout further refinement for very complex blended family structures
