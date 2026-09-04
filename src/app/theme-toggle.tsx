"use client";

import { useEffect, useState } from "react";

type ThemePreference = "light" | "system" | "dark";

const options = [
  { value: "light", label: "Light theme", symbol: "☀" },
  { value: "system", label: "Use system theme", symbol: "◫" },
  { value: "dark", label: "Dark theme", symbol: "☾" },
] as const;

function applyTheme(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = preference;
}

export function ThemeToggle({ hideSystemOnMobile = false }: { hideSystemOnMobile?: boolean }) {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const saved = window.localStorage.getItem("drawcms-theme");
    const initial: ThemePreference =
      saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    applyTheme(initial);
    queueMicrotask(() => setTheme(initial));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((window.localStorage.getItem("drawcms-theme") ?? "system") === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      className="inline-flex rounded-md border border-border bg-card p-1"
      role="group"
      aria-label="Color theme"
    >
      {options.map(({ value, label, symbol }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
          onClick={() => {
            window.localStorage.setItem("drawcms-theme", value);
            setTheme(value);
            applyTheme(value);
          }}
          className={`${hideSystemOnMobile && value === "system" ? "hidden md:flex" : "flex"} size-10 items-center justify-center rounded-sm text-sm transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8 ${
            theme === value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span aria-hidden="true">{symbol}</span>
        </button>
      ))}
    </div>
  );
}
