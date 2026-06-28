'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Command } from 'cmdk'
import { Search, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { CommandPaletteProps } from '@/lib/types'
import { SERVICE_COLORS, GROUP_LABELS, inferGroup } from '@/lib/colors'

export default function CommandPalette({
  open,
  onOpenChange,
  graph,
  onSelect,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')

  // Reset search on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => setSearch(''), 200)
    }
  }, [open])

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  const handleSelect = useCallback(
    (slug: string) => {
      onSelect(slug)
      onOpenChange(false)
    },
    [onSelect, onOpenChange]
  )

  // Build search index
  const searchItems = useMemo(
    () =>
      graph.nodes.map((node) => ({
        slug: node.slug,
        name: node.name,
        toolkit: node.toolkit,
        group: inferGroup(node.slug),
        isDeprecated: node.isDeprecated,
        searchText: `${node.slug} ${node.name}`.toLowerCase(),
      })),
    [graph.nodes]
  )

  // Filter results
  const results = useMemo(() => {
    if (!search.trim()) return searchItems.slice(0, 60)
    const q = search.toLowerCase().trim()
    return searchItems
      .filter((item) => item.searchText.includes(q))
      .sort((a, b) => {
        // Exact slug match first
        const aSlug = a.slug.toLowerCase() === q
        const bSlug = b.slug.toLowerCase() === q
        if (aSlug && !bSlug) return -1
        if (bSlug && !aSlug) return 1
        // Slug starts-with
        const aStarts = a.slug.toLowerCase().startsWith(q)
        const bStarts = b.slug.toLowerCase().startsWith(q)
        if (aStarts && !bStarts) return -1
        if (bStarts && !aStarts) return 1
        return a.slug.localeCompare(b.slug)
      })
      .slice(0, 80)
  }, [search, searchItems])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => onOpenChange(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#010409]/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[580px] mx-4 bg-[#161b22] border border-[#30363d] rounded-xl shadow-panel overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Tool search" shouldFilter={false}>
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#21262d]">
            <Search className="w-4 h-4 text-[#6e7681] flex-shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search 1,296 tools by name or slug…"
              className="flex-1 bg-transparent text-[#e6edf3] placeholder-[#6e7681] text-sm outline-none"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="flex-shrink-0 text-[#6e7681] hover:text-[#e6edf3] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:block flex-shrink-0 px-1.5 py-0.5 text-[10px] text-[#6e7681] bg-[#21262d] border border-[#30363d] rounded font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[420px] overflow-y-auto py-2">
            {results.length === 0 ? (
              <Command.Empty className="py-12 text-center text-[#6e7681] text-sm">
                No tools matching &ldquo;{search}&rdquo;
              </Command.Empty>
            ) : (
              <>
                {search && (
                  <div className="px-4 py-1.5 text-[10px] text-[#6e7681] uppercase tracking-wider font-semibold">
                    {results.length} result{results.length !== 1 ? 's' : ''}
                    {results.length === 80 ? ' (showing top 80)' : ''}
                  </div>
                )}
                {!search && (
                  <div className="px-4 py-1.5 text-[10px] text-[#6e7681] uppercase tracking-wider font-semibold">
                    All tools
                  </div>
                )}
                {results.map((item) => {
                  const color = SERVICE_COLORS[item.group] ?? SERVICE_COLORS.default
                  const groupLabel = GROUP_LABELS[item.group] ?? item.group

                  return (
                    <Command.Item
                      key={item.slug}
                      value={item.slug}
                      onSelect={() => handleSelect(item.slug)}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none',
                        'transition-colors duration-75',
                        'aria-selected:bg-[#1c2128]',
                        'hover:bg-[#1c2128]',
                        item.isDeprecated && 'opacity-50'
                      )}
                    >
                      {/* Group color dot */}
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: color }}
                      />

                      {/* Tool info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#e6edf3] truncate">{item.name}</div>
                        <code className="text-[10px] text-[#6e7681] font-mono">{item.slug}</code>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: color + '1a',
                            color,
                          }}
                        >
                          {groupLabel}
                        </span>
                        {item.toolkit === 'github' ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[rgba(139,92,246,0.12)] text-[#8B5CF6]">
                            GH
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[rgba(66,133,244,0.12)] text-[#4285F4]">
                            GWS
                          </span>
                        )}
                        {item.isDeprecated && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-[rgba(248,81,73,0.12)] text-[#f85149]">
                            Deprecated
                          </span>
                        )}
                      </div>
                    </Command.Item>
                  )
                })}
              </>
            )}
          </Command.List>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-[#21262d] flex items-center gap-4 text-[10px] text-[#6e7681]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded font-mono">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded font-mono">↵</kbd>
              Select & fly to
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#21262d] border border-[#30363d] rounded font-mono">ESC</kbd>
              Close
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}
