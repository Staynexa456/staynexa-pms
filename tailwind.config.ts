import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#1e293b",
        cream: "#faf7f2",
        "cream-dark": "#f0ebe1",
        gold: "#c9a961",
        "gold-dark": "#a88a45",
      },
    },
  },
  plugins: [],
};

export default config;