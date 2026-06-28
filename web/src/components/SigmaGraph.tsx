'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { SigmaGraphProps, SigmaNodeAttributes, SigmaEdgeAttributes } from '@/lib/types'
import { SERVICE_COLORS, EDGE_COLORS, inferGroup } from '@/lib/colors'
import {
  computeGroupLayout,
  computeDegrees,
  computeConnectedNodes,
  isNodeVisible,
  isEdgeVisible,
  getNeighbors,
} from '@/lib/graph-utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGraph = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySigma = any

export default function SigmaGraph({
  graph,
  selectedNode,
  tracedNodes,
  filters,
  onNodeClick,
  flyToRef,
}: SigmaGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<AnySigma>(null)
  const graphologyRef = useRef<AnyGraph>(null)
  const mountedRef = useRef(false)

  // Build graphology graph when data loads
  useEffect(() => {
    if (!containerRef.current || !graph) return

    let isCancelled = false

    async function init() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ MultiDirectedGraph }, Sigma, fa2Module] = await Promise.all([
        import('graphology'),
        import('sigma'),
        import('graphology-layout-forceatlas2').catch(() => null),
      ])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FA2Worker = (fa2Module as any)?.default ?? null

      if (isCancelled || !containerRef.current) return

      // Kill existing renderer
      if (sigmaRef.current) {
        sigmaRef.current.kill()
        sigmaRef.current = null
      }

      const g = new MultiDirectedGraph()
      graphologyRef.current = g

      // Compute layout positions
      const positions = computeGroupLayout(
        graph.nodes.map((n) => ({ slug: n.slug })),
        inferGroup
      )

      // Compute degrees for node sizing
      const degrees = computeDegrees(
        graph.nodes.map((n) => n.slug),
        graph.edges
      )

      // Connected set (for filtering)
      const connectedSlugs = computeConnectedNodes(graph.edges)

      // Add nodes
      for (const node of graph.nodes) {
        const pos = positions.get(node.slug) ?? { x: 0, y: 0 }
        const group = inferGroup(node.slug)
        const outDeg = degrees.get(node.slug)?.out ?? 0
        const size = 3 + Math.min(outDeg * 1.5, 18)
        const color = SERVICE_COLORS[group] ?? SERVICE_COLORS.default

        const attrs: SigmaNodeAttributes = {
          x: pos.x,
          y: pos.y,
          size,
          color,
          label: node.name,
          slug: node.slug,
          group,
          toolkit: node.toolkit,
          isDeprecated: node.isDeprecated,
          hidden: false,
        }

        g.addNode(node.slug, attrs)
      }

      // Add edges
      for (let i = 0; i < graph.edges.length; i++) {
        const edge = graph.edges[i]
        const primaryLink = edge.params[0]
        const matchType = primaryLink?.matchType ?? 'heuristic'
        const color = EDGE_COLORS[matchType] ?? EDGE_COLORS.heuristic
        const size = Math.max(0.8, edge.confidence * 2.5)

        const attrs: SigmaEdgeAttributes = {
          size,
          color,
          type: 'arrow',
          matchType,
          confidence: edge.confidence,
          hidden: false,
          label: primaryLink?.inputParam ?? '',
        }

        try {
          g.addEdgeWithKey(`edge-${i}`, edge.from, edge.to, attrs)
        } catch {
          // Duplicate edges in multigraph are fine — skip
        }
      }

      if (isCancelled || !containerRef.current) return

      // Create Sigma renderer
      const renderer = new Sigma.default(g, containerRef.current, {
        renderEdgeLabels: false,
        defaultEdgeType: 'arrow',
        labelColor: { color: '#8b949e' },
        labelSize: 11,
        labelFont: 'Inter, system-ui, sans-serif',
        labelWeight: '400',
        minCameraRatio: 0.02,
        maxCameraRatio: 20,
        allowInvalidContainer: true,
        nodeProgramClasses: {},
        edgeProgramClasses: {},
      })

      sigmaRef.current = renderer

      // Store FA2 worker ref for external access
      ;(sigmaRef.current as AnySigma)._fa2Worker = FA2Worker ? new FA2Worker(g) : null

      // Event handlers
      renderer.on('clickNode', ({ node }: { node: string }) => {
        onNodeClick(node)
      })

      renderer.on('clickStage', () => {
        onNodeClick(null)
      })

      // flyTo callback for CommandPalette
      flyToRef.current = (slug: string) => {
        if (!sigmaRef.current) return
        try {
          const nodeAttrs = g.getNodeAttributes(slug) as SigmaNodeAttributes
          const { x, y } = renderer.graphToViewport({ x: nodeAttrs.x, y: nodeAttrs.y })
          void x; void y
          const camera = renderer.getCamera()
          const graphCoords = { x: nodeAttrs.x, y: nodeAttrs.y }
          const viewCoords = renderer.graphToViewport(graphCoords)
          void viewCoords
          camera.animate(
            { x: nodeAttrs.x, y: nodeAttrs.y, ratio: 0.3 },
            { duration: 600 }
          )
        } catch {
          // Node might not exist yet
        }
      }

      // Run layout trigger (exposed via ref)
      ;(sigmaRef.current as AnySigma)._runLayout = () => {
        const worker = (sigmaRef.current as AnySigma)._fa2Worker
        if (!worker) return
        worker.start()
        setTimeout(() => {
          worker.stop()
          sigmaRef.current?.refresh()
        }, 3000)
      }

      ;(sigmaRef.current as AnySigma)._resetView = () => {
        renderer.getCamera().animate({ x: 0, y: 0, ratio: 1 }, { duration: 400 })
      }

      mountedRef.current = true
      if (isCancelled) return
      renderer.refresh()
    }

    void init()

    return () => {
      isCancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // Update reducers when selection/trace/filters change
  useEffect(() => {
    if (!sigmaRef.current || !graphologyRef.current || !mountedRef.current) return

    const g = graphologyRef.current as AnyGraph
    const renderer = sigmaRef.current as AnySigma
    const connectedSlugs = computeConnectedNodes(graph.edges)

    let neighbors: Set<string> | null = null
    if (selectedNode) {
      neighbors = getNeighbors(selectedNode, graph.edges)
    }

    // nodeReducer
    renderer.setSetting('nodeReducer', (node: string, data: SigmaNodeAttributes) => {
      const nodeData = { ...data }

      // Visibility filters
      const visible = isNodeVisible(
        node,
        nodeData.toolkit,
        nodeData.isDeprecated,
        filters,
        connectedSlugs
      )
      if (!visible) {
        return { ...nodeData, hidden: true }
      }

      // Trace mode: dim everything not in trace set
      if (tracedNodes !== null) {
        if (!tracedNodes.has(node)) {
          return {
            ...nodeData,
            color: dimHex(nodeData.color, 0.08),
            size: nodeData.size * 0.6,
            label: '',
          }
        }
        return {
          ...nodeData,
          color: node === selectedNode ? '#8B5CF6' : brightenHex(nodeData.color),
          size: nodeData.size * 1.3,
        }
      }

      // Selection highlight
      if (selectedNode !== null) {
        if (node === selectedNode) {
          return { ...nodeData, color: '#8B5CF6', size: nodeData.size * 1.5 }
        }
        if (neighbors?.has(node)) {
          return { ...nodeData }
        }
        return {
          ...nodeData,
          color: dimHex(nodeData.color, 0.1),
          label: '',
          size: nodeData.size * 0.7,
        }
      }

      return nodeData
    })

    // edgeReducer
    renderer.setSetting('edgeReducer', (edge: string, data: SigmaEdgeAttributes) => {
      const edgeData = { ...data }
      const source = g.source(edge)
      const target = g.target(edge)

      // Edge type / confidence filter
      const visible = isEdgeVisible(edgeData.matchType, edgeData.confidence, filters)
      if (!visible) return { ...edgeData, hidden: true }

      // Trace mode: show only path edges
      if (tracedNodes !== null) {
        if (tracedNodes.has(source) && tracedNodes.has(target)) {
          return { ...edgeData, color: '#8B5CF6', size: 2 }
        }
        return { ...edgeData, hidden: true }
      }

      // Selection: hide non-adjacent edges
      if (selectedNode !== null) {
        if (source === selectedNode || target === selectedNode) {
          return { ...edgeData, size: Math.max(1.5, edgeData.size) }
        }
        return { ...edgeData, hidden: true }
      }

      return edgeData
    })

    renderer.refresh()
  }, [selectedNode, tracedNodes, filters, graph])

  // Expose layout controls via refs on the sigmaRef
  const handleRunLayout = useCallback(() => {
    if (!sigmaRef.current) return
    ;(sigmaRef.current as AnySigma)._runLayout?.()
  }, [])

  const handleResetView = useCallback(() => {
    if (!sigmaRef.current) return
    ;(sigmaRef.current as AnySigma)._resetView?.()
  }, [])

  // Attach layout functions to window for GraphExplorer refs
  useEffect(() => {
    ;(window as AnySigma).__plexusRunLayout = handleRunLayout
    ;(window as AnySigma).__plexusResetView = handleResetView
  }, [handleRunLayout, handleResetView])

  // Cleanup
  useEffect(() => {
    return () => {
      if (sigmaRef.current) {
        try { sigmaRef.current.kill() } catch { /* ignore */ }
        sigmaRef.current = null
      }
      mountedRef.current = false
    }
  }, [])

  return (
    <div className="relative w-full h-full bg-[#0d1117]">
      <div
        ref={containerRef}
        className="sigma-container w-full h-full"
        style={{ background: '#0d1117' }}
      />
    </div>
  )
}

// ─── Color utilities ──────────────────────────────────────────────────────────

function dimHex(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    // Blend toward #1c2128 (dim bg) with alpha
    const bg = { r: 28, g: 33, b: 40 }
    const rOut = Math.round(r * alpha + bg.r * (1 - alpha))
    const gOut = Math.round(g * alpha + bg.g * (1 - alpha))
    const bOut = Math.round(b * alpha + bg.b * (1 - alpha))
    return `#${rOut.toString(16).padStart(2, '0')}${gOut.toString(16).padStart(2, '0')}${bOut.toString(16).padStart(2, '0')}`
  } catch {
    return hex
  }
}

function brightenHex(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const rOut = Math.min(255, Math.round(r * 1.2 + 30))
    const gOut = Math.min(255, Math.round(g * 1.2 + 30))
    const bOut = Math.min(255, Math.round(b * 1.2 + 30))
    return `#${rOut.toString(16).padStart(2, '0')}${gOut.toString(16).padStart(2, '0')}${bOut.toString(16).padStart(2, '0')}`
  } catch {
    return hex
  }
}
