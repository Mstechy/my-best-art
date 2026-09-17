import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // Inter is the marketplace body font (style.css body rule).
        // Overriding `sans` fixes the homepage, which used undefined `font-sans`.
        sans: ["'Inter'", "system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        price: "hsl(var(--price))",

        // ─── MarketHub brand layer ────────────────────────────────────
        // Raw `var()` values, NO hsl() wrapper. These are complete colour
        // values from style.css. IMPORTANT: because they're opaque vars,
        // Tailwind opacity modifiers do NOT work on them —
        // `bg-ink/50` emits nothing. Use the HSL-triplet semantic tokens
        // above (`bg-primary/10`, `text-foreground/70`) when you need alpha.
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          foreground: "var(--ink-foreground)",
        },
        paper: "var(--paper)",
        panel: "var(--panel)",
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        // sketch's "muted text" — renamed because shadcn already owns
        // `muted` as a SURFACE. `text-quiet` == muted body copy.
        quiet: "var(--quiet)",
        brand: {
          DEFAULT: "var(--brand)",
          dark: "var(--brand-dark)",
          tint: "var(--brand-tint)",
        },
        deal: {
          DEFAULT: "var(--deal)",
          tint: "var(--deal-tint)",
        },
        ok: {
          DEFAULT: "var(--ok)",
          tint: "var(--ok-tint)",
        },
        star: "var(--star)",
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        seller: {
          DEFAULT: "hsl(var(--seller))",
          foreground: "hsl(var(--seller-foreground))",
        },
        buyer: {
          DEFAULT: "hsl(var(--buyer))",
          foreground: "hsl(var(--buyer-foreground))",
        },
        admin: {
          DEFAULT: "hsl(var(--admin))",
          foreground: "hsl(var(--admin-foreground))",
        },
        navbar: {
          DEFAULT: "hsl(var(--navbar))",
          foreground: "hsl(var(--navbar-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Sketch tokens: 6px / 10px. Named semantically rather than `s`/`m`
        // because `rounded-s` would read as a typo of `rounded-sm`, and
        // Tailwind already reserves the s/e prefix for logical corners.
        chip: "var(--radius-s)",
        card: "var(--radius-m)",
      },
      boxShadow: {
        "glow-seller": "0 0 30px hsl(var(--seller) / 0.15)",
        "glow-buyer": "0 0 30px hsl(var(--buyer) / 0.15)",
        card: "var(--shadow-card)",
        "card-hover": "0 6px 18px rgba(20, 20, 15, .10)",
        header: "0 1px 0 rgba(20, 20, 15, .06)",
        pop: "var(--shadow-pop)",
      },
      spacing: {
        // Enables h-header / top-header / h-catbar for the sticky stack.
        header: "var(--header-h)",
        catbar: "var(--catbar-h)",
      },
      screens: {
        // style.css breaks at 1080px and 760px.
        // 760px → snapped to Tailwind's `md` (768px; 8px drift, imperceptible).
        // 1080px → NO Tailwind equivalent (lg=1024, xl=1280), so it's added.
        xlg: "1080px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-20px) scale(1.02)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "33%": { transform: "translateY(-10px) rotate(1deg)" },
          "66%": { transform: "translateY(-20px) rotate(-1deg)" },
        },
        blob: {
          "0%, 100%": { borderRadius: "60% 40% 30% 70%/60% 30% 70% 40%" },
          "50%": { borderRadius: "30% 60% 70% 40%/50% 60% 30% 60%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 6s ease-in-out infinite",
        "float-slow": "float-slow 8s ease-in-out infinite",
        blob: "blob 7s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "spin-slow": "spin-slow 20s linear infinite",
        "slide-up": "slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
