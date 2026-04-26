import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  Node,
  NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import PersonNode from './components/PersonNode'
import GenogramConnections from './components/GenogramConnections'
import PersonEditor from './components/PersonEditor'
import RelationshipEditor from './components/RelationshipEditor'
import GedcomImport from './components/GedcomImport'
import SettingsPanel from './components/SettingsPanel'
import ProjectManager from './components/ProjectManager'
import WelcomeModal from './components/WelcomeModal'
import { Person, Relationship, GenogramData, Settings, DEFAULT_SETTINGS, RelContext, Project } from './lib/types'
import type { ParentIds } from './components/PersonEditor'
import { SettingsContext } from './lib/SettingsContext'
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
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS
    } catch { return DEFAULT_SETTINGS }
  })

  const [editPerson, setEditPerson] = useState<Person | null | 'new'>(null)
  const [editRel, setEditRel] = useState<Relationship | null | 'new'>(null)
  const [showGedcom, setShowGedcom] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
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
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
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
    const shiftOnly = e.shiftKey
    const { group, coupleNetworkIds } = shiftOnly
      ? { group: new Set([node.id]), coupleNetworkIds: new Set([node.id]) }
      : getFamilyGroup(node.id)
    const groupStartPositions: Record<string, { x: number; y: number }> = {}
    for (const n of nodes) {
      if (group.has(n.id)) groupStartPositions[n.id] = { ...n.position }
    }
    dragGroupRef.current = { nodeId: node.id, startPos: { ...node.position }, groupStartPositions, shiftOnly, coupleNetworkIds }
  }, [nodes, relationships]) // eslint-disable-line react-hooks/exhaustive-deps

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
      const pos = relContext ? getSmartPosition(relContext) : { x: Math.random() * 400, y: Math.random() * 200 }
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

  function deletePerson(id: string) {
    snapshot()
    setPeople(ps => ps.filter(p => p.id !== id))
    setRelationships(rs => rs.filter(r => r.sourceId !== id && r.targetId !== id))
    setNodes(ns => ns.filter(n => n.id !== id))
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
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: '#fafaf9' }}>
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
          <button style={addBtn} onClick={() => setEditPerson('new')}>+ Person</button>
          <button style={addBtn} onClick={() => setEditRel('new')}>+ Relationship</button>
          <div style={toolbarDivider} />
          <button style={gearBtn} onClick={() => setShowSettings(true)} title="Settings">⚙</button>
        </div>
      </div>

      {/* Legend */}
      <div style={legend}>
        <LegendItem label="Male" shape="square" />
        <LegendItem label="Female" shape="circle" />
        <LegendItem label="Unknown" shape="diamond" />
        <LegendItem label="Deceased" shape="filled" />
        <span style={divider} />
        <LegendItem label="Married" line="solid" />
        <LegendItem label="Divorced" line="divorced" />
        <LegendItem label="Separated" line="separated" />
        <LegendItem label="Cohabiting" line="dashed" />
        <LegendItem label="Twins" line="twins" />
        <span style={divider} />
        <span style={hint}>Double-click to edit · Drag moves family · Shift+drag slides spouse horizontally</span>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
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
                onNodesChange={onNodesChange}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                nodeTypes={nodeTypes}
                fitView
                deleteKeyCode="Delete"
              >
                <Background color="#e5e5e5" gap={20} />
                <Controls />
                <MiniMap />
              </ReactFlow>
              <GenogramConnections
                relationships={relationships}
                onCoupleDoubleClick={openRelationshipEditor}
              />
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
          person={editPerson === 'new' ? null : editPerson}
          people={people}
          settings={settings}
          initialParents={editPerson !== 'new' ? getParentsOf(editPerson.id) : undefined}
          getParentsOf={getParentsOf}
          onSave={savePerson}
          onDelete={deletePerson}
          onClose={() => setEditPerson(null)}
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
    </SettingsContext.Provider>
  )
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
          background: open ? '#f3f4f6' : '#f9fafb',
          borderColor: open ? '#9ca3af' : '#d1d5db',
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
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'sans-serif', color: '#555' }}>
      {shape === 'square' && <svg width={14} height={14}><rect x={1} y={1} width={12} height={12} fill="#fff" stroke="#1a1a1a" strokeWidth={1.5} /></svg>}
      {shape === 'circle' && <svg width={14} height={14}><circle cx={7} cy={7} r={6} fill="#fff" stroke="#1a1a1a" strokeWidth={1.5} /></svg>}
      {shape === 'diamond' && <svg width={14} height={14}><polygon points="7,1 13,7 7,13 1,7" fill="#fff" stroke="#1a1a1a" strokeWidth={1.5} /></svg>}
      {shape === 'filled' && <svg width={14} height={14}><rect x={1} y={1} width={12} height={12} fill="#555" stroke="#1a1a1a" strokeWidth={1.5} /><line x1={1} y1={1} x2={13} y2={13} stroke="#1a1a1a" strokeWidth={1} /><line x1={13} y1={1} x2={1} y2={13} stroke="#1a1a1a" strokeWidth={1} /></svg>}
      {line === 'solid' && <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke="#1a1a1a" strokeWidth={2} /></svg>}
      {line === 'divorced' && <svg width={20} height={14}><line x1={0} y1={7} x2={20} y2={7} stroke="#1a1a1a" strokeWidth={2} /><line x1={7} y1={2} x2={9} y2={12} stroke="#1a1a1a" strokeWidth={2} /><line x1={11} y1={2} x2={13} y2={12} stroke="#1a1a1a" strokeWidth={2} /></svg>}
      {line === 'separated' && <svg width={20} height={14}><line x1={0} y1={7} x2={20} y2={7} stroke="#1a1a1a" strokeWidth={2} /><line x1={9} y1={2} x2={11} y2={12} stroke="#1a1a1a" strokeWidth={2} /></svg>}
      {line === 'dashed' && <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke="#1a1a1a" strokeWidth={2} strokeDasharray="4,3" /></svg>}
      {line === 'twins' && <svg width={20} height={14}><line x1={10} y1={2} x2={4} y2={12} stroke="#1a1a1a" strokeWidth={1.5} /><line x1={10} y1={2} x2={16} y2={12} stroke="#1a1a1a" strokeWidth={1.5} /></svg>}
      {label}
    </div>
  )
}

