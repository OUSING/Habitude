/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    // Mobile-first: Tailwind's default breakpoints (sm, md, lg...) already
    // work bottom-up, we just make sure the app shell never exceeds a
    // phone-sized column even on desktop (see `max-w-app` used in App.tsx).
    extend: {
      colors: {
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--color-surface-2) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          light: "rgb(var(--color-brand-light) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)",
          light: "rgb(var(--color-accent-light) / <alpha-value>)"
        }
      },
      maxWidth: {
        app: "28rem" // 448px — the whole UI lives in this column, centered on desktop
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-left": "env(safe-area-inset-left)",
        "safe-right": "env(safe-area-inset-right)"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Fraunces", "serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      keyframes: {
        "sheet-in": {
          "0%": { transform: "translateY(100%)", opacity: "0.4" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        "pop": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        "burst": {
          "0%": {
            transform: "translate(-50%, -50%) rotate(var(--burst-angle)) translateX(0) scale(1)",
            opacity: "1"
          },
          "100%": {
            transform: "translate(-50%, -50%) rotate(var(--burst-angle)) translateX(22px) scale(0)",
            opacity: "0"
          }
        },
        "ring-pop": {
          "0%": { transform: "translate(-50%, -50%) scale(0.6)", opacity: "0.6", borderWidth: "8px" },
          "100%": { transform: "translate(-50%, -50%) scale(1.6)", opacity: "0", borderWidth: "0px" }
        },
        "check-bounce": {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        "float-slow": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(14px, -18px) scale(1.06)" },
          "66%": { transform: "translate(-10px, 12px) scale(0.96)" }
        },
        "float-slow-reverse": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(-16px, 14px) scale(0.95)" },
          "66%": { transform: "translate(12px, -10px) scale(1.05)" }
        },
        "bubble-rise": {
          "0%": { transform: "translateY(0) translateX(0) scale(0.7)", opacity: "0" },
          "10%": { opacity: "var(--bubble-opacity, 0.5)" },
          "90%": { opacity: "var(--bubble-opacity, 0.5)" },
          "100%": { transform: "translateY(-115vh) translateX(var(--bubble-drift, 20px)) scale(1)", opacity: "0" }
        },
        "icon-drift": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(var(--icon-drift-x, 10px), var(--icon-drift-y, -14px)) rotate(8deg)" }
        }
      },
      animation: {
        "sheet-in": "sheet-in 220ms cubic-bezier(0.32, 0.72, 0, 1)",
        "fade-in": "fade-in 180ms ease-out",
        "pop": "pop 150ms ease-out",
        "burst": "burst 500ms ease-out forwards",
        "ring-pop": "ring-pop 450ms ease-out forwards",
        "check-bounce": "check-bounce 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "float-slow": "float-slow 16s ease-in-out infinite",
        "float-slow-reverse": "float-slow-reverse 20s ease-in-out infinite",
        "bubble-rise": "bubble-rise linear infinite",
        "icon-drift": "icon-drift ease-in-out infinite"
      }
    }
  },
  plugins: []
};
