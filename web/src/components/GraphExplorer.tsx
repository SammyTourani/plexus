'use client'

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react'
import dynamic from 'next/dynamic'
import { GitBranch, ExternalLink, Zap } from 'lucide-react'
import type {
  DependencyGraph,
  ToolPreconditions,
  FilterState,
  GraphStats,
  EdgeType,
} from '@/lib/types'
import { computeConnectedNodes, computeStats, getAncestors } from '@/lib/graph-utils'
import ControlPanel from './ControlPanel'
import DetailPanel from './DetailPanel'
import CommandPalette from './CommandPalette'

// ─── Dynamic import of Sigma (no SSR) ────────────────────────────────────────

const SigmaGraph = dynamic(() => import('./SigmaGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-[#0d1117]">
      <div className="text-center">
        <div className="spinner mb-4 mx-auto" />
        <p className="text-sm text-[#8b949e]">Loading graph engine…</p>
      </div>
    </div>
  ),
})

// ─── Default filter state ─────────────────────────────────────────────────────

const DEFAULT_FILTERS: FilterState = {
  toolkits: new Set(['googlesuper', 'github']),
  showConnectedOnly: true,
  showDeprecated: false,
  minConfidence: 0.5,
  edgeTypes: new Set<EdgeType>(['description', 'targeted', 'heuristic', 'llm']),
  search: '',
}

// ─── Stat counter animation ───────────────────────────────────────────────────

