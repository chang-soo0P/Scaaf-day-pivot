"use client"

import { Highlighter, Share2, Check } from "lucide-react"
import type { DailyMissionState } from "@/hooks/use-daily-mission"

interface MissionStripProps {
  state: DailyMissionState
}

export function MissionStrip({ state }: MissionStripProps) {
  const { todayHighlightsCount, todayCircleSharesCount, status } = state

  const highlightDone = todayHighlightsCount >= 1
  const shareDone = todayCircleSharesCount >= 1

  if (status === "completed") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2.5 ring-1 ring-primary/30">
        <Check className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-primary">Today's mission complete</span>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl bg-secondary px-3 py-2.5 ring-1 ring-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Today's mission</span>
        <span className="text-[10px] text-muted-foreground/70">1 highlight + 1 share = complete</span>
      </div>
      <div className="mt-2 flex gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-300 ${
            highlightDone
              ? "bg-primary text-primary-foreground scale-105"
              : "border border-border text-muted-foreground"
          }`}
        >
          {highlightDone ? <Check className="h-3 w-3" /> : <Highlighter className="h-3 w-3" />}
          Highlight
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-300 ${
            shareDone ? "bg-primary text-primary-foreground scale-105" : "border border-border text-muted-foreground"
          }`}
        >
          {shareDone ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
          Circle share
        </span>
      </div>
    </div>
  )
}
