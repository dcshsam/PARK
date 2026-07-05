"use client";

import { cn } from "@/lib/utils";

interface SapHeroBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SapHeroBackground({ children, className, contentClassName }: SapHeroBackgroundProps) {
  return (
    <div className={cn("relative isolate overflow-hidden", className)}>
      {/* Light Salesforce-blue tinted base gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            "linear-gradient(135deg, #ffffff 0%, #f3faff 45%, #eaf5fe 75%, #d9ecfd 100%)",
        }}
      />

      {/* Soft mesh orbs */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="sap-float absolute -left-[15%] -top-[15%] h-[70vh] w-[70vh] rounded-full opacity-50 blur-3xl"
          style={{
            background: "radial-gradient(circle, #9DC8F5 0%, #cfe9ff 40%, transparent 70%)",
            animationDuration: "12s",
          }}
        />
        <div
          className="sap-float-reverse absolute -right-[10%] top-[10%] h-[55vh] w-[55vh] rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, #63B3FF 0%, #9dc8f5 40%, transparent 70%)",
            animationDuration: "16s",
          }}
        />
        <div
          className="sap-float absolute bottom-[0%] left-[25%] h-[50vh] w-[50vh] rounded-full opacity-40 blur-3xl"
          style={{
            background: "radial-gradient(circle, #cfe9ff 0%, #eaf5fe 40%, transparent 70%)",
            animationDuration: "18s",
          }}
        />
        <div
          className="sap-pulse absolute right-[20%] top-[40%] h-[30vh] w-[30vh] rounded-full opacity-30 blur-2xl"
          style={{
            background: "radial-gradient(circle, #ffffff 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Soft hairline grid, fading out toward the edges */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(1,118,211,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(1,118,211,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(circle at 50% 0%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 0%, black 0%, transparent 75%)",
        }}
      />

      {/* Content wrapper */}
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </div>
  );
}
