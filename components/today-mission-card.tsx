"use client"

import { useEffect } from "react"
import { Flame, Highlighter, Share2, Check, ChevronRight } from "lucide-react"
import type { DailyMissionState } from "@/hooks/use-daily-mission"
import { ShineBorder } from "@/components/ui/shine-border"
import { useToast } from "@/hooks/use-toast"

interface TodayMissionCardProps {
  state: DailyMissionState
  onFindHighlight?: () => void
  onShareHighlight?: () => void
  markCompletionToastShown?: () => void
}

export function TodayMissionCard({
  state,
  onFindHighlight,
  onShareHighlight,
  markCompletionToastShown,
}: TodayMissionCardProps) {
  const { toast } = useToast()
  const { status, todayHighlightsCount, todayCircleSharesCount, hasShownCompletionToast } = state

  const highlightDone = todayHighlightsCount >= 1
  const shareDone = todayCircleSharesCount >= 1

  // ✅ 완료 토스트 1회
  useEffect(() => {
    if (status !== "completed") return
    if (hasShownCompletionToast) return

    toast({
      title: "Mission completed 🎉",
      description: "Nice work. Come back tomorrow to keep your streak going.",
    })

    // 1회 표시 처리
    if (typeof markCompletionToastShown === "function") {
      markCompletionToastShown()
    }
  }, [status, hasShownCompletionToast, toast, markCompletionToastShown])

  const shineProps = {
    color: ["#A07CFE", "#FE8FB5", "#FFBE7B"] as string[],
    borderRadius: 16,
    borderWidth: 3,
    duration: 10,
  }

  if (status === "completed") {
    return (
      <ShineBorder className="mb-4 rounded-2xl bg-primary/5 p-4 shadow-sm ring-1 ring-primary/30" {...shineProps}>
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground">Mission completed</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Nice work. Come back tomorrow to keep your streak going.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" />
              Done for today
            </div>
          </div>
        </div>
      </ShineBorder>
    )
  }

  const isInProgress = status === "in_progress"
  const needsHighlight = !highlightDone
  const needsShare = !shareDone

  let title = "Today's mission"
  let description = "Create 1 highlight and share 1 highlight to a Circle to complete today's mission."
  let ctaLabel = "Find something to highlight"
  let ctaAction = onFindHighlight

  if (isInProgress) {
    title = "Keep going"
    if (needsHighlight && !needsShare) {
      description = "You've shared a highlight. Create one more to finish today's mission."
      ctaLabel = "Find something to highlight"
      ctaAction = onFindHighlight
    } else if (!needsHighlight && needsShare) {
      description = "You've created a highlight. Share it to a Circle to finish today's mission."
      ctaLabel = "Share a highlight to a Circle"
      ctaAction = onShareHighlight
    } else {
      description = "You're making progress. Keep going to complete today's mission."
    }
  }

  return (
    <ShineBorder className="mb-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border" {...shineProps}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Flame className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          {/* Progress pills */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                highlightDone ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {highlightDone ? <Check className="h-3 w-3" /> : <Highlighter className="h-3 w-3" />}
              Highlight: {todayHighlightsCount} / 1
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                shareDone ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {shareDone ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
              Share: {todayCircleSharesCount} / 1
            </span>
          </div>

          {/* CTA Button */}
          <button
            onClick={ctaAction}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {ctaLabel}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </ShineBorder>
  )
}
