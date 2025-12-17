"use client"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
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
  TrendingUp,
  Target,
  ChevronRight,
} from "lucide-react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { ShineBorder } from "@/components/ui/shine-border"
import {
  getAllTopics,
  getEmailsByTopicId,
  getTopicStats,
  getTodayActivity,
  getTopicById,
  getEmailsWithRelations,
  type Email,
  type TopicInfo,
  type Reaction,
} from "@/lib/supabase-queries"
import { useDailyMissionStore } from "@/lib/daily-mission-store"

// --- Types ---
type TabType = "byTopics" | "all"
type LayoutMode = "stack" | "grid" | "list"

// --- Derived data from Supabase ---
function useTopicData() {
  const [topicsWithStats, setTopicsWithStats] = useState<Array<TopicInfo & {
    newsletterCount: number
    newCommentsToday: number
    newHighlightsToday: number
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const allTopics = await getAllTopics()
        const topicsWithStatsData = await Promise.all(
          allTopics.map(async (topic) => {
            const stats = await getTopicStats(topic.id)
            const todayActivity = await getTodayActivity(topic.id)
            return {
              ...topic,
              newsletterCount: stats.newsletterCount,
              newCommentsToday: todayActivity.newCommentsToday,
              newHighlightsToday: todayActivity.newHighlightsToday,
            }
          })
        )
        setTopicsWithStats(topicsWithStatsData)
      } catch (error) {
        console.error('Error fetching topic data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { topicsWithStats, loading }
}

function useEmailsForTopic(topicId: string) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getEmailsByTopicId(topicId)
        setEmails(data)
      } catch (error) {
        console.error('Error fetching emails:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [topicId])

  return { emails, loading }
}

// --- Layout Icons ---
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

  // Calculate top reaction from comments
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
      {/* Left: Text Content */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{email.senderName}</p>
        <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 mb-1">
          {email.newsletterTitle}
        </h4>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{email.snippet}</p>
        {/* Reactions/meta row */}
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

      {/* Right: Emoji Thumbnail */}
      {email.issueImageEmoji && (
        <div className="relative h-16 w-16 shrink-0 rounded-xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center">
          <span className="text-2xl">{email.issueImageEmoji}</span>
        </div>
      )}
    </div>
  )
}

function NewsletterCard({ email }: { email: Email }) {
  const stats = {
    highlightCount: email.highlights.length,
    commentCount: email.comments.length,
  }

  // Calculate top reaction
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

  return (
    <Link href={`/inbox/${email.id}`}>
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-md">
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
  )
}

function TopicNewsletterCard({
  newsletter,
}: {
  newsletter: {
    id: string
    name: string
    subject: string
    receivedTime: string
    oneLiner: string
    topic: string
    thumbnail: string
  }
}) {
  return (
    <Link href={`/inbox/${newsletter.id}`}>
      <div className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
        {/* Left side - text content */}
        <div className="flex flex-1 min-w-0 flex-col justify-between">
          {/* Source name */}
          <span className="text-xs text-muted-foreground truncate mb-1">{newsletter.name}</span>

          {/* Large bold subject/headline */}
          <h3 className="text-base font-semibold leading-snug line-clamp-2 text-card-foreground">
            {newsletter.subject}
          </h3>

          {/* Topic chip and time */}
          <div className="flex items-center gap-2 mt-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {newsletter.topic}
            </span>
            <span className="text-xs text-muted-foreground">{newsletter.receivedTime}</span>
          </div>
        </div>

        {/* Right side - thumbnail */}
        <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">
          <Image src={newsletter.thumbnail || "/placeholder.svg"} alt="" fill className="object-cover" />
        </div>
      </div>
    </Link>
  )
}

// --- Topic Detail View (AI Summary + Key Points + Newsletters) ---
function TopicDetailView({
  topic,
  emails,
  onBack,
}: {
  topic: TopicInfo
  emails: Email[]
  onBack: () => void
}) {
  const router = useRouter()

  return (
    <div className="flex flex-col min-h-full">
      {/* Header with back button */}
      <div className="sticky top-0 z-10 bg-background pt-4 pb-2 px-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to topics
        </button>
      </div>

      <div className="flex-1 px-4 pb-24">
        {/* Topic Heading */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Hash className="h-6 w-6" />
            {topic.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{emails.length} newsletters this week</p>
        </div>

        {/* AI Summary Card with ShineBorder */}
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

        {/* Key Points */}
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

        {/* Share to Circle button */}
        <button className="w-full mb-6 flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors">
          <Share2 className="h-4 w-4" />
          Share to circle
        </button>

        {/* From these newsletters */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">From these newsletters</h3>
          <div className="space-y-3">
            {emails.map((email) => (
              <div
                key={email.id}
                onClick={() => router.push(`/inbox/${email.id}`)}
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

function StackLayout({
  emails,
  onCardClick,
}: {
  emails: Email[]
  onCardClick: (emailId: string) => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 100
    const velocity = info.velocity.x
    const offset = info.offset.x

    if (Math.abs(offset) > threshold || Math.abs(velocity) > 500) {
      // Move to next card
      setCurrentIndex((prev) => (prev + 1) % emails.length)
    }

    // Add slight delay before resetting isDragging to prevent click
    setTimeout(() => {
      setIsDragging(false)
    }, 100)
  }

  const visibleCards = emails.slice(currentIndex, currentIndex + 3)
  if (visibleCards.length < 3) {
    visibleCards.push(...emails.slice(0, 3 - visibleCards.length))
  }

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
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25,
                }}
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

      {/* Pagination dots */}
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

function MasonryGrid({
  emails,
  onCardClick,
}: {
  emails: Email[]
  onCardClick: (emailId: string) => void
}) {
  const leftColumn: Email[] = []
  const rightColumn: Email[] = []

  emails.forEach((email, index) => {
    if (index % 2 === 0) {
      leftColumn.push(email)
    } else {
      rightColumn.push(email)
    }
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

// Emoji background gradients
const emojiGradients = [
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-600",
]

function getGradientForIndex(index: number) {
  return emojiGradients[index % emojiGradients.length]
}

// --- Retention Header Components ---
function TodaysDigestCard({ onOpenToday }: { onOpenToday: () => void }) {
  // Mock data for today's activity
  const todayStats = {
    issuesCount: 7,
    commentsCount: 12,
    topTopic: "AI",
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 ring-1 ring-primary/20">
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <CalendarDays className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground">Today's Digest</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your friends are active! 3 new highlights shared this morning.
          </p>
        </div>
      </div>

      {/* Pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
          <TrendingUp className="h-3 w-3 text-primary" />
          {todayStats.issuesCount} issues
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
          <MessageCircle className="h-3 w-3 text-blue-500" />
          {todayStats.commentsCount} comments
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border">
          <Hash className="h-3 w-3 text-amber-500" />
          {todayStats.topTopic}
        </span>
      </div>

      {/* CTA */}
      <button
        onClick={onOpenToday}
        className="w-full flex items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Open today's emails
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function DailyMissionCard() {
  const { commentsToday, goal, streakCount } = useDailyMissionStore()

  const mission = {
    title: "Leave 1 comment today",
    current: commentsToday,
    target: goal,
  }
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

      {/* Progress bar */}
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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("byTopics")
  const [selectedTopicId, setSelectedTopicId] = useState<string>("")
  const [layout, setLayout] = useState<LayoutMode>("list")
  const [showTopicDetail, setShowTopicDetail] = useState(false)
  const [allEmails, setAllEmails] = useState<Email[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicInfo | null>(null)
  const [allEmailsLoading, setAllEmailsLoading] = useState(true)

  const { topicsWithStats, loading: topicsLoading } = useTopicData()
  const { emails: selectedTopicEmails, loading: emailsLoading } = useEmailsForTopic(selectedTopicId)

  // Set initial topic ID when topics are loaded
  useEffect(() => {
    if (topicsWithStats.length > 0 && !selectedTopicId) {
      setSelectedTopicId(topicsWithStats[0].id)
    }
  }, [topicsWithStats, selectedTopicId])

  // Fetch selected topic details
  useEffect(() => {
    if (selectedTopicId) {
      getTopicById(selectedTopicId).then(setSelectedTopic)
    }
  }, [selectedTopicId])

  // Fetch all emails for "All" tab
  useEffect(() => {
    async function fetchAllEmails() {
      try {
        setAllEmailsLoading(true)
        const emails = await getEmailsWithRelations()
        setAllEmails(emails)
      } catch (error) {
        console.error('Error fetching all emails:', error)
      } finally {
        setAllEmailsLoading(false)
      }
    }
    fetchAllEmails()
  }, [])

  const handleTopicHeadingClick = () => {
    setShowTopicDetail(true)
  }

  const handleIssueCardClick = () => {
    // Click on issue card also shows topic detail
    setShowTopicDetail(true)
  }

  const handleOpenTodayEmails = () => {
    setActiveTab("all")
  }

  // Loading state
  if (topicsLoading || (selectedTopicId && emailsLoading)) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // If showing topic detail view
  if (showTopicDetail && selectedTopic) {
    return (
      <TopicDetailView topic={selectedTopic} emails={selectedTopicEmails} onBack={() => setShowTopicDetail(false)} />
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground">Your newsletters, organized</p>
      </div>

      <div className="px-4 py-3 space-y-3">
        <TodaysDigestCard onOpenToday={handleOpenTodayEmails} />
        <DailyMissionCard />
      </div>

      {/* Tab Switcher */}
      <div className="sticky top-0 z-10 bg-background pt-2 pb-2">
        <div className="mx-4 flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setActiveTab("byTopics")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "byTopics"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
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
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-24">
        {activeTab === "byTopics" ? (
          <>
            {/* Horizontal topic pills */}
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

            {/* Topic heading and view toggle */}
            <div className="flex items-start justify-between mb-4">
              <button onClick={handleTopicHeadingClick} className="text-left hover:opacity-80 transition-opacity">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-1">
                  <Hash className="h-5 w-5" />
                  {topicsWithStats.find((t) => t.id === selectedTopicId)?.name || 'Loading...'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {emailsLoading ? 'Loading...' : `${selectedTopicEmails.length} issues today`}
                </p>
              </button>

              {/* View mode toggle */}
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

            {/* Issue cards based on layout */}
            {emailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading emails...</p>
              </div>
            ) : selectedTopicEmails.length === 0 ? (
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
          /* All tab */
          <div className="flex flex-col gap-4">
            {allEmailsLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">Loading emails...</p>
              </div>
            ) : allEmails.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">No emails found</p>
              </div>
            ) : (
              allEmails.map((email) => (
                <NewsletterCard key={email.id} email={email} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
