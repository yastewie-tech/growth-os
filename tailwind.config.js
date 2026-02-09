export default {
  darkMode: ["class"],
  content: ["./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // --- NEW DESIGN SYSTEM TOKENS ---
        design: {
          background: "#F5F8F7",
          lavender: "#E9D9F7",
          pink: "#FDE8F0", 
          blue: "#E6F4FF",
          text: {
             DEFAULT: "#111827",
             muted: "#6B7280",
          }
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // --- NEW RADIUS ---
        "2xl": "1.5rem", // 24px
        "3xl": "2rem",   // 32px
      },
      boxShadow: {
        "soft": "0 10px 30px -5px rgba(0,0,0,0.05)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};