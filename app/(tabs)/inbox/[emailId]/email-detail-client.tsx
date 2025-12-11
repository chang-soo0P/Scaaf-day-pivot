"use client"
import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Highlighter,
  Share2,
  ChevronDown,
  ChevronUp,
  X,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Sparkles,
  MessageSquare,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { ShineBorder } from "@/components/ui/shine-border"
import { FloatingHighlightBar } from "@/components/floating-highlight-bar"
import { getEmailById, type Comment as CommentType } from "@/lib/email-mock-data"
import { useDailyMissionStore } from "@/lib/daily-mission-store"
import { useToast } from "@/hooks/use-toast"

// Mock data and interfaces (will be replaced/supplemented by imports)
// Note: These are retained for now but will largely be superseded by imported data.
// Some might be used for fallback or initial state if imports don't provide everything.
const emailsData: Record<
  string,
  {
    id: string
    sender: string
    subject: string
    topic: string
    date: string
    time: string
    summary: string
    bullets: string[]
    highlights: { quote: string; note?: string }[]
    body: string
  }
> = {
  "1": {
    id: "1",
    sender: "Morning Brew",
    subject: "Apple's AI Push & Market Rally",
    topic: "AI",
    date: "Today",
    time: "7:30 AM",
    summary:
      "Apple announced significant AI integrations across its product lineup, partnering with OpenAI to bring advanced language models to iOS 18. The market responded positively with tech stocks rallying.",
    bullets: [
      "Apple Intelligence will be available on iPhone 15 Pro and later",
      "Partnership with OpenAI for ChatGPT integration",
      "On-device processing for privacy-focused AI features",
      "Siri getting major upgrade with contextual awareness",
    ],
    highlights: [
      { quote: "This is the biggest update to Siri since its introduction.", note: "Tim Cook, CEO" },
      { quote: "Privacy is a fundamental human right, and we've built AI with that principle at its core." },
    ],
    body: `Good morning! Here's what you need to know today.

Apple just dropped the biggest news in AI this week. At WWDC, they unveiled "Apple Intelligence" - their take on bringing AI to your everyday devices.

The key highlights: Siri is getting a brain transplant. The voice assistant will now understand context, remember previous conversations, and actually be useful. Plus, they're partnering with OpenAI to bring ChatGPT directly into iOS when needed.

But here's the catch - you'll need an iPhone 15 Pro or newer to use most features. Apple says the A17 Pro chip is required for on-device AI processing.

The market loved it. Apple stock jumped 7% on the news, and the broader tech sector followed suit. The S&P 500 hit new all-time highs.`,
  },
  "2": {
    id: "2",
    sender: "The Hustle",
    subject: "Startup Funding Hits New High",
    topic: "Startups",
    date: "Today",
    time: "8:15 AM",
    summary:
      "Q2 2024 saw record venture capital deployment with $75B invested globally. AI startups captured 40% of all funding, while climate tech emerged as the second hottest category.",
    bullets: [
      "$75B deployed in Q2 2024, up 23% from Q1",
      "AI startups received $30B in funding",
      "Climate tech raised $12B across 200+ deals",
      "Seed stage valuations reached all-time highs",
    ],
    highlights: [
      { quote: "We're seeing the most competitive seed market in a decade.", note: "A16Z Partner" },
      { quote: "Every pitch deck now has an AI angle - it's become table stakes." },
    ],
    body: `The startup world is heating up again.

After a brutal 2023 where funding dried up and valuations crashed, VCs are back with a vengeance. Q2 2024 saw $75 billion deployed globally - that's the highest quarterly total since the 2021 boom.

Where's all that money going? AI, obviously. Four out of every ten dollars went to AI startups. But the real surprise is climate tech taking the #2 spot, beating out fintech for the first time.

The catch? Most of this money is going to a small number of mega-rounds. The top 10 deals accounted for 35% of all funding. If you're not raising $100M+, it's still a tough market out there.`,
  },
  "3": {
    id: "3",
    sender: "Finimize",
    subject: "Fed Signals Rate Decision",
    topic: "Economy",
    date: "Yesterday",
    time: "6:45 AM",
    summary:
      "Federal Reserve officials hinted at potential rate cuts in September if inflation continues cooling. Markets are now pricing in 75% probability of a 25bps cut.",
    bullets: [
      "Fed Chair Powell emphasized data-dependent approach",
      "Core PCE inflation dropped to 2.6% in May",
      "Labor market showing signs of gradual cooling",
      "Bond yields fell on the dovish commentary",
    ],
    highlights: [
      { quote: "We're not far from the point where it will be appropriate to begin dialing back policy restriction." },
      { quote: "The labor market has come into better balance." },
    ],
    body: `The Fed just dropped some major hints about where rates are headed.

In yesterday's testimony, Chair Powell struck a notably dovish tone. He acknowledged that inflation has made "considerable progress" toward the 2% target and suggested rate cuts could come "fairly soon."

Markets immediately priced in higher odds of a September cut. Bond yields dropped across the curve, with the 10-year falling below 4.2% for the first time in months.

But don't break out the champagne just yet. Powell was careful to note that no decisions have been made and the Fed remains "data dependent." Translation: if inflation surprises to the upside, all bets are off.`,
  },
}

