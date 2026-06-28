'use client'

import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import type { DependencyGraph, ToolPreconditions } from '@/lib/types'
import GraphExplorer from '@/components/GraphExplorer'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton({ stage }: { stage: string }) {
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#0d1117] gap-6">
      <div className="flex flex-col items-center gap-4">
        {/* Logo */}
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#4285F4] flex items-center justify-center shadow-glow-sm">
            <GitBranch className="w-7 h-7 text-white" />
          </div>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#8B5CF6] to-[#4285F4] opacity-20 blur-lg" />
        </div>

        {/* Wordmark */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#e6edf3] tracking-tight">Plexus</h1>
          <p className="text-sm text-[#6e7681] mt-1">AI Tool Dependency Graph</p>
        </div>
      </div>

      {/* Progress */}
      <div className="w-64">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#6e7681]">{stage}</span>
          <div className="spinner w-4 h-4" style={{ borderWidth: '2px' }} />
        </div>
        <div className="h-0.5 w-full bg-[#21262d] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#4285F4] rounded-full animate-pulse-subtle w-2/3" />
        </div>
      </div>

      {/* Teaser stats */}
      <div className="flex items-center gap-6 text-xs text-[#6e7681]">
        {[
          { value: '1,296', label: 'tools' },
          { value: '520', label: 'edges' },
          { value: '2', label: 'toolkits' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-lg font-bold text-[#8B5CF6] tabular-nums">{stat.value}</div>
            <div className="mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#0d1117] gap-4">
      <div className="w-12 h-12 rounded-xl bg-[rgba(248,81,73,0.1)] border border-[rgba(248,81,73,0.3)] flex items-center justify-center">
        <span className="text-[#f85149] text-xl">✕</span>
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-[#e6edf3]">Failed to load data</h2>
        <p className="text-sm text-[#8b949e] mt-1 max-w-sm">{message}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7c3aed] text-white text-sm rounded-md transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function Home() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null)
  const [preconditions, setPreconditions] = useState<ToolPreconditions[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState('Loading tool graph…')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const basePath =
          process.env.NEXT_PUBLIC_BASE_PATH ??
          (process.env.NODE_ENV === 'production' ? '/plexus' : '')

        setStage('Loading tool graph…')
        const graphRes = await fetch(`${basePath}/data/graph.json`)
        if (!graphRes.ok) throw new Error(`graph.json: HTTP ${graphRes.status}`)
        const graphData: DependencyGraph = await graphRes.json()

        if (cancelled) return

        setStage('Loading preconditions…')
        const precRes = await fetch(`${basePath}/data/preconditions.json`)
        if (!precRes.ok) throw new Error(`preconditions.json: HTTP ${precRes.status}`)
        const precData: ToolPreconditions[] = await precRes.json()

        if (cancelled) return

        setStage('Initializing graph…')
        setGraph(graphData)
        setPreconditions(precData)
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  if (error) return <ErrorState message={error} />
  if (!graph || !preconditions) return <LoadingSkeleton stage={stage} />

  return <GraphExplorer graph={graph} preconditions={preconditions} />
}
