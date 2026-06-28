'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Sigma from 'sigma'
import { MultiDirectedGraph } from 'graphology'
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
type AnyVal = any

export default function SigmaGraph({
  graph,
  selectedNode,
  tracedNodes,
  filters,
  onNodeClick,
  flyToRef,
}: SigmaGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const graphologyRef = useRef<MultiDirectedGraph | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Build graph + create Sigma renderer
  useEffect(() => {
    if (!containerRef.current || !graph) return

    setError(null)

    // Kill any existing instance
    if (sigmaRef.current) {
      try { sigmaRef.current.kill() } catch { /* ignore */ }
      sigmaRef.current = null
    }

    try {
      const g = new MultiDirectedGraph()
      graphologyRef.current = g

      const positions = computeGroupLayout(graph.nodes.map((n) => ({ slug: n.slug })), inferGroup)
      const degrees = computeDegrees(graph.nodes.map((n) => n.slug), graph.edges)

      for (const node of graph.nodes) {
        const pos = positions.get(node.slug) ?? { x: 0, y: 0 }
        const group = inferGroup(node.slug)
        const outDeg = degrees.get(node.slug)?.out ?? 0
        const size = 3 + Math.min(outDeg * 1.5, 18)

        const attrs: SigmaNodeAttributes = {
          x: pos.x,
          y: pos.y,
          size,
          color: SERVICE_COLORS[group] ?? SERVICE_COLORS.default,
          label: node.name,
          slug: node.slug,
          group,
          toolkit: node.toolkit,
          isDeprecated: node.isDeprecated,
          hidden: false,
        }
        g.addNode(node.slug, attrs)
      }

      for (let i = 0; i < graph.edges.length; i++) {
        const edge = graph.edges[i]
        const primaryLink = edge.params[0]
        const matchType = primaryLink?.matchType ?? 'heuristic'

        const attrs: SigmaEdgeAttributes = {
          size: Math.max(0.8, edge.confidence * 2),
          color: EDGE_COLORS[matchType] ?? EDGE_COLORS.heuristic,
          type: 'line',
          matchType,
          confidence: edge.confidence,
          hidden: false,
          label: primaryLink?.inputParam ?? '',
        }

        try {
          g.addEdgeWithKey(`e${i}`, edge.from, edge.to, attrs)
        } catch {
          // duplicate in multigraph — skip
        }
      }

      const renderer = new Sigma(g, containerRef.current, {
        renderEdgeLabels: false,
        labelColor: { color: '#9b9b9b' },
        labelSize: 10,
        labelFont: 'ui-sans-serif, system-ui, sans-serif',
        minCameraRatio: 0.02,
        maxCameraRatio: 20,
        allowInvalidContainer: true,
      })

      sigmaRef.current = renderer

      renderer.on('clickNode', ({ node }: { node: string }) => onNodeClick(node))
      renderer.on('clickStage', () => onNodeClick(null))

      flyToRef.current = (slug: string) => {
        if (!sigmaRef.current) return
        try {
          const nodeAttrs = g.getNodeAttributes(slug) as SigmaNodeAttributes
          sigmaRef.current.getCamera().animate(
            { x: nodeAttrs.x, y: nodeAttrs.y, ratio: 0.3 },
            { duration: 500 }
          )
        } catch { /* node might not exist */ }
      }

      ;(sigmaRef.current as AnyVal)._resetView = () => {
        renderer.getCamera().animate({ x: 0, y: 0, ratio: 1 }, { duration: 400 })
      }

      renderer.refresh()
    } catch (err) {
      console.error('Sigma init error:', err)
      setError(err instanceof Error ? err.message : String(err))
    }

    return () => {
      if (sigmaRef.current) {
        try { sigmaRef.current.kill() } catch { /* ignore */ }
        sigmaRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph])

  // Update reducers when selection/filter state changes
  useEffect(() => {
    const renderer = sigmaRef.current
    const g = graphologyRef.current
    if (!renderer || !g) return

    const connectedSlugs = computeConnectedNodes(graph.edges)
    const neighbors = selectedNode ? getNeighbors(selectedNode, graph.edges) : null

    renderer.setSetting('nodeReducer', (node: string, data: AnyVal) => {
      const d = { ...(data as SigmaNodeAttributes) }

      if (!isNodeVisible(node, d.toolkit, d.isDeprecated, filters, connectedSlugs)) {
        return { ...d, hidden: true }
      }

      if (tracedNodes !== null) {
        if (!tracedNodes.has(node)) return { ...d, color: dimHex(d.color, 0.07), size: d.size * 0.6, label: '' }
        return { ...d, color: node === selectedNode ? '#3b82f6' : brightenHex(d.color), size: d.size * 1.3 }
      }

      if (selectedNode !== null) {
        if (node === selectedNode) return { ...d, color: '#3b82f6', size: d.size * 1.5 }
        if (neighbors?.has(node)) return { ...d }
        return { ...d, color: dimHex(d.color, 0.1), label: '', size: d.size * 0.7 }
      }

      return d
    })

    renderer.setSetting('edgeReducer', (edge: string, data: AnyVal) => {
      const d = { ...(data as SigmaEdgeAttributes) }
      const source = g.source(edge)
      const target = g.target(edge)

      if (!isEdgeVisible(d.matchType, d.confidence, filters)) return { ...d, hidden: true }

      if (tracedNodes !== null) {
        if (tracedNodes.has(source) && tracedNodes.has(target)) return { ...d, color: '#3b82f6', size: 2 }
        return { ...d, hidden: true }
      }

      if (selectedNode !== null) {
        if (source === selectedNode || target === selectedNode) return { ...d, size: Math.max(1.5, d.size) }
        return { ...d, hidden: true }
      }

      return d
    })

    renderer.refresh()
  }, [selectedNode, tracedNodes, filters, graph])

  // Expose reset via ref
  const handleResetView = useCallback(() => {
    ;(sigmaRef.current as AnyVal)?._resetView?.()
  }, [])

  useEffect(() => {
    ;(window as AnyVal).__plexusResetView = handleResetView
  }, [handleResetView])

  return (
    <div className="relative w-full h-full bg-[#0c0c0c]">
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10 p-8">
          <div className="bg-[#1e1e1e] border border-red-900/50 rounded-lg p-4 max-w-lg text-sm">
            <p className="text-red-400 font-medium mb-1">Graph failed to render</p>
            <p className="text-[#9b9b9b] font-mono text-xs break-all">{error}</p>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="sigma-container w-full h-full"
        style={{ background: '#0c0c0c' }}
      />
    </div>
  )
}

function dimHex(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    const bg = { r: 12, g: 12, b: 12 }
    return rgb(
      Math.round(r * alpha + bg.r * (1 - alpha)),
      Math.round(g * alpha + bg.g * (1 - alpha)),
      Math.round(b * alpha + bg.b * (1 - alpha))
    )
  } catch { return hex }
}

function brightenHex(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return rgb(Math.min(255, Math.round(r * 1.2 + 30)), Math.min(255, Math.round(g * 1.2 + 30)), Math.min(255, Math.round(b * 1.2 + 30)))
  } catch { return hex }
}

function rgb(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
