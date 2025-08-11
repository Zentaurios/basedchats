import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Base Brand Kit Core Colors
        "base-blue": "#0000ff",
        "base-black": "#0a0b0d", 
        "base-white": "#ffffff",
        
        // Base Brand Kit Secondary Colors
        cerulean: "#3c8aff",
        tan: "#b8a581", 
        red: "#fc401f",
        yellow: "#ffd12f",
        pink: "#fea8cd",
        green: "#66c800",
        "lime-green": "#b6f569",
        
        // Base Brand Kit Gray Ramp
        "gray-0": "#ffffff",
        "gray-10": "#eef0f3",
        "gray-15": "#dee1e7", 
        "gray-30": "#b1b7c3",
        "gray-50": "#717886",
        "gray-60": "#5b616e",
        "gray-80": "#32353d",
        "gray-100": "#0a0b0d",
        
        // Semantic theme colors using CSS variables
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        input: "var(--input)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
      },
      animation: {
        "fade-out": "1s fadeOut 3s ease-out forwards",
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
