'use client'

import React, { useCallback, useState } from 'react'
import { RefreshCw, RotateCcw, ChevronDown } from 'lucide-react'
import type { ControlPanelProps, FilterState, EdgeType } from '@/lib/types'
import { SERVICE_COLORS, GROUP_LABELS, GROUP_ORDER } from '@/lib/colors'

const TOOLKIT_OPTIONS = [
  { value: 'googlesuper', label: 'Google Workspace' },
  { value: 'github', label: 'GitHub' },
]

const EDGE_TYPE_OPTIONS: { value: EdgeType; label: string; color: string }[] = [
  { value: 'description', label: 'Description', color: '#60a5fa' },
  { value: 'targeted',    label: 'Targeted',    color: '#4ade80' },
  { value: 'heuristic',   label: 'Heuristic',   color: '#facc15' },
  { value: 'llm',         label: 'LLM',         color: '#c084fc' },
]

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium text-[#5a5a5a] mb-2">{children}</p>
  )
}

export default function ControlPanel({
  filters,
  onFiltersChange,
  stats,
  onRunLayout,
  onResetView,
}: ControlPanelProps) {
  const [legendOpen, setLegendOpen] = useState(false)

  const update = useCallback(
    (patch: Partial<FilterState>) => onFiltersChange({ ...filters, ...patch }),
    [filters, onFiltersChange]
  )

  const toggleToolkit = useCallback(
    (value: string) => {
      const next = new Set(filters.toolkits)
      if (next.has(value)) { if (next.size > 1) next.delete(value) }
      else next.add(value)
      update({ toolkits: next })
    },
    [filters.toolkits, update]
  )

  const toggleEdgeType = useCallback(
    (value: EdgeType) => {
      const next = new Set(filters.edgeTypes)
      if (next.has(value)) { if (next.size > 1) next.delete(value) }
      else next.add(value)
      update({ edgeTypes: next })
    },
    [filters.edgeTypes, update]
  )

  const topGroups = GROUP_ORDER.filter((g) => (stats.byGroup[g] ?? 0) > 0)

  return (
    <aside className="w-56 flex-shrink-0 h-full overflow-y-auto bg-[#141414] border-r border-[#222] flex flex-col select-none text-[13px]">
      {/* Search */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <input
          type="text"
          placeholder="Filter by name…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="w-full bg-[#0c0c0c] border border-[#2a2a2a] rounded px-2.5 py-1.5 text-[13px] text-[#ebebeb] placeholder-[#444] focus:outline-none focus:border-[#3b82f6] transition-colors"
        />
      </div>

      {/* Toolkits */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <SectionLabel>Toolkits</SectionLabel>
        <div className="space-y-2">
          {TOOLKIT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.toolkits.has(opt.value)}
                onChange={() => toggleToolkit(opt.value)}
              />
              <span className="text-[#c4c4c4]">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Display */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <SectionLabel>Display</SectionLabel>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[#c4c4c4]">Connected only</span>
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
            <span className="text-[#c4c4c4]">Show deprecated</span>
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

      {/* Confidence */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Min confidence</SectionLabel>
          <span className="text-[11px] font-mono text-[#3b82f6]">
            {filters.minConfidence.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0} max={1} step={0.05}
          value={filters.minConfidence}
          onChange={(e) => update({ minConfidence: parseFloat(e.target.value) })}
          className="w-full"
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[#444]">0.0</span>
          <span className="text-[10px] text-[#444]">1.0</span>
        </div>
      </div>

      {/* Edge types */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <SectionLabel>Edge types</SectionLabel>
        <div className="space-y-2">
          {EDGE_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.edgeTypes.has(opt.value)}
                onChange={() => toggleEdgeType(opt.value)}
              />
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
              <span className="text-[#c4c4c4]">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <SectionLabel>Stats</SectionLabel>
        <div className="space-y-1.5">
          {[
            { label: 'Tools',     value: stats.totalNodes.toLocaleString(), color: '#c4c4c4' },
            { label: 'Edges',     value: stats.totalEdges.toLocaleString(), color: '#c4c4c4' },
            { label: 'Connected', value: stats.connectedNodes.toLocaleString(), color: '#4ade80' },
            { label: 'Orphans',   value: stats.orphanNodes.toLocaleString(), color: '#444' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between">
              <span className="text-[#5a5a5a]">{label}</span>
              <span className="tabular-nums font-medium" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Service groups legend */}
      <div className="p-3 border-b border-[#1e1e1e]">
        <button
          onClick={() => setLegendOpen((v) => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <SectionLabel>Services</SectionLabel>
          <ChevronDown
            className="w-3 h-3 text-[#444] transition-transform"
            style={{ transform: legendOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {legendOpen && (
          <div className="mt-2 space-y-1.5">
            {topGroups.map((group) => (
              <div key={group} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: SERVICE_COLORS[group] ?? SERVICE_COLORS.default }}
                />
                <span className="text-[#9b9b9b] flex-1">{GROUP_LABELS[group] ?? group}</span>
                <span className="text-[11px] text-[#444] tabular-nums">{stats.byGroup[group] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Layout controls */}
      <div className="p-3 mt-auto space-y-2">
        <button
          onClick={onRunLayout}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-[#2e2e2e] text-[12px] text-[#9b9b9b] hover:text-[#ebebeb] hover:border-[#3a3a3a] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Force layout
        </button>
        <button
          onClick={onResetView}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-[#2e2e2e] text-[12px] text-[#9b9b9b] hover:text-[#ebebeb] hover:border-[#3a3a3a] transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset view
        </button>
      </div>
    </aside>
  )
}
