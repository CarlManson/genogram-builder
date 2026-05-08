import { Settings, Relationship, InnerCircleShape } from './types'

export interface ResolvedInnerCircle {
  ids: string[]
  shape: InnerCircleShape
}

// Resolves which people the inner-circle shape should enclose, falling back
// to the legacy focal-couple behaviour for projects that haven't migrated.
// Returns null when nothing should be drawn.
export function resolveInnerCircle(
  settings: Settings,
  relationships: Relationship[],
): ResolvedInnerCircle | null {
  const shape: InnerCircleShape = settings.innerCircleShape ?? 'ellipse'
  const explicit = settings.innerCircleIds ?? []

  if (explicit.length > 0) {
    if (settings.showInnerCircle === false) return null
    return { ids: explicit, shape }
  }

  // Legacy fallback: focal + first non-parent-child partner.
  if (settings.showFocalEllipse && settings.focalPersonId) {
    const ids = [settings.focalPersonId]
    const rel = relationships.find(r =>
      r.type !== 'parent-child' &&
      (r.sourceId === settings.focalPersonId || r.targetId === settings.focalPersonId)
    )
    if (rel) {
      const partner = rel.sourceId === settings.focalPersonId ? rel.targetId : rel.sourceId
      ids.push(partner)
    }
    return { ids, shape }
  }

  return null
}
