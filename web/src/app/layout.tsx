import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Plexus — AI Tool Dependency Graph',
  description:
    'Interactive dependency graph explorer for 1,296 agentic AI tools. Discover which tools must run before others in Google Workspace and GitHub toolkits.',
  keywords: ['AI tools', 'dependency graph', 'Composio', 'agentic AI', 'Google Workspace', 'GitHub'],
  authors: [{ name: 'Plexus' }],
  openGraph: {
    title: 'Plexus — AI Tool Dependency Graph',
    description: '1,296 tools · 520 dependency edges · Interactive explorer',
    type: 'website',
  },
  icons: {
    icon: '/plexus/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="bg-[#0d1117] text-[#e6edf3] antialiased h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
}
