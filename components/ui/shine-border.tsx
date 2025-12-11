"use client"

import type React from "react"
import { cn } from "@/lib/utils"

type TColorProp = string | string[]

interface ShineBorderProps {
  borderRadius?: number
  borderWidth?: number
  duration?: number
  color?: TColorProp
  className?: string
  children: React.ReactNode
}

export function ShineBorder({
  borderRadius = 16,
  borderWidth = 2,
  duration = 14,
  color = "#000000",
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          "--border-radius": `${borderRadius}px`,
          "--border-width": `${borderWidth}px`,
          "--shine-duration": `${duration}s`,
          "--background-radial-gradient": `radial-gradient(transparent, transparent, ${
            Array.isArray(color) ? color.join(",") : color
          }, transparent, transparent)`,
        } as React.CSSProperties
      }
      className={cn(
        "relative w-full overflow-visible rounded-[var(--border-radius)] bg-card", 
        // ❗ bg-card 제거됨
        className,
      )}
    >
      {/* border glow layer */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[var(--border-radius)]"
        style={{
          padding: "var(--border-width)",
          background: "var(--background-radial-gradient)",
          backgroundSize: "300% 300%",
          animation: "shine var(--shine-duration) linear infinite",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />

      {/* children */}
      <div className="relative z-10 rounded-[var(--border-radius)]">
        {children}
      </div>
    </div>
  )
}
