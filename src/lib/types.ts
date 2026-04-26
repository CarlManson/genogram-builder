export type Sex = 'male' | 'female' | 'unknown' | 'other'
export type DateDisplay = 'date' | 'year' | 'age'
export type NameFormat = 'birth' | 'married' | 'first-only'

export interface DesignSettings {
  fontSize: number                  // shape label font size in px
  outlineColor: string              // default shape stroke (when no per-person override)
  outlineThickness: number          // default shape stroke width
  coupleLineColor: string           // marriage / couple horizontal lines
  coupleLineThickness: number
  parentChildLineColor: string      // drop, sibship, child verticals
  parentChildLineThickness: number
  cropNamesToShape: boolean         // when false (default), names render unclipped
}

export const DEFAULT_DESIGN: DesignSettings = {
  fontSize: 10,
  outlineColor: '#1a1a1a',
  outlineThickness: 1.5,
  coupleLineColor: '#1a1a1a',
  coupleLineThickness: 2,
  parentChildLineColor: '#1a1a1a',
  parentChildLineThickness: 1.5,
  cropNamesToShape: false,
}

// Shared palette used by the per-person outline swatch (PersonEditor header)
// and the global default-outline picker (Settings → Design). Index 0 (default
// ink) acts as "no override" in PersonEditor.
export const OUTLINE_COLORS: readonly string[] = [
  '#1a1a1a', '#64748b', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#0d9488', '#0284c7',
  '#2563eb', '#4f46e5', '#9333ea', '#db2777',
]

export interface Settings {
  nameFormat: NameFormat
  dateDisplay: DateDisplay
  focalPersonId?: string
  showFocalEllipse?: boolean
  design: DesignSettings
}

export const DEFAULT_SETTINGS: Settings = {
  nameFormat: 'birth',
  dateDisplay: 'year',
  showFocalEllipse: false,
  design: DEFAULT_DESIGN,
}

export type RelContextType = 'spouse' | 'child-of' | 'parent-of' | 'sibling-of'

export interface RelContext {
  relatedPersonId: string
  relType: RelContextType
}

export type RelationshipType =
  | 'married'
  | 'separated'
  | 'divorced'
  | 'cohabiting'
  | 'never-married-separated'
  | 'parent-child'

export interface Person {
  id: string
  firstName: string
  middleName?: string
  lastName: string
  marriedName?: string
  sex: Sex
  birthDate?: string   // ISO "YYYY-MM-DD" or year string "YYYY"
  deathDate?: string
  deceased: boolean
  occupation?: string
  causeOfDeath?: string
  notes?: string
  dateDisplay?: DateDisplay  // overrides global default when set
  outlineColor?: string      // hex colour for the shape's outline; falls back to default ink
}

export interface Relationship {
  id: string
  type: RelationshipType
  sourceId: string
  targetId: string
  location?: string
}

export interface GenogramData {
  people: Person[]
  relationships: Relationship[]
  nodePositions: Record<string, { x: number; y: number }>
}

export interface Project {
  id: string
  name: string
  data: GenogramData
  lastModified: number
}
