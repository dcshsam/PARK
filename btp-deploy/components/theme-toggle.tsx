"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const cycle = () => {
    const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const Icon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      aria-label={`Theme: ${theme}. Click to cycle.`}
      className="gap-2"
    >
      <Icon size={16} />
      {showLabel && (
        <span className="capitalize text-xs">{theme === "system" ? "Auto" : theme}</span>
      )}
    </Button>
  );
}

export function ThemeMenu() {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: "light" | "dark" | "system"; label: string; icon: React.ElementType }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="flex rounded-lg border border-border bg-surface p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            theme === value
              ? "bg-accent-bg text-accent-text"
              : "text-text-secondary hover:text-text-primary"
          }`}
          aria-pressed={theme === value}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  );
}
