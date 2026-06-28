'use client'

import React, { useState, useMemo } from 'react'
import { X, ChevronDown, ChevronUp, GitMerge, ArrowRight, ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'
import type { DetailPanelProps, InputResolution, ResolutionType, DependencyEdge } from '@/lib/types'
import { SERVICE_COLORS, GROUP_LABELS, inferGroup } from '@/lib/colors'
import { getProducers, getConsumers } from '@/lib/graph-utils'

// ─── Resolution badge ─────────────────────────────────────────────────────────

const RESOLUTION_CONFIG: Record<ResolutionType, { label: string; className: string; dot: string }> = {
  tool: {
    label: 'From tool',
    className: 'badge badge-tool',
    dot: '#3fb950',
  },
  user: {
    label: 'User input',
    className: 'badge badge-user',
    dot: '#f85149',
  },
  tool_or_user: {
    label: 'Either',
    className: 'badge badge-tool_or_user',
    dot: '#d29922',
  },
  unknown: {
    label: 'Unknown',
    className: 'badge badge-unknown',
    dot: '#6e7681',
  },
}

function ResolutionBadge({ resolution }: { resolution: ResolutionType }) {
  const config = RESOLUTION_CONFIG[resolution]
  return <span className={config.className}>{config.label}</span>
}

// ─── Edge type badge ──────────────────────────────────────────────────────────

function EdgeTypeBadge({ type }: { type: string }) {
  return (
    <span
      className={clsx('badge', `badge-${type}`)}
    >
      {type}
    </span>
  )
}

// ─── Confidence bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.8 ? '#3fb950' : value >= 0.65 ? '#d29922' : '#f85149'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-[#21262d] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] text-[#6e7681] tabular-nums w-8 text-right">{pct}%</span>
    </div>
  )
}

// ─── Group badge ──────────────────────────────────────────────────────────────

function GroupBadge({ slug }: { slug: string }) {
  const group = inferGroup(slug)
  const color = SERVICE_COLORS[group] ?? SERVICE_COLORS.default
  const label = GROUP_LABELS[group] ?? group

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        borderColor: color + '40',
        backgroundColor: color + '18',
        color,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}

// ─── Input param row ──────────────────────────────────────────────────────────

