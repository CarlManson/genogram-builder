import { Person, GenogramData, Settings, DEFAULT_SETTINGS } from './types'
import { buildFamilies } from './families'
import { personDateLabel } from './dateUtils'

const NODE_SIZE = 80
const HALF = NODE_SIZE / 2
const PAD = 50
const SIBSHIP_GAP = 28

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function nameLines(person: Person, settings: Settings): string[] {
  if (settings.nameFormat === 'first-only') {
    return person.firstName ? [person.firstName] : []
  }
  const first = [person.firstName, person.middleName].filter(Boolean).join(' ')
  const surname = settings.nameFormat === 'married'
    ? (person.marriedName || person.lastName)
    : person.lastName
  return [first, surname].filter(Boolean)
}

function renderPersonSymbol(person: Person, pos: { x: number; y: number }, settings: Settings): string {
  const cx = pos.x + HALF
  const cy = pos.y + HALF
  const stroke = '#1a1a1a'
  const fill = person.deceased ? '#e5e5e5' : '#fff'

  const nameOnly = nameLines(person, settings)
  const nameCount = nameOnly.length
  const dateStr = personDateLabel(person, settings.dateDisplay)
  const lines = dateStr ? [...nameOnly, dateStr] : [...nameOnly]
  if (lines.length === 0) lines.push('Unknown')

  const lineH = 14
  const totalTextH = lines.length * lineH
  const startY = cy - totalTextH / 2 + lineH * 0.5

  const textEls = lines
    .map((line, i) =>
      `<text x="${cx}" y="${startY + i * lineH}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="10" fill="#1a1a1a"${i < nameCount ? ' font-weight="bold"' : ''}>${escapeXml(line)}</text>`
    )
    .join('')

  const crossColor = '#999'
  let shape = ''
  let shapeClip = ''
  let textClip = ''

  if (person.sex === 'male') {
    shape = `<rect x="${pos.x + 1}" y="${pos.y + 1}" width="${NODE_SIZE - 2}" height="${NODE_SIZE - 2}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
    shapeClip = `<rect x="${pos.x + 1}" y="${pos.y + 1}" width="${NODE_SIZE - 2}" height="${NODE_SIZE - 2}"/>`
    textClip = `<rect x="${pos.x + 3}" y="${pos.y + 3}" width="${NODE_SIZE - 6}" height="${NODE_SIZE - 6}"/>`
  } else if (person.sex === 'female') {
    shape = `<circle cx="${cx}" cy="${cy}" r="${HALF - 1}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
    shapeClip = `<circle cx="${cx}" cy="${cy}" r="${HALF - 1}"/>`
    textClip = `<circle cx="${cx}" cy="${cy}" r="${HALF - 4}"/>`
  } else {
    const pts = `${cx},${pos.y + 2} ${pos.x + NODE_SIZE - 2},${cy} ${cx},${pos.y + NODE_SIZE - 2} ${pos.x + 2},${cy}`
    shape = `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
    shapeClip = `<polygon points="${pts}"/>`
    textClip = `<polygon points="${pts}"/>`
  }

  const clipId = `clip-${person.id.replace(/\W/g, '')}`
  const crossClipId = `clip-cross-${person.id.replace(/\W/g, '')}`

  const cross = person.deceased
    ? `<g clip-path="url(#${crossClipId})">` +
      `<line x1="${pos.x + 12}" y1="${pos.y + 12}" x2="${pos.x + NODE_SIZE - 12}" y2="${pos.y + NODE_SIZE - 12}" stroke="${crossColor}" stroke-width="1.5"/>` +
      `<line x1="${pos.x + NODE_SIZE - 12}" y1="${pos.y + 12}" x2="${pos.x + 12}" y2="${pos.y + NODE_SIZE - 12}" stroke="${crossColor}" stroke-width="1.5"/>` +
      `</g>`
    : ''

  let extra = ''
  let yOff = pos.y + NODE_SIZE + 14
  if (person.occupation) {
    extra += `<text x="${cx}" y="${yOff}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#555">${escapeXml(person.occupation)}</text>`
    yOff += 13
  }
  if (person.causeOfDeath) {
    extra += `<text x="${cx}" y="${yOff}" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#888" font-style="italic">${escapeXml(person.causeOfDeath)}</text>`
  }

  return `<defs><clipPath id="${crossClipId}">${shapeClip}</clipPath><clipPath id="${clipId}">${textClip}</clipPath></defs>` +
    shape + cross +
    `<g clip-path="url(#${clipId})">${textEls}</g>` +
    extra
}
function renderFamilies(
  data: GenogramData,
  positions: Record<string, { x: number; y: number }>,
  settings: Settings
): string {
  const personMap = new Map(data.people.map(p => [p.id, p]))
  const families = buildFamilies(data.relationships)
  const locationMap = new Map<string, string>()
  for (const r of data.relationships) {
    if (r.location) locationMap.set([r.sourceId, r.targetId].sort().join(':'), r.location)
  }
  const lines: string[] = []

  // --- Focal Ellipse ---
  if (settings.showFocalEllipse && settings.focalPersonId) {
    const p1Id = settings.focalPersonId
    const p1Pos = positions[p1Id]
    if (p1Pos) {
      const rel = data.relationships.find(r => r.type !== 'parent-child' && (r.sourceId === p1Id || r.targetId === p1Id))
      const p2Id = rel ? (rel.sourceId === p1Id ? rel.targetId : rel.sourceId) : undefined
      const p2Pos = p2Id ? positions[p2Id] : undefined

      let bounds: { minX: number; minY: number; maxX: number; maxY: number }
      if (p2Pos) {
        bounds = {
          minX: Math.min(p1Pos.x, p2Pos.x),
          minY: Math.min(p1Pos.y, p2Pos.y),
          maxX: Math.max(p1Pos.x, p2Pos.x) + NODE_SIZE,
          maxY: Math.max(p1Pos.y, p2Pos.y) + NODE_SIZE,
        }
      } else {
        bounds = {
          minX: p1Pos.x,
          minY: p1Pos.y,
          maxX: p1Pos.x + NODE_SIZE,
          maxY: p1Pos.y + NODE_SIZE,
        }
      }

      const marginX = 40
      const marginY = 60
      const cx = (bounds.minX + bounds.maxX) / 2
      const cy = (bounds.minY + bounds.maxY) / 2
      const rx = (bounds.maxX - bounds.minX) / 2 + marginX
      const ry = (bounds.maxY - bounds.minY) / 2 + marginY

      lines.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-dasharray="6,4"/>`)
    }
  }

  for (const family of families) {
    const [p1Id, p2Id] = family.parentIds
    const p1Pos = positions[p1Id]
    if (!p1Pos) continue

    const isSingleParent = !p2Id
    let coupleY = 0
    let midX = 0

    if (p2Id) {
      const p2Pos = positions[p2Id]
      if (!p2Pos) continue

      const [leftPos, rightPos] =
        p1Pos.x <= p2Pos.x ? [p1Pos, p2Pos] : [p2Pos, p1Pos]

      coupleY = ((leftPos.y + HALF) + (rightPos.y + HALF)) / 2
      const x1 = leftPos.x + NODE_SIZE
      const x2 = rightPos.x
      midX = (x1 + x2) / 2
      const isDashed = family.coupleType === 'cohabiting' || family.coupleType === 'never-married-separated'
      const dash = isDashed ? ' stroke-dasharray="6,4"' : ''

      lines.push(`<line x1="${x1}" y1="${coupleY}" x2="${x2}" y2="${coupleY}" stroke="#1a1a1a" stroke-width="2"${dash}/>`)

      const location = locationMap.get([p1Id, p2Id].sort().join(':'))
      if (location) {
        lines.push(`<text x="${midX}" y="${coupleY - 8}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#555">${escapeXml(location)}</text>`)
      }

      // Offset 12px left of midX so slashes don't overlap the drop line
      const slashCx = midX - 12
      if (family.coupleType === 'divorced') {
        lines.push(`<line x1="${slashCx - 6}" y1="${coupleY - 8}" x2="${slashCx - 2}" y2="${coupleY + 8}" stroke="#1a1a1a" stroke-width="2"/>`)
        lines.push(`<line x1="${slashCx + 2}" y1="${coupleY - 8}" x2="${slashCx + 6}" y2="${coupleY + 8}" stroke="#1a1a1a" stroke-width="2"/>`)
      } else if (family.coupleType === 'separated' || family.coupleType === 'never-married-separated') {
        lines.push(`<line x1="${slashCx - 4}" y1="${coupleY - 8}" x2="${slashCx}" y2="${coupleY + 8}" stroke="#1a1a1a" stroke-width="2"/>`)
      }
    } else {
      midX = p1Pos.x + HALF
      coupleY = p1Pos.y + NODE_SIZE
    }

    if (family.childIds.length > 0) {
      const childData = family.childIds.map(id => ({ id, pos: positions[id], p: personMap.get(id) })).filter(d => d.pos && d.p)
      if (childData.length > 0) {
        const minChildY = Math.min(...childData.map(d => d.pos!.y))
        const sibshipY = Math.max(coupleY + (isSingleParent ? 10 : 20), minChildY - SIBSHIP_GAP)
        const childCXs = childData.map(d => d.pos!.x + HALF)
        const sibLeft = Math.min(midX, ...childCXs)
        const sibRight = Math.max(midX, ...childCXs)

        lines.push(`<line x1="${midX}" y1="${coupleY}" x2="${midX}" y2="${sibshipY}" stroke="#1a1a1a" stroke-width="1.5"/>`)
        lines.push(`<line x1="${sibLeft}" y1="${sibshipY}" x2="${sibRight}" y2="${sibshipY}" stroke="#1a1a1a" stroke-width="1.5"/>`)

        const dateGroups = new Map<string, string[]>()
        const nonDateChildren: string[] = []

        for (const child of childData) {
          const bd = child.p!.birthDate
          if (bd && bd.length >= 10) {
            if (!dateGroups.has(bd)) dateGroups.set(bd, [])
            dateGroups.get(bd)!.push(child.id)
          } else {
            nonDateChildren.push(child.id)
          }
        }

        for (const childId of nonDateChildren) {
          const cp = positions[childId]
          if (!cp) continue
          const cx = cp.x + HALF
          lines.push(`<line x1="${cx}" y1="${sibshipY}" x2="${cx}" y2="${cp.y}" stroke="#1a1a1a" stroke-width="1.5"/>`)
        }

        for (const ids of dateGroups.values()) {
          if (ids.length === 1) {
            const cp = positions[ids[0]]
            if (!cp) continue
            const cx = cp.x + HALF
            lines.push(`<line x1="${cx}" y1="${sibshipY}" x2="${cx}" y2="${cp.y}" stroke="#1a1a1a" stroke-width="1.5"/>`)
          } else {
            const cPositions = ids.map(id => positions[id]).filter(Boolean) as { x: number; y: number }[]
            const avgCX = cPositions.reduce((sum, p) => sum + p.x + HALF, 0) / cPositions.length
            for (const id of ids) {
              const cp = positions[id]
              if (!cp) continue
              const cx = cp.x + HALF
              lines.push(`<line x1="${avgCX}" y1="${sibshipY}" x2="${cx}" y2="${cp.y}" stroke="#1a1a1a" stroke-width="1.5"/>`)
            }
          }
        }
      }
    }
  }

  return lines.join('\n')
}

export function exportToSvg(data: GenogramData, settings: Settings = DEFAULT_SETTINGS): string {
  const { people, nodePositions } = data

  if (people.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg"/>'

  const xs = Object.values(nodePositions).map(p => p.x)
  const ys = Object.values(nodePositions).map(p => p.y)
  const minX = Math.min(...xs) - PAD
  const minY = Math.min(...ys) - PAD
  const maxX = Math.max(...xs) + NODE_SIZE + PAD
  const maxY = Math.max(...ys) + NODE_SIZE + 40 + PAD

  const width = maxX - minX
  const height = maxY - minY

  const peopleSvg = people
    .map(p => {
      const pos = nodePositions[p.id]
      if (!pos) return ''
      return renderPersonSymbol(p, { x: pos.x - minX, y: pos.y - minY }, settings)
    })
    .join('\n')

  const offsetPositions: Record<string, { x: number; y: number }> = {}
  for (const [id, pos] of Object.entries(nodePositions)) {
    offsetPositions[id] = { x: pos.x - minX, y: pos.y - minY }
  }

  const relSvg = renderFamilies(
    { ...data, nodePositions: offsetPositions },
    offsetPositions,
    settings
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#fafaf9"/>
  <g id="relationships">${relSvg}</g>
  <g id="people">${peopleSvg}</g>
</svg>`
}
