import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1220px"
      }
    },
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        "surface": "hsl(var(--surface))",
        "on-surface": "hsl(var(--on-surface))",
        "primary": "hsl(var(--primary))",
        "on-primary": "hsl(var(--on-primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        "secondary": "hsl(var(--secondary))",
        "on-secondary": "hsl(var(--on-secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        "tertiary": "#006d4a",
        "on-tertiary": "#e6ffee",
        "error": "hsl(var(--destructive))",
        "on-error": "hsl(var(--destructive-foreground))",
        "surface-container-highest": "#d9e4ea",
        "inverse-surface": "#0b0f10",
        "surface-container-high": "#e1e9ee",
        "on-error-container": "#752121",
        "on-background": "#2a3439",
        "outline-variant": "#a9b4b9",
        "surface-container-lowest": "#ffffff",
        "tertiary-dim": "#005f40",
        "secondary-fixed-dim": "#c7d5ed",
        "inverse-on-surface": "#9a9d9f",
        "secondary-container": "#d5e3fc",
        "on-primary-fixed": "#354053",
        "inverse-primary": "#dae6fe",
        "on-secondary-fixed-variant": "#4e5c71",
        "surface-dim": "#cfdce3",
        "on-secondary-container": "#455367",
        "on-primary-fixed-variant": "#515c70",
        "surface-tint": "#545f73",
        "primary-container": "#d8e3fb",
        "on-tertiary-container": "#005a3c",
        "error-dim": "#4e0309",
        "on-primary-container": "#475266",
        "primary-fixed-dim": "#cad5ed",
        "outline": "#717c82",
        "surface-container": "#e8eff3",
        "on-secondary-fixed": "#324053",
        "on-tertiary-fixed": "#00452d",
        "tertiary-fixed-dim": "#58e7ab",
        "secondary-dim": "#465468",
        "tertiary-container": "#69f6b8",
        "error-container": "#fe8983",
        "primary-dim": "#485367",
        "primary-fixed": "#d8e3fb",
        "surface-variant": "#d9e4ea",
        "surface-bright": "#f7f9fb",
        "secondary-fixed": "#d5e3fc",
        "on-tertiary-fixed-variant": "#006544",
        "tertiary-fixed": "#69f6b8",
        "surface-container-low": "#f0f4f7",
        "on-surface-variant": "#566166",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        accent: "hsl(var(--accent))",
        "accent-foreground": "hsl(var(--accent-foreground))"
      },
      fontFamily: {
        "headline": ["var(--font-manrope)", "sans-serif"],
        "body": ["var(--font-inter)", "sans-serif"],
        "label": ["var(--font-inter)", "sans-serif"]
      },
      borderRadius: {
        lg: "0.25rem",
        md: "0.125rem",
        sm: "0.125rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      boxShadow: {
        soft: "0 20px 55px -32px rgba(15, 23, 42, 0.35)",
        custom: "0 12px 32px -4px rgba(42, 52, 57, 0.08)"
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
    }
  },
  plugins: []
};

export default config;