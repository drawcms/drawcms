"use client";

import { useState } from "react";
import { Search, CheckCircle2 } from "lucide-react";

interface MotionPresetsPanelProps {
  selectedPreset: string | null;
  onSelectPreset: (preset: string) => void;
  type: "node" | "edge";
}

export function MotionPresetsPanel({
  selectedPreset,
  onSelectPreset,
  type,
}: MotionPresetsPanelProps) {
  const edgePresets = [
    {
      id: "Pulse",
      name: "Pulse",
      render: () => (
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center relative">
          <div className="absolute w-full h-full rounded-full border-2 border-primary/30 animate-ping opacity-20"></div>
          <div className="w-6 h-6 rounded-full bg-primary"></div>
          <div className="w-3 h-3 rounded-full bg-primary absolute"></div>
        </div>
      ),
    },
    {
      id: "Data Flow",
      name: "Data Flow",
      render: () => (
        <div className="w-12 h-10 relative flex items-center justify-center">
          <svg viewBox="0 0 50 30" className="w-full h-full overflow-visible">
            <path
              d="M 5 5 C 25 5, 25 25, 45 25"
              fill="none"
              stroke="#63d2a4"
              strokeWidth="3"
              strokeDasharray="4 4"
            />
            <circle cx="5" cy="5" r="4" fill="#0c8c5e" />
            <circle cx="25" cy="15" r="3" fill="#0c8c5e" />
            <polygon points="42,21 48,25 42,29" fill="#0c8c5e" />
          </svg>
        </div>
      ),
    },
    {
      id: "Sequence Flow",
      name: "Sequence Flow",
      render: () => (
        <div className="flex h-10 w-12 items-center justify-center">
          <svg viewBox="0 0 52 30" className="h-full w-full overflow-visible" aria-hidden="true">
            <path
              d="M 4 15 H 45"
              fill="none"
              stroke="#475569"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M 40 10 L 48 15 L 40 20" fill="none" stroke="#475569" strokeWidth="2" />
            <circle cx="25" cy="15" r="4" fill="#0c8c5e" stroke="white" strokeWidth="2" />
          </svg>
        </div>
      ),
    },
    {
      id: "Sequential Glow",
      name: "Sequential Glow",
      render: () => (
        <div className="flex gap-1 items-center">
          <div className="w-4 h-4 rounded-full bg-primary shadow-[0_0_10px_rgba(249,115,22,0.8)]"></div>
          <div className="w-4 h-4 rounded-full bg-primary"></div>
          <div className="w-4 h-4 rounded-full bg-primary/30"></div>
        </div>
      ),
    },
    {
      id: "Fade Path",
      name: "Fade Path",
      render: () => (
        <div className="w-12 h-4 relative flex items-center">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-transparent via-primary/40 to-primary"></div>
        </div>
      ),
    },
    {
      id: "Orbit",
      name: "Orbit",
      render: () => (
        <div className="relative w-10 h-10 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/25 to-primary"></div>
          <div className="absolute w-12 h-12 rounded-full border border-primary/30 -rotate-12 scale-y-50"></div>
          <div className="absolute w-2 h-2 rounded-full bg-primary top-1 right-1"></div>
        </div>
      ),
    },
  ];

  const nodePresets = [
    {
      id: "Bounce",
      name: "Bounce",
      render: () => (
        <div className="w-10 h-10 bg-accent border-2 border-primary rounded-lg animate-bounce"></div>
      ),
    },
    {
      id: "Spin",
      name: "Spin",
      render: () => (
        <div className="w-10 h-10 bg-accent border-2 border-primary rounded-lg animate-spin"></div>
      ),
    },
    {
      id: "Pulse Node",
      name: "Pulse",
      render: () => (
        <div className="w-10 h-10 bg-accent border-2 border-primary rounded-lg animate-pulse"></div>
      ),
    },
    {
      id: "Shake",
      name: "Shake",
      render: () => (
        <div
          className="w-10 h-10 bg-accent border-2 border-primary rounded-lg"
          style={{ animation: "shake 0.5s infinite" }}
        >
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              25% { transform: translateX(-4px) rotate(-5deg); }
              75% { transform: translateX(4px) rotate(5deg); }
            }
          `}</style>
        </div>
      ),
    },
  ];

  const presets = type === "edge" ? edgePresets : nodePresets;
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePresets = normalizedQuery
    ? presets.filter((preset) => preset.name.toLowerCase().includes(normalizedQuery))
    : presets;

  return (
    <div className="z-10 flex h-full w-72 max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="p-5 border-b border-border">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Motion presets</h2>
          {selectedPreset && (
            <button
              type="button"
              onClick={() => onSelectPreset("")}
              className="min-h-10 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-100 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Remove
            </button>
          )}
        </div>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={16}
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Motion Presets"
            aria-label="Search motion presets"
            className="min-h-10 w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {visiblePresets.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No presets match “{query.trim()}”.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visiblePresets.map((preset) => (
              <button
                type="button"
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                aria-pressed={selectedPreset === preset.id}
                className={`min-h-28 bg-muted border ${
                  selectedPreset === preset.id
                    ? "border-primary"
                    : "border-border hover:border-primary/30"
                } relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                {selectedPreset === preset.id && (
                  <div className="absolute top-2 right-2 text-primary">
                    <CheckCircle2 size={16} className="fill-primary text-white" />
                  </div>
                )}
                {preset.render()}
                <span className="text-xs font-medium text-foreground text-center leading-tight">
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
