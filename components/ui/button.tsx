import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            "bg-primary-600 text-white shadow-sm hover:bg-primary-700 hover:shadow-md": variant === "primary",
            "bg-surface-muted text-text-primary hover:bg-border": variant === "secondary",
            "border border-border-strong bg-surface text-text-primary hover:bg-surface-muted": variant === "outline",
            "text-text-secondary hover:bg-surface-muted hover:text-text-primary": variant === "ghost",
            "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md": variant === "danger",
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