function InputRow({
  input,
  onSelectTool,
}: {
  input: InputResolution
  onSelectTool?: (slug: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="py-2.5 border-b border-[#21262d] last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <code className="tool-slug text-[#e6edf3]">{input.name}</code>
          <span className="ml-2 text-[10px] text-[#6e7681] bg-[#21262d] px-1.5 py-0.5 rounded font-mono">
            {input.type}
          </span>
        </div>
        <ResolutionBadge resolution={input.resolution} />
      </div>

      {input.reason && (
        <p className="mt-1 text-xs text-[#6e7681] leading-relaxed">{input.reason}</p>
      )}

      {input.candidateTools && input.candidateTools.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#8B5CF6] hover:text-[#7c3aed] flex items-center gap-1 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {input.candidateTools.length} candidate tool{input.candidateTools.length !== 1 ? 's' : ''}
          </button>

          {expanded && (
            <div className="mt-1.5 space-y-1">
              {input.candidateTools.map((tool) => (
                <button
                  key={tool}
                  onClick={() => onSelectTool?.(tool)}
                  className="block w-full text-left tool-slug text-xs text-[#60a5fa] hover:text-[#93c5fd] hover:bg-[#1c2128] px-2 py-1 rounded transition-colors"
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

// ─── Producer edge row ────────────────────────────────────────────────────────

function ProducerRow({
  edge,
  onSelect,
}: {
  edge: DependencyEdge
  onSelect: (slug: string) => void
}) {
  const primaryLink = edge.params[0]
  return (
    <button
      onClick={() => onSelect(edge.from)}
      className="w-full text-left tool-item px-3 py-2.5 rounded-md transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowLeft className="w-3 h-3 text-[#6e7681] flex-shrink-0" />
          <span className="tool-slug text-xs text-[#60a5fa] group-hover:text-[#93c5fd] truncate transition-colors">
            {edge.from}
          </span>
        </div>
        <EdgeTypeBadge type={primaryLink?.matchType ?? 'heuristic'} />
      </div>
      {primaryLink?.inputParam && (
        <div className="mt-1 ml-5 text-[10px] text-[#6e7681]">
          via{' '}
          <code className="text-[#8b949e] font-mono">{primaryLink.inputParam}</code>
        </div>
      )}
      <div className="mt-1 ml-5">
        <ConfidenceBar value={edge.confidence} />
      </div>
    </button>
  )
}

// ─── Consumer edge row ────────────────────────────────────────────────────────

function ConsumerRow({
  edge,
  onSelect,
}: {
  edge: DependencyEdge
  onSelect: (slug: string) => void
}) {
  const primaryLink = edge.params[0]
  return (
    <button
      onClick={() => onSelect(edge.to)}
      className="w-full text-left tool-item px-3 py-2.5 rounded-md transition-colors group"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowRight className="w-3 h-3 text-[#6e7681] flex-shrink-0" />
          <span className="tool-slug text-xs text-[#34d399] group-hover:text-[#6ee7b7] truncate transition-colors">
            {edge.to}
          </span>
        </div>
        <EdgeTypeBadge type={primaryLink?.matchType ?? 'heuristic'} />
      </div>
      {primaryLink?.inputParam && (
        <div className="mt-1 ml-5 text-[10px] text-[#6e7681]">
          provides{' '}
          <code className="text-[#8b949e] font-mono">{primaryLink.inputParam}</code>
        </div>
      )}
      <div className="mt-1 ml-5">
        <ConfidenceBar value={edge.confidence} />
      </div>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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

  const producers = useMemo(
    () => (slug ? getProducers(slug, graph.edges) : []),
    [slug, graph.edges]
  )

  const consumers = useMemo(
    () => (slug ? getConsumers(slug, graph.edges) : []),
    [slug, graph.edges]
  )

  if (!slug || !node) return null

  const group = inferGroup(slug)
  const groupColor = SERVICE_COLORS[group] ?? SERVICE_COLORS.default

  const descFull = node.description
  const descShort = descFull.length > 180 ? descFull.slice(0, 180) + '…' : descFull
  const needsExpand = descFull.length > 180

  const isTracing = tracedNodes !== null

  return (
    <aside className="w-[320px] flex-shrink-0 h-full overflow-y-auto bg-[#161b22] border-l border-[#30363d] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-[#21262d] sticky top-0 bg-[#161b22] z-10">
        <div className="flex-1 min-w-0 pr-2">
          <h2 className="text-base font-semibold text-[#e6edf3] leading-tight">{node.name}</h2>
          <code className="tool-slug text-[10px] text-[#8b949e] mt-0.5 block truncate">
            {node.slug}
          </code>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Group + deprecated */}
      <div className="px-4 py-3 border-b border-[#21262d] flex items-center gap-2 flex-wrap">
        <GroupBadge slug={slug} />
        {node.toolkit === 'github' ? (
          <span className="badge" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}>
            GitHub
          </span>
        ) : (
          <span className="badge" style={{ background: 'rgba(66,133,244,0.12)', color: '#4285F4' }}>
            Google
          </span>
        )}
        {node.isDeprecated && (
          <span className="badge" style={{ background: 'rgba(248,81,73,0.12)', color: '#f85149' }}>
            Deprecated
          </span>
        )}
      </div>

      {/* Description */}
      <div className="px-4 py-3 border-b border-[#21262d]">
        <p className="text-sm text-[#8b949e] leading-relaxed">
          {needsExpand && !descExpanded ? descShort : descFull}
        </p>
        {needsExpand && (
          <button
            onClick={() => setDescExpanded((v) => !v)}
            className="mt-1.5 text-xs text-[#8B5CF6] hover:text-[#7c3aed] transition-colors"
          >
            {descExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Required inputs */}
      {prec && prec.requiredInputs.length > 0 && (
        <div className="px-4 py-3 border-b border-[#21262d]">
          <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-2">
            Required Inputs ({prec.requiredInputs.length})
          </p>
          <div>
            {prec.requiredInputs.map((input) => (
              <InputRow
                key={input.name}
                input={input}
                onSelectTool={onSelectNode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Producers (depends on) */}
      <div className="px-4 py-3 border-b border-[#21262d]">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider">
            Depends On
          </p>
          {producers.length > 0 && (
            <span className="text-[10px] bg-[#21262d] text-[#6e7681] px-1.5 py-0.5 rounded-full tabular-nums">
              {producers.length}
            </span>
          )}
        </div>
        {producers.length === 0 ? (
          <p className="text-xs text-[#6e7681]">No producer tools — all inputs user-provided.</p>
        ) : (
          <div className="space-y-1 -mx-1">
            {producers.map((edge, i) => (
              <ProducerRow key={i} edge={edge} onSelect={onSelectNode} />
            ))}
          </div>
        )}
      </div>

      {/* Consumers (required by) */}
      <div className="px-4 py-3 border-b border-[#21262d]">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider">
            Required By
          </p>
          {consumers.length > 0 && (
            <span className="text-[10px] bg-[#21262d] text-[#6e7681] px-1.5 py-0.5 rounded-full tabular-nums">
              {consumers.length}
            </span>
          )}
        </div>
        {consumers.length === 0 ? (
          <p className="text-xs text-[#6e7681]">No downstream tools depend on this.</p>
        ) : (
          <div className="space-y-1 -mx-1">
            {consumers.map((edge, i) => (
              <ConsumerRow key={i} edge={edge} onSelect={onSelectNode} />
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="px-4 py-3 border-b border-[#21262d]">
          <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-2">
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-2 py-0.5 bg-[#21262d] text-[#8b949e] rounded-full border border-[#30363d]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trace button */}
      {producers.length > 0 && (
        <div className="p-4 mt-auto">
          <button
            onClick={() => {
              if (isTracing) {
                onTrace('')  // Clear trace by passing empty string
              } else {
                onTrace(slug)
              }
            }}
            className={clsx(
              'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-150 active:scale-95',
              isTracing
                ? 'bg-[#8B5CF6] text-white hover:bg-[#7c3aed]'
                : 'border border-[#8B5CF6] text-[#8B5CF6] hover:bg-[#8B5CF6] hover:text-white'
            )}
          >
            <GitMerge className="w-4 h-4" />
            {isTracing ? 'Clear Trace' : 'Trace Producer Chain'}
          </button>
          {isTracing && tracedNodes && (
            <p className="mt-2 text-center text-xs text-[#8b949e]">
              Showing {tracedNodes.size} tools in chain
            </p>
          )}
        </div>
      )}
    </aside>
  )
}
