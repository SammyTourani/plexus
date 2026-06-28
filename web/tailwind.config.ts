import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // GitHub dark palette
        canvas: {
          DEFAULT: '#0d1117',
          subtle: '#161b22',
          inset: '#010409',
        },
        border: {
          DEFAULT: '#30363d',
          subtle: '#21262d',
          muted: '#1c2128',
        },
        fg: {
          DEFAULT: '#e6edf3',
          muted: '#8b949e',
          subtle: '#6e7681',
          on_emphasis: '#ffffff',
        },
        accent: {
          fg: '#8B5CF6',
          emphasis: '#7c3aed',
          muted: 'rgba(139,92,246,0.15)',
          subtle: 'rgba(139,92,246,0.08)',
        },
        success: {
          fg: '#3fb950',
          muted: 'rgba(63,185,80,0.15)',
        },
        danger: {
          fg: '#f85149',
          muted: 'rgba(248,81,73,0.15)',
        },
        attention: {
          fg: '#d29922',
          muted: 'rgba(210,153,34,0.15)',
        },
        done: {
          fg: '#8957e5',
        },
        // Service group colors
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.25s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'count-up': 'countUp 0.6s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        countUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      boxShadow: {
        'inset-border': 'inset 0 0 0 1px rgba(48,54,61,1)',
        'glow-accent': '0 0 0 3px rgba(139,92,246,0.3)',
        'glow-sm': '0 0 12px rgba(139,92,246,0.2)',
        'panel': '0 8px 32px rgba(1,4,9,0.6)',
      },
    },
  },
  plugins: [],
}

export default config
