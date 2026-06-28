'use client'

import React, { useCallback, useState } from 'react'
import { RefreshCw, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'
import type { ControlPanelProps, FilterState, EdgeType } from '@/lib/types'
import { SERVICE_COLORS, GROUP_LABELS, GROUP_ORDER } from '@/lib/colors'

const TOOLKIT_OPTIONS = [
  { value: 'googlesuper', label: 'Google Workspace' },
  { value: 'github', label: 'GitHub' },
]

const EDGE_TYPE_OPTIONS: { value: EdgeType; label: string; color: string }[] = [
  { value: 'description', label: 'Description', color: '#60A5FA' },
  { value: 'targeted', label: 'Targeted', color: '#34D399' },
  { value: 'heuristic', label: 'Heuristic', color: '#FBBF24' },
  { value: 'llm', label: 'LLM', color: '#A78BFA' },
]

export default function ControlPanel({
  filters,
  onFiltersChange,
  stats,
  onRunLayout,
  onResetView,
}: ControlPanelProps) {
  const [legendExpanded, setLegendExpanded] = useState(true)

  const update = useCallback(
    (patch: Partial<FilterState>) => {
      onFiltersChange({ ...filters, ...patch })
    },
    [filters, onFiltersChange]
  )

  const toggleToolkit = useCallback(
    (value: string) => {
      const next = new Set(filters.toolkits)
      if (next.has(value)) {
        if (next.size > 1) next.delete(value) // keep at least one
      } else {
        next.add(value)
      }
      update({ toolkits: next })
    },
    [filters.toolkits, update]
  )

  const toggleEdgeType = useCallback(
    (value: EdgeType) => {
      const next = new Set(filters.edgeTypes)
      if (next.has(value)) {
        if (next.size > 1) next.delete(value)
      } else {
        next.add(value)
      }
      update({ edgeTypes: next })
    },
    [filters.edgeTypes, update]
  )

  const topGroups = GROUP_ORDER.filter((g) => (stats.byGroup[g] ?? 0) > 0)

  return (
    <aside className="w-[260px] flex-shrink-0 h-full overflow-y-auto bg-[#161b22] border-r border-[#30363d] flex flex-col select-none">
      {/* Search */}
      <div className="p-4 border-b border-[#21262d]">
        <div className="relative">
          <input
            type="text"
            placeholder="Search tools..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-sm text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6] transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => update({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-[#e6edf3] transition-colors text-xs leading-none"
            >
              ✕
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-[#6e7681]">
          Press{' '}
          <kbd className="px-1 py-0.5 bg-[#21262d] border border-[#30363d] rounded text-[#8b949e] font-mono text-[10px]">
            ⌘K
          </kbd>{' '}
          for full search
        </p>
      </div>

      {/* Toolkits */}
      <div className="p-4 border-b border-[#21262d]">
        <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-3">
          Toolkits
        </p>
        <div className="space-y-2">
          {TOOLKIT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.toolkits.has(opt.value)}
                onChange={() => toggleToolkit(opt.value)}
              />
              <span className="text-sm text-[#e6edf3] group-hover:text-white transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="p-4 border-b border-[#21262d]">
        <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-3">
          Display
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#e6edf3]">Connected only</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={filters.showConnectedOnly}
                onChange={(e) => update({ showConnectedOnly: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#e6edf3]">Show deprecated</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={filters.showDeprecated}
                onChange={(e) => update({ showDeprecated: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
      </div>

      {/* Confidence slider */}
      <div className="p-4 border-b border-[#21262d]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider">
            Min Confidence
          </p>
          <span className="text-xs font-mono text-[#8B5CF6] tabular-nums">
            {filters.minConfidence.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={filters.minConfidence}
          onChange={(e) => update({ minConfidence: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#6e7681]">0.0</span>
          <span className="text-[10px] text-[#6e7681]">1.0</span>
        </div>
      </div>

      {/* Edge types */}
      <div className="p-4 border-b border-[#21262d]">
        <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-3">
          Edge Types
        </p>
        <div className="space-y-2">
          {EDGE_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={filters.edgeTypes.has(opt.value)}
                onChange={() => toggleEdgeType(opt.value)}
              />
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: opt.color }}
              />
              <span className="text-sm text-[#e6edf3] group-hover:text-white transition-colors">
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 border-b border-[#21262d]">
        <p className="text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-3">
          Stats
        </p>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#8b949e]">Total tools</span>
            <span className="text-[#e6edf3] font-medium tabular-nums">
              {stats.totalNodes.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">Edges</span>
            <span className="text-[#e6edf3] font-medium tabular-nums">
              {stats.totalEdges.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">Connected</span>
            <span className="text-[#3fb950] font-medium tabular-nums">
              {stats.connectedNodes.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8b949e]">Orphans</span>
            <span className="text-[#6e7681] font-medium tabular-nums">
              {stats.orphanNodes.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-b border-[#21262d]">
        <button
          onClick={() => setLegendExpanded((v) => !v)}
          className="flex items-center justify-between w-full text-xs font-semibold text-[#6e7681] uppercase tracking-wider mb-0 hover:text-[#8b949e] transition-colors"
        >
          <span>Service Groups</span>
          {legendExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {legendExpanded && (
          <div className="mt-3 space-y-1.5">
            {topGroups.map((group) => {
              const color = SERVICE_COLORS[group] ?? SERVICE_COLORS.default
              const label = GROUP_LABELS[group] ?? group
              const count = stats.byGroup[group] ?? 0

              return (
                <div key={group} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-[#8b949e] flex-1">{label}</span>
                  <span className="text-xs text-[#6e7681] tabular-nums">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Layout controls */}
      <div className="p-4 mt-auto space-y-2">
        <button
          onClick={onRunLayout}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md',
            'text-sm font-medium border transition-all duration-150',
            'border-[#8B5CF6] text-[#8B5CF6]',
            'hover:bg-[#8B5CF6] hover:text-white active:scale-95'
          )}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Run FA2 Layout
        </button>
        <button
          onClick={onResetView}
          className={clsx(
            'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md',
            'text-sm font-medium border transition-all duration-150',
            'border-[#30363d] text-[#8b949e]',
            'hover:border-[#484f58] hover:text-[#e6edf3] active:scale-95'
          )}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset View
        </button>
      </div>
    </aside>
  )
}
