import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: "#3C3B6E",
          "blue-dark": "#2a2950",
          "blue-light": "#4e4d8f",
          red: "#B22234",
          "red-dark": "#8b1a28",
          "red-light": "#cc2a3e",
          navy: "#1B2B5E",
          "navy-dark": "#121e42",
          gold: "#C9A84C",
          "gold-light": "#e0c070",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
