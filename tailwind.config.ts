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
        // Keep your existing Base Blue pure
        'base-blue': '#0000ff', // Pure blue #0000ff
        
        // Other base colors without interfering with your system
        'base-cerulean': '#3c8aff',
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
        'base-tan': '#b8a581',
        'base-yellow': '#ffd12f',
        'base-green': '#66c800',
        'base-lime': '#b6f569', 
        'base-red': '#fc401f',
        'base-pink': '#fea8cd',
        
        // Your existing semantic colors (don't override)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
  darkMode: ['class']
} satisfies Config

export default config
