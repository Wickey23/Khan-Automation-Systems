"use client";

import { useEffect, useState } from "react";

const themes = [
  { value: "core-dark", label: "Core Dark" },
  { value: "enterprise-navy", label: "Enterprise Navy" },
  { value: "industrial-charcoal", label: "Industrial Charcoal" },
  { value: "enterprise-light", label: "Enterprise Light" },
  { value: "premium-minimal", label: "Premium Minimal" }
] as const;

type ThemeValue = (typeof themes)[number]["value"];

function isTheme(value: string): value is ThemeValue {
  return themes.some((item) => item.value === value);
}

export function ThemeSwitcher() {
  const [value, setValue] = useState<ThemeValue>("core-dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("khan-theme") : null;
    if (stored && isTheme(stored)) {
      setValue(stored);
      document.documentElement.setAttribute("data-theme", stored);
      return;
    }
    document.documentElement.setAttribute("data-theme", "core-dark");
  }, []);

  return (
    <select
      aria-label="Theme palette"
      className="h-9 rounded-md border border-border bg-card px-2 text-xs text-muted-foreground"
      value={value}
      onChange={(event) => {
        const next = event.target.value as ThemeValue;
        setValue(next);
        document.documentElement.setAttribute("data-theme", next);
        window.localStorage.setItem("khan-theme", next);
      }}
    >
      {themes.map((theme) => (
        <option key={theme.value} value={theme.value}>
          {theme.label}
        </option>
      ))}
    </select>
  );
}

