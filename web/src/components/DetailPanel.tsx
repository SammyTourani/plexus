'use client'

import React, { useState, useMemo } from 'react'
import { X, ChevronDown, ChevronUp, GitMerge, ArrowRight, ArrowLeft } from 'lucide-react'
import type { DetailPanelProps, InputResolution, ResolutionType, DependencyEdge } from '@/lib/types'
import { SERVICE_COLORS, GROUP_LABELS, inferGroup } from '@/lib/colors'
import { getProducers, getConsumers } from '@/lib/graph-utils'

const RESOLUTION_CONFIG: Record<ResolutionType, { label: string; className: string }> = {
  tool:         { label: 'From tool',  className: 'badge badge-tool' },
  user:         { label: 'User input', className: 'badge badge-user' },
  tool_or_user: { label: 'Either',     className: 'badge badge-tool_or_user' },
  unknown:      { label: 'Unknown',    className: 'badge badge-unknown' },
}

function ResolutionBadge({ resolution }: { resolution: ResolutionType }) {
  const cfg = RESOLUTION_CONFIG[resolution]
  return <span className={cfg.className}>{cfg.label}</span>
}

function EdgeTypeBadge({ type }: { type: string }) {
  return <span className={`badge badge-${type}`}>{type}</span>
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? '#4ade80' : value >= 0.65 ? '#facc15' : '#f87171'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-0.5 bg-[#252525] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-[#444] tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

function GroupBadge({ slug }: { slug: string }) {
  const group = inferGroup(slug)
  const color = SERVICE_COLORS[group] ?? SERVICE_COLORS.default
  const label = GROUP_LABELS[group] ?? group
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
      style={{ background: color + '18', color }}
    >
      {label}
    </span>
  )
}

function InputRow({
  input,
  onSelectTool,
}: {
  input: InputResolution
  onSelectTool?: (slug: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="py-2 border-b border-[#1e1e1e] last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <code className="tool-slug text-[#c4c4c4]">{input.name}</code>
          <span className="ml-1.5 text-[10px] text-[#444] bg-[#1e1e1e] px-1 py-0.5 rounded font-mono">
            {input.type}
          </span>
        </div>
        <ResolutionBadge resolution={input.resolution} />
      </div>

      {input.candidateTools && input.candidateTools.length > 0 && (
        <div className="mt-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] text-[#3b82f6] hover:text-[#60a5fa] flex items-center gap-0.5 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {input.candidateTools.length} candidate tool{input.candidateTools.length !== 1 ? 's' : ''}
          </button>
          {expanded && (
            <div className="mt-1 space-y-0.5">
              {input.candidateTools.map((tool) => (
                <button
                  key={tool}
                  onClick={() => onSelectTool?.(tool)}
                  className="block w-full text-left tool-slug text-[11px] text-[#60a5fa] hover:text-[#93c5fd] hover:bg-[#1a1a1a] px-2 py-1 rounded transition-colors"
                >
                  {tool}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProducerRow({ edge, onSelect }: { edge: DependencyEdge; onSelect: (slug: string) => void }) {
  const primaryLink = edge.params[0]
  return (
    <button
      onClick={() => onSelect(edge.from)}
      className="w-full text-left tool-item px-2.5 py-2 rounded transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ArrowLeft className="w-3 h-3 text-[#444] flex-shrink-0" />
          <span className="tool-slug text-[11px] text-[#60a5fa] group-hover:text-[#93c5fd] truncate transition-colors">
            {edge.from}
          </span>
        </div>
        <EdgeTypeBadge type={primaryLink?.matchType ?? 'heuristic'} />
      </div>
      {primaryLink?.inputParam && (
        <p className="mt-0.5 ml-4.5 text-[10px] text-[#444]">
          via <code className="text-[#666] font-mono">{primaryLink.inputParam}</code>
        </p>
      )}
      <div className="mt-1 ml-4.5">
        <ConfidenceBar value={edge.confidence} />
      </div>
    </button>
  )
}

function ConsumerRow({ edge, onSelect }: { edge: DependencyEdge; onSelect: (slug: string) => void }) {
  const primaryLink = edge.params[0]
  return (
    <button
      onClick={() => onSelect(edge.to)}
      className="w-full text-left tool-item px-2.5 py-2 rounded transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <ArrowRight className="w-3 h-3 text-[#444] flex-shrink-0" />
          <span className="tool-slug text-[11px] text-[#4ade80] group-hover:text-[#86efac] truncate transition-colors">
            {edge.to}
          </span>
        </div>
        <EdgeTypeBadge type={primaryLink?.matchType ?? 'heuristic'} />
      </div>
      {primaryLink?.inputParam && (
        <p className="mt-0.5 ml-4.5 text-[10px] text-[#444]">
          provides <code className="text-[#666] font-mono">{primaryLink.inputParam}</code>
        </p>
      )}
      <div className="mt-1 ml-4.5">
        <ConfidenceBar value={edge.confidence} />
      </div>
    </button>
  )
}

export default function DetailPanel({
  slug,
  graph,
  preconditions,
  onSelectNode,
  onTrace,
  tracedNodes,
  onClose,
}: DetailPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false)

  const node = useMemo(
    () => (slug ? graph.nodes.find((n) => n.slug === slug) : null),
    [slug, graph.nodes]
  )
  const prec = useMemo(() => (slug ? preconditions.get(slug) : null), [slug, preconditions])
  const producers = useMemo(() => (slug ? getProducers(slug, graph.edges) : []), [slug, graph.edges])
  const consumers = useMemo(() => (slug ? getConsumers(slug, graph.edges) : []), [slug, graph.edges])

  if (!slug || !node) return null

  const descFull = node.description
  const descShort = descFull.length > 160 ? descFull.slice(0, 160) + '…' : descFull
  const needsExpand = descFull.length > 160
  const isTracing = tracedNodes !== null

  return (
    <aside className="w-72 flex-shrink-0 h-full overflow-y-auto bg-[#141414] border-l border-[#222] flex flex-col animate-slide-in-right text-[13px]">
      {/* Header */}
      <div className="flex items-start justify-between p-3 border-b border-[#1e1e1e] sticky top-0 bg-[#141414] z-10">
        <div className="flex-1 min-w-0 pr-2">
          <h2 className="text-sm font-semibold text-[#ebebeb] leading-tight">{node.name}</h2>
          <code className="tool-slug text-[10px] text-[#5a5a5a] mt-0.5 block truncate">{node.slug}</code>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded text-[#444] hover:text-[#ebebeb] hover:bg-[#1e1e1e] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Group chips */}
      <div className="px-3 py-2 border-b border-[#1e1e1e] flex items-center gap-1.5 flex-wrap">
        <GroupBadge slug={slug} />
        {node.isDeprecated && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1e1e1e] text-[#f87171]">
            Deprecated
          </span>
        )}
      </div>

      {/* Description */}
      <div className="px-3 py-2.5 border-b border-[#1e1e1e]">
        <p className="text-[13px] text-[#9b9b9b] leading-relaxed">
          {needsExpand && !descExpanded ? descShort : descFull}
        </p>
        {needsExpand && (
          <button
            onClick={() => setDescExpanded((v) => !v)}
            className="mt-1 text-[11px] text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
          >
            {descExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Required inputs */}
      {prec && prec.requiredInputs.length > 0 && (
        <div className="px-3 py-2.5 border-b border-[#1e1e1e]">
          <p className="text-[11px] text-[#5a5a5a] mb-2">
            Required inputs ({prec.requiredInputs.length})
          </p>
          <div>
            {prec.requiredInputs.map((input) => (
              <InputRow key={input.name} input={input} onSelectTool={onSelectNode} />
            ))}
          </div>
        </div>
      )}

      {/* Producers */}
      <div className="px-3 py-2.5 border-b border-[#1e1e1e]">
        <p className="text-[11px] text-[#5a5a5a] mb-2">
          Depends on {producers.length > 0 && `(${producers.length})`}
        </p>
        {producers.length === 0 ? (
          <p className="text-[12px] text-[#3a3a3a]">No upstream dependencies.</p>
        ) : (
          <div className="space-y-0.5 -mx-1">
            {producers.map((edge, i) => (
              <ProducerRow key={i} edge={edge} onSelect={onSelectNode} />
            ))}
          </div>
        )}
      </div>

      {/* Consumers */}
      <div className="px-3 py-2.5 border-b border-[#1e1e1e]">
        <p className="text-[11px] text-[#5a5a5a] mb-2">
          Required by {consumers.length > 0 && `(${consumers.length})`}
        </p>
        {consumers.length === 0 ? (
          <p className="text-[12px] text-[#3a3a3a]">No downstream tools depend on this.</p>
        ) : (
          <div className="space-y-0.5 -mx-1">
            {consumers.map((edge, i) => (
              <ConsumerRow key={i} edge={edge} onSelect={onSelectNode} />
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="px-3 py-2.5 border-b border-[#1e1e1e]">
          <p className="text-[11px] text-[#5a5a5a] mb-2">Tags</p>
          <div className="flex flex-wrap gap-1">
            {node.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-[#1e1e1e] text-[#5a5a5a] rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trace button */}
      {producers.length > 0 && (
        <div className="p-3 mt-auto">
          <button
            onClick={() => onTrace(isTracing ? '' : slug)}
            className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[12px] font-medium transition-all ${
              isTracing
                ? 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
                : 'border border-[#2e2e2e] text-[#9b9b9b] hover:text-[#ebebeb] hover:border-[#3a3a3a]'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5" />
            {isTracing ? 'Clear trace' : 'Trace producer chain'}
          </button>
          {isTracing && tracedNodes && (
            <p className="mt-1.5 text-center text-[11px] text-[#5a5a5a]">
              {tracedNodes.size} tools in chain
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
