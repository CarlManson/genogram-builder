/**
 * autoLayout — places genogram nodes so that:
 *   • spouses are always adjacent on the same row
 *   • each couple is centred above its shared children
 *   • generations are on evenly-spaced horizontal rows
 *
 * Algorithm:
 *   1. Assign every person a generation (BFS, max-depth from roots).
 *   2. Collect every person into a "couple unit" (connected component
 *      through spouse relationships).  A single person is a unit of 1.
 *   3. For every couple unit, find its "child units" — the couple units
 *      that contain the shared children.
 *   4. Bottom-up: compute a block width for every unit:
 *        blockWidth = max(unitWidth, Σ childBlockWidths + gaps)
 *   5. Top-down: place root units left-to-right; recursively place each
 *      child unit centred within its allocated slice of the parent's block.
 *   6. Within a unit, order spouses so the one with more (or left-most)
 *      children goes on the left.
 */

import { Person, Relationship } from './types'

const NW = 140   // horizontal centre-to-centre spacing (px)
const NH = 160   // vertical spacing between generations (px)
const CLUSTER_GAP = 10   // extra gap between adjacent sibling-family blocks

export function autoLayout(
  people: Person[],
  relationships: Relationship[]
): Record<string, { x: number; y: number }> {
  if (people.length === 0) return {}

  const ids = new Set(people.map(p => p.id))

  // ── Build adjacency maps ────────────────────────────────────────────────
  const childrenOf = new Map<string, string[]>()
  const parentsOf  = new Map<string, string[]>()
  const spousesOf  = new Map<string, string[]>()

  for (const r of relationships) {
    if (!ids.has(r.sourceId) || !ids.has(r.targetId)) continue
    if (r.type === 'parent-child') {
      addTo(childrenOf, r.sourceId, r.targetId)
      addTo(parentsOf,  r.targetId, r.sourceId)
    } else {
      addTo(spousesOf, r.sourceId, r.targetId)
      addTo(spousesOf, r.targetId, r.sourceId)
    }
  }

  // ── Assign generations ──────────────────────────────────────────────────
  const hasParentInSet = new Set(
    relationships
      .filter(r => r.type === 'parent-child' && ids.has(r.sourceId) && ids.has(r.targetId))
      .map(r => r.targetId)
  )
  const gen = new Map<string, number>()
  const bfsQ: [string, number][] = people
    .filter(p => !hasParentInSet.has(p.id))
    .map(p => [p.id, 0])

  while (bfsQ.length > 0) {
    const [pid, g] = bfsQ.shift()!
    if ((gen.get(pid) ?? -1) >= g) continue
    gen.set(pid, g)
    for (const cid of childrenOf.get(pid) ?? []) bfsQ.push([cid, g + 1])
    // Spouses share the same generation; only enqueue if unseen
    for (const sid of spousesOf.get(pid) ?? []) {
      if (!gen.has(sid)) bfsQ.push([sid, g])
    }
  }
  // Fallback for disconnected nodes
  for (const p of people) if (!gen.has(p.id)) gen.set(p.id, 0)

  // ── Build couple units (connected components via spouse links) ──────────
  // unitOf[id] → the array that is this person's couple unit
  const unitOf   = new Map<string, string[]>()
  const allUnits: string[][] = []
  const visited  = new Set<string>()

  for (const p of people) {
    if (visited.has(p.id)) continue
    const unit: string[] = []
    const q = [p.id]
    while (q.length > 0) {
      const id = q.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      unit.push(id)
      for (const sid of spousesOf.get(id) ?? []) {
        if (ids.has(sid) && !visited.has(sid)) q.push(sid)
      }
    }
    for (const id of unit) unitOf.set(id, unit)
    allUnits.push(unit)
  }

  // ── Generation fixed-point ──────────────────────────────────────────────
  // BFS alone doesn't enforce the two invariants together: spouses can end
  // up at different generations (the BFS spouse rule only propagates to an
  // unseen partner), and once a parent's generation is bumped up via a
  // longer ancestral path, its children's generations aren't re-propagated.
  // The visible symptom is "children rendered above their parents" in
  // complex trees with cross-family marriages. Fix: iterate
  //   1. equalise spouses to max within each couple unit, and
  //   2. push every child to ≥ parent + 1
  // until stable. Generations only increase, so this converges quickly.
  let changed = true
  while (changed) {
    changed = false
    for (const unit of allUnits) {
      let maxG = 0
      for (const id of unit) {
        const g = gen.get(id) ?? 0
        if (g > maxG) maxG = g
      }
      for (const id of unit) {
        if ((gen.get(id) ?? 0) < maxG) { gen.set(id, maxG); changed = true }
      }
    }
    for (const r of relationships) {
      if (r.type !== 'parent-child') continue
      if (!ids.has(r.sourceId) || !ids.has(r.targetId)) continue
      const pg = gen.get(r.sourceId) ?? 0
      const cg = gen.get(r.targetId) ?? 0
      // Forward: child must be ≥ parent + 1.
      if (cg < pg + 1) { gen.set(r.targetId, pg + 1); changed = true }
      // Backward: if a child has been pushed deeper than parent + 1 (typically by
      // spouse equalisation pulling them down a row), pull the parent down to
      // child − 1 so the generation gap stays at 1. Without this, a side-family's
      // ancestors get stranded several rows above their now-deeper descendants.
      const cgNow = gen.get(r.targetId) ?? 0
      if (pg < cgNow - 1) { gen.set(r.sourceId, cgNow - 1); changed = true }
    }
  }

  // Normalise so the oldest generation = 0 (no-op when BFS started at 0;
  // kept explicit so future changes don't silently break y-positioning).
  const minG = Math.min(...gen.values())
  if (minG !== 0) for (const [id, g] of gen) gen.set(id, g - minG)

  // ── Find child units for a given unit ───────────────────────────────────
  // Only include a child if AT LEAST ONE of its parents is in this unit,
  // preventing children from previous marriages being counted in both units.
  const unitSet = (unit: string[]) => new Set(unit)

  function childUnitsOf(unit: string[]): string[][] {
    const parentSet = unitSet(unit)
    const seen  = new Set<string[]>()
    const result: string[][] = []
    for (const pid of unit) {
      for (const cid of childrenOf.get(pid) ?? []) {
        // Only claim this child if all their included parents belong to this unit
        // (i.e. don't steal children that truly belong to another couple)
        const childParents = (parentsOf.get(cid) ?? []).filter(p => ids.has(p))
        const belongsHere = childParents.length === 0 ||
          childParents.some(p => parentSet.has(p)) &&
          (childParents.length === 1 || childParents.every(p => parentSet.has(p)))
        if (!belongsHere) continue
        const cu = unitOf.get(cid)
        if (cu && !seen.has(cu)) { seen.add(cu); result.push(cu) }
      }
    }
    return result
  }

  // ── Top-down placement ───────────────────────────────────────────────────
  // We compute block widths dynamically so that couple units which have already
  // been placed by an earlier root-family are excluded (zero width) from later
  // families.  This prevents the "big gap" that appears when two separate family
  // trees are connected by a cross-family marriage (e.g. Stephen Manson ↔
  // Joycelyn Pulley): the couple unit is claimed & placed by the first family,
  // and the second family's effective width simply ignores it.

  const pos        = new Map<string, { x: number; y: number }>()
  const placedUnits = new Set<string[]>()

  /** Width this unit needs, excluding already-placed descendant units. */
  function effectiveBW(unit: string[]): number {
    if (placedUnits.has(unit)) return 0
    const coupleW  = unit.length * NW
    const children = childUnitsOf(unit).filter(cu => !placedUnits.has(cu))
    if (children.length === 0) return coupleW
    const childSum  = children.reduce((s, cu) => s + effectiveBW(cu), 0)
    const withGaps  = childSum + Math.max(0, children.length - 1) * CLUSTER_GAP
    return Math.max(coupleW, withGaps)
  }

  // Root units: members whose parents are all outside the dataset
  const rootUnits = allUnits.filter(unit =>
    unit.every(id => (parentsOf.get(id) ?? []).every(pid => !ids.has(pid)))
  )

  function placeUnit(unit: string[], blockLeft: number) {
    if (placedUnits.has(unit)) return   // already placed by another family branch
    placedUnits.add(unit)

    const bw  = effectiveBW(unit)   // recompute now that placedUnits is updated
    const g   = gen.get(unit[0]) ?? 0
    const y   = g * NH

    // Order spouses: more children → left
    const ordered    = orderSpouses(unit, childrenOf)
    const coupleSpan = (ordered.length - 1) * NW
    const coupleLeft = blockLeft + (bw - coupleSpan) / 2
    ordered.forEach((id, i) => {
      pos.set(id, { x: coupleLeft + i * NW, y })
    })

    // Place child units (skip already-placed ones)
    const children = childUnitsOf(unit).filter(cu => !placedUnits.has(cu))
    children.sort((a, b) => avgParentX(a, parentsOf, pos) - avgParentX(b, parentsOf, pos))

    let cursor = blockLeft
    for (const cu of children) {
      const cbw = effectiveBW(cu)
      placeUnit(cu, cursor)
      cursor += cbw + CLUSTER_GAP
    }
  }

  // Place root units left-to-right
  let rootCursor = 0
  for (const unit of rootUnits) {
    const bw = effectiveBW(unit)
    placeUnit(unit, rootCursor)
    rootCursor += bw + CLUSTER_GAP
  }

  // ── Handle any unplaced nodes (disconnected people) ──────────────────────
  let fallback = rootCursor
  for (const p of people) {
    if (!pos.has(p.id)) {
      pos.set(p.id, { x: fallback, y: (gen.get(p.id) ?? 0) * NH })
      fallback += NW
    }
  }

  // ── Centre the whole layout around x = 0 ────────────────────────────────
  const xs = [...pos.values()].map(p => p.x)
  const layoutMin = Math.min(...xs)
  const layoutMax = Math.max(...xs)
  const offsetX = -((layoutMin + layoutMax) / 2)

  const result: Record<string, { x: number; y: number }> = {}
  for (const [id, p] of pos) {
    result[id] = { x: p.x + offsetX, y: p.y }
  }
  return result
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function addTo(map: Map<string, string[]>, key: string, val: string) {
  if (!map.has(key)) map.set(key, [])
  map.get(key)!.push(val)
}

/** Order spouses left-to-right: the one whose children appear leftmost goes first. */
function orderSpouses(
  unit: string[],
  childrenOf: Map<string, string[]>
): string[] {
  if (unit.length <= 1) return unit
  // Score each person by the total number of children (more children → more "central" role → left)
  return unit.slice().sort((a, b) => {
    const ca = (childrenOf.get(a) ?? []).length
    const cb = (childrenOf.get(b) ?? []).length
    return cb - ca  // more children → goes left (index 0)
  })
}

/** Average x of already-placed parents. Falls back to a large number if none placed. */
function avgParentX(
  unit: string[],
  parentsOf: Map<string, string[]>,
  pos: Map<string, { x: number; y: number }>
): number {
  const xs: number[] = []
  for (const id of unit) {
    for (const pid of parentsOf.get(id) ?? []) {
      const p = pos.get(pid)
      if (p) xs.push(p.x)
    }
  }
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : Infinity
}
