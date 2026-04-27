import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useReactFlow,
  useNodesInitialized,
  Node,
  NodeMouseHandler,
  OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import PersonNode from './components/PersonNode'
import GenogramConnections from './components/GenogramConnections'
import PersonEditor, { AddNextKind } from './components/PersonEditor'
import RelationshipEditor from './components/RelationshipEditor'
import GedcomImport from './components/GedcomImport'
import SettingsPanel from './components/SettingsPanel'
import ProjectManager from './components/ProjectManager'
import SelectionToolbar from './components/SelectionToolbar'
import WelcomeModal from './components/WelcomeModal'
import CoffeeModal from './components/CoffeeModal'
import UserGuideModal from './components/UserGuideModal'
import { Coffee, HelpCircle } from 'lucide-react'
import { useIsMobile } from './lib/useIsMobile'
import { Person, Relationship, GenogramData, Settings, DEFAULT_SETTINGS, DEFAULT_DESIGN, RelContext, Project } from './lib/types'
import type { ParentIds } from './components/PersonEditor'
import { SettingsContext } from './lib/SettingsContext'
import { MoveModeContext } from './lib/MoveModeContext'
import { exportToSvg } from './lib/exportSvg'
import { autoLayout } from './lib/autoLayout'

const nodeTypes = { person: PersonNode }

function genogramToNodes(data: GenogramData): Node[] {
  return data.people.map(p => ({
    id: p.id,
    type: 'person',
    position: data.nodePositions[p.id] ?? { x: 0, y: 0 },
    data: { person: p },
  }))
}

const LS_LEGACY_KEY = 'genogram-builder-data'
const LS_PROJECTS_KEY = 'genogram-builder-projects-v1'
const LS_ACTIVE_ID_KEY = 'genogram-builder-active-id-v1'
const LS_SETTINGS_KEY = 'genogram-builder-settings'
const LS_WELCOME_SEEN_KEY = 'genogram-builder-welcome-seen-v1'
const LS_COFFEE_PROMPTED_KEY = 'genogram-builder-coffee-prompted-v1'
const COFFEE_PROMPT_DELAY_MS = 20 * 60 * 1000

