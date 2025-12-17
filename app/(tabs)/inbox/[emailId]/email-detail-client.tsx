"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
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

/** -----------------------------
 * Types
 * ------------------------------*/
type DbEmailRow = {
  id: string
  user_id: string | null
  address_id: string | null
  message_id: string | null
  from_address: string | null
  to_address?: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  raw: any
  received_at: string | null
}

type ApiSingleEmailResponse =
  | { ok: true; email: DbEmailRow }
  | { ok: false; error?: string }

type Highlight = {
  id: string
  quote: string
  createdAt: string
  isShared: boolean
  memo?: string
}

type Comment = {
  id: string
  authorName: string
  authorAvatarColor: string
  text: string
  createdAt: string
  reactions: { emoji: string; count: number; reacted: boolean }[]
}

interface EmailDetailClientProps {
  emailId: string
  serverData?: any
}

/** -----------------------------
 * Helpers
 * ------------------------------*/
function extractNameFromEmail(addr: string) {
  const emailMatch = addr.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const email = emailMatch?.[0] ?? addr
  const name = email.split("@")[0]
  return name || email
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function formatHeaderDateTime(iso: string | null) {
  if (!iso) return { date: "", time: "", receivedAtText: "" }
  const d = new Date(iso)
  const receivedAtText = d.toLocaleString()
  const date = d.toLocaleDateString()
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return { date, time, receivedAtText }
}

function buildSummaryFromBody(body: string) {
  const clean = body.replace(/\s+/g, " ").trim()
  if (!clean) return "No content."
  return clean.length > 220 ? clean.slice(0, 220) + "…" : clean
}

function mapDbEmailToView(db: DbEmailRow | null, emailId: string) {
  const fallback = {
    id: emailId,
    senderName: "Unknown",
    subject: "Email not found",
    topics: [] as string[],
    date: "",
    time: "",
    summary: "This email could not be found.",
    bullets: [] as string[],
    body: "No content available.",
  }

  if (!db) return fallback

  const from = db.from_address ?? "Unknown"
  const senderName = extractNameFromEmail(from)
  const subject = db.subject ?? "(no subject)"

  const bodyText =
    (db.body_text && db.body_text.trim()) ||
    (db.body_html && stripHtml(db.body_html)) ||
    ""

  const { date, time } = formatHeaderDateTime(db.received_at)

  return {
    id: db.id,
    senderName,
    subject,
    topics: [] as string[], // (추후 topics 테이블/추론 붙이면 여기 채우면 됨)
    date,
    time,
    summary: buildSummaryFromBody(bodyText),
    bullets: [] as string[], // (추후 AI 요약 결과 저장하면 채우면 됨)
    body: bodyText || "No content available.",
  }
}

/** -----------------------------
 * UI bits (기존 유지)
 * ------------------------------*/
function formatTimeRelative(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

export default function EmailDetailClient({ emailId, serverData }: EmailDetailClientProps) {
  const router = useRouter()

  /** -----------------------------
   * DB email state (serverData 우선)
   * ------------------------------*/
  const initialDbEmail: DbEmailRow | null = useMemo(() => {
    if (serverData?.ok && serverData?.email) return serverData.email as DbEmailRow
    return null
  }, [serverData])

  const [dbEmail, setDbEmail] = useState<DbEmailRow | null>(initialDbEmail)
  const [loading, setLoading] = useState(!initialDbEmail)
  const [error, setError] = useState<string | null>(
    serverData?.ok ? null : serverData?.error ?? null
  )

  // serverData가 없거나 실패하면, 클라에서 단건 재조회
  useEffect(() => {
    if (dbEmail) return
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        const res = await fetch(`/api/inbox-emails/${emailId}`, { cache: "no-store" })
        const data: ApiSingleEmailResponse = await res.json()
        if (cancelled) return

        if (!data.ok) {
          setError(data.error ?? "Unauthorized or not found")
          setLoading(false)
          return
        }

        setDbEmail(data.email)
        setError(null)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError("Failed to load email")
        setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [emailId, dbEmail])

  // 화면용 email object
  const email = useMemo(() => mapDbEmailToView(dbEmail, emailId), [dbEmail, emailId])

  /** -----------------------------
   * 기존 UI/상태(로컬) 유지
   * ------------------------------*/
  const [showMoreSummary, setShowMoreSummary] = useState(false)
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCreateOptions, setShowCreateOptions] = useState(false)
  const [highlightToShare, setHighlightToShare] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelectedText(selection.toString().trim())
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
    document.addEventListener("mouseup", handleTextSelection)
    document.addEventListener("touchend", handleTextSelection)
    return () => {
      document.removeEventListener("mouseup", handleTextSelection)
      document.removeEventListener("touchend", handleTextSelection)
    }
  }, [handleTextSelection])

  const handleHighlight = () => {
    if (!selectedText) return
    const newHighlight: Highlight = {
      id: `h-${Date.now()}`,
      quote: selectedText,
      createdAt: new Date().toISOString(),
      isShared: false,
    }
    setHighlights((prev) => [...prev, newHighlight])
    setSelectedText("")
    setSelectionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleShare = () => {
    if (!selectedText) return
    setHighlightToShare(selectedText)
    setShowShareModal(true)
    setSelectedText("")
    setSelectionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleShareHighlight = (highlightQuote: string) => {
    setHighlightToShare(highlightQuote)
    setShowShareModal(true)
  }

  const handleAddComment = () => {
    if (!newComment.trim()) return
    const comment: Comment = {
      id: `c-${Date.now()}`,
      authorName: "You",
      authorAvatarColor: "#3b82f6",
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
      reactions: [],
    }
    setComments((prev) => [...prev, comment])
    setNewComment("")
  }

  const handleDeleteComment = (commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  const handleAddReaction = (commentId: string, emoji: string) => {
    setComments((prev) =>
      prev.map((comment) => {
        if (comment.id !== commentId) return comment
        const existing = comment.reactions.find((r) => r.emoji === emoji)
        if (existing) {
          return {
            ...comment,
            reactions: comment.reactions.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r
            ),
          }
        }
        return {
          ...comment,
          reactions: [...comment.reactions, { emoji, count: 1, reacted: true }],
        }
      })
    )
  }

  const handleToggleReaction = (commentId: string, emoji: string) => {
    setComments((prev) =>
      prev.map((comment) => {
        if (comment.id !== commentId) return comment
        return {
          ...comment,
          reactions: comment.reactions
            .map((r) =>
              r.emoji === emoji
                ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
                : r
            )
            .filter((r) => r.count > 0),
        }
      })
    )
  }

  const availableEmojis = ["👍", "❤️", "🔥", "💡", "😂", "🤔", "👀", "🎉"]

  /** -----------------------------
   * Loading/Error UI
   * ------------------------------*/
  if (loading) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>
        <div className="px-4 py-10 text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="px-4 py-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-semibold text-foreground">Failed to load</div>
            <div className="mt-1 text-sm text-muted-foreground">{error}</div>
          </div>
        </div>
      </div>
    )
  }

  /** -----------------------------
   * Main UI
   * ------------------------------*/
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
            <span>{email.senderName}</span>
            {email.date ? (
              <>
                <span>•</span>
                <span>{email.date}</span>
              </>
            ) : null}
            {email.time ? (
              <>
                <span>•</span>
                <span>{email.time}</span>
              </>
            ) : null}
          </div>

          <h1 className="mt-2 text-xl font-bold text-foreground leading-tight">{email.subject}</h1>

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
                  <p className="text-sm text-foreground/90 italic">"{highlight.quote}"</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatTimeRelative(highlight.createdAt)}</span>
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
                          <span className="text-xs text-muted-foreground">{formatTimeRelative(comment.createdAt)}</span>
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
                            onClick={() => handleToggleReaction(comment.id, reaction.emoji)}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                              reaction.reacted ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}

                        {/* Add reaction */}
                        <div className="relative group">
                          <button className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80">
                            <Plus className="h-3 w-3" />
                          </button>

                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex bg-card rounded-lg shadow-lg ring-1 ring-border p-1 gap-1 z-10">
                            {availableEmojis.map((emoji) => (
                              <button
                                key={emoji}
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

              {highlightToShare && (
                <div className="mb-4 rounded-xl bg-yellow-500/10 p-3 border-l-2 border-yellow-500">
                  <p className="text-sm italic">"{highlightToShare}"</p>
                </div>
              )}

              <div className="space-y-2">
                {["Tech Enthusiasts", "Investment Club", "News Junkies"].map((circle) => (
                  <button
                    key={circle}
                    onClick={() => setShowShareModal(false)}
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
                  onClick={() => {
                    setShowCreateOptions(false)
                    if (selectedText) handleHighlight()
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
                    document.getElementById("comment-input")?.focus()
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
