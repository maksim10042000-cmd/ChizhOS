import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        card: "var(--card)",
        muted: "var(--muted)",
        text: "var(--text)",
        borderc: "var(--border)",
        green: "var(--green)",
        red: "var(--red)",
        amber: "var(--amber)",
        blue: "var(--blue)",
      },
      borderRadius: {
        card: "14px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
