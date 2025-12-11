"use client"

import { create } from "zustand"

function getTodayKey() {
  // Use local date in YYYY-MM-DD format
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// Helper: how many whole days between two YYYY-MM-DD date strings?
function countDayDiff(from: string, to: string): number {
  const fromDate = new Date(from + "T00:00:00")
  const toDate = new Date(to + "T00:00:00")
  const diffMs = toDate.getTime() - fromDate.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

type DailyMissionState = {
  commentsToday: number
  goal: number
  lastCommentDate: string | null // YYYY-MM-DD or null
  streakCount: number
  incrementComments: () => void
  resetForDebug: () => void
}

export const useDailyMissionStore = create<DailyMissionState>((set, get) => ({
  commentsToday: 0,
  goal: 1,
  lastCommentDate: null,
  streakCount: 0,

  incrementComments: () => {
    const state = get()
    const todayKey = getTodayKey()

    let commentsToday = state.commentsToday
    let lastCommentDate = state.lastCommentDate
    let streakCount = state.streakCount

    if (lastCommentDate === todayKey) {
      // Still the same day – just increment today's comment count
      commentsToday = commentsToday + 1
    } else {
      // New day (or first comment ever)
      if (!lastCommentDate) {
        // First ever comment -> start streak at 1
        streakCount = 1
      } else {
        const diff = countDayDiff(lastCommentDate, todayKey)
        if (diff === 1) {
          // Yesterday + today -> streak continues
          streakCount = streakCount + 1
        } else {
          // Gap of at least 1 day -> reset streak
          streakCount = 1
        }
      }

      // Since it is a new day, reset today's comments and set to 1
      commentsToday = 1
      lastCommentDate = todayKey
    }

    set({
      commentsToday,
      lastCommentDate,
      streakCount,
      goal: state.goal,
    })
  },

  resetForDebug: () =>
    set({
      commentsToday: 0,
      goal: 1,
      lastCommentDate: null,
      streakCount: 0,
    }),
}))
