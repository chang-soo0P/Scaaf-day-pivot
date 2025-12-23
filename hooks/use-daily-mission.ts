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
const EVENT_NAME = "scaaf-daily-mission:update"

function getDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function computeStatus(highlights: number, shares: number): MissionStatus {
  if (highlights === 0 && shares === 0) return "not_started"
  if (highlights >= 1 && shares >= 1) return "completed"
  return "in_progress"
}

function safeParse(v: string | null): DailyMissionState | null {
  if (!v) return null
  try {
    return JSON.parse(v) as DailyMissionState
  } catch {
    return null
  }
}

function freshStateForToday(today: string): DailyMissionState {
  return {
    dateKey: today,
    todayHighlightsCount: 0,
    todayCircleSharesCount: 0,
    status: "not_started",
    hasShownCompletionToast: false,
  }
}

function normalizeToToday(state: DailyMissionState, today: string): DailyMissionState {
  if (state.dateKey === today) return state
  return freshStateForToday(today)
}

function getInitialState(): DailyMissionState {
  const today = getDateKey()

  if (typeof window === "undefined") return freshStateForToday(today)

  const parsed = safeParse(localStorage.getItem(STORAGE_KEY))
  if (parsed) return normalizeToToday(parsed, today)
  return freshStateForToday(today)
}

function writeState(next: DailyMissionState) {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  // 같은 탭/SPA에서도 즉시 반영되도록 커스텀 이벤트
  window.dispatchEvent(new Event(EVENT_NAME))
}

/**
 * ✅ 다른 페이지(이메일 상세 등)에서 “오늘 하이라이트 1 증가” 처리를 쉽게 하기 위한 helper
 * 사용 예:
 *   import { bumpDailyMissionHighlights } from "@/hooks/use-daily-mission"
 *   bumpDailyMissionHighlights()
 */
export function bumpDailyMissionHighlights(delta: number = 1) {
  if (typeof window === "undefined") return
  const today = getDateKey()
  const current = safeParse(localStorage.getItem(STORAGE_KEY)) ?? freshStateForToday(today)
  const normalized = normalizeToToday(current, today)

  const nextHighlights = Math.max(0, normalized.todayHighlightsCount + delta)
  const nextStatus = computeStatus(nextHighlights, normalized.todayCircleSharesCount)

  writeState({
    ...normalized,
    todayHighlightsCount: nextHighlights,
    status: nextStatus,
  })
}

/**
 * ✅ 다른 페이지에서 “오늘 Circle Share 1 증가” 처리 helper
 */
export function bumpDailyMissionCircleShares(delta: number = 1) {
  if (typeof window === "undefined") return
  const today = getDateKey()
  const current = safeParse(localStorage.getItem(STORAGE_KEY)) ?? freshStateForToday(today)
  const normalized = normalizeToToday(current, today)

  const nextShares = Math.max(0, normalized.todayCircleSharesCount + delta)
  const nextStatus = computeStatus(normalized.todayHighlightsCount, nextShares)

  writeState({
    ...normalized,
    todayCircleSharesCount: nextShares,
    status: nextStatus,
  })
}

export function useDailyMission() {
  const [state, setState] = useState<DailyMissionState>(getInitialState)

  // localStorage 변경(다른 페이지/다른 탭) 반영
  useEffect(() => {
    if (typeof window === "undefined") return

    const syncFromStorage = () => {
      const today = getDateKey()
      const parsed = safeParse(localStorage.getItem(STORAGE_KEY))
      const next = normalizeToToday(parsed ?? freshStateForToday(today), today)
      setState(next)
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      syncFromStorage()
    }

    const onCustom = () => syncFromStorage()

    window.addEventListener("storage", onStorage)
    window.addEventListener(EVENT_NAME, onCustom)

    // mount 시 1회 동기화
    syncFromStorage()

    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(EVENT_NAME, onCustom)
    }
  }, [])

  // 날짜 변경 체크 (자정 넘어가면 리셋)
  useEffect(() => {
    const interval = setInterval(() => {
      const today = getDateKey()
      setState((prev) => {
        if (prev.dateKey === today) return prev
        const next = freshStateForToday(today)
        writeState(next)
        return next
      })
    }, 60000)

    return () => clearInterval(interval)
  }, [])

  // Persist (이 훅을 통해 바꿀 때도 localStorage 동기화)
  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const incrementHighlights = useCallback(() => {
    setState((prev) => {
      const today = getDateKey()
      const normalized = normalizeToToday(prev, today)
      const nextHighlights = normalized.todayHighlightsCount + 1
      const nextStatus = computeStatus(nextHighlights, normalized.todayCircleSharesCount)

      const next = { ...normalized, todayHighlightsCount: nextHighlights, status: nextStatus }
      writeState(next)
      return next
    })
  }, [])

  const incrementCircleShares = useCallback(() => {
    setState((prev) => {
      const today = getDateKey()
      const normalized = normalizeToToday(prev, today)
      const nextShares = normalized.todayCircleSharesCount + 1
      const nextStatus = computeStatus(normalized.todayHighlightsCount, nextShares)

      const next = { ...normalized, todayCircleSharesCount: nextShares, status: nextStatus }
      writeState(next)
      return next
    })
  }, [])

  const markCompletionToastShown = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, hasShownCompletionToast: true }
      writeState(next)
      return next
    })
  }, [])

  return {
    state,
    incrementHighlights,
    incrementCircleShares,
    markCompletionToastShown,
  }
}
