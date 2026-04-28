import { Person, GenogramData, Settings, DEFAULT_SETTINGS } from './types'
import { buildFamilies } from './families'
import { personDateLabel } from './dateUtils'

const NODE_SIZE = 80
const HALF = NODE_SIZE / 2
const PAD = 50
const SIBSHIP_GAP = 28
const TWIN_APEX_DROP = 12

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
  const design = settings.design
  const cx = pos.x + HALF
  const cy = pos.y + HALF
  const stroke = person.outlineColor ?? design.outlineColor
  const strokeWidth = person.outlineColor ? Math.max(design.outlineThickness, 2) : design.outlineThickness
  const fill = person.deceased ? design.deceasedFillColor : design.shapeFillColor

  const nameOnly = nameLines(person, settings)
  const nameCount = nameOnly.length
  const dateStr = personDateLabel(person, settings.dateDisplay)
  const labelLines = dateStr ? [...nameOnly, dateStr] : [...nameOnly]
  if (labelLines.length === 0) labelLines.push('Unknown')

  const lineH = Math.max(12, Math.round(design.fontSize * 1.4))

  let shape = ''
  let shapeClip = ''
  let textClip = ''

  if (person.sex === 'male') {
    shape = `<rect x="${pos.x + 1}" y="${pos.y + 1}" width="${NODE_SIZE - 2}" height="${NODE_SIZE - 2}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
    shapeClip = `<rect x="${pos.x + 1}" y="${pos.y + 1}" width="${NODE_SIZE - 2}" height="${NODE_SIZE - 2}"/>`
    textClip = `<rect x="${pos.x + 3}" y="${pos.y + 3}" width="${NODE_SIZE - 6}" height="${NODE_SIZE - 6}"/>`
  } else if (person.sex === 'female') {
    shape = `<circle cx="${cx}" cy="${cy}" r="${HALF - 1}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
    shapeClip = `<circle cx="${cx}" cy="${cy}" r="${HALF - 1}"/>`
    textClip = `<circle cx="${cx}" cy="${cy}" r="${HALF - 4}"/>`
  } else {
    const pts = person.sex === 'unknown'
      ? `${cx},${pos.y + 2} ${pos.x + NODE_SIZE - 2},${pos.y + NODE_SIZE - 2} ${pos.x + 2},${pos.y + NODE_SIZE - 2}`
      : `${cx},${pos.y + 2} ${pos.x + NODE_SIZE - 2},${cy} ${cx},${pos.y + NODE_SIZE - 2} ${pos.x + 2},${cy}`
    shape = `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
    shapeClip = `<polygon points="${pts}"/>`
    textClip = `<polygon points="${pts}"/>`
  }

  const clipId = `clip-${person.id.replace(/\W/g, '')}`
  const crossClipId = `clip-cross-${person.id.replace(/\W/g, '')}`

  const cross = person.deceased
    ? `<g clip-path="url(#${crossClipId})">` +
      `<line x1="${pos.x + 12}" y1="${pos.y + 12}" x2="${pos.x + NODE_SIZE - 12}" y2="${pos.y + NODE_SIZE - 12}" stroke="${design.deceasedCrossColor}" stroke-width="1.5"/>` +
      `<line x1="${pos.x + NODE_SIZE - 12}" y1="${pos.y + 12}" x2="${pos.x + 12}" y2="${pos.y + NODE_SIZE - 12}" stroke="${design.deceasedCrossColor}" stroke-width="1.5"/>` +
      `</g>`
    : ''

  // Names: when cropping is on, draw inside the shape clipped; when off, draw
  // below the shape so they're never clipped by the shape boundary.
  let labelSvg = ''
  if (design.cropNamesToShape) {
    const totalTextH = labelLines.length * lineH
    const startY = cy - totalTextH / 2 + lineH * 0.5
    const els = labelLines.map((line, i) =>
      `<text x="${cx}" y="${startY + i * lineH}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${design.fontSize}" fill="${i < nameCount ? design.nameTextColor : design.dateTextColor}"${i < nameCount ? ' font-weight="bold"' : ''}>${escapeXml(line)}</text>`
    ).join('')
    labelSvg = `<g clip-path="url(#${clipId})">${els}</g>`
  } else {
    let y = pos.y + NODE_SIZE + lineH
    labelSvg = labelLines.map((line, i) => {
      const t = `<text x="${cx}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${design.fontSize}" fill="${i < nameCount ? design.nameTextColor : design.dateTextColor}"${i < nameCount ? ' font-weight="bold"' : ''}>${escapeXml(line)}</text>`
      y += lineH
      return t
    }).join('')
  }

  // Above-shape extras (residence, prefixed with Lives/Lived in).
  let above = ''
  if (person.residence) {
    const ay = pos.y - 6
    const verb = person.deceased ? 'Lived in' : 'Lives in'
    above = `<text x="${cx}" y="${ay}" text-anchor="middle" font-family="sans-serif" font-size="${design.fontSize}" font-style="italic" fill="${design.locationTextColor}">${escapeXml(`${verb} ${person.residence}`)}</text>`
  }

  // Below-shape extras (occupation, cause of death, notes). When labels are
  // below the shape, push these further down so they don't collide with the
  // name block.
  let extra = ''
  const labelOffset = design.cropNamesToShape ? 14 : (labelLines.length * lineH + lineH)
  let yOff = pos.y + NODE_SIZE + labelOffset
  if (person.occupation) {
    extra += `<text x="${cx}" y="${yOff}" text-anchor="middle" font-family="sans-serif" font-size="${design.fontSize}" fill="${design.occupationTextColor}">${escapeXml(person.occupation)}</text>`
    yOff += lineH
  }
  if (person.causeOfDeath) {
    extra += `<text x="${cx}" y="${yOff}" text-anchor="middle" font-family="sans-serif" font-size="${design.fontSize}" fill="${design.causeOfDeathTextColor}" font-style="italic">${escapeXml(person.causeOfDeath)}</text>`
    yOff += lineH
  }
  if (person.notes) {
    // Notes can be multi-line; split on \n and render each as its own <text>.
    for (const line of person.notes.split(/\r?\n/)) {
      if (!line) { yOff += lineH; continue }
      extra += `<text x="${cx}" y="${yOff}" text-anchor="middle" font-family="sans-serif" font-size="${design.fontSize}" fill="${design.occupationTextColor}">${escapeXml(line)}</text>`
      yOff += lineH
    }
  }

  return `<defs><clipPath id="${crossClipId}">${shapeClip}</clipPath><clipPath id="${clipId}">${textClip}</clipPath></defs>` +
    above +
    shape + cross +
    labelSvg +
    extra
}
function renderFamilies(
  data: GenogramData,
  positions: Record<string, { x: number; y: number }>,
  settings: Settings
): string {
  const design = settings.design
  const cc = design.coupleLineColor
  const cw = design.coupleLineThickness
  const pc = design.parentChildLineColor
  const pw = design.parentChildLineThickness
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

      lines.push(`<line x1="${x1}" y1="${coupleY}" x2="${x2}" y2="${coupleY}" stroke="${cc}" stroke-width="${cw}"${dash}/>`)

      const location = locationMap.get([p1Id, p2Id].sort().join(':'))
      if (location) {
        lines.push(`<text x="${midX}" y="${coupleY - 8}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${design.locationTextColor}">${escapeXml(location)}</text>`)
      }

      // Offset 12px left of midX so slashes don't overlap the drop line
      const slashCx = midX - 12
      if (family.coupleType === 'divorced') {
        lines.push(`<line x1="${slashCx - 6}" y1="${coupleY - 8}" x2="${slashCx - 2}" y2="${coupleY + 8}" stroke="${cc}" stroke-width="${cw}"/>`)
        lines.push(`<line x1="${slashCx + 2}" y1="${coupleY - 8}" x2="${slashCx + 6}" y2="${coupleY + 8}" stroke="${cc}" stroke-width="${cw}"/>`)
      } else if (family.coupleType === 'separated' || family.coupleType === 'never-married-separated') {
        lines.push(`<line x1="${slashCx - 4}" y1="${coupleY - 8}" x2="${slashCx}" y2="${coupleY + 8}" stroke="${cc}" stroke-width="${cw}"/>`)
      }
    } else {
      midX = p1Pos.x + HALF
      coupleY = p1Pos.y + NODE_SIZE
    }

    // Per-rel adoption nature → dasharray for the child-vertical.
    const childDash = (childId: string): string => {
      const parentIds = [p1Id, p2Id].filter(Boolean) as string[]
      const childRels = data.relationships.filter(r =>
        r.type === 'parent-child' && r.targetId === childId && parentIds.includes(r.sourceId)
      )
      if (childRels.length === 0) return ''
      const natures = childRels.map(r => r.nature ?? 'biological')
      if (natures.every(n => n === 'adopted')) return ' stroke-dasharray="6,4"'
      if (natures.every(n => n === 'foster')) return ' stroke-dasharray="2,3"'
      return ''
    }

    if (family.childIds.length > 0) {
      const childData = family.childIds.map(id => ({ id, pos: positions[id], p: personMap.get(id) })).filter(d => d.pos && d.p)
      if (childData.length > 0) {
        const minChildY = Math.min(...childData.map(d => d.pos!.y))
        const baseSibshipY = Math.max(coupleY + (isSingleParent ? 10 : 20), minChildY - SIBSHIP_GAP)
        const sibshipY = baseSibshipY + (data.sibshipOffsets?.[family.id] ?? 0)

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

        // Twins-only family: clean wishbone (drop + two diagonals), no sibship.
        const twinsOnlyIds = nonDateChildren.length === 0 && dateGroups.size === 1
          ? [...dateGroups.values()][0]
          : null

        if (twinsOnlyIds && twinsOnlyIds.length >= 2) {
          lines.push(`<line x1="${midX}" y1="${coupleY}" x2="${midX}" y2="${sibshipY}" stroke="${pc}" stroke-width="${pw}"/>`)
          for (const id of twinsOnlyIds) {
            const cp = positions[id]
            if (!cp) continue
            const cx = cp.x + HALF
            lines.push(`<line x1="${midX}" y1="${sibshipY}" x2="${cx}" y2="${cp.y}" stroke="${pc}" stroke-width="${pw}"${childDash(id)}/>`)
          }
        } else {
          // Sibship endpoints come from connection points (one per non-twin
          // child, one per twin group's wishbone stem) — not from each twin's
          // individual column, so the sibship doesn't extend past the wishbone.
          const sibConnectionXs: number[] = []
          for (const childId of nonDateChildren) {
            const cp = positions[childId]
            if (cp) sibConnectionXs.push(cp.x + HALF)
          }
          const twinGroups: Array<{ ids: string[]; avgCX: number }> = []
          for (const ids of dateGroups.values()) {
            if (ids.length === 1) {
              const cp = positions[ids[0]]
              if (cp) sibConnectionXs.push(cp.x + HALF)
            } else {
              const cPositions = ids.map(id => positions[id]).filter(Boolean) as { x: number; y: number }[]
              const avgCX = cPositions.reduce((sum, p) => sum + p.x + HALF, 0) / cPositions.length
              twinGroups.push({ ids, avgCX })
              sibConnectionXs.push(avgCX)
            }
          }
          const sibLeft = Math.min(midX, ...sibConnectionXs)
          const sibRight = Math.max(midX, ...sibConnectionXs)

          lines.push(`<line x1="${midX}" y1="${coupleY}" x2="${midX}" y2="${sibshipY}" stroke="${pc}" stroke-width="${pw}"/>`)
          lines.push(`<line x1="${sibLeft}" y1="${sibshipY}" x2="${sibRight}" y2="${sibshipY}" stroke="${pc}" stroke-width="${pw}"/>`)

          for (const childId of nonDateChildren) {
            const cp = positions[childId]
            if (!cp) continue
            const cx = cp.x + HALF
            lines.push(`<line x1="${cx}" y1="${sibshipY}" x2="${cx}" y2="${cp.y}" stroke="${pc}" stroke-width="${pw}"${childDash(childId)}/>`)
          }

          for (const ids of dateGroups.values()) {
            if (ids.length === 1) {
              const cp = positions[ids[0]]
              if (!cp) continue
              const cx = cp.x + HALF
              lines.push(`<line x1="${cx}" y1="${sibshipY}" x2="${cx}" y2="${cp.y}" stroke="${pc}" stroke-width="${pw}"${childDash(ids[0])}/>`)
            }
          }

          for (const { ids, avgCX } of twinGroups) {
            const apexY = sibshipY + TWIN_APEX_DROP
            lines.push(`<line x1="${avgCX}" y1="${sibshipY}" x2="${avgCX}" y2="${apexY}" stroke="${pc}" stroke-width="${pw}"/>`)
            for (const id of ids) {
              const cp = positions[id]
              if (!cp) continue
              const cx = cp.x + HALF
              lines.push(`<line x1="${avgCX}" y1="${apexY}" x2="${cx}" y2="${cp.y}" stroke="${pc}" stroke-width="${pw}"${childDash(id)}/>`)
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
  // When labels render below the shape, reserve room for name + date lines +
  // occupation/cause-of-death/notes (worst case ~6 lines). Above the shape we
  // also need ~lineH for the residence label, plus the existing PAD.
  const lineH = Math.max(12, Math.round(settings.design.fontSize * 1.4))
  const labelRoom = settings.design.cropNamesToShape ? 40 : (6 * lineH + 10)
  const minX = Math.min(...xs) - PAD
  const minY = Math.min(...ys) - PAD - lineH
  const maxX = Math.max(...xs) + NODE_SIZE + PAD
  const maxY = Math.max(...ys) + NODE_SIZE + labelRoom + PAD

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