const toolbar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', padding: '0 16px', height: 50,
  background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
}
const logo: React.CSSProperties = {
  fontFamily: 'sans-serif', fontWeight: 700, fontSize: 15, color: '#1a1a1a', letterSpacing: '-0.01em',
}
const projectBadge: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
  background: '#f3f4f6', borderRadius: 20, cursor: 'pointer',
  border: '1px solid transparent',
}
const projectName: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'sans-serif' }
const toolbarDivider: React.CSSProperties = { width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }
const undoRedoBtn: React.CSSProperties = {
  padding: '6px 9px', fontSize: 15, fontFamily: 'sans-serif', cursor: 'pointer',
  background: 'transparent', border: '1px solid transparent', borderRadius: 6,
  color: '#374151', lineHeight: 1,
}
const cleanUpBtn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer',
  background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 6, fontWeight: 500,
}
const addBtn: React.CSSProperties = {
  padding: '6px 13px', fontSize: 13, fontFamily: 'sans-serif', cursor: 'pointer',
  background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 500,
}
const gearBtn: React.CSSProperties = {
  padding: '6px 8px', fontSize: 17, fontFamily: 'sans-serif', cursor: 'pointer',
  background: 'transparent', border: '1px solid transparent', borderRadius: 6,
  color: '#6b7280', lineHeight: 1,
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
  background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0, flexWrap: 'wrap',
}
const divider: React.CSSProperties = {
  display: 'inline-block', width: 1, height: 16, background: '#d1d5db', margin: '0 4px',
}
const hint: React.CSSProperties = { fontSize: 11, fontFamily: 'sans-serif', color: '#9ca3af' }
const footer: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  height: 26, padding: '0 16px', flexShrink: 0,
  background: '#fff', borderTop: '1px solid #e5e7eb',
  fontSize: 11, fontFamily: 'sans-serif', color: '#9ca3af',
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
