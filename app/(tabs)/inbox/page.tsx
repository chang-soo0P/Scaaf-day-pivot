"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { emailDetailHref } from "@/lib/email-href"
import {
  ChevronLeft,
  Hash,
  Highlighter,
  MessageCircle,
  Grid3X3,
  LayoutList,
  Layers,
  Share2,
  Sparkles,
  CalendarDays,
  Target,
  ChevronRight,
  Mail,
} from "lucide-react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { ShineBorder } from "@/components/ui/shine-border"
import { useDailyMissionStore } from "@/lib/daily-mission-store"
import { useToast } from "@/hooks/use-toast"

// --- Types ---
type TabType = "byTopics" | "all"
type LayoutMode = "stack" | "grid" | "list"

type Reaction = { emoji: string; count: number }
type Comment = { reactions: Reaction[] }

type Email = {
  id: string
  senderName: string
  newsletterTitle: string
  snippet: string
  receivedAt: string
  receivedAtIso?: string | null
  issueImageEmoji?: string | null
  hasAdSegment?: boolean
  topics: string[]
  highlights: any[]
  comments: Comment[]
}

type TopicInfo = {
  id: string
  name: string
  summary: string
  keyPoints: string[]
  newsletterCount: number
  newCommentsToday: number
  newHighlightsToday: number
}

type InboxEmailRow = {
  id: string
  from_address: string | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  received_at: string | null
  message_id: string | null
  address_id: string | null
  raw: any
}

// --- helpers ---
function safeDomain(from: string) {
  const email = (from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "").toLowerCase()
  const domain = email.split("@")[1] ?? ""
  return domain || "unknown"
}

function formatTime(iso: string | null) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function makeSnippet(text: string | null) {
  const t = (text ?? "").replace(/\s+/g, " ").trim()
  return t.length > 140 ? `${t.slice(0, 140)}…` : t
}

const topicEmojiPool = ["🧠", "📈", "🛠️", "📰", "🧪", "🚀", "💡", "🎯", "🌿", "🔮"]
function emojiForKey(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return topicEmojiPool[h % topicEmojiPool.length]
}
function toTopicId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

// --- fetch hook (5s polling + dedupe + visibility guard + abort overlap) ---
function useInboxEmails(limit = 200, pollMs = 5000) {
  const [rows, setRows] = useState<InboxEmailRow[]>([])
  const [loading, setLoading] = useState(true)
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)

  const pendingToastKeyRef = useRef<string | null>(null)
  const inFlightRef = useRef<AbortController | null>(null)
  const initialLoadedRef = useRef(false)

  async function fetchOnce(isInitial = false) {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return

    if (inFlightRef.current) inFlightRef.current.abort()
    const ac = new AbortController()
    inFlightRef.current = ac

    const res = await fetch(`/api/inbox-emails?limit=${limit}`, {
      cache: "no-store",
      signal: ac.signal,
    }).catch((e) => {
      if (String((e as any)?.name) === "AbortError") return null
      throw e
    })

    if (!res) return

    const json = await res.json()

    if (!res.ok) {
      console.error("Failed to load inbox emails:", json)
      if (isInitial) {
        setRows([])
        setNewCount(0)
      }
      return
    }

    const nextRows: InboxEmailRow[] = json.emails ?? []
    setRows(nextRows)

    const top = nextRows[0]
    const topKey = top ? `${top.id}:${top.received_at ?? ""}` : null

    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true
      const topAt = top?.received_at ?? null
      if (topAt) setLastSeenAt(topAt)
      setNewCount(0)
      pendingToastKeyRef.current = null
      return
    }

    if (!lastSeenAt) {
      const topAt = top?.received_at ?? null
      if (topAt) setLastSeenAt(topAt)
      setNewCount(0)
      pendingToastKeyRef.current = null
      return
    }

    const lastSeenMs = new Date(lastSeenAt).getTime()
    const cnt = nextRows.filter((r) => {
      if (!r.received_at) return false
      return new Date(r.received_at).getTime() > lastSeenMs
    }).length

    setNewCount(cnt)

    if (cnt > 0 && topKey) pendingToastKeyRef.current = topKey
  }

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        setLoading(true)
        await fetchOnce(true)
      } finally {
        if (alive) setLoading(false)
      }
    })()

    const t = setInterval(() => {
      fetchOnce(false).catch(console.error)
    }, pollMs)

    return () => {
      alive = false
      clearInterval(t)
      if (inFlightRef.current) inFlightRef.current.abort()
      inFlightRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, pollMs])

  const markSeenNow = () => {
    const top = rows[0]?.received_at ?? null
    if (top) setLastSeenAt(top)
    setNewCount(0)
    pendingToastKeyRef.current = null
  }

  return { rows, loading, newCount, lastSeenAt, markSeenNow, pendingToastKeyRef }
}

