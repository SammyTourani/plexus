// ─── Graph data types ────────────────────────────────────────────────────────

export interface ParamInfo {
  name: string
  type: string
  description: string
  required: boolean
}

export interface ToolNode {
  slug: string
  name: string
  description: string
  toolkit: string
  inputs: ParamInfo[]
  isDeprecated: boolean
  tags: string[]
}

export interface ParamLink {
  inputParam: string
  producerSlug: string
  reason: string
  matchType: 'description' | 'heuristic' | 'targeted' | 'llm'
  evidence: 'explicit' | 'inferred'
}

export interface DependencyEdge {
  from: string
  to: string
  params: ParamLink[]
  confidence: number
}

export interface GraphMetadata {
  totalTools: number
  totalEdges: number
  edgesByType: Record<string, number>
  toolkits: string[]
  generatedAt: string
}

export interface DependencyGraph {
  nodes: ToolNode[]
  edges: DependencyEdge[]
  metadata: GraphMetadata
}

// ─── Preconditions types ─────────────────────────────────────────────────────

export type ResolutionType = 'tool' | 'user' | 'tool_or_user' | 'unknown'

export interface InputResolution {
  name: string
  type: string
  required: boolean
  resolution: ResolutionType
  reason: string
  candidateTools: string[]
}

export interface ConditionalGroup {
  condition: string
  inputs: InputResolution[]
}

export interface ToolPreconditions {
  tool: string
  name: string
  toolkit: string
  requiredInputs: InputResolution[]
  conditionalInputs?: ConditionalGroup[]
}

// ─── UI state types ───────────────────────────────────────────────────────────

export type EdgeType = 'description' | 'heuristic' | 'targeted' | 'llm'

export interface FilterState {
  toolkits: Set<string>
  showConnectedOnly: boolean
  showDeprecated: boolean
  minConfidence: number
  edgeTypes: Set<EdgeType>
  search: string
}

export interface GraphStats {
  totalNodes: number
  totalEdges: number
  connectedNodes: number
  orphanNodes: number
  byGroup: Record<string, number>
}

// ─── Sigma node/edge attributes ───────────────────────────────────────────────

export interface SigmaNodeAttributes {
  x: number
  y: number
  size: number
  color: string
  label: string
  slug: string
  group: string
  toolkit: string
  isDeprecated: boolean
  hidden?: boolean
}

export interface SigmaEdgeAttributes {
  size: number
  color: string
  type: string
  matchType: EdgeType
  confidence: number
  hidden?: boolean
  label?: string
}

// ─── Component prop types ─────────────────────────────────────────────────────

export interface SigmaGraphProps {
  graph: DependencyGraph
  selectedNode: string | null
  tracedNodes: Set<string> | null
  filters: FilterState
  onNodeClick: (slug: string | null) => void
  flyToRef: React.MutableRefObject<((slug: string) => void) | null>
}

export interface ControlPanelProps {
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
  stats: GraphStats
  onRunLayout: () => void
  onResetView: () => void
  runLayoutRef: React.MutableRefObject<(() => void) | null>
  resetViewRef: React.MutableRefObject<(() => void) | null>
}

export interface DetailPanelProps {
  slug: string | null
  graph: DependencyGraph
  preconditions: Map<string, ToolPreconditions>
  onSelectNode: (slug: string) => void
  onTrace: (slug: string) => void
  tracedNodes: Set<string> | null
  onClose: () => void
}

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  graph: DependencyGraph
  onSelect: (slug: string) => void
}
