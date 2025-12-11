"use client"

import { useState, useEffect, useCallback } from "react"

export type MissionStatus = "not_started" | "in_progress" | "completed"

export interface DailyMissionState {
  dateKey: string
  todayHighlightsCount: number
  todayCircleSharesCount: number
  status: MissionStatus
  hasShownCompletionToast: boolean
}

const STORAGE_KEY = "scaaf-daily-mission"

function getDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function computeStatus(highlights: number, shares: number): MissionStatus {
  if (highlights === 0 && shares === 0) return "not_started"
  if (highlights >= 1 && shares >= 1) return "completed"
  return "in_progress"
}

function getInitialState(): DailyMissionState {
  const today = getDateKey()

  if (typeof window === "undefined") {
    return {
      dateKey: today,
      todayHighlightsCount: 0,
      todayCircleSharesCount: 0,
      status: "not_started",
      hasShownCompletionToast: false,
    }
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as DailyMissionState
      // Check if stored date is today
      if (parsed.dateKey === today) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Reset for new day
  return {
    dateKey: today,
    todayHighlightsCount: 0,
    todayCircleSharesCount: 0,
    status: "not_started",
    hasShownCompletionToast: false,
  }
}

export function useDailyMission() {
  const [state, setState] = useState<DailyMissionState>(getInitialState)

  // Persist to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  // Check for day change on mount and periodically
  useEffect(() => {
    const checkDayChange = () => {
      const today = getDateKey()
      if (state.dateKey !== today) {
        setState({
          dateKey: today,
          todayHighlightsCount: 0,
          todayCircleSharesCount: 0,
          status: "not_started",
          hasShownCompletionToast: false,
        })
      }
    }

    // Check every minute for day change
    const interval = setInterval(checkDayChange, 60000)
    return () => clearInterval(interval)
  }, [state.dateKey])

  const incrementHighlights = useCallback(() => {
    setState((prev) => {
      const newHighlights = prev.todayHighlightsCount + 1
      const newStatus = computeStatus(newHighlights, prev.todayCircleSharesCount)
      return {
        ...prev,
        todayHighlightsCount: newHighlights,
        status: newStatus,
      }
    })
  }, [])

  const incrementCircleShares = useCallback(() => {
    setState((prev) => {
      const newShares = prev.todayCircleSharesCount + 1
      const newStatus = computeStatus(prev.todayHighlightsCount, newShares)
      return {
        ...prev,
        todayCircleSharesCount: newShares,
        status: newStatus,
      }
    })
  }, [])

  const markCompletionToastShown = useCallback(() => {
    setState((prev) => ({
      ...prev,
      hasShownCompletionToast: true,
    }))
  }, [])

  return {
    state,
    incrementHighlights,
    incrementCircleShares,
    markCompletionToastShown,
  }
}
