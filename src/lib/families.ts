import { Relationship } from './types'

export interface Family {
  id: string
  parentIds: [string] | [string, string]
  coupleType?: string
  childIds: string[]
}

export function buildFamilies(relationships: Relationship[]): Family[] {
  const coupleRels = relationships.filter(r => r.type !== 'parent-child')
  const parentChildRels = relationships.filter(r => r.type === 'parent-child')

  const parentToChildren = new Map<string, string[]>()
  for (const r of parentChildRels) {
    if (!parentToChildren.has(r.sourceId)) parentToChildren.set(r.sourceId, [])
    parentToChildren.get(r.sourceId)!.push(r.targetId)
  }

  const assignedKeys = new Set<string>() // "parentId:childId" pairs already in a couple family
  const families: Family[] = []
  const processedCouples = new Set<string>()

  for (const coupleRel of coupleRels) {
    const key = [coupleRel.sourceId, coupleRel.targetId].sort().join(':')
    if (processedCouples.has(key)) continue
    processedCouples.add(key)

    const p1Children = new Set(parentToChildren.get(coupleRel.sourceId) ?? [])
    const p2Children = new Set(parentToChildren.get(coupleRel.targetId) ?? [])
    const sharedChildren = [...p1Children].filter(c => p2Children.has(c))

    for (const c of sharedChildren) {
      assignedKeys.add(`${coupleRel.sourceId}:${c}`)
      assignedKeys.add(`${coupleRel.targetId}:${c}`)
    }

    families.push({
      id: key,
      parentIds: [coupleRel.sourceId, coupleRel.targetId],
      coupleType: coupleRel.type,
      childIds: sharedChildren,
    })
  }

  // Single-parent families for unassigned parent-child relationships
  const singleFamilies = new Map<string, Family>()
  for (const r of parentChildRels) {
    if (assignedKeys.has(`${r.sourceId}:${r.targetId}`)) continue
    if (!singleFamilies.has(r.sourceId)) {
      const f: Family = { id: `single:${r.sourceId}`, parentIds: [r.sourceId], childIds: [] }
      singleFamilies.set(r.sourceId, f)
      families.push(f)
    }
    singleFamilies.get(r.sourceId)!.childIds.push(r.targetId)
  }

  return families
}
