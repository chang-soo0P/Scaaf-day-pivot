"use client"

import { useState, useEffect, useCallback } from "react"

export type MissionStatus = "not_started" | "in_progress" | "completed"

export interface DailyMissionState {
  dateKey: string
  todayHighlightsCount: number
  todayCircleSharesCount: number
  status: MissionStatus
  hasShownCompletionToast: boolean

  /**
   * ✅ 중복 방지용 키 목록
   * - highlightKeys: 같은 날, 같은 이메일에서 여러 번 하이라이트 생성해도 1회만 인정
   * - shareKeys: 같은 날, 같은 이메일을 여러 번 공유해도 1회만 인정
   */
  highlightKeys: string[]
  shareKeys: string[]
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

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/**
 * 현재 URL에서 /inbox/{uuid} 형태의 emailId를 최대한 추출
 * (기존 호출부를 바꾸지 않아도 이메일 단위 dedupe가 되게 하기 위함)
 */
function inferEmailIdFromPath(): string | null {
  if (typeof window === "undefined") return null
  const path = window.location?.pathname ?? ""
  const m = path.match(/\/inbox\/([0-9a-f-]{36})/i)
  const id = m?.[1]
  if (id && isUuid(id)) return id
  return null
}

function normalizeArray(v: any): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []
}

function getInitialState(): DailyMissionState {
  const today = getDateKey()

  const base: DailyMissionState = {
    dateKey: today,
    todayHighlightsCount: 0,
    todayCircleSharesCount: 0,
    status: "not_started",
    hasShownCompletionToast: false,
    highlightKeys: [],
    shareKeys: [],
  }

  if (typeof window === "undefined") return base

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DailyMissionState>

      // 같은 날이면 마이그레이션 + 복구
      if (parsed?.dateKey === today) {
        const highlights = Number(parsed.todayHighlightsCount ?? 0) || 0
        const shares = Number(parsed.todayCircleSharesCount ?? 0) || 0

        const migrated: DailyMissionState = {
          dateKey: today,
          todayHighlightsCount: highlights,
          todayCircleSharesCount: shares,
          status: (parsed.status as MissionStatus) ?? computeStatus(highlights, shares),
          hasShownCompletionToast: Boolean(parsed.hasShownCompletionToast ?? false),
          highlightKeys: normalizeArray((parsed as any).highlightKeys),
          shareKeys: normalizeArray((parsed as any).shareKeys),
        }

        // status가 이상하면 재계산
        migrated.status = computeStatus(migrated.todayHighlightsCount, migrated.todayCircleSharesCount)

        return migrated
      }
    }
  } catch {
    // ignore
  }

  // 새로운 날이면 리셋
  return base
}

export function useDailyMission() {
  const [state, setState] = useState<DailyMissionState>(getInitialState)

  // Persist
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  // Day change watcher
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
          highlightKeys: [],
          shareKeys: [],
        })
      }
    }

    const interval = setInterval(checkDayChange, 60000)
    return () => clearInterval(interval)
  }, [state.dateKey])

  /**
   * ✅ 하이라이트 1회 인정 (이메일 단위 중복 방지)
   * - 기본: 현재 URL에서 /inbox/{emailId} 추출 → `highlight:email:{emailId}`
   * - 인자를 주면 그 값을 키로 사용(확장용)
   */
  const incrementHighlights = useCallback((key?: string) => {
    setState((prev) => {
      const inferredEmailId = inferEmailIdFromPath()
      const dedupeKey = key?.trim()
        ? `highlight:${key.trim()}`
        : inferredEmailId
          ? `highlight:email:${inferredEmailId}`
          : "highlight:global"

      if (prev.highlightKeys.includes(dedupeKey)) {
        return prev // 이미 인정됨
      }

      const nextHighlights = prev.todayHighlightsCount + 1
      const nextShare = prev.todayCircleSharesCount
      const nextStatus = computeStatus(nextHighlights, nextShare)

      return {
        ...prev,
        highlightKeys: [dedupeKey, ...prev.highlightKeys],
        todayHighlightsCount: nextHighlights,
        status: nextStatus,
      }
    })
  }, [])

  /**
   * ✅ 공유 1회 인정 (이메일 단위 중복 방지)
   * - 기본: 현재 URL에서 /inbox/{emailId} 추출 → `share:email:{emailId}`
   * - 인자를 주면 그 값을 키로 사용(확장용: shareKey = `${emailId}:${circleId}` 등)
   */
  const incrementCircleShares = useCallback((key?: string) => {
    setState((prev) => {
      const inferredEmailId = inferEmailIdFromPath()
      const dedupeKey = key?.trim()
        ? `share:${key.trim()}`
        : inferredEmailId
          ? `share:email:${inferredEmailId}`
          : "share:global"

      if (prev.shareKeys.includes(dedupeKey)) {
        return prev // 이미 인정됨
      }

      const nextHighlights = prev.todayHighlightsCount
      const nextShares = prev.todayCircleSharesCount + 1
      const nextStatus = computeStatus(nextHighlights, nextShares)

      return {
        ...prev,
        shareKeys: [dedupeKey, ...prev.shareKeys],
        todayCircleSharesCount: nextShares,
        status: nextStatus,
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
