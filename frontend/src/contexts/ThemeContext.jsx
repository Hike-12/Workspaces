import React, { createContext, useContext, useState } from "react";

const ThemeContext = createContext();

// 🌤️ Light Theme (Premium Off-White / Alice White)
const lightTheme = {
  name: "light",
  colors: {
    background: "#F0F3F8",     // Soft off-white / alice white
    surface: "#FFFFFF",         // Clean white panels/cards
    textPrimary: "#22272E",     // Charcoal for readability
    textSecondary: "#6B7280",   // Muted grey for timestamps / subtext
    accentCool: "#4C9AFF",      // Cool blue for active / highlights
    accentWarm: "#FFB76B",      // Warm golden for badges / highlights
    border: "#E0E4EA",          // Very subtle border
    error: "#E53E3E",
    success: "#16A34A",
    inputBackground: "#FFFFFF",
    shadow: "rgba(0, 0, 0, 0.06)", // soft shadow
  },
  typography: {
    fontFamily: "'Inter', 'Poppins', sans-serif",
    fontSize: "16px",
    headingWeight: 600,
    textWeight: 400,
  },
  effects: {
    transition: "all 0.3s ease",
    hoverGlow: "0 0 10px rgba(76, 154, 255, 0.4)",
  },
};

// 🌙 Dark Theme (Ultra-Dark Navy / Luxe Black)
const darkTheme = {
  name: "dark",
  colors: {
    background: "#0A0D1A",     // Almost black, deep navy hint
    surface: "#111426",         // Slightly lighter panels
    textPrimary: "#E8EAED",     // Off-white text
    textSecondary: "#9CA3AF",   // Soft grey for secondary info
    accentCool: "#4C9AFF",      // Vibrant blue accent
    accentWarm: "#FFB76B",      // Warm gold accent
    border: "#1B1F33",          // subtle border
    error: "#F87171",
    success: "#22C55E",
    inputBackground: "#141830",
    shadow: "rgba(0, 0, 0, 0.5)", // deeper shadow
  },
  typography: {
    fontFamily: "'Inter', 'Poppins', sans-serif",
    fontSize: "16px",
    headingWeight: 600,
    textWeight: 400,
  },
  effects: {
    transition: "all 0.3s ease",
    hoverGlow: "0 0 10px rgba(255, 183, 107, 0.5)", // gold glow
  },
};

// 🌗 Theme Provider
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(lightTheme);

  const toggleTheme = () => {
    setTheme(theme.name === "light" ? darkTheme : lightTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        style={{
          backgroundColor: theme.colors.background,
          color: theme.colors.textPrimary,
          fontFamily: theme.typography.fontFamily,
          fontSize: theme.typography.fontSize,
          transition: theme.effects.transition,
          minHeight: "100vh",
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
