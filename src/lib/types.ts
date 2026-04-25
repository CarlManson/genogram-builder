export type Sex = 'male' | 'female' | 'unknown'
export type DateDisplay = 'date' | 'year' | 'age'
export type NameFormat = 'birth' | 'married' | 'first-only'

export interface Settings {
  nameFormat: NameFormat
  dateDisplay: DateDisplay
  focalPersonId?: string
  showFocalEllipse?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  nameFormat: 'birth',
  dateDisplay: 'year',
  showFocalEllipse: false,
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