// --- derive UI data from inbox_emails ---
function rowsToUiEmails(rows: InboxEmailRow[]): Email[] {
  return rows.map((r) => {
    const from = r.from_address ?? "Unknown"
    const domain = safeDomain(from)
    const topic = domain === "unknown" ? "Other" : domain
    const title = r.subject ?? "(no subject)"
    const snippet = makeSnippet(r.body_text ?? null)

    return {
      id: r.id,
      senderName: from,
      newsletterTitle: title,
      snippet,
      receivedAt: formatTime(r.received_at),
      receivedAtIso: r.received_at,
      issueImageEmoji: emojiForKey(domain),
      hasAdSegment: false,
      topics: [topic],
      highlights: [],
      comments: [],
    }
  })
}

function buildTopics(emails: Email[]): TopicInfo[] {
  const map = new Map<string, Email[]>()
  emails.forEach((e) => {
    const t = e.topics[0] ?? "Other"
    if (!map.has(t)) map.set(t, [])
    map.get(t)!.push(e)
  })

  const topics: TopicInfo[] = []
  for (const [name, list] of map.entries()) {
    const id = toTopicId(name)
    const latestSubjects = list
      .slice(0, 5)
      .map((x) => x.newsletterTitle)
      .filter(Boolean)

    topics.push({
      id,
      name,
      newsletterCount: list.length,
      newCommentsToday: 0,
      newHighlightsToday: 0,
      summary: `Auto topic generated from sender domain (${name}). ${list.length} newsletters currently.`,
      keyPoints: latestSubjects.length ? latestSubjects : ["No subjects yet"],
    })
  }

  topics.sort((a, b) => b.newsletterCount - a.newsletterCount)
  return topics
}

function filterEmailsByTopicId(emails: Email[], topicId: string) {
  return emails.filter((e) => toTopicId(e.topics[0] ?? "other") === topicId)
}

const layoutIcons = {
  stack: Layers,
  grid: Grid3X3,
  list: LayoutList,
}

// --- Components ---
function IssueCard({
  email,
  onClick,
  isDragging,
}: {
  email: Email
  onClick: () => void
  isDragging?: boolean
}) {
  const stats = {
    highlightCount: email.highlights.length,
    commentCount: email.comments.length,
  }

  const reactionCounts: Record<string, number> = {}
  email.comments.forEach((comment) => {
    comment.reactions.forEach((r) => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + r.count
    })
  })
  let topReaction: Reaction | null = null
  let maxCount = 0
  Object.entries(reactionCounts).forEach(([emoji, count]) => {
    if (count > maxCount) {
      maxCount = count
      topReaction = { emoji, count }
    }
  })

  return (
    <div
      onClick={() => {
        if (!isDragging) onClick()
      }}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/60 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{email.senderName}</p>
        <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
          {email.newsletterTitle}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{email.snippet}</p>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {stats.highlightCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Highlighter className="h-3 w-3" />
              {stats.highlightCount}
            </span>
          )}
          {stats.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" />
              {stats.commentCount}
            </span>
          )}
          {topReaction && (
            <span className="flex items-center gap-0.5">
              {topReaction.emoji} {topReaction.count}
            </span>
          )}
        </div>
      </div>

      {email.issueImageEmoji && (
        <div className="relative h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
          <span className="text-2xl">{email.issueImageEmoji}</span>
        </div>
      )}
    </div>
  )
}

