# Genogram Builder

A browser-based genogram builder. A genogram is a clinical/family diagram that shows people as shapes (square = male, circle = female, diamond = unknown/other) connected by relationship lines. It's used in counselling, social work, and family history.

The app runs entirely in the browser — no server, no backend. State persists to `localStorage`, with multi-project support.

## Getting started

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build to dist/
```

## Features

- **Interactive canvas** — pan, zoom, drag people. Drag a person and their whole family group moves with them; shift+drag slides horizontally only.
- **McGoldrick notation** — squares/circles/diamonds, deceased grey-fill with cross, married/cohabiting/separated/divorced lines, twin detection.
- **Multi-project storage** — create, rename, switch, delete genograms. All data lives in `localStorage`.
- **GEDCOM import** — drop a `.ged` file, pick a focal person, choose generations above/below. Auto-layout produces an initial tree.
- **Undo / redo** — `⌘Z` / `⌘⇧Z` (or `Ctrl+Z` / `Ctrl+Y`), capped at 50 steps per project.
- **Smart auto-layout** — "✦ Clean Up Layout" reflows the tree, centering each couple above their children and handling cross-family marriages.
- **SVG export + JSON save/load** — round-trip your work or hand off a print-ready diagram.
- **Focal person** — optional blue dashed ellipse around a chosen person and their spouse.

## Tech stack

- **Vite + React + TypeScript**
- **@xyflow/react v12** for the interactive canvas (node positioning only — relationship lines are drawn by a custom SVG overlay)
- **localStorage** for persistence

## Interaction cheatsheet

| Action | Result |
|---|---|
| Drag a person | Moves their whole couple network and all descendants |
| Shift+drag | Slides horizontally only (Y locked) |
| Double-click person | Edit person |
| Double-click couple line | Edit relationship |
| Delete | Remove selected node |
| `⌘Z` / `⌘⇧Z` | Undo / redo |

## Project structure

See [`HANDOVER.md`](./HANDOVER.md) for the full architecture, data model, and file map.

## License

MIT