const fallbackEmail = {
  sender: "Newsletter",
  subject: "Today's Update",
  topic: "General",
  date: "Today",
  time: "9:00 AM",
  summary: "Here's what you need to know today.",
  bullets: ["Key point 1", "Key point 2", "Key point 3"],
  highlights: [{ quote: "An interesting quote from today's newsletter." }],
  body: "Thank you for reading today's newsletter. We hope you found it informative and useful.",
}

// Highlight interface for typed highlight data
interface HighlightData {
  id: string
  quote: string
  memo?: string
  createdAt: string
  isShared: boolean
}

// Comment interface for typed comment data
interface CommentData {
  id: string
  author: string
  avatar: string
  content: string
  createdAt: string
  reactions: { emoji: string; count: number; reacted: boolean }[]
}

function isToday(dateStr: string): boolean {
  const today = new Date().toDateString()
  const date = new Date(dateStr).toDateString()
  return today === date
}

function formatTimeOld(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const isToday = date.toDateString() === today.toDateString()
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
  return isToday
    ? `Today ${timeStr}`
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` ${timeStr}`
}

function HighlightCard({
  highlight,
  onRemove,
  onShare,
}: {
  highlight: HighlightData
  onRemove: () => void
  onShare: () => void
}) {
  return (
    <div className="rounded-xl bg-highlight p-4 ring-1 ring-highlight-border">
      <p className="text-sm font-medium leading-relaxed text-foreground/90 line-clamp-3">"{highlight.quote}"</p>

      <p className="mt-2 text-[11px] text-muted-foreground">{formatTimeOld(highlight.createdAt)}</p>

      {highlight.memo && (
        <div className="mt-2 border-t border-highlight-border pt-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            My memo
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{highlight.memo}</p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onShare}
          disabled={highlight.isShared}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            highlight.isShared
              ? "bg-secondary/50 text-muted-foreground cursor-default"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {highlight.isShared ? (
            <>
              <Check className="h-3 w-3" />
              Shared
            </>
          ) : (
            <>
              <Share2 className="h-3 w-3" />
              Share to circle
            </>
          )}
        </button>

        <button
          onClick={onRemove}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Remove
        </button>
      </div>
    </div>
  )
}

function CreateHighlightModal({
  selectedText,
  onSave,
  onClose,
  isManual = false,
}: {
  selectedText: string
  onSave: (quote: string, memo?: string) => void
  onClose: () => void
  isManual?: boolean
}) {
  const [quote, setQuote] = useState(selectedText)
  const [memo, setMemo] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            {isManual ? "Add highlight manually" : "Create highlight"}
          </h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Selected text</label>
          {isManual ? (
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="Paste or type the text you want to highlight..."
              className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
          ) : (
            <div className="rounded-lg bg-highlight p-3 text-sm italic text-foreground/80">"{selectedText}"</div>
          )}
        </div>

        <div className="mb-5">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            My memo <span className="text-muted-foreground/60">(optional, not shared)</span>
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Add a personal note..."
            className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            rows={2}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (quote.trim()) {
                onSave(quote.trim(), memo.trim() || undefined)
              }
            }}
            disabled={!quote.trim()}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save highlight
          </button>
        </div>
      </div>
    </div>
  )
}

