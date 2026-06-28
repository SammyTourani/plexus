'use client'

import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react'
import dynamic from 'next/dynamic'
import { Search, GitFork } from 'lucide-react'
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

const SigmaGraph = dynamic(() => import('./SigmaGraph'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-[#0c0c0c]">
      <div className="text-center">
        <div className="spinner mb-3 mx-auto" />
        <p className="text-xs text-[#5a5a5a]">Loading graph…</p>
      </div>
    </div>
  ),
})

const DEFAULT_FILTERS: FilterState = {
  toolkits: new Set(['googlesuper', 'github']),
  showConnectedOnly: true,
  showDeprecated: false,
  minConfidence: 0.5,
  edgeTypes: new Set<EdgeType>(['description', 'targeted', 'heuristic', 'llm']),
  search: '',
}

interface GraphExplorerProps {
  graph: DependencyGraph
  preconditions: ToolPreconditions[]
}

export default function GraphExplorer({ graph, preconditions }: GraphExplorerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [tracedNodes, setTracedNodes] = useState<Set<string> | null>(null)
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [paletteOpen, setPaletteOpen] = useState(false)

  const flyToRef = useRef<((slug: string) => void) | null>(null)
  const runLayoutRef = useRef<(() => void) | null>(null)
  const resetViewRef = useRef<(() => void) | null>(null)

  const preconditionsMap = useMemo(() => {
    const map = new Map<string, ToolPreconditions>()
    for (const p of preconditions) map.set(p.tool, p)
    return map
  }, [preconditions])

  const connectedSlugs = useMemo(
    () => computeConnectedNodes(graph.edges),
    [graph.edges]
  )

  const stats: GraphStats = useMemo(
    () => computeStats(graph, connectedSlugs),
    [graph, connectedSlugs]
  )

  // ⌘K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleNodeClick = useCallback((slug: string | null) => {
    setSelectedNode(slug)
    if (slug === null) setTracedNodes(null)
  }, [])

  const handleTrace = useCallback(
    (slug: string) => {
      if (!slug) { setTracedNodes(null); return }
      setTracedNodes(getAncestors(slug, graph.edges, 4))
    },
    [graph.edges]
  )

  const handleCommandSelect = useCallback((slug: string) => {
    setSelectedNode(slug)
    setTracedNodes(null)
    flyToRef.current?.(slug)
  }, [])

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
    flyToRef.current?.(slug)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0c0c]">
      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-11 bg-[#141414] border-b border-[#282828] z-20">
        <div className="flex items-center gap-2.5">
          <GitFork className="w-4 h-4 text-[#3b82f6]" />
          <span className="text-sm font-semibold text-[#ebebeb] tracking-tight">Plexus</span>
          <span className="text-[#282828]">·</span>
          <span className="text-xs text-[#5a5a5a]">
            {graph.metadata.totalTools.toLocaleString()} tools · {graph.metadata.totalEdges} edges
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2e2e2e] rounded-md text-xs text-[#9b9b9b] hover:text-[#ebebeb] transition-colors"
          >
            <Search className="w-3 h-3" />
            <span>Search</span>
            <kbd className="px-1 bg-[#141414] border border-[#333] rounded text-[10px] font-mono text-[#5a5a5a]">⌘K</kbd>
          </button>
          <a
            href="https://github.com/sammytourani/plexus"
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 bg-[#1e1e1e] hover:bg-[#252525] border border-[#2e2e2e] rounded-md text-xs text-[#9b9b9b] hover:text-[#ebebeb] transition-colors"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ControlPanel
          filters={filters}
          onFiltersChange={setFilters}
          stats={stats}
          onRunLayout={handleRunLayout}
          onResetView={handleResetView}
          runLayoutRef={runLayoutRef}
          resetViewRef={resetViewRef}
        />

        <main className="flex-1 relative overflow-hidden">
          <SigmaGraph
            graph={graph}
            selectedNode={selectedNode}
            tracedNodes={tracedNodes}
            filters={filters}
            onNodeClick={handleNodeClick}
            flyToRef={flyToRef}
          />

          {/* Bottom-left status */}
          <div className="absolute bottom-3 left-3 pointer-events-none">
            <span className="text-[11px] text-[#444] bg-[#141414]/80 px-2 py-1 rounded">
              {stats.connectedNodes} connected · {stats.orphanNodes} orphan
            </span>
          </div>

          {/* Selected node chip */}
          {selectedNode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="text-[11px] text-[#60a5fa] bg-[#141414]/90 border border-[#1d3557] px-2.5 py-1 rounded-full font-mono animate-fade-in">
                {selectedNode}
              </span>
            </div>
          )}

          {/* Trace mode badge */}
          {tracedNodes && (
            <div className="absolute top-3 right-3 pointer-events-none">
              <span className="text-[11px] text-[#3b82f6] bg-[#141414]/90 border border-[#1e3a5f] px-2.5 py-1 rounded-full animate-fade-in">
                Tracing {tracedNodes.size} tools
              </span>
            </div>
          )}
        </main>

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

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        graph={graph}
        onSelect={handleCommandSelect}
      />
    </div>
  )
}
