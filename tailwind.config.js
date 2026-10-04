/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#0A0E12",
        surface: "#12171C",
        surface2: "#171D23",
        border: "#232B31",
        ink: "#F1F5F4",
        dim: "#8B98A0",
        faint: "#57636A",
        accent: "#39FFC6",
        accentInk: "#04140F",
        danger: "#FF6B5E",
        dangerDim: "#3A2320",
      },
      borderRadius: {
        xl2: "20px",
      },
    },
  },
  plugins: [],
};