function AnimatedStat({
  target,
  label,
  delay = 0,
}: {
  target: number
  label: string
  delay?: number
}) {
  const [display, setDisplay] = useState(0)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  useEffect(() => {
    if (!started) return
    const duration = 800
    const start = performance.now()
    const from = 0

    function step(now: number) {
      const progress = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3) // cubic ease-out
      setDisplay(Math.round(from + (target - from) * ease))
      if (progress < 1) requestAnimationFrame(step)
    }

    requestAnimationFrame(step)
  }, [started, target])

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[#e6edf3] font-semibold tabular-nums">
        {display.toLocaleString()}
      </span>{' '}
      <span className="text-[#6e7681]">{label}</span>
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GraphExplorerProps {
  graph: DependencyGraph
  preconditions: ToolPreconditions[]
}

export default function GraphExplorer({ graph, preconditions }: GraphExplorerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [tracedNodes, setTracedNodes] = useState<Set<string> | null>(null)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Refs for cross-component imperative calls
  const flyToRef = useRef<((slug: string) => void) | null>(null)
  const runLayoutRef = useRef<(() => void) | null>(null)
  const resetViewRef = useRef<(() => void) | null>(null)

  // Build preconditions lookup map
  const preconditionsMap = useMemo(() => {
    const map = new Map<string, ToolPreconditions>()
    for (const p of preconditions) {
      map.set(p.tool, p)
    }
    return map
  }, [preconditions])

  // Connected nodes (stable reference)
  const connectedSlugs = useMemo(
    () => computeConnectedNodes(graph.edges),
    [graph.edges]
  )

  // Graph stats
  const stats: GraphStats = useMemo(
    () => computeStats(graph, connectedSlugs),
    [graph, connectedSlugs]
  )

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((slug: string | null) => {
    setSelectedNode(slug)
    if (slug === null) {
      setTracedNodes(null)
    }
  }, [])

  const handleTrace = useCallback(
    (slug: string) => {
      if (!slug) {
        setTracedNodes(null)
        return
      }
      const ancestors = getAncestors(slug, graph.edges, 4)
      setTracedNodes(ancestors)
    },
    [graph.edges]
  )

  const handleCommandSelect = useCallback(
    (slug: string) => {
      setSelectedNode(slug)
      setTracedNodes(null)
      // Fly camera to node
      if (flyToRef.current) {
        flyToRef.current(slug)
      }
    },
    []
  )

  const handleRunLayout = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__plexusRunLayout?.()
  }, [])

  const handleResetView = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__plexusResetView?.()
  }, [])

  const handleCloseDetail = useCallback(() => {
    setSelectedNode(null)
    setTracedNodes(null)
  }, [])

  const handleSelectNode = useCallback((slug: string) => {
    setSelectedNode(slug)
    setTracedNodes(null)
    if (flyToRef.current) flyToRef.current(slug)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0d1117]">
      {/* ─── Header band ────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 bg-[#161b22] border-b border-[#30363d] z-20">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#4285F4] flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#3fb950] rounded-full border border-[#161b22]" />
          </div>
          <div>
            <span className="text-[#e6edf3] font-bold text-lg tracking-tight leading-none">
              Plexus
            </span>
            <span className="ml-2 text-xs text-[#6e7681] hidden sm:inline">
              AI Tool Dependency Graph
            </span>
          </div>
        </div>

        {/* Animated stats */}
        <div className="hidden md:flex items-center gap-3 text-sm">
          <AnimatedStat target={graph.metadata.totalTools} label="tools" delay={100} />
          <span className="text-[#30363d]">·</span>
          <AnimatedStat target={graph.metadata.totalEdges} label="edges" delay={300} />
          <span className="text-[#30363d]">·</span>
          <span className="text-[#6e7681]">
            <span className="text-[#e6edf3] font-semibold">2</span> toolkits
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md text-xs text-[#8b949e] hover:text-[#e6edf3] transition-all"
          >
            <Zap className="w-3 h-3" />
            <span>Search</span>
            <kbd className="px-1 bg-[#161b22] border border-[#30363d] rounded text-[10px] font-mono">
              ⌘K
            </kbd>
          </button>
          <a
            href="https://github.com/sammytourani/plexus"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md text-xs text-[#8b949e] hover:text-[#e6edf3] transition-all"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </header>

      {/* ─── Main 3-column layout ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <ControlPanel
          filters={filters}
          onFiltersChange={setFilters}
          stats={stats}
          onRunLayout={handleRunLayout}
          onResetView={handleResetView}
          runLayoutRef={runLayoutRef}
          resetViewRef={resetViewRef}
        />

        {/* Graph canvas */}
        <main className="flex-1 relative overflow-hidden">
          <SigmaGraph
            graph={graph}
            selectedNode={selectedNode}
            tracedNodes={tracedNodes}
            filters={filters}
            onNodeClick={handleNodeClick}
            flyToRef={flyToRef}
          />

          {/* Node count overlay (bottom left of canvas) */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 pointer-events-none">
            <div className="px-3 py-1.5 bg-[#161b22]/80 backdrop-blur-sm border border-[#30363d] rounded-full text-xs text-[#6e7681]">
              {stats.connectedNodes} connected · {stats.orphanNodes} orphan
            </div>
          </div>

          {/* Selected node mini label */}
          {selectedNode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="px-3 py-1.5 bg-[#8B5CF6]/20 backdrop-blur-sm border border-[#8B5CF6]/40 rounded-full text-xs text-[#a78bfa] font-medium animate-fade-in">
                {selectedNode}
              </div>
            </div>
          )}

          {/* Trace mode banner */}
          {tracedNodes && (
            <div className="absolute top-4 right-4 pointer-events-none">
              <div className="px-3 py-1.5 bg-[#8B5CF6]/15 backdrop-blur-sm border border-[#8B5CF6]/30 rounded-lg text-xs text-[#a78bfa] animate-fade-in">
                Tracing {tracedNodes.size} tools in producer chain
              </div>
            </div>
          )}
        </main>

        {/* Right detail panel */}
        {selectedNode && (
          <DetailPanel
            slug={selectedNode}
            graph={graph}
            preconditions={preconditionsMap}
            onSelectNode={handleSelectNode}
            onTrace={handleTrace}
            tracedNodes={tracedNodes}
            onClose={handleCloseDetail}
          />
        )}
      </div>

      {/* Command palette */}
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        graph={graph}
        onSelect={handleCommandSelect}
      />
    </div>
  )
}