interface DragGroup {
  nodeId: string
  startPos: { x: number; y: number }
  groupStartPositions: Record<string, { x: number; y: number }>
  shiftOnly: boolean
  coupleNetworkIds: Set<string>
}

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [people, setPeople] = useState<Person[]>([])
  const [relationships, setRelationships] = useState<Relationship[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>('')

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem(LS_SETTINGS_KEY)
      if (!saved) return DEFAULT_SETTINGS
      const parsed = JSON.parse(saved) as Partial<Settings>
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        design: { ...DEFAULT_DESIGN, ...(parsed.design ?? {}) },
      }
    } catch { return DEFAULT_SETTINGS }
  })

  const [editPerson, setEditPerson] = useState<Person | null | 'new'>(null)

  // Move-mode interaction: a single click selects (React Flow default); a
  // second click on the same selected node toggles move mode, where dragging
  // slides only that person horizontally — the same path that Shift+drag
  // takes (kept for power users). Cleared on drag end, pane click, double
  // click, or selecting a different node.
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  const [moveMode, setMoveMode] = useState(false)
  const [newPersonSeed, setNewPersonSeed] = useState<{ relContext?: RelContext; parents?: ParentIds; key: number } | null>(null)
  const [editRel, setEditRel] = useState<Relationship | null | 'new'>(null)
  const [showGedcom, setShowGedcom] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const [showCoffee, setShowCoffee] = useState(false)
  const [coffeeIsPrompt, setCoffeeIsPrompt] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const isMobile = useIsMobile()

  // Counter incremented whenever the canvas should re-fit (initial load,
  // project switch, JSON/GEDCOM import). FitViewOnLoad below watches it.
  const [fitViewKey, setFitViewKey] = useState(0)

  // Auto-open the coffee modal once after the user has spent COFFEE_PROMPT_DELAY_MS
  // on the page. The localStorage flag prevents the prompt from re-firing on later
  // visits. Manual opens via the toolbar button stay unaffected.
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_COFFEE_PROMPTED_KEY)) return
    } catch { return }
    const timer = setTimeout(() => {
      try { localStorage.setItem(LS_COFFEE_PROMPTED_KEY, '1') } catch { /* ignore */ }
      setCoffeeIsPrompt(true)
      setShowCoffee(true)
    }, COFFEE_PROMPT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    try { return !localStorage.getItem(LS_WELCOME_SEEN_KEY) } catch { return false }
  })

  function handleCloseWelcome() {
    setShowWelcome(false)
    try { localStorage.setItem(LS_WELCOME_SEEN_KEY, '1') } catch { /* ignore */ }
  }

  // --- Undo / Redo ---
  const [undoStack, setUndoStack] = useState<GenogramData[]>([])
  const [redoStack, setRedoStack] = useState<GenogramData[]>([])

  // Ref keeps snapshot() always pointing at current state without extra deps
  const snapshotFnRef = useRef<() => void>(() => {})
  snapshotFnRef.current = () => {
    const nodePositions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) nodePositions[n.id] = n.position
    const snap: GenogramData = { people, relationships, nodePositions }
    setUndoStack(prev => [...prev.slice(-49), snap])
    setRedoStack([])
  }
  function snapshot() { snapshotFnRef.current() }

  function handleUndo() {
    setUndoStack(stack => {
      if (stack.length === 0) return stack
      const prev = stack[stack.length - 1]
      const nodePositions: Record<string, { x: number; y: number }> = {}
      for (const n of nodes) nodePositions[n.id] = n.position
      setRedoStack(r => [...r.slice(-49), { people, relationships, nodePositions }])
      setPeople(prev.people)
      setRelationships(prev.relationships)
      setNodes(genogramToNodes(prev))
      return stack.slice(0, -1)
    })
  }

  function handleRedo() {
    setRedoStack(stack => {
      if (stack.length === 0) return stack
      const next = stack[stack.length - 1]
      const nodePositions: Record<string, { x: number; y: number }> = {}
      for (const n of nodes) nodePositions[n.id] = n.position
      setUndoStack(u => [...u.slice(-49), { people, relationships, nodePositions }])
      setPeople(next.people)
      setRelationships(next.relationships)
      setNodes(genogramToNodes(next))
      return stack.slice(0, -1)
    })
  }

  // Keyboard shortcuts — use refs so the effect never needs to re-register
  const undoRef = useRef(handleUndo)
  const redoRef = useRef(handleRedo)
  undoRef.current = handleUndo
  redoRef.current = handleRedo
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key === 'z') { e.preventDefault(); undoRef.current() }
      if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redoRef.current() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // --- Initial Load & Migration ---
  useEffect(() => {
    const savedProjects = localStorage.getItem(LS_PROJECTS_KEY)
    let initialProjects: Project[] = []
    let activeId = localStorage.getItem(LS_ACTIVE_ID_KEY) || ''

    if (savedProjects) {
      try {
        initialProjects = JSON.parse(savedProjects)
      } catch { initialProjects = [] }
    }

    // Migration from legacy single-project storage
    if (initialProjects.length === 0) {
      const legacyData = localStorage.getItem(LS_LEGACY_KEY)
      if (legacyData) {
        try {
          const data = JSON.parse(legacyData) as GenogramData
          const firstProject: Project = {
            id: crypto.randomUUID(),
            name: 'Default Genogram',
            data,
            lastModified: Date.now(),
          }
          initialProjects = [firstProject]
          activeId = firstProject.id
        } catch { /* ignore */ }
      }
    }

    // If still empty, create a placeholder
    if (initialProjects.length === 0) {
      const emptyProject: Project = {
        id: crypto.randomUUID(),
        name: 'My First Genogram',
        data: { people: [], relationships: [], nodePositions: {} },
        lastModified: Date.now(),
      }
      initialProjects = [emptyProject]
      activeId = emptyProject.id
    }

    if (!activeId || !initialProjects.find(p => p.id === activeId)) {
      activeId = initialProjects[0].id
    }

    setProjects(initialProjects)
    setActiveProjectId(activeId)
    loadProject(initialProjects.find(p => p.id === activeId)!)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadProject(project: Project) {
    setPeople(project.data.people)
    setRelationships(project.data.relationships)
    setNodes(genogramToNodes(project.data))
    setUndoStack([])
    setRedoStack([])
    setFitViewKey(k => k + 1)
  }

  // --- Persistence ---
  useEffect(() => {
    if (!activeProjectId) return
    const nodePositions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) nodePositions[n.id] = n.position
    
    const currentData: GenogramData = { people, relationships, nodePositions }
    
    setProjects(ps => {
      const updated = ps.map(p => p.id === activeProjectId 
        ? { ...p, data: currentData, lastModified: Date.now() } 
        : p
      )
      localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(updated))
      return updated
    })
    localStorage.setItem(LS_ACTIVE_ID_KEY, activeProjectId)
  }, [people, relationships, nodes, activeProjectId])

  useEffect(() => {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  // --- Project Actions ---
  function handleSelectProject(id: string) {
    const p = projects.find(proj => proj.id === id)
    if (p) {
      setActiveProjectId(id)
      loadProject(p)
    }
  }

  function handleCreateProject(name: string) {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name,
      data: { people: [], relationships: [], nodePositions: {} },
      lastModified: Date.now(),
    }
    const updated = [...projects, newProject]
    setProjects(updated)
    setActiveProjectId(newProject.id)
    loadProject(newProject)
    localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(updated))
  }

  function handleRenameProject(id: string, name: string) {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, name, lastModified: Date.now() } : p))
  }

  function handleDeleteProject(id: string) {
    if (projects.length <= 1) {
      alert("You must have at least one genogram. Create a new one before deleting this one.")
      return
    }
    if (!confirm("Delete this genogram permanently?")) return
    
    const updated = projects.filter(p => p.id !== id)
    setProjects(updated)
    if (activeProjectId === id) {
      handleSelectProject(updated[0].id)
    }
  }

  function loadData(data: GenogramData) {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: 'Imported Genogram',
      data,
      lastModified: Date.now(),
    }
    const updated = [...projects, newProject]
    setProjects(updated)
    setActiveProjectId(newProject.id)
    loadProject(newProject)
    localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(updated))
  }

  function handleStartOver() {
    if (!confirm('Clear all data in this genogram and start over?')) return
    snapshot()
    setPeople([])
    setRelationships([])
    setNodes([])
  }

  // --- React Flow Callbacks ---
  const onNodeClick: NodeMouseHandler = useCallback((e, node) => {
    // Shift/⌘/Ctrl click is multi-select — don't toggle move mode.
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setLastClickedId(node.id)
      setMoveMode(false)
      return
    }
    setLastClickedId(prevId => {
      if (prevId === node.id) {
        setMoveMode(m => !m)
      } else {
        setMoveMode(false)
      }
      return node.id
    })
  }, [])

  const onPaneClick = useCallback(() => {
    setLastClickedId(null)
    setMoveMode(false)
  }, [])

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      setMoveMode(false)
      const person = people.find(p => p.id === node.id)
      if (person) setEditPerson(person)
    },
    [people]
  )

  const dragGroupRef = useRef<DragGroup | null>(null)

  function getCoupleNetwork(personId: string): Set<string> {
    const network = new Set<string>()
    const queue = [personId]
    while (queue.length > 0) {
      const pid = queue.shift()!
      if (network.has(pid)) continue
      network.add(pid)
      for (const r of relationships) {
        if (r.type === 'parent-child') continue
        if (r.sourceId === pid && !network.has(r.targetId)) queue.push(r.targetId)
        if (r.targetId === pid && !network.has(r.sourceId)) queue.push(r.sourceId)
      }
    }
    return network
  }

  function getFamilyGroup(personId: string): { group: Set<string>; coupleNetworkIds: Set<string> } {
    const coupleNetworkIds = getCoupleNetwork(personId)
    const group = new Set(coupleNetworkIds)

    // BFS: for everyone in the group, find their children; for each child expand
    // their full couple network (so child's spouses move too), then repeat for
    // those spouses' children, grandchildren, etc.
    const frontier = new Set(coupleNetworkIds)
    while (frontier.size > 0) {
      const pid = frontier.values().next().value as string
      frontier.delete(pid)
      for (const r of relationships) {
        if (r.type !== 'parent-child' || r.sourceId !== pid) continue
        const childId = r.targetId
        if (group.has(childId)) continue
        // Expand the child's couple network so spouses move together
        const childCouple = getCoupleNetwork(childId)
        for (const id of childCouple) {
          if (!group.has(id)) {
            group.add(id)
            frontier.add(id)   // process this person's children on the next pass
          }
        }
      }
    }

    return { group, coupleNetworkIds }
  }

  const onNodeDragStart: NodeMouseHandler = useCallback((e, node) => {
    snapshotFnRef.current()   // make drag undoable
    // Spouse-only drag triggers from either Shift+drag (legacy) or the new
    // move mode (click an already-selected node to toggle on, then drag).
    const shiftOnly = e.shiftKey || (moveMode && lastClickedId === node.id)
    const { group, coupleNetworkIds } = shiftOnly
      ? { group: new Set([node.id]), coupleNetworkIds: new Set([node.id]) }
      : getFamilyGroup(node.id)
    const groupStartPositions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) {
      if (group.has(n.id)) groupStartPositions[n.id] = { ...n.position }
    }
    dragGroupRef.current = { nodeId: node.id, startPos: { ...node.position }, groupStartPositions, shiftOnly, coupleNetworkIds }
  }, [nodes, relationships, moveMode, lastClickedId]) // eslint-disable-line react-hooks/exhaustive-deps

  const onNodeDrag: NodeMouseHandler = useCallback((_e, node) => {
    const ref = dragGroupRef.current
    if (!ref || ref.nodeId !== node.id) return

    if (ref.shiftOnly) {
      setNodes(ns => ns.map(n =>
        n.id === node.id ? { ...n, position: { x: node.position.x, y: ref.startPos.y } } : n
      ))
      return
    }

    const dx = node.position.x - ref.startPos.x
    const dy = node.position.y - ref.startPos.y
    setNodes(ns => ns.map(n => {
      if (n.id === node.id) return n
      const sp = ref.groupStartPositions[n.id]
      if (!sp) return n
      if (ref.coupleNetworkIds.has(n.id)) {
        return { ...n, position: { x: sp.x + dx, y: node.position.y } }
      }
      return { ...n, position: { x: sp.x + dx, y: sp.y + dy } }
    }))
  }, [setNodes])

  const onNodeDragStop: NodeMouseHandler = useCallback(() => {
    dragGroupRef.current = null
    setMoveMode(false)
  }, [])

  function getSmartPosition(relContext: RelContext): { x: number; y: number } {
    const NW = 200
    const NH = 160
    const relNode = nodes.find(n => n.id === relContext.relatedPersonId)
    if (!relNode) return { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }
    const { x, y } = relNode.position

    if (relContext.relType === 'spouse') {
      const network = getCoupleNetwork(relContext.relatedPersonId)
      let maxX = x
      for (const n of nodes) {
        if (network.has(n.id)) maxX = Math.max(maxX, n.position.x)
      }
      return { x: maxX + NW, y }
    }

    if (relContext.relType === 'child-of') {
      const childIds = relationships
        .filter(r => r.type === 'parent-child' && r.sourceId === relContext.relatedPersonId)
        .map(r => r.targetId)
      const childNodes = nodes.filter(n => childIds.includes(n.id))
      if (childNodes.length > 0) {
        const maxX = Math.max(...childNodes.map(n => n.position.x))
        const avgY = childNodes.reduce((s, n) => s + n.position.y, 0) / childNodes.length
        return { x: maxX + NW, y: avgY }
      }
      return { x, y: y + NH }
    }

    if (relContext.relType === 'parent-of') {
      const parentIds = relationships
        .filter(r => r.type === 'parent-child' && r.targetId === relContext.relatedPersonId)
        .map(r => r.sourceId)
      const parentNodes = nodes.filter(n => parentIds.includes(n.id))
      if (parentNodes.length > 0) {
        const maxX = Math.max(...parentNodes.map(n => n.position.x))
        return { x: maxX + NW, y: parentNodes[0].position.y }
      }
      return { x, y: y - NH }
    }

    if (relContext.relType === 'sibling-of') {
      const parentIds = relationships
        .filter(r => r.type === 'parent-child' && r.targetId === relContext.relatedPersonId)
        .map(r => r.sourceId)
      let sibIds = [relContext.relatedPersonId]
      if (parentIds.length > 0) {
        sibIds = relationships
          .filter(r => r.type === 'parent-child' && parentIds.includes(r.sourceId))
          .map(r => r.targetId)
      }
      const sibNodes = nodes.filter(n => sibIds.includes(n.id))
      const maxX = sibNodes.length > 0 ? Math.max(...sibNodes.map(n => n.position.x)) : x
      return { x: maxX + NW, y }
    }

    return { x: x + NW, y }
  }

  // Position a new person whose parent set is given (any of these IDs counts as a parent).
  // If the parents already have children, sit beside the rightmost on their row;
  // otherwise drop one row below the parents' midpoint.
  function positionFromParents(parentIds: string[]): { x: number; y: number } {
    const NW = 200
    const NH = 160
    const parentNodes = nodes.filter(n => parentIds.includes(n.id))
    if (parentNodes.length === 0) return { x: Math.random() * 400, y: Math.random() * 200 }

    const childIds = new Set<string>()
    for (const r of relationships) {
      if (r.type === 'parent-child' && parentIds.includes(r.sourceId)) childIds.add(r.targetId)
    }
    const childNodes = nodes.filter(n => childIds.has(n.id))
    if (childNodes.length > 0) {
      const maxX = Math.max(...childNodes.map(n => n.position.x))
      const avgY = childNodes.reduce((s, n) => s + n.position.y, 0) / childNodes.length
      return { x: maxX + NW, y: avgY }
    }

    const midX = parentNodes.reduce((s, n) => s + n.position.x, 0) / parentNodes.length
    const maxY = Math.max(...parentNodes.map(n => n.position.y))
    return { x: midX, y: maxY + NH }
  }

  // Pick the best position for a brand-new person given the editor context.
  // Priority: spouse > sibling > parents > parent-of > random fallback. Spouse and
  // sibling override the parents arg because they pin the new person to a specific
  // row alongside someone already placed; parents only dictate position when no
  // such row anchor exists.
  function getSmartPositionFor(relContext: RelContext | undefined, parents: ParentIds): { x: number; y: number } {
    if (relContext?.relatedPersonId && (relContext.relType === 'spouse' || relContext.relType === 'sibling-of')) {
      return getSmartPosition(relContext)
    }
    const parentIds = [parents.fatherId, parents.motherId].filter(Boolean) as string[]
    if (parentIds.length > 0) return positionFromParents(parentIds)
    if (relContext?.relatedPersonId) return getSmartPosition(relContext)
    return { x: Math.random() * 400, y: Math.random() * 200 }
  }

  function getParentsOf(personId: string): ParentIds {
    const parentIds = relationships
      .filter(r => r.type === 'parent-child' && r.targetId === personId)
      .map(r => r.sourceId)
    const parents = people.filter(p => parentIds.includes(p.id))
    const father = parents.find(p => p.sex === 'male')
    const mother = parents.find(p => p.sex === 'female')
    const fatherId = father?.id ?? parents[0]?.id
    const motherId = mother?.id ?? parents.find(p => p.id !== fatherId)?.id
    return { fatherId, motherId }
  }

  function savePerson(person: Person, relContext?: RelContext, parents?: ParentIds) {
    snapshot()
    const exists = people.some(p => p.id === person.id)
    setPeople(ps => exists ? ps.map(p => p.id === person.id ? person : p) : [...ps, person])

    if (!exists) {
      const pos = getSmartPositionFor(relContext, parents ?? {})
      setNodes(ns => [...ns, { id: person.id, type: 'person', position: pos, data: { person } }])

      if (relContext?.relatedPersonId) {
        const newRels: Relationship[] = []
        const rid = () => crypto.randomUUID()
        if (relContext.relType === 'spouse') {
          newRels.push({ id: rid(), type: 'married', sourceId: person.id, targetId: relContext.relatedPersonId })
        } else if (relContext.relType === 'parent-of') {
          newRels.push({ id: rid(), type: 'parent-child', sourceId: person.id, targetId: relContext.relatedPersonId })
        }
        if (newRels.length > 0) setRelationships(rs => [...rs, ...newRels])
      }
    } else {
      setNodes(ns => ns.map(n => n.id === person.id ? { ...n, data: { person } } : n))
    }

    if (parents !== undefined) {
      const newParentIds = new Set([parents.fatherId, parents.motherId].filter(Boolean) as string[])
      const currentParentIds = new Set(
        relationships.filter(r => r.type === 'parent-child' && r.targetId === person.id).map(r => r.sourceId)
      )
      const toRemove = [...currentParentIds].filter(id => !newParentIds.has(id))
      const toAdd = [...newParentIds].filter(id => !currentParentIds.has(id))
      if (toRemove.length > 0 || toAdd.length > 0) {
        setRelationships(rs => {
          let updated = rs.filter(r => !(r.type === 'parent-child' && r.targetId === person.id && toRemove.includes(r.sourceId)))
          for (const parentId of toAdd) {
            updated = [...updated, { id: crypto.randomUUID(), type: 'parent-child', sourceId: parentId, targetId: person.id }]
          }
          return updated
        })
      }
    }
  }

  function handleSaveAndAddNext(person: Person, relContext: RelContext | undefined, parents: ParentIds, kind: AddNextKind) {
    savePerson(person, relContext, parents)

    let nextRelContext: RelContext | undefined
    let nextParents: ParentIds | undefined
    if (kind === 'spouse') {
      nextRelContext = { relatedPersonId: person.id, relType: 'spouse' }
    } else if (kind === 'sibling') {
      nextRelContext = { relatedPersonId: person.id, relType: 'sibling-of' }
    } else if (kind === 'parent') {
      nextRelContext = { relatedPersonId: person.id, relType: 'parent-of' }
    } else if (kind === 'child') {
      // Place the just-saved person in the appropriate parent slot of the new person.
      // Female → mother slot; male/unknown/other → father slot (the user can adjust).
      nextParents = person.sex === 'female' ? { motherId: person.id } : { fatherId: person.id }
    }

    setNewPersonSeed(prev => ({ relContext: nextRelContext, parents: nextParents, key: (prev?.key ?? 0) + 1 }))
    setEditPerson('new')
  }

  function deletePerson(id: string) {
    snapshot()
    setPeople(ps => ps.filter(p => p.id !== id))
    setRelationships(rs => rs.filter(r => r.sourceId !== id && r.targetId !== id))
    setNodes(ns => ns.filter(n => n.id !== id))
  }

  function deletePeople(ids: string[]) {
    if (ids.length === 0) return
    snapshot()
    const idSet = new Set(ids)
    setPeople(ps => ps.filter(p => !idSet.has(p.id)))
    setRelationships(rs => rs.filter(r => !idSet.has(r.sourceId) && !idSet.has(r.targetId)))
    setNodes(ns => ns.filter(n => !idSet.has(n.id)))
  }

  // Intercept React Flow change events. We need to take a snapshot BEFORE the
  // remove is applied (so undo restores the deleted nodes) and sync `people`/
  // `relationships` since React Flow only owns the canvas nodes, not our data.
  // Selection/position/dimension changes are forwarded untouched.
  const handleNodesChange = useCallback<OnNodesChange>((changes) => {
    const removeIds = changes.filter(c => c.type === 'remove').map(c => (c as { id: string }).id)
    if (removeIds.length > 0) {
      snapshotFnRef.current()
      const idSet = new Set(removeIds)
      setPeople(ps => ps.filter(p => !idSet.has(p.id)))
      setRelationships(rs => rs.filter(r => !idSet.has(r.sourceId) && !idSet.has(r.targetId)))
    }
    onNodesChange(changes)
  }, [onNodesChange])

  function alignSelectedHorizontal(ids: string[]) {
    if (ids.length < 2) return
    snapshot()
    const idSet = new Set(ids)
    const sel = nodes.filter(n => idSet.has(n.id))
    const targetY = Math.min(...sel.map(n => n.position.y))
    setNodes(ns => ns.map(n => idSet.has(n.id) ? { ...n, position: { ...n.position, y: targetY } } : n))
  }

  function alignSelectedVertical(ids: string[]) {
    if (ids.length < 2) return
    snapshot()
    const idSet = new Set(ids)
    const sel = nodes.filter(n => idSet.has(n.id))
    const targetX = Math.min(...sel.map(n => n.position.x))
    setNodes(ns => ns.map(n => idSet.has(n.id) ? { ...n, position: { ...n.position, x: targetX } } : n))
  }

  function cleanUpDescendants(personId: string) {
    // Collect descendants via parent-child links.
    const descendants = new Set<string>()
    const queue = [personId]
    while (queue.length > 0) {
      const id = queue.shift()!
      for (const r of relationships) {
        if (r.type === 'parent-child' && r.sourceId === id && !descendants.has(r.targetId)) {
          descendants.add(r.targetId)
          queue.push(r.targetId)
        }
      }
    }
    if (descendants.size === 0) return

    // Spouses of descendants move with them so couple lines stay coherent;
    // the focal person itself never moves.
    const movable = new Set(descendants)
    for (const id of descendants) {
      const network = getCoupleNetwork(id)
      for (const partnerId of network) {
        if (partnerId !== personId) movable.add(partnerId)
      }
    }

    const newPositions = autoLayout(people, relationships)
    const selectedNew = newPositions[personId]
    const selectedCur = nodes.find(n => n.id === personId)?.position
    if (!selectedNew || !selectedCur) return
    const offsetX = selectedCur.x - selectedNew.x
    const offsetY = selectedCur.y - selectedNew.y

    snapshot()
    setNodes(ns => ns.map(n =>
      movable.has(n.id) && newPositions[n.id]
        ? { ...n, position: { x: newPositions[n.id].x + offsetX, y: newPositions[n.id].y + offsetY } }
        : n
    ))
  }

  function handleEditFromToolbar(id: string) {
    const person = people.find(p => p.id === id)
    if (person) setEditPerson(person)
  }

  function saveRelationship(rel: Relationship) {
    snapshot()
    setRelationships(rs =>
      rs.some(r => r.id === rel.id) ? rs.map(r => r.id === rel.id ? rel : r) : [...rs, rel]
    )
  }

  function deleteRelationship(id: string) {
    snapshot()
    setRelationships(rs => rs.filter(r => r.id !== id))
  }

  function openRelationshipEditor(relId: string) {
    const rel = relationships.find(r => r.id === relId)
    if (rel) setEditRel(rel)
  }

  function getCurrentPositions(): Record<string, { x: number; y: number }> {
    const pos: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) pos[n.id] = n.position
    return pos
  }

  function handleCleanUpLayout() {
    const ok = confirm(
      'Clean Up Layout will automatically re-arrange all nodes.\n\n' +
      '• Any custom positioning will be lost.\n' +
      '• Complex structures (multiple marriages, blended families) may not lay out perfectly — you can undo afterwards.\n\n' +
      'Continue?'
    )
    if (!ok) return
    snapshot()
    const newPositions = autoLayout(people, relationships)
    setNodes(ns => ns.map(n => ({
      ...n,
      position: newPositions[n.id] ?? n.position,
    })))
  }

  function projectFileName(ext: string) {
    const name = currentProject?.name?.trim() || 'genogram'
    return name.replace(/[/\\?%*:|"<>]/g, '-') + '.' + ext
  }

  function handleExportSvg() {
    const data: GenogramData = { people, relationships, nodePositions: getCurrentPositions() }
    const svg = exportToSvg(data, settings)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = projectFileName('svg'); a.click()
    URL.revokeObjectURL(url)
  }

  function handleExportJson() {
    const data: GenogramData = { people, relationships, nodePositions: getCurrentPositions() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = projectFileName('json'); a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try { 
        const data = JSON.parse(ev.target?.result as string) as GenogramData
        const name = file.name.replace('.json', '')
        const newProject: Project = {
          id: crypto.randomUUID(),
          name,
          data,
          lastModified: Date.now(),
        }
        const updated = [...projects, newProject]
        setProjects(updated)
        setActiveProjectId(newProject.id)
        loadProject(newProject)
        localStorage.setItem(LS_PROJECTS_KEY, JSON.stringify(updated))
      }
      catch { alert('Invalid JSON file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const jsonInputRef = useRef<HTMLInputElement>(null)
  const currentProject = projects.find(p => p.id === activeProjectId)

  return (
    <SettingsContext.Provider value={settings}>
    <MoveModeContext.Provider value={{ moveModeId: moveMode ? lastClickedId : null }}>
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e2e' }}>
      {/* Toolbar */}
      <div style={toolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={logo}>Genogram Builder</span>
          <div style={projectBadge} onClick={() => setShowProjects(true)} title="Switch project">
            <span style={projectName}>{currentProject?.name || 'Untitled'}</span>
            <span style={{ fontSize: 10, color: '#9ca3af', lineHeight: 1 }}>▾</span>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileMenu
            onImportGedcom={() => setShowGedcom(true)}
            onOpenJson={() => jsonInputRef.current?.click()}
            onExportSvg={handleExportSvg}
            onSaveJson={handleExportJson}
            onStartOver={handleStartOver}
            disabled={people.length === 0}
          />
          <input ref={jsonInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJson} />
          {!isMobile && (
            <>
              <button
                style={{ ...cleanUpBtn, opacity: people.length === 0 ? 0.4 : 1 }}
                disabled={people.length === 0}
                onClick={handleCleanUpLayout}
                title="Re-arrange nodes so spouses are adjacent and children are centred under their parents"
              >
                ✦ Clean Up Layout
              </button>
              <div style={toolbarDivider} />
              <button
                style={{ ...undoRedoBtn, opacity: undoStack.length === 0 ? 0.35 : 1 }}
                disabled={undoStack.length === 0}
                onClick={handleUndo}
                title="Undo (⌘Z)"
              >↩</button>
              <button
                style={{ ...undoRedoBtn, opacity: redoStack.length === 0 ? 0.35 : 1 }}
                disabled={redoStack.length === 0}
                onClick={handleRedo}
                title="Redo (⌘⇧Z)"
              >↪</button>
              <div style={toolbarDivider} />
            </>
          )}
          <button style={addBtn} onClick={() => setEditPerson('new')}>+ Person</button>
          {!isMobile && <button style={addBtn} onClick={() => setEditRel('new')}>+ Relationship</button>}
          <div style={toolbarDivider} />
          <button
            style={{ ...gearBtn, border: `1px solid ${C.borderStrong}` }}
            onClick={() => setShowSettings(true)}
            title="Settings"
          >⚙</button>
          <button
            style={gearBtn}
            onClick={() => setShowGuide(true)}
            title="User guide"
            aria-label="User guide"
          >
            <HelpCircle size={17} />
          </button>
          <button
            style={{ ...gearBtn, background: '#fcbf47', color: '#fff' }}
            onClick={() => { setCoffeeIsPrompt(false); setShowCoffee(true) }}
            title="Buy me a coffee"
            aria-label="Buy me a coffee"
          >
            <Coffee size={17} />
          </button>
        </div>
      </div>

      {/* Legend — hidden on mobile to free up vertical space for the canvas */}
      {!isMobile && (
        <div style={legend}>
          <LegendItem label="Male" shape="square" />
          <LegendItem label="Female" shape="circle" />
          <LegendItem label="Unknown" shape="triangle" />
          <LegendItem label="Other" shape="diamond" />
          <LegendItem label="Deceased" shape="filled" />
          <span style={divider} />
          <LegendItem label="Married" line="solid" />
          <LegendItem label="Divorced" line="divorced" />
          <LegendItem label="Separated" line="separated" />
          <LegendItem label="Cohabiting" line="dashed" />
          <LegendItem label="Twins" line="twins" />
          <span style={divider} />
          <span style={hint}>Click to select · Click again to slide spouse · Drag = move family · Double-click to edit</span>
        </div>
      )}

      {/* Canvas — explicitly light so the build area stays bright while the chrome above/below is dark */}
      <div style={{ flex: 1, background: '#fafaf9', cursor: moveMode ? 'ew-resize' : undefined }}>
        {people.length === 0 && relationships.length === 0 ? (
          <div style={empty}>
            <div style={emptyBox}>
              <p style={emptyTitle}>Start your genogram</p>
              <p style={emptyHint}>Import a GEDCOM file or add people manually</p>
              <div style={btnGroup}>
                <button style={btnPrimary} onClick={() => setShowGedcom(true)}>Import GEDCOM</button>
                <button style={btn} onClick={() => setEditPerson('new')}>Add Person</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={[]}
                onNodesChange={handleNodesChange}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                deleteKeyCode="Delete"
                multiSelectionKeyCode="Shift"
              >
                <Background color="#e5e5e5" gap={20} />
                <Controls />
                <MiniMap />
              </ReactFlow>
              <GenogramConnections
                relationships={relationships}
                onCoupleDoubleClick={openRelationshipEditor}
              />
              <SelectionToolbar
                onEdit={handleEditFromToolbar}
                onDelete={deletePeople}
                onCleanDescendants={cleanUpDescendants}
                onAlignHorizontal={alignSelectedHorizontal}
                onAlignVertical={alignSelectedVertical}
              />
              <FitViewOnLoad k={fitViewKey} />
            </ReactFlowProvider>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={footer}>
        © 2026 Carl Manson. All rights reserved.
      </div>

      {/* Modals */}
      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
      {showCoffee && <CoffeeModal prompted={coffeeIsPrompt} onClose={() => setShowCoffee(false)} />}
      {showGuide && <UserGuideModal onClose={() => setShowGuide(false)} />}
      {showProjects && (
        <ProjectManager
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={handleSelectProject}
          onCreate={handleCreateProject}
          onRename={handleRenameProject}
          onDelete={handleDeleteProject}
          onClose={() => setShowProjects(false)}
        />
      )}
      {editPerson !== null && (
        <PersonEditor
          key={editPerson === 'new' ? `new-${newPersonSeed?.key ?? 0}` : editPerson.id}
          person={editPerson === 'new' ? null : editPerson}
          people={people}
          settings={settings}
          initialParents={editPerson !== 'new' ? getParentsOf(editPerson.id) : newPersonSeed?.parents}
          initialRelContext={editPerson === 'new' ? newPersonSeed?.relContext : undefined}
          getParentsOf={getParentsOf}
          onSave={savePerson}
          onSaveAndAddNext={handleSaveAndAddNext}
          onDelete={deletePerson}
          onClose={() => { setEditPerson(null); setNewPersonSeed(null) }}
        />
      )}
      {editRel !== null && (
        <RelationshipEditor
          people={people}
          relationship={editRel === 'new' ? undefined : editRel}
          onSave={saveRelationship}
          onDelete={deleteRelationship}
          onClose={() => setEditRel(null)}
        />
      )}
      {showGedcom && (
        <GedcomImport
          onImport={loadData}
          onClose={() => setShowGedcom(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          people={people}
          onSave={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
    </MoveModeContext.Provider>
    </SettingsContext.Provider>
  )
}

// Calls fitView whenever `k` changes AND nodes have been measured. We bump `k`
// on initial load and project switch. fitView() on its own (the boolean prop
// on <ReactFlow>) only fires once on mount with the empty initial node set, so
// users were left with an unfit view until they pressed the controls button.
function FitViewOnLoad({ k }: { k: number }) {
  const { fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  useEffect(() => {
    if (!nodesInitialized) return
    const t = setTimeout(() => fitView({ padding: 0.2, duration: 250 }), 50)
    return () => clearTimeout(t)
  }, [k, nodesInitialized, fitView])
  return null
}

interface FileMenuProps {
  onImportGedcom: () => void
  onOpenJson: () => void
  onExportSvg: () => void
  onSaveJson: () => void
  onStartOver: () => void
  disabled: boolean
}

function FileMenu({ onImportGedcom, onOpenJson, onExportSvg, onSaveJson, onStartOver, disabled }: FileMenuProps) {
  const [open, setOpen] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function menuItem(key: string, label: string, action: () => void, opts: { danger?: boolean; itemDisabled?: boolean } = {}) {
    const isHovered = hoveredItem === key && !opts.itemDisabled
    return (
      <button
        key={key}
        style={{
          display: 'block', width: '100%', textAlign: 'left',
          padding: '7px 14px', border: 'none',
          cursor: opts.itemDisabled ? 'default' : 'pointer',
          background: isHovered ? (opts.danger ? '#fff1f1' : '#f3f4f6') : 'transparent',
          color: opts.itemDisabled ? '#c0c4cc' : opts.danger ? '#dc2626' : '#1a1a1a',
          fontSize: 13, fontFamily: 'sans-serif',
        }}
        disabled={opts.itemDisabled}
        onMouseEnter={() => setHoveredItem(key)}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => { if (!opts.itemDisabled) { action(); setOpen(false) } }}
      >
        {label}
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        style={{
          ...fileMenuTrigger,
          background: open ? '#45475a' : 'transparent',
          borderColor: open ? '#6c7086' : '#45475a',
          color: '#f4f4f5',
        }}
        onClick={() => setOpen(o => !o)}
      >
        File <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div style={fileMenuDropdown}>
          {menuItem('gedcom', 'Import GEDCOM…', onImportGedcom)}
          {menuItem('open-json', 'Open JSON…', onOpenJson)}
          <div style={fileMenuSep} />
          {menuItem('export-svg', 'Export SVG', onExportSvg, { itemDisabled: disabled })}
          {menuItem('save-json', 'Save JSON', onSaveJson, { itemDisabled: disabled })}
          <div style={fileMenuSep} />
          {menuItem('start-over', 'Start Over', onStartOver, { danger: true, itemDisabled: disabled })}
        </div>
      )}
    </div>
  )
}

const fileMenuTrigger: React.CSSProperties = {
  padding: '6px 11px', fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151',
  display: 'flex', alignItems: 'center', gap: 5,
}
const fileMenuDropdown: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 5px)', right: 0, minWidth: 185,
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
  boxShadow: '0 6px 20px rgba(0,0,0,0.1)', zIndex: 200, padding: '4px 0',
}
const fileMenuSep: React.CSSProperties = { height: 1, background: '#f3f4f6', margin: '4px 0' }

function LegendItem({ label, shape, line }: { label: string; shape?: string; line?: string }) {
  // Legend lives in dark chrome, so icons use light strokes / fills, NOT the
  // canvas convention (dark on white). They're a UI key, not a real genogram.
  const ink = '#a6adc8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'sans-serif', color: ink }}>
      {shape === 'square' && <svg width={14} height={14}><rect x={1} y={1} width={12} height={12} fill="none" stroke={ink} strokeWidth={1.5} /></svg>}
      {shape === 'circle' && <svg width={14} height={14}><circle cx={7} cy={7} r={6} fill="none" stroke={ink} strokeWidth={1.5} /></svg>}
      {shape === 'diamond' && <svg width={14} height={14}><polygon points="7,1 13,7 7,13 1,7" fill="none" stroke={ink} strokeWidth={1.5} /></svg>}
      {shape === 'triangle' && <svg width={14} height={14}><polygon points="7,1 13,13 1,13" fill="none" stroke={ink} strokeWidth={1.5} /></svg>}
      {shape === 'filled' && <svg width={14} height={14}><rect x={1} y={1} width={12} height={12} fill={ink} stroke={ink} strokeWidth={1.5} /><line x1={1} y1={1} x2={13} y2={13} stroke="#1e1e2e" strokeWidth={1} /><line x1={13} y1={1} x2={1} y2={13} stroke="#1e1e2e" strokeWidth={1} /></svg>}
      {line === 'solid' && <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke={ink} strokeWidth={2} /></svg>}
      {line === 'divorced' && <svg width={20} height={14}><line x1={0} y1={7} x2={20} y2={7} stroke={ink} strokeWidth={2} /><line x1={7} y1={2} x2={9} y2={12} stroke={ink} strokeWidth={2} /><line x1={11} y1={2} x2={13} y2={12} stroke={ink} strokeWidth={2} /></svg>}
      {line === 'separated' && <svg width={20} height={14}><line x1={0} y1={7} x2={20} y2={7} stroke={ink} strokeWidth={2} /><line x1={9} y1={2} x2={11} y2={12} stroke={ink} strokeWidth={2} /></svg>}
      {line === 'dashed' && <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke={ink} strokeWidth={2} strokeDasharray="4,3" /></svg>}
      {line === 'twins' && <svg width={20} height={14}><line x1={10} y1={2} x2={4} y2={12} stroke={ink} strokeWidth={1.5} /><line x1={10} y1={2} x2={16} y2={12} stroke={ink} strokeWidth={1.5} /></svg>}
      {label}
    </div>
  )
}

// Dark chrome palette. Canvas + modals stay light.
const C = {
  bg: '#1e1e2e',
  bgRaised: '#313244',
  bgHover: '#45475a',
  border: '#313244',
  borderStrong: '#45475a',
  text: '#ffffff',
  textSubtle: '#a6adc8',
  textMuted: '#7f849c',
  accent: '#6d7ce5',
}

const toolbar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: 50,
  background: C.bg, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
  flexWrap: 'wrap', gap: 6,
}
const logo: React.CSSProperties = {
  fontFamily: 'sans-serif', fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: '-0.01em',
}
const projectBadge: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
  background: C.bgRaised, borderRadius: 20, cursor: 'pointer',
  border: '1px solid transparent',
}
const projectName: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.text, fontFamily: 'sans-serif' }
const toolbarDivider: React.CSSProperties = { width: 1, height: 20, background: C.borderStrong, margin: '0 2px' }
const undoRedoBtn: React.CSSProperties = {
  padding: '6px 9px', fontSize: 15, fontFamily: 'sans-serif', cursor: 'pointer',
  background: 'transparent', border: '1px solid transparent', borderRadius: 6,
  color: C.textSubtle, lineHeight: 1,
}
const cleanUpBtn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer',
  background: 'transparent', color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 6, fontWeight: 500,
}
const addBtn: React.CSSProperties = {
  padding: '6px 13px', fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer',
  background: C.accent, color: C.text, border: 'none', borderRadius: 6, fontWeight: 500,
}
const gearBtn: React.CSSProperties = {
  padding: '6px 8px', fontSize: 17, fontFamily: 'sans-serif', cursor: 'pointer',
  background: 'transparent', border: '1px solid transparent', borderRadius: 6,
  color: C.textSubtle, lineHeight: 1,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
// Kept for empty-state panel
const btnGroup: React.CSSProperties = { display: 'flex', gap: 6 }
const btn: React.CSSProperties = {
  padding: '7px 14px', fontSize: 14, fontFamily: 'sans-serif', cursor: 'pointer',
  background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: 6, color: '#333',
}
const btnPrimary: React.CSSProperties = { ...btn, background: '#1a1a1a', color: '#fff', border: 'none' }
const legend: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, padding: '5px 16px',
  background: C.bg, borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap',
}
const divider: React.CSSProperties = {
  display: 'inline-block', width: 1, height: 16, background: C.borderStrong, margin: '0 4px',
}
const hint: React.CSSProperties = { fontSize: 11, fontFamily: 'sans-serif', color: C.textMuted }
const footer: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: 26, padding: '0 16px', flexShrink: 0,
  background: C.bg, borderTop: `1px solid ${C.border}`,
  fontSize: 11, fontFamily: 'sans-serif', color: C.textMuted,
}
const empty: React.CSSProperties = {
  width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const emptyBox: React.CSSProperties = {
  textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
}
const emptyTitle: React.CSSProperties = {
  margin: 0, fontSize: 20, fontWeight: 600, fontFamily: 'sans-serif', color: '#1a1a1a',
}
const emptyHint: React.CSSProperties = {
  margin: 0, fontSize: 14, fontFamily: 'sans-serif', color: '#6b7280',
}
