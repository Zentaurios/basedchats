import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Base Brand Core Palette
        'base-blue': '#0000ff', // RGB native blue - our anchor
        'base-cerulean': '#3c8aff',
        
        // Base Brand Grays
        'base-gray': {
          0: '#ffffff',
          10: '#eef0f3', 
          15: '#dee1e7',
          30: '#b1b7c3',
          50: '#717886',
          60: '#5b616e', 
          80: '#32353d',
          100: '#0a0b0d'
        },
        
        // Base Brand Secondary Colors
        'base-tan': '#b8a581',
        'base-yellow': '#ffd12f',
        'base-green': '#66c800',
        'base-lime': '#b6f569', 
        'base-red': '#fc401f',
        'base-pink': '#fea8cd',
        
        // Semantic colors using Base palette
        primary: '#0000ff',      // Base Blue
        secondary: '#3c8aff',    // Cerulean
        accent: '#66c800',       // Green
        warning: '#ffd12f',      // Yellow
        danger: '#fc401f',       // Red
        success: '#66c800',      // Green
        
        // Theme-aware colors
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
  darkMode: ['class']
} satisfies Config

export default config