function NewsletterCard({ email, glowNew }: { email: Email; glowNew?: boolean }) {
  const stats = {
    highlightCount: email.highlights.length,
    commentCount: email.comments.length,
  }

  const reactionCounts: Record<string, number> = {}
  email.comments.forEach((comment) => {
    comment.reactions.forEach((r) => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + r.count
    })
  })
  let topEmoji: string | null = null
  let maxCount = 0
  Object.entries(reactionCounts).forEach(([emoji, count]) => {
    if (count > maxCount) {
      maxCount = count
      topEmoji = emoji
    }
  })

  const href = emailDetailHref(email.id)

  return href ? (
    <Link href={href}>
      <div
        className={cn(
          "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60 transition-all duration-500 hover:shadow-md",
          glowNew && "ring-2 ring-primary/35 bg-primary/5 shadow-md",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{email.senderName}</p>
            <h3 className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{email.newsletterTitle}</h3>

            <div className="mt-1.5 flex flex-wrap gap-1">
              {email.topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>

            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{email.snippet}</p>
          </div>

          {email.issueImageEmoji && (
            <div className="relative h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
              <span className="text-xl">{email.issueImageEmoji}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{email.receivedAt}</span>

          {glowNew && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">NEW</span>
          )}

          {stats.highlightCount > 0 && (
            <span className="flex items-center gap-0.5">
              <Highlighter className="h-3 w-3" /> {stats.highlightCount}
            </span>
          )}
          {stats.commentCount > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-3 w-3" /> {stats.commentCount}
            </span>
          )}
          {topEmoji && <span>{topEmoji}</span>}
          {email.hasAdSegment && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">Ad</span>
          )}
        </div>
      </div>
    </Link>
  ) : (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60 opacity-60 cursor-not-allowed">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{email.senderName}</p>
          <h3 className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{email.newsletterTitle}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {email.topics.map((topic) => (
              <span
                key={topic}
                className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                {topic}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{email.snippet}</p>
        </div>
      </div>
    </div>
  )
}

function TopicDetailView({ topic, emails, onBack }: { topic: TopicInfo; emails: Email[]; onBack: () => void }) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 bg-background pt-4 pb-2 px-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Back to topics
        </button>
      </div>

      <div className="flex-1 px-4 pb-24">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Hash className="h-6 w-6" />
            {topic.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{emails.length} newsletters</p>
        </div>

        <ShineBorder
          className="mb-6 rounded-2xl bg-card p-4"
          color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
          borderRadius={16}
          borderWidth={3}
          duration={8}
        >
          <div className="flex items-start gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
              <p className="text-xs text-muted-foreground">Based on {emails.length} newsletters</p>
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{topic.summary}</p>
        </ShineBorder>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">Key Points</h3>
          <ul className="space-y-2">
            {topic.keyPoints.map((point, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-primary font-semibold text-sm mt-0.5">•</span>
                <span className="text-sm text-foreground/80">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <button className="w-full mb-6 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <Share2 className="h-4 w-4" />
          Share to circle
        </button>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">From these newsletters</h3>
          <div className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => {
                  const href = emailDetailHref(email.id) || `/inbox/${email.id}`
                  window.location.href = href
                }}
                className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm ring-1 ring-border/60 cursor-pointer hover:shadow-md transition-shadow"
              >
                {email.issueImageEmoji && (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
                    <span className="text-lg">{email.issueImageEmoji}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{email.senderName}</p>
                  <h4 className="text-sm font-medium text-foreground line-clamp-1">{email.newsletterTitle}</h4>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{email.receivedAt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StackLayout({ emails, onCardClick }: { emails: Email[]; onCardClick: (emailId: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 100
    const velocity = info.velocity.x
    const offset = info.offset.x

    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      setCurrentIndex((prev) => (prev + 1) % emails.length)
    }

    setTimeout(() => setIsDragging(false), 100)
  }

  const visibleCards = emails.slice(currentIndex, currentIndex + 3)
  if (visibleCards.length < 3) visibleCards.push(...emails.slice(0, 3 - visibleCards.length))

  return (
    <div className="relative h-[280px] w-full">
      <LayoutGroup>
        <AnimatePresence mode="popLayout">
          {visibleCards.map((email, index) => {
            const isTop = index === 0
            return (
              <motion.div
                key={`${email.id}-${currentIndex}-${index}`}
                layout
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{
                  scale: 1 - index * 0.05,
                  y: index * 8,
                  zIndex: visibleCards.length - index,
                  opacity: 1 - index * 0.2,
                }}
                exit={{ x: 300, opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                drag={isTop ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.7}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                className="absolute inset-x-0 top-0 cursor-grab active:cursor-grabbing"
                style={{ touchAction: "pan-y" }}
              >
                <IssueCard email={email} onClick={() => onCardClick(email.id)} isDragging={isDragging} />
              </motion.div>
            )
          })}
        </AnimatePresence>
      </LayoutGroup>

      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
        {emails.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentIndex(idx)}
            className={cn(
              "h-1.5 rounded-full transition-all",
              idx === currentIndex % emails.length ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  )
}

function MasonryGrid({ emails, onCardClick }: { emails: Email[]; onCardClick: (emailId: string) => void }) {
  const leftColumn: Email[] = []
  const rightColumn: Email[] = []

  emails.forEach((email, index) => {
    if (index % 2 === 0) leftColumn.push(email)
    else rightColumn.push(email)
  })

  return (
    <div className="flex gap-3">
      <div className="flex-1 flex flex-col gap-3">
        {leftColumn.map((email) => (
          <IssueCard key={email.id} email={email} onClick={() => onCardClick(email.id)} />
        ))}
      </div>
      <div className="flex-1 flex flex-col gap-3">
        {rightColumn.map((email) => (
          <IssueCard key={email.id} email={email} onClick={() => onCardClick(email.id)} />
        ))}
      </div>
    </div>
  )
}

// --- Retention Header Components ---
function TodaysDigestCard({ onOpenToday }: { onOpenToday: () => void }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 ring-1 ring-primary/20">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Today's Digest</h3>
          <p className="text-xs text-muted-foreground mt-0.5">This will become a real daily summary later.</p>
        </div>
      </div>

      <button
        onClick={onOpenToday}
        className="w-full flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Open today&apos;s emails
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function DailyMissionCard() {
  const { commentsToday, goal, streakCount } = useDailyMissionStore()

  const mission = { title: "Leave 1 comment today", current: commentsToday, target: goal }
  const completed = mission.current >= mission.target
  const hasStreakReward = streakCount >= 7

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
            completed ? "bg-green-500/20" : "bg-amber-500/20",
          )}
        >
          <Target className={cn("h-5 w-5", completed ? "text-green-500" : "text-amber-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Daily Mission</h3>
          {completed && hasStreakReward ? (
            <p className="text-xs text-green-500 font-medium truncate">Completed · {streakCount}-day streak! 🔥</p>
          ) : completed && streakCount > 0 ? (
            <p className="text-xs text-green-500 font-medium truncate">Completed · {streakCount}-day streak</p>
          ) : (
            <p className="text-xs text-muted-foreground truncate">{mission.title}</p>
          )}
        </div>
        <div className="text-right">
          <span className={cn("text-sm font-bold", completed ? "text-green-500" : "text-foreground")}>
            {mission.current}/{mission.target}
          </span>
          <p className="text-[10px] text-muted-foreground">{completed ? "Completed!" : "In progress"}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", completed ? "bg-green-500" : "bg-amber-500")}
          style={{ width: `${(mission.current / mission.target) * 100}%` }}
        />
      </div>
    </div>
  )
}

// --- Main Page ---
export default function InboxPage() {
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<TabType>("byTopics")
  const [selectedTopicId, setSelectedTopicId] = useState<string>("")
  const [layout, setLayout] = useState<LayoutMode>("list")
  const [showTopicDetail, setShowTopicDetail] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<TopicInfo | null>(null)

  const { rows, loading, newCount, lastSeenAt, markSeenNow, pendingToastKeyRef } = useInboxEmails(200, 5000)

  const allEmails: Email[] = useMemo(() => rowsToUiEmails(rows), [rows])
  const topicsWithStats: TopicInfo[] = useMemo(() => buildTopics(allEmails), [allEmails])

  const [isAllScrolledDown, setIsAllScrolledDown] = useState(false)
  const allTopRef = useRef<HTMLDivElement>(null)

  const [newOnly, setNewOnly] = useState(false)

  const [transientNewIds, setTransientNewIds] = useState<string[]>([])
  const transientTimerRef = useRef<number | null>(null)

  const NEW_HIGHLIGHT_LIMIT = 3

  const derivedNewIdsSet = useMemo(() => {
    if (!lastSeenAt) return new Set<string>()
    const lastSeenMs = new Date(lastSeenAt).getTime()
    const ids = allEmails
      .filter((e) => e.receivedAtIso && new Date(e.receivedAtIso).getTime() > lastSeenMs)
      .slice(0, NEW_HIGHLIGHT_LIMIT)
      .map((e) => e.id)
    return new Set(ids)
  }, [allEmails, lastSeenAt])

  const effectiveNewIdsSet = useMemo(() => {
    if (transientNewIds.length > 0) return new Set(transientNewIds)
    return derivedNewIdsSet
  }, [transientNewIds, derivedNewIdsSet])

  const hasAnyNew = effectiveNewIdsSet.size > 0 || newCount > 0

  useEffect(() => {
    if (topicsWithStats.length > 0 && !selectedTopicId) setSelectedTopicId(topicsWithStats[0].id)
  }, [topicsWithStats, selectedTopicId])

  useEffect(() => {
    if (!selectedTopicId) return
    setSelectedTopic(topicsWithStats.find((x) => x.id === selectedTopicId) ?? null)
  }, [selectedTopicId, topicsWithStats])

  const selectedTopicEmails = useMemo(
    () => (selectedTopicId ? filterEmailsByTopicId(allEmails, selectedTopicId) : []),
    [allEmails, selectedTopicId],
  )

  const lastNotifiedKeyRef = useRef<string | null>(null)
  const lastNotifiedAtRef = useRef<number>(0)

  useEffect(() => {
    if (loading) return
    if (newCount <= 0) return

    const key = pendingToastKeyRef.current
    if (!key) return

    const now = Date.now()
    if (now - lastNotifiedAtRef.current < 10000) return
    if (lastNotifiedKeyRef.current === key) return

    toast({
      title: "New emails arrived",
      description: `${newCount} new email${newCount > 1 ? "s" : ""} received.`,
    })

    lastNotifiedKeyRef.current = key
    lastNotifiedAtRef.current = now
  }, [newCount, loading, toast, pendingToastKeyRef])

  useEffect(() => {
    if (activeTab !== "all") {
      setIsAllScrolledDown(false)
      return
    }

    const threshold = 120
    const onScroll = () => {
      const y = window.scrollY || 0
      setIsAllScrolledDown(y > threshold)
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [activeTab])

  useEffect(() => {
    if (newOnly && effectiveNewIdsSet.size === 0) setNewOnly(false)
  }, [newOnly, effectiveNewIdsSet])

  useEffect(() => {
    return () => {
      if (transientTimerRef.current) window.clearTimeout(transientTimerRef.current)
      transientTimerRef.current = null
    }
  }, [])

  const handleTopicHeadingClick = () => setShowTopicDetail(true)
  const handleIssueCardClick = () => setShowTopicDetail(true)

  const handleOpenTodayEmails = () => setActiveTab("all")

  const allEmailsToRender = useMemo(() => {
    if (!newOnly) return allEmails
    return allEmails.filter((e) => effectiveNewIdsSet.has(e.id))
  }, [allEmails, newOnly, effectiveNewIdsSet])

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (showTopicDetail && selectedTopic) {
    return <TopicDetailView topic={selectedTopic} emails={selectedTopicEmails} onBack={() => setShowTopicDetail(false)} />
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground">Your newsletters, organized</p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <TodaysDigestCard onOpenToday={handleOpenTodayEmails} />
        <DailyMissionCard />
      </div>

      <div className="sticky top-0 z-10 bg-background pt-2 pb-2">
        <div className="mx-4 flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setActiveTab("byTopics")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "byTopics" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            By topics
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            All
            {newCount > 0 ? (
              <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                +{newCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-24">
        {activeTab === "byTopics" ? (
          <>
            {topicsWithStats.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                {topicsWithStats.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      selectedTopicId === topic.id
                        ? "bg-foreground text-background"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                    )}
                  >
                    {topic.name}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-start justify-between mb-4">
              <button onClick={handleTopicHeadingClick} className="text-left hover:opacity-80 transition-opacity">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-1">
                  <Hash className="h-5 w-5" />
                  {topicsWithStats.find((t) => t.id === selectedTopicId)?.name || "Loading..."}
                </h2>
                <p className="text-sm text-muted-foreground">{`${selectedTopicEmails.length} issues`}</p>
              </button>

              <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
                {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
                  const Icon = layoutIcons[mode]
                  return (
                    <button
                      key={mode}
                      onClick={() => setLayout(mode)}
                      className={cn(
                        "rounded-md p-2 transition-all",
                        layout === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                      )}
                      aria-label={`Switch to ${mode} layout`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedTopicEmails.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">No emails found for this topic</p>
              </div>
            ) : (
              <>
                {layout === "list" && (
                  <div className="space-y-4">
                    {selectedTopicEmails.map((email) => (
                      <IssueCard key={email.id} email={email} onClick={handleIssueCardClick} />
                    ))}
                  </div>
                )}

                {layout === "grid" && <MasonryGrid emails={selectedTopicEmails} onCardClick={handleIssueCardClick} />}

                {layout === "stack" && <StackLayout emails={selectedTopicEmails} onCardClick={handleIssueCardClick} />}
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div ref={allTopRef} />

            {hasAnyNew && (
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {effectiveNewIdsSet.size > 0 ? `New: ${effectiveNewIdsSet.size}` : newCount > 0 ? `New: ${newCount}` : "New"}
                </div>

                <button
                  onClick={() => setNewOnly((v) => !v)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors ring-1 ring-border",
                    newOnly ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                >
                  NEW only
                </button>
              </div>
            )}

            {newCount > 0 && isAllScrolledDown && (
              <button
                onClick={() => {
                  const ids = Array.from(derivedNewIdsSet)
                  setTransientNewIds(ids)

                  if (transientTimerRef.current) window.clearTimeout(transientTimerRef.current)
                  transientTimerRef.current = window.setTimeout(() => setTransientNewIds([]), 2600)

                  allTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  window.scrollTo({ top: 0, behavior: "smooth" })
                  markSeenNow()
                }}
                className="sticky top-2 z-20 flex items-center justify-center gap-2 rounded-xl border border-border bg-card/90 px-4 py-2 text-sm font-semibold text-foreground shadow-sm backdrop-blur hover:bg-card transition-colors"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </span>
                {newCount} new email{newCount > 1 ? "s" : ""} arrived — jump to top
              </button>
            )}

            {allEmailsToRender.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
                    <Mail className="h-5 w-5" />
                  </div>
                  {newOnly ? "No NEW emails to show." : "No emails found yet. Send a newsletter to your @mg.scaaf.day address."}
                </div>
              </div>
            ) : (
              allEmailsToRender.map((email) => (
                <NewsletterCard key={email.id} email={email} glowNew={effectiveNewIdsSet.has(email.id)} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
