"use client";

import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("insight-theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
    }
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("insight-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  return (
    <button className="sidebar-theme-toggle" onClick={toggle} aria-label="Toggle theme">
      <span>{theme === "dark" ? "☀" : "☾"}</span>
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
