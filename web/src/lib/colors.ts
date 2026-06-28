// ─── Service group color palette ──────────────────────────────────────────────

export const SERVICE_COLORS: Record<string, string> = {
  gmail: '#EA4335',
  calendar: '#F4B400',
  drive: '#4285F4',
  sheets: '#0F9D58',
  docs: '#4285F4',
  photos: '#F4B400',
  tasks: '#4285F4',
  analytics: '#E37400',
  ads: '#FBBC04',
  maps: '#34A853',
  contacts: '#4285F4',
  github: '#8B5CF6',
  default: '#6B7280',
}

// ─── Edge type colors ─────────────────────────────────────────────────────────

export const EDGE_COLORS: Record<string, string> = {
  description: '#60A5FA', // blue
  targeted: '#34D399',    // green
  heuristic: '#FBBF24',   // amber
  llm: '#A78BFA',         // violet
}

// ─── Human-readable group labels ─────────────────────────────────────────────

export const GROUP_LABELS: Record<string, string> = {
  gmail: 'Gmail',
  calendar: 'Calendar',
  drive: 'Drive',
  sheets: 'Sheets',
  docs: 'Docs',
  photos: 'Photos',
  tasks: 'Tasks',
  analytics: 'Analytics',
  ads: 'Ads',
  maps: 'Maps',
  contacts: 'Contacts',
  github: 'GitHub',
  default: 'Other',
}

// ─── Group ordering for legend display ───────────────────────────────────────

export const GROUP_ORDER: string[] = [
  'gmail',
  'drive',
  'calendar',
  'sheets',
  'docs',
  'github',
  'photos',
  'tasks',
  'analytics',
  'ads',
  'maps',
  'contacts',
  'default',
]

// ─── inferGroup: maps tool slug to service group ──────────────────────────────

export function inferGroup(slug: string): string {
  const l = slug.toLowerCase()

  if (
    l.includes('email') ||
    l.includes('thread') ||
    l.includes('draft') ||
    l.includes('label') ||
    l.includes('message') ||
    l.includes('filter') ||
    l.includes('history') ||
    l.includes('send_email') ||
    l.includes('reply_to') ||
    l.includes('attachment')
  )
    return 'gmail'

  if (
    l.includes('calendar') ||
    l.includes('event') ||
    l.includes('acl') ||
    l.includes('freebusy')
  )
    return 'calendar'

  if (
    l.includes('file') ||
    l.includes('folder') ||
    l.includes('drive') ||
    l.includes('permission') ||
    l.includes('revision') ||
    l.includes('change') ||
    l.includes('upload') ||
    l.includes('download') ||
    l.includes('copy_file') ||
    l.includes('edit_file') ||
    l.includes('find_file')
  )
    return 'drive'

  if (
    l.includes('sheet') ||
    l.includes('spreadsheet') ||
    l.includes('cell') ||
    l.includes('dimension') ||
    l.includes('chart') ||
    l.includes('values') ||
    l.includes('column') ||
    l.includes('data_validation') ||
    l.includes('conditional_format') ||
    l.includes('table')
  )
    return 'sheets'

  if (
    l.includes('document') ||
    l.includes('footer') ||
    l.includes('header') ||
    l.includes('insert_text') ||
    l.includes('markdown')
  )
    return 'docs'

  if (
    l.includes('album') ||
    l.includes('media_item') ||
    l.includes('photo') ||
    l.includes('enrichment')
  )
    return 'photos'

  if (l.includes('task')) return 'tasks'

  if (
    l.includes('analytics') ||
    l.includes('report') ||
    l.includes('metric') ||
    l.includes('audience')
  )
    return 'analytics'

  if (slug.startsWith('GITHUB_')) return 'github'

  return 'default'
}

// ─── Color alpha utilities ────────────────────────────────────────────────────

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function dimColor(hex: string): string {
  return hexToRgba(hex, 0.15)
}
