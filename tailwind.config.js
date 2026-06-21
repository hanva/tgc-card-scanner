/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ygo: {
          bg: "#0d0d1a",
          card: "#16213e",
          gold: "#e6b800",
          "gold-bright": "#ffd700",
          "gold-dark": "#c9a200",
          dm: "#8b5cf6",
          gx: "#f97316",
          owned: "#2d6a4f",
          "owned-text": "#95d5b2",
          danger: "#ff6b6b",
          muted: "#2a2a4e",
          archetype: "#7b68ee",
        },
      },
    },
  },
  plugins: [],
};
