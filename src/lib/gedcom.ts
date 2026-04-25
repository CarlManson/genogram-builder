import { Person, Relationship, GenogramData } from './types'
import { normalizeGedcomDate } from './dateUtils'
import { autoLayout } from './autoLayout'

interface GedcomRecord {
  tag: string
  data?: string
  tree?: GedcomRecord[]
}

function findTag(tree: GedcomRecord[], tag: string): GedcomRecord | undefined {
  return tree.find(r => r.tag === tag)
}

function findAllTag(tree: GedcomRecord[], tag: string): GedcomRecord[] {
  return tree.filter(r => r.tag === tag)
}

export interface GedcomPerson {
  id: string
  firstName: string
  lastName: string
  fullName: string
  birthDate?: string
  deathDate?: string
  sex: 'male' | 'female' | 'unknown'
  deceased: boolean
  occupation?: string
}

export function parseGedcom(content: string): {
  people: GedcomPerson[]
  rawRecords: GedcomRecord[]
} {
  // Dynamic import not available at parse time, so we do a lightweight manual parse
  const lines = content.split(/\r?\n/)
  const root: GedcomRecord[] = []
  const stack: { level: number; record: GedcomRecord }[] = []

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(@[^@]+@|\w+)\s*(.*)$/)
    if (!match) continue
    const level = parseInt(match[1])
    const tagOrId = match[2]
    const rest = match[3]

    let tag: string
    let data: string | undefined

    if (tagOrId.startsWith('@')) {
      tag = rest.split(' ')[0]
      data = tagOrId
    } else {
      tag = tagOrId
      data = rest || undefined
    }

    const record: GedcomRecord = { tag, data, tree: [] }

    if (level === 0) {
      root.push(record)
      stack.length = 0
      stack.push({ level, record })
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }
      if (stack.length > 0) {
        stack[stack.length - 1].record.tree!.push(record)
      }
      stack.push({ level, record })
    }
  }

  const people: GedcomPerson[] = []

  for (const rec of root) {
    if (rec.tag !== 'INDI') continue
    const id = rec.data?.replace(/@/g, '') ?? ''
    const tree = rec.tree ?? []

    const nameRec = findTag(tree, 'NAME')
    const rawName = nameRec?.data ?? ''
    const nameParts = rawName.replace(/\//g, '').trim().split(/\s+/)
    // In GEDCOM, surname is between slashes
    const surnameMatch = rawName.match(/\/([^/]*)\//)
    const lastName = surnameMatch ? surnameMatch[1].trim() : ''
    const firstName = nameParts
      .filter(p => p !== lastName)
      .join(' ')
      .trim()

    const sexRec = findTag(tree, 'SEX')
    const sexVal = sexRec?.data?.toUpperCase()
    const sex =
      sexVal === 'M' ? 'male' : sexVal === 'F' ? 'female' : 'unknown'

    const birthRec = findTag(tree, 'BIRT')
    const birthDateRec = birthRec?.tree ? findTag(birthRec.tree, 'DATE') : undefined
    const birthDate = normalizeGedcomDate(birthDateRec?.data)

    const deathRec = findTag(tree, 'DEAT')
    const deceased = !!deathRec
    const deathDateRec = deathRec?.tree ? findTag(deathRec.tree, 'DATE') : undefined
    const deathDate = normalizeGedcomDate(deathDateRec?.data)

    const occuRec = findTag(tree, 'OCCU')
    const occupation = occuRec?.data

    people.push({
      id,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      sex,
      birthDate,
      deathDate,
      deceased,
      occupation,
    })
  }

  return { people, rawRecords: root }
}

export function buildGenogramFromGedcom(
  rawRecords: GedcomRecord[],
  allPeople: GedcomPerson[],
  startPersonId: string,
  generationsAbove: number,
  generationsBelow: number
): GenogramData {
  const personMap = new Map(allPeople.map(p => [p.id, p]))

  // Build family index: FAM records
  interface FamRecord {
    id: string
    husbId?: string
    wifeId?: string
    childIds: string[]
    relationship: 'married' | 'divorced' | 'separated' | 'cohabiting'
  }

  const families: FamRecord[] = []
  for (const rec of rawRecords) {
    if (rec.tag !== 'FAM') continue
    const famId = rec.data?.replace(/@/g, '') ?? ''
    const tree = rec.tree ?? []

    const husbRec = findTag(tree, 'HUSB')
    const wifeRec = findTag(tree, 'WIFE')
    const childRecs = findAllTag(tree, 'CHIL')

    const divRec = findTag(tree, 'DIV')
    const marrRec = findTag(tree, 'MARR')

    let relationship: FamRecord['relationship'] = 'cohabiting'
    if (marrRec) relationship = 'married'
    if (divRec) relationship = 'divorced'

    families.push({
      id: famId,
      husbId: husbRec?.data?.replace(/@/g, ''),
      wifeId: wifeRec?.data?.replace(/@/g, ''),
      childIds: childRecs.map(c => c.data?.replace(/@/g, '') ?? '').filter(Boolean),
      relationship,
    })
  }

  // BFS outward from startPerson
  const includedIds = new Set<string>()
  const relationships: Relationship[] = []
  const relSet = new Set<string>()

  function addRel(rel: Omit<Relationship, 'id'>) {
    const key = `${rel.type}:${rel.sourceId}:${rel.targetId}`
    if (relSet.has(key)) return
    relSet.add(key)
    relationships.push({ ...rel, id: key })
  }

  // Find parents of a person (returns family records where person is a child)
  function parentFamilies(pid: string) {
    return families.filter(f => f.childIds.includes(pid))
  }

  // Find child families (records where person is spouse)
  function spouseFamilies(pid: string) {
    return families.filter(f => f.husbId === pid || f.wifeId === pid)
  }

  // Collect descendants up to `gens` levels
  function collectDescendants(pid: string, gens: number) {
    if (!pid) return
    includedIds.add(pid)
    if (gens <= 0) return
    const sFams = spouseFamilies(pid)
    for (const fam of sFams) {
      const spouseId = fam.husbId === pid ? fam.wifeId : fam.husbId
      if (spouseId) {
        includedIds.add(spouseId)
        addRel({ type: fam.relationship, sourceId: pid, targetId: spouseId })
      }
      for (const childId of fam.childIds) {
        includedIds.add(childId)
        addRel({ type: 'parent-child', sourceId: pid, targetId: childId })
        if (spouseId) {
          addRel({ type: 'parent-child', sourceId: spouseId, targetId: childId })
        }
        collectDescendants(childId, gens - 1)
      }
    }
  }

  // Collect ancestors up to `gens` levels.
  // `depth` tracks how many generations above the start person we currently are,
  // so siblings of ancestors at depth k get (k + generationsBelow) descendant levels,
  // ensuring cousins/second-cousins etc. land within the declared generation window.
  function collectAncestors(pid: string, gens: number, depth: number) {
    if (gens <= 0 || !pid) return
    includedIds.add(pid)
    const pFams = parentFamilies(pid)
    for (const fam of pFams) {
      const parents = [fam.husbId, fam.wifeId].filter(Boolean) as string[]
      if (parents.length === 2) {
        addRel({ type: fam.relationship, sourceId: parents[0], targetId: parents[1] })
      }

      // Siblings of pid (aunts/uncles/cousins relative to start person)
      for (const sibId of fam.childIds) {
        if (sibId === pid) continue
        includedIds.add(sibId)
        for (const parentId of parents) {
          addRel({ type: 'parent-child', sourceId: parentId, targetId: sibId })
        }
        // A sibling at depth k can have (k + generationsBelow) descendant levels
        // before exceeding the window below the start person
        collectDescendants(sibId, depth + generationsBelow)
      }

      for (const parentId of parents) {
        includedIds.add(parentId)
        addRel({ type: 'parent-child', sourceId: parentId, targetId: pid })
        collectAncestors(parentId, gens - 1, depth + 1)
      }
    }
  }

  collectAncestors(startPersonId, generationsAbove, 0)
  collectDescendants(startPersonId, generationsBelow)

  const people: Person[] = []
  for (const id of includedIds) {
    const gp = personMap.get(id)
    if (!gp) continue
    people.push({
      id: gp.id,
      firstName: gp.firstName,
      lastName: gp.lastName,
      sex: gp.sex,
      birthDate: gp.birthDate,
      deathDate: gp.deathDate,
      occupation: gp.occupation,
      deceased: gp.deceased,
    })
  }

  const nodePositions = autoLayout(people, relationships)
  return { people, relationships, nodePositions }
}
