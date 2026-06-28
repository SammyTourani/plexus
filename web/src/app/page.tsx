'use client'

import { useEffect, useState } from 'react'
import { GitFork } from 'lucide-react'
import type { DependencyGraph, ToolPreconditions } from '@/lib/types'
import GraphExplorer from '@/components/GraphExplorer'

function LoadingSkeleton({ stage }: { stage: string }) {
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#0c0c0c] gap-5">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center">
          <GitFork className="w-5 h-5 text-[#3b82f6]" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold text-[#ebebeb] tracking-tight">Plexus</h1>
          <p className="text-xs text-[#5a5a5a] mt-0.5">AI Tool Dependency Graph</p>
        </div>
      </div>

      <div className="w-48">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-[#444]">{stage}</span>
          <div className="spinner" style={{ width: 14, height: 14, borderWidth: '1.5px' }} />
        </div>
        <div className="h-px w-full bg-[#1e1e1e] rounded-full overflow-hidden">
          <div className="h-full bg-[#3b82f6] rounded-full animate-pulse-subtle w-2/3" />
        </div>
      </div>

      <div className="flex items-center gap-5 text-[11px] text-[#444]">
        {[['1,296', 'tools'], ['520', 'edges'], ['2', 'toolkits']].map(([v, l]) => (
          <div key={l} className="text-center">
            <div className="text-base font-semibold text-[#3b82f6] tabular-nums">{v}</div>
            <div className="mt-0.5">{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-[#0c0c0c] gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#1e1e1e] border border-[#f87171]/30 flex items-center justify-center">
        <span className="text-[#f87171] text-lg">✕</span>
      </div>
      <div className="text-center">
        <h2 className="text-sm font-semibold text-[#ebebeb]">Failed to load</h2>
        <p className="text-xs text-[#5a5a5a] mt-1 max-w-xs">{message}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs rounded transition-colors"
      >
        Retry
      </button>
    </div>
  )
}

export default function Home() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null)
  const [preconditions, setPreconditions] = useState<ToolPreconditions[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState('Loading graph…')

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const base =
          process.env.NEXT_PUBLIC_BASE_PATH ??
          (process.env.NODE_ENV === 'production' ? '/plexus' : '')

        setStage('Loading graph…')
        const gr = await fetch(`${base}/data/graph.json`)
        if (!gr.ok) throw new Error(`graph.json: HTTP ${gr.status}`)
        const graphData: DependencyGraph = await gr.json()
        if (cancelled) return

        setStage('Loading preconditions…')
        const pr = await fetch(`${base}/data/preconditions.json`)
        if (!pr.ok) throw new Error(`preconditions.json: HTTP ${pr.status}`)
        const precData: ToolPreconditions[] = await pr.json()
        if (cancelled) return

        setStage('Initializing…')
        setGraph(graphData)
        setPreconditions(precData)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void load()
    return () => { cancelled = true }
  }, [])

  if (error) return <ErrorState message={error} />
  if (!graph || !preconditions) return <LoadingSkeleton stage={stage} />
  return <GraphExplorer graph={graph} preconditions={preconditions} />
}