function ShareToCircleModal({
  onShare,
  onClose,
}: {
  onShare: (circleName: string) => void
  onClose: () => void
}) {
  const [selectedCircle, setSelectedCircle] = useState<string | null>(null)

  const circles = [
    { id: "1", name: "AI Friends", members: 5 },
    { id: "2", name: "Investing Club", members: 8 },
    { id: "3", name: "Tech News Crew", members: 4 },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Share to circle</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-secondary">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mb-5 space-y-2">
          {circles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => setSelectedCircle(circle.id)}
              className={`w-full rounded-xl p-3 text-left transition-colors ${
                selectedCircle === circle.id
                  ? "bg-primary/10 ring-2 ring-primary"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              <p className="text-sm font-medium text-foreground">{circle.name}</p>
              <p className="text-xs text-muted-foreground">{circle.members} members</p>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedCircle) {
                const circle = circles.find((c) => c.id === selectedCircle)
                if (circle) onShare(circle.name)
              }
            }}
            disabled={!selectedCircle}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Share
          </button>
        </div>
      </div>
    </div>
  )
}

function CommentCard({
  comment,
  onReact,
  onDelete,
  isOwn,
}: {
  comment: CommentData
  onReact: () => void
  onDelete: () => void
  isOwn: boolean
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <img
          src={comment.avatar || "/placeholder.svg"}
          alt={comment.author}
          className="h-8 w-8 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{comment.author}</span>
            <span className="text-xs text-muted-foreground">{formatTimeOld(comment.createdAt)}</span>
          </div>
          <p className="mt-1 text-sm text-foreground/90">{comment.content}</p>

          {/* Reactions display */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {comment.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                onClick={onReact}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                  reaction.reacted
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            ))}

            {/* Add reaction button */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80 text-xs"
              >
                +
              </button>

              {showEmojiPicker && (
                <div className="absolute bottom-full left-0 mb-1 flex gap-1 rounded-lg bg-card p-1.5 shadow-lg ring-1 ring-border z-10">
                  {AVAILABLE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact()
                        setShowEmojiPicker(false)
                      }}
                      className="h-7 w-7 rounded hover:bg-secondary text-base"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete button for own comments */}
            {isOwn && (
              <button onClick={onDelete} className="ml-auto text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const AVAILABLE_EMOJIS = ["👍", "❤️", "🔥", "💡", "👀", "🎯"]

const initialComments: CommentData[] = [
  {
    id: "c1",
    author: "Sarah K.",
    avatar: "/diverse-woman-avatar.png",
    content: "The Apple Intelligence features look promising! Can't wait to try the new Siri.",
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    reactions: [
      { emoji: "👍", count: 3, reacted: false },
      { emoji: "🔥", count: 2, reacted: true },
    ],
  },
  {
    id: "c2",
    author: "Mike T.",
    avatar: "/man-avatar.png",
    content: "Interesting that they require iPhone 15 Pro. Makes sense for on-device processing though.",
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    reactions: [{ emoji: "💡", count: 5, reacted: false }],
  },
]

interface EmailDetailClientProps {
  emailId: string
}

export function EmailDetailClient({ emailId }: EmailDetailClientProps) {
  const [showMoreSummary, setShowMoreSummary] = useState(false)
  // Add state for expanding/collapsing original email
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  // Renamed showCreateModal to showCreateOptions and adjusted logic
  const [showCreateOptions, setShowCreateOptions] = useState(false)
  // Renamed shareHighlightId to highlightToShare
  const [highlightToShare, setHighlightToShare] = useState<string | null>(null)
  // Renamed emailBodyRef to bodyRef
  const bodyRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const sharedEmail = getEmailById(emailId)

  // Local state for highlights and comments (initialized from shared data)
  const [highlights, setHighlights] = useState<Highlight[]>(sharedEmail?.highlights || [])
  const [comments, setComments] = useState<CommentType[]>(sharedEmail?.comments || [])
  const [newComment, setNewComment] = useState("")

  const incrementComments = useDailyMissionStore((state) => state.incrementComments)

  // Fallback email data if not found in shared module
  const email = sharedEmail || {
    id: emailId,
    senderName: "Unknown",
    newsletterTitle: "Email not found",
    subject: "Email not found",
    topics: [],
    topicId: "",
    date: "",
    time: "",
    receivedAt: "",
    snippet: "",
    summary: "This email could not be found.",
    bullets: [],
    body: "No content available.",
    highlights: [],
    comments: [],
  }

  const { toast } = useToast()

  // Adjusted text selection handling to use updated refs and logic
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText(selection.toString().trim())
      // Adjusted position slightly for better UI placement
      setSelectionPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      })
    } else {
      setSelectedText("")
      setSelectionPosition(null)
    }
  }, [])

  useEffect(() => {
    // Simplified event listeners for selection
    document.addEventListener("mouseup", handleTextSelection)
    document.addEventListener("touchend", handleTextSelection)
    return () => {
      document.removeEventListener("mouseup", handleTextSelection)
      document.removeEventListener("touchend", handleTextSelection)
    }
  }, [handleTextSelection])

  // Updated handleHighlight logic
  const handleHighlight = () => {
    if (selectedText) {
      const newHighlight: Highlight = {
        id: `h-${Date.now()}`,
        text: selectedText,
        quote: selectedText,
        createdBy: "You",
        createdAt: new Date().toISOString(),
        isShared: false,
      }
      setHighlights([...highlights, newHighlight])
      setSelectedText("")
      setSelectionPosition(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  // Updated handleShare logic
  const handleShare = () => {
    if (selectedText) {
      setHighlightToShare(selectedText)
      setShowShareModal(true)
      setSelectedText("")
      setSelectionPosition(null)
      window.getSelection()?.removeAllRanges()
    }
  }

  // Renamed handleShareHighlight to match new state variable
  const handleShareHighlight = (highlightQuote: string) => {
    setHighlightToShare(highlightQuote)
    setShowShareModal(true)
  }

  const handleAddComment = () => {
    if (newComment.trim()) {
      const comment: CommentType = {
        id: `c-${Date.now()}`,
        authorName: "You",
        authorAvatarColor: "#3b82f6", // Example color
        text: newComment.trim(),
        createdAt: new Date().toISOString(),
        reactions: [],
      }
      setComments([...comments, comment])
      setNewComment("")
      incrementComments()
    }
  }

  const handleDeleteComment = (commentId: string) => {
    setComments(comments.filter((c) => c.id !== commentId))
  }

  // Updated handleAddReaction and handleToggleReaction to use new comment structure
  const handleAddReaction = (commentId: string, emoji: string) => {
    setComments(
      comments.map((comment) => {
        if (comment.id === commentId) {
          const existingReaction = comment.reactions.find((r) => r.emoji === emoji)
          if (existingReaction) {
            // If already reacted, toggle off (handled by handleToggleReaction)
            // This function is for adding a *new* reaction or the first reaction
            return {
              ...comment,
              reactions: comment.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r,
              ),
            }
          } else {
            // Add new reaction
            return {
              ...comment,
              reactions: [...comment.reactions, { emoji, count: 1, reacted: true }],
            }
          }
        }
        return comment
      }),
    )
  }

  const handleToggleReaction = (commentId: string, emoji: string) => {
    setComments(
      comments.map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            reactions: comment.reactions
              .map((r) =>
                r.emoji === emoji ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted } : r,
              )
              .filter((r) => r.count > 0), // Remove reaction if count becomes 0
          }
        }
        return comment
      }),
    )
  }

  // Updated formatTime function to match new requirements
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const availableEmojis = ["👍", "❤️", "🔥", "💡", "😂", "🤔", "👀", "🎉"]

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          {/* Adjusted button to open create options */}
          <button
            onClick={() => setShowCreateOptions(!showCreateOptions)}
            className="rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-secondary/80"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-secondary/80"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-32">
        {/* Email Header */}
        <div className="py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {/* Adjusted sender/date/time display */}
            <span>{email.senderName}</span>
            <span>•</span>
            <span>{email.date}</span>
            <span>•</span>
            <span>{email.time}</span>
          </div>
          <h1 className="mt-2 text-xl font-bold text-foreground leading-tight">{email.subject}</h1>
          {/* Display topics if available */}
          {email.topics.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {email.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* AI Summary with ShineBorder */}
        <ShineBorder
          className="mb-6 rounded-2xl bg-card p-4"
          color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
          borderRadius={16}
          borderWidth={3}
          duration={8}
        >
          <div className="flex items-start gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
          </div>
          <p className={cn("text-sm text-foreground/80 leading-relaxed", !showMoreSummary && "line-clamp-3")}>
            {email.summary}
          </p>
          {/* Conditional rendering for "Show more/less" */}
          {email.summary.length > 150 && (
            <button
              onClick={() => setShowMoreSummary(!showMoreSummary)}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {showMoreSummary ? (
                <>
                  Show less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          )}

          {/* Bullet Points */}
          {email.bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
              {email.bullets.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="text-primary">•</span>
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </ShineBorder>

        {/* My Highlights */}
        {highlights.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Highlighter className="h-4 w-4" />
              My Highlights ({highlights.length})
            </h3>
            <div className="space-y-2">
              {highlights.map((highlight) => (
                <div key={highlight.id} className="rounded-xl bg-yellow-500/10 p-3 border-l-2 border-yellow-500">
                  {/* Displaying highlight quote and share action */}
                  <p className="text-sm text-foreground/90 italic">"{highlight.quote}"</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatTime(highlight.createdAt)}</span>
                    <button
                      onClick={() => handleShareHighlight(highlight.quote)}
                      className="text-xs text-primary hover:underline"
                    >
                      Share
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Original Email */}
        <div className="mb-6">
          <button
            onClick={() => setIsOriginalExpanded(!isOriginalExpanded)}
            className="flex w-full items-center justify-between rounded-xl bg-secondary/50 px-4 py-3"
          >
            <span className="text-sm font-medium text-foreground">Original email</span>
            {isOriginalExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          <AnimatePresence>
            {isOriginalExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {/* Using bodyRef for the original email content */}
                <div
                  ref={bodyRef}
                  className="mt-3 rounded-xl bg-card p-4 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap"
                >
                  {email.body}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Comments Section */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageCircle className="h-4 w-4" />
            Comments ({comments.length})
          </h3>

          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-card p-3 shadow-sm ring-1 ring-border/60">
                  <div className="flex items-start gap-2">
                    <div
                      className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                      style={{ backgroundColor: comment.authorAvatarColor }}
                    >
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{comment.authorName}</span>
                          <span className="text-xs text-muted-foreground">{formatTime(comment.createdAt)}</span>
                        </div>
                        {comment.authorName === "You" && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-foreground/80">{comment.text}</p>

                      {/* Reactions */}
                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {comment.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            // Pass correct arguments to handleToggleReaction
                            onClick={() => handleToggleReaction(comment.id, reaction.emoji)}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                              reaction.reacted
                                ? "bg-primary/20 text-primary"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}
                        {/* Add reaction button */}
                        <div className="relative group">
                          <button className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80">
                            <Plus className="h-3 w-3" />
                          </button>
                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex bg-card rounded-lg shadow-lg ring-1 ring-border p-1 gap-1 z-10">
                            {availableEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                // Pass correct arguments to handleAddReaction
                                onClick={() => handleAddReaction(comment.id, emoji)}
                                className="h-7 w-7 rounded hover:bg-secondary flex items-center justify-center text-sm"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
          )}

          {/* Comment Input */}
          <div className="mt-4 flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              // Simplified onKeyDown handler
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              placeholder="Add a comment..."
              className="flex-1 rounded-xl bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              id="comment-input"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="rounded-xl bg-primary p-2.5 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Highlight Bar */}
      {/* Adjusted FloatingHighlightBar usage */}
      {selectedText && selectionPosition && (
        <FloatingHighlightBar
          position={selectionPosition}
          onHighlight={handleHighlight}
          onShare={handleShare}
          onClose={() => {
            setSelectedText("")
            setSelectionPosition(null)
            window.getSelection()?.removeAllRanges()
          }}
        />
      )}

      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Share to Circle</h3>
                <button onClick={() => setShowShareModal(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              {/* Displaying the highlight text to be shared */}
              {highlightToShare && (
                <div className="mb-4 rounded-xl bg-yellow-500/10 p-3 border-l-2 border-yellow-500">
                  <p className="text-sm italic">"{highlightToShare}"</p>
                </div>
              )}
              <div className="space-y-2">
                {["Tech Enthusiasts", "Investment Club", "News Junkies"].map((circle) => (
                  <button
                    key={circle}
                    onClick={() => setShowShareModal(false)} // Close modal after selection
                    className="w-full rounded-xl bg-secondary p-3 text-left text-sm font-medium hover:bg-secondary/80"
                  >
                    {circle}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Options Modal */}
      <AnimatePresence>
        {showCreateOptions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4"
            onClick={() => setShowCreateOptions(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Create</h3>
                <button onClick={() => setShowCreateOptions(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-2">
                <button
                  // Logic to trigger highlight creation
                  onClick={() => {
                    setShowCreateOptions(false)
                    if (selectedText) {
                      // If text is already selected, proceed to highlight
                      handleHighlight()
                    } else {
                      // Otherwise, prompt user to select text
                      // This part might need a more explicit UI cue or modal to tell the user to select text first.
                      // For now, we just close the create options and hope user selects text.
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-xl bg-secondary p-3 text-left hover:bg-secondary/80"
                >
                  <Highlighter className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm font-medium">New Highlight</p>
                    <p className="text-xs text-muted-foreground">Select text to highlight</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setShowCreateOptions(false)
                    // Logic to focus comment input
                    // This assumes there's an input element ready to receive focus.
                    // If not, a dedicated comment modal might be better.
                    // For now, we assume the comment input is visible and just try to focus it.
                    // A more robust solution might involve a ref to the input.
                    document.getElementById("comment-input")?.focus() // Example: assuming input has this ID
                  }}
                  className="flex w-full items-center gap-3 rounded-xl bg-secondary p-3 text-left hover:bg-secondary/80"
                >
                  <MessageCircle className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Add Comment</p>
                    <p className="text-xs text-muted-foreground">Share your thoughts</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default EmailDetailClient
