import type { DependencyGraph, DependencyEdge, FilterState, GraphStats } from './types'
import { inferGroup } from './colors'

// ─── Connected node computation ────────────────────────────────────────────────

/**
 * Returns the set of slugs that appear in at least one edge (as from or to).
 */
export function computeConnectedNodes(edges: DependencyEdge[]): Set<string> {
  const connected = new Set<string>()
  for (const edge of edges) {
    connected.add(edge.from)
    connected.add(edge.to)
  }
  return connected
}

// ─── Ancestor BFS (trace producer chain) ──────────────────────────────────────

/**
 * BFS backwards from `slug` up to `maxHops` hops.
 * Returns Set of ancestor slugs (including the starting slug).
 */
export function getAncestors(
  slug: string,
  edges: DependencyEdge[],
  maxHops = 4
): Set<string> {
  const visited = new Set<string>()
  visited.add(slug)
  let frontier = [slug]

  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = []
    for (const current of frontier) {
      for (const edge of edges) {
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from)
          next.push(edge.from)
        }
      }
    }
    if (next.length === 0) break
    frontier = next
  }

  return visited
}

// ─── Producer/consumer helpers ────────────────────────────────────────────────

/**
 * Returns all edges where `to === slug` (producers that feed into this tool).
 */
export function getProducers(slug: string, edges: DependencyEdge[]): DependencyEdge[] {
  return edges.filter((e) => e.to === slug)
}

/**
 * Returns all edges where `from === slug` (consumers that depend on this tool).
 */
export function getConsumers(slug: string, edges: DependencyEdge[]): DependencyEdge[] {
  return edges.filter((e) => e.from === slug)
}

// ─── Neighborhood helper ──────────────────────────────────────────────────────

/**
 * Returns the set of 1-hop neighbors (producers + consumers) for a slug.
 */
export function getNeighbors(slug: string, edges: DependencyEdge[]): Set<string> {
  const neighbors = new Set<string>()
  for (const edge of edges) {
    if (edge.from === slug) neighbors.add(edge.to)
    if (edge.to === slug) neighbors.add(edge.from)
  }
  return neighbors
}

// ─── Graph statistics ─────────────────────────────────────────────────────────

export function computeStats(graph: DependencyGraph, connectedSlugs: Set<string>): GraphStats {
  const byGroup: Record<string, number> = {}

  for (const node of graph.nodes) {
    const group = inferGroup(node.slug)
    byGroup[group] = (byGroup[group] ?? 0) + 1
  }

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    connectedNodes: connectedSlugs.size,
    orphanNodes: graph.nodes.length - connectedSlugs.size,
    byGroup,
  }
}

// ─── Filter helpers ───────────────────────────────────────────────────────────

export function isNodeVisible(
  slug: string,
  toolkit: string,
  isDeprecated: boolean,
  filters: FilterState,
  connectedSlugs: Set<string>
): boolean {
  // Toolkit filter
  if (!filters.toolkits.has(toolkit)) return false

  // Deprecated filter
  if (!filters.showDeprecated && isDeprecated) return false

  // Connected-only filter
  if (filters.showConnectedOnly && !connectedSlugs.has(slug)) return false

  // Search filter
  if (filters.search) {
    const q = filters.search.toLowerCase()
    if (!slug.toLowerCase().includes(q)) return false
  }

  return true
}

export function isEdgeVisible(
  matchType: string,
  confidence: number,
  filters: FilterState
): boolean {
  if (!filters.edgeTypes.has(matchType as FilterState['edgeTypes'] extends Set<infer T> ? T : never)) return false
  if (confidence < filters.minConfidence) return false
  return true
}

// ─── Circular layout computation ─────────────────────────────────────────────

export interface NodePosition {
  x: number
  y: number
}

export function computeGroupLayout(
  nodes: { slug: string }[],
  getGroup: (slug: string) => string
): Map<string, NodePosition> {
  // Group slugs by service group
  const groups = new Map<string, string[]>()
  for (const node of nodes) {
    const g = getGroup(node.slug)
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(node.slug)
  }

  const groupNames = Array.from(groups.keys())
  const outerRadius = 80
  const innerRadius = 12
  const positions = new Map<string, NodePosition>()

  groupNames.forEach((group, gi) => {
    const members = groups.get(group)!
    const angle = (gi / groupNames.length) * 2 * Math.PI

    // Group center on the outer ring
    const cx = outerRadius * Math.cos(angle)
    const cy = outerRadius * Math.sin(angle)

    members.forEach((slug, mi) => {
      if (members.length === 1) {
        positions.set(slug, { x: cx, y: cy })
      } else {
        const innerAngle = (mi / members.length) * 2 * Math.PI
        positions.set(slug, {
          x: cx + innerRadius * Math.cos(innerAngle),
          y: cy + innerRadius * Math.sin(innerAngle),
        })
      }
    })
  })

  return positions
}

// ─── Degree computation ────────────────────────────────────────────────────────

export function computeDegrees(
  slugs: string[],
  edges: DependencyEdge[]
): Map<string, { in: number; out: number }> {
  const degrees = new Map<string, { in: number; out: number }>()
  for (const slug of slugs) {
    degrees.set(slug, { in: 0, out: 0 })
  }
  for (const edge of edges) {
    const f = degrees.get(edge.from)
    if (f) f.out++
    const t = degrees.get(edge.to)
    if (t) t.in++
  }
  return degrees
}
