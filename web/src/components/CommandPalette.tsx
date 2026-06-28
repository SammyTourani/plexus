'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Command } from 'cmdk'
import { Search, X } from 'lucide-react'
import type { CommandPaletteProps } from '@/lib/types'
import { SERVICE_COLORS, GROUP_LABELS, inferGroup } from '@/lib/colors'

export default function CommandPalette({
  open,
  onOpenChange,
  graph,
  onSelect,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) setTimeout(() => setSearch(''), 200)
  }, [open])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onOpenChange(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  const handleSelect = useCallback(
    (slug: string) => { onSelect(slug); onOpenChange(false) },
    [onSelect, onOpenChange]
  )

  const searchItems = useMemo(
    () => graph.nodes.map((node) => ({
      slug: node.slug,
      name: node.name,
      toolkit: node.toolkit,
      group: inferGroup(node.slug),
      isDeprecated: node.isDeprecated,
      searchText: `${node.slug} ${node.name}`.toLowerCase(),
    })),
    [graph.nodes]
  )

  const results = useMemo(() => {
    if (!search.trim()) return searchItems.slice(0, 60)
    const q = search.toLowerCase().trim()
    return searchItems
      .filter((item) => item.searchText.includes(q))
      .sort((a, b) => {
        const aExact = a.slug.toLowerCase() === q, bExact = b.slug.toLowerCase() === q
        if (aExact && !bExact) return -1
        if (bExact && !aExact) return 1
        const aStarts = a.slug.toLowerCase().startsWith(q), bStarts = b.slug.toLowerCase().startsWith(q)
        if (aStarts && !bStarts) return -1
        if (bStarts && !aStarts) return 1
        return a.slug.localeCompare(b.slug)
      })
      .slice(0, 80)
  }, [search, searchItems])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-[540px] mx-4 bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Tool search" shouldFilter={false}>
          {/* Input */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#1e1e1e]">
            <Search className="w-4 h-4 text-[#444] flex-shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search 1,296 tools…"
              className="flex-1 bg-transparent text-[#ebebeb] placeholder-[#444] text-sm outline-none"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[#444] hover:text-[#9b9b9b] transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="text-[10px] text-[#3a3a3a] bg-[#1e1e1e] border border-[#2a2a2a] px-1.5 py-0.5 rounded font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-y-auto py-1">
            {results.length === 0 ? (
              <Command.Empty className="py-10 text-center text-[#444] text-sm">
                No tools matching &ldquo;{search}&rdquo;
              </Command.Empty>
            ) : (
              <>
                <div className="px-3.5 py-1.5 text-[10px] text-[#3a3a3a]">
                  {search
                    ? `${results.length} result${results.length !== 1 ? 's' : ''}${results.length === 80 ? ' (top 80)' : ''}`
                    : `${searchItems.length} tools`}
                </div>
                {results.map((item) => {
                  const color = SERVICE_COLORS[item.group] ?? SERVICE_COLORS.default
                  const groupLabel = GROUP_LABELS[item.group] ?? item.group

                  return (
                    <Command.Item
                      key={item.slug}
                      value={item.slug}
                      onSelect={() => handleSelect(item.slug)}
                      className={`flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-colors duration-75 aria-selected:bg-[#1a1a1a] hover:bg-[#1a1a1a] ${item.isDeprecated ? 'opacity-40' : ''}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[#ebebeb] truncate">{item.name}</div>
                        <code className="text-[10px] text-[#5a5a5a] font-mono">{item.slug}</code>
                      </div>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: color + '18', color }}
                      >
                        {groupLabel}
                      </span>
                    </Command.Item>
                  )
                })}
              </>
            )}
          </Command.List>

          {/* Footer */}
          <div className="px-3.5 py-2 border-t border-[#1e1e1e] flex items-center gap-3 text-[10px] text-[#3a3a3a]">
            {[['↑↓', 'Navigate'], ['↵', 'Select'], ['ESC', 'Close']].map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <kbd className="px-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded font-mono">{key}</kbd>
                {label}
              </span>
            ))}
          </div>
        </Command>
      </div>
    </div>
  )
}
