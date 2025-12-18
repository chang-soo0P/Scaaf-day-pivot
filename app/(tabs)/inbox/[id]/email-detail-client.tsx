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

type ApiSingleEmailResponse = { ok: true; email: DbEmailRow } | { ok: false; error?: string }

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

type ApiHighlightsListResponse = { ok: true; highlights: Highlight[] } | { ok: false; error?: string }
type ApiHighlightCreateResponse = { ok: true; highlight: Highlight } | { ok: false; error?: string }
type ApiHighlightPatchResponse = { ok: true; highlight: Highlight } | { ok: false; error?: string }

type ApiCommentsListResponse = { ok: true; comments: Comment[] } | { ok: false; error?: string }
type ApiCommentCreateResponse = { ok: true; comment: Comment } | { ok: false; error?: string }

type ApiOkResponse = { ok: true } | { ok: false; error?: string }

type ApiReactionToggleResponse =
  | { ok: true; reactions: Comment["reactions"] }
  | { ok: false; error?: string }

interface EmailDetailClientProps {
  emailId: string
  serverData?: any
}

/** -----------------------------
 * Helpers
 * ------------------------------*/
async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

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
  if (!iso) return { date: "", time: "" }
  const d = new Date(iso)
  const date = d.toLocaleDateString()
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  return { date, time }
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
    topics: [] as string[],
    date,
    time,
    summary: buildSummaryFromBody(bodyText),
    bullets: [] as string[],
    body: bodyText || "No content available.",
  }
}

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

// 아주 가벼운 HTML sanitize
function basicSanitizeHtml(input: string) {
  let html = input
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "")
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "")
  html = html.replace(/<(iframe|object|embed)[\s\S]*?<\/\1>/gi, "")
  html = html.replace(/<(iframe|object|embed)(.|\n)*?>/gi, "")
  html = html.replace(/\son\w+="[^"]*"/gi, "")
  html = html.replace(/\son\w+='[^']*'/gi, "")
  return html
}

export default function EmailDetailClient({ emailId, serverData }: EmailDetailClientProps) {
  const router = useRouter()

  /** -----------------------------
   * DB email state
   * ------------------------------*/
  const initialDbEmail: DbEmailRow | null = useMemo(() => {
    if (serverData?.ok && serverData?.email) return serverData.email as DbEmailRow
    return null
  }, [serverData])

  const [dbEmail, setDbEmail] = useState<DbEmailRow | null>(initialDbEmail)
  const [loading, setLoading] = useState(!initialDbEmail)
  const [error, setError] = useState<string | null>(serverData?.ok ? null : serverData?.error ?? null)

  useEffect(() => {
    if (dbEmail) return
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        const res = await fetch(`/api/inbox-emails/${emailId}`, { cache: "no-store" })
        const data = await safeReadJson<ApiSingleEmailResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setError(data.error ?? "Unauthorized or not found")
          setLoading(false)
          return
        }

        setDbEmail(data.email)
        setError(null)
        setLoading(false)
      } catch {
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

  const email = useMemo(() => mapDbEmailToView(dbEmail, emailId), [dbEmail, emailId])

  /** -----------------------------
   * HTML original rendering
   * ------------------------------*/
  const sanitizedHtml = useMemo(() => {
    const html = dbEmail?.body_html?.trim()
    if (!html) return ""
    return basicSanitizeHtml(html)
  }, [dbEmail?.body_html])

  const bodyRef = useRef<HTMLDivElement>(null)
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false)

  useEffect(() => {
    if (!isOriginalExpanded) return
    const el = bodyRef.current
    if (!el) return

    el.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
      a.setAttribute("target", "_blank")
      a.setAttribute("rel", "noopener noreferrer")
    })

    el.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
      img.setAttribute("loading", "lazy")
      img.setAttribute("decoding", "async")
      img.style.maxWidth = "100%"
      img.style.height = "auto"
    })
  }, [isOriginalExpanded, sanitizedHtml])

  /** -----------------------------
   * Local UI state
   * ------------------------------*/
  const [showMoreSummary, setShowMoreSummary] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showCreateOptions, setShowCreateOptions] = useState(false)

  const [highlightToShare, setHighlightToShare] = useState<{ id?: string; quote: string } | null>(null)

  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)

  /** ✅ highlights load */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setHighlightsLoading(true)
        const res = await fetch(`/api/inbox-emails/${emailId}/highlights`, { cache: "no-store" })
        const data = await safeReadJson<ApiHighlightsListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setHighlights([])
          setHighlightsLoading(false)
          return
        }

        setHighlights(data.highlights ?? [])
        setHighlightsLoading(false)
      } catch {
        if (cancelled) return
        setHighlights([])
        setHighlightsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [emailId])

  /** ✅ comments load */
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setCommentsLoading(true)
        const res = await fetch(`/api/inbox-emails/${emailId}/comments`, { cache: "no-store" })
        const data = await safeReadJson<ApiCommentsListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setComments([])
          setCommentsLoading(false)
          return
        }

        setComments(data.comments ?? [])
        setCommentsLoading(false)
      } catch {
        if (cancelled) return
        setComments([])
        setCommentsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [emailId])

  /** text selection */
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

  /** highlight CRUD */
  const createHighlight = async (quote: string) => {
    const optimistic: Highlight = {
      id: `temp-h-${Date.now()}`,
      quote,
      createdAt: new Date().toISOString(),
      isShared: false,
    }
    setHighlights((prev) => [optimistic, ...prev])

    try {
      const res = await fetch(`/api/inbox-emails/${emailId}/highlights`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quote }),
      })
      const data = await safeReadJson<ApiHighlightCreateResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to create highlight")

      setHighlights((prev) => prev.map((h) => (h.id === optimistic.id ? data.highlight : h)))
      return data.highlight
    } catch {
      setHighlights((prev) => prev.filter((h) => h.id !== optimistic.id))
      return null
    }
  }

  const deleteHighlight = async (highlightId: string) => {
    const prev = highlights
    setHighlights((cur) => cur.filter((h) => h.id !== highlightId))
    try {
      const res = await fetch(`/api/email-highlights/${highlightId}`, { method: "DELETE" })
      const data = await safeReadJson<ApiOkResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to delete highlight")
      return true
    } catch {
      setHighlights(prev)
      return false
    }
  }

  const markHighlightShared = async (highlightId: string) => {
    const prev = highlights
    setHighlights((cur) => cur.map((h) => (h.id === highlightId ? { ...h, isShared: true } : h)))

    try {
      const res = await fetch(`/api/email-highlights/${highlightId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isShared: true }),
      })
      const data = await safeReadJson<ApiHighlightPatchResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to share highlight")

      setHighlights((cur) => cur.map((h) => (h.id === highlightId ? data.highlight : h)))
      return true
    } catch {
      setHighlights(prev)
      return false
    }
  }

  const handleHighlight = async () => {
    if (!selectedText) return
    await createHighlight(selectedText)
    setSelectedText("")
    setSelectionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleShare = () => {
    if (!selectedText) return
    setHighlightToShare({ quote: selectedText })
    setShowShareModal(true)
    setSelectedText("")
    setSelectionPosition(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleShareHighlight = (h: Highlight) => {
    setHighlightToShare({ id: h.id, quote: h.quote })
    setShowShareModal(true)
  }

  /** comments CRUD */
  const handleAddComment = async () => {
    if (!newComment.trim()) return

    const text = newComment.trim()
    setNewComment("")

    const optimistic: Comment = {
      id: `temp-c-${Date.now()}`,
      authorName: "You",
      authorAvatarColor: "#3b82f6",
      text,
      createdAt: new Date().toISOString(),
      reactions: [],
    }
    setComments((prev) => [...prev, optimistic])

    try {
      const res = await fetch(`/api/inbox-emails/${emailId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, authorName: "You", authorAvatarColor: "#3b82f6" }),
      })
      const data = await safeReadJson<ApiCommentCreateResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to create comment")

      setComments((prev) => prev.map((c) => (c.id === optimistic.id ? data.comment : c)))
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id))
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const prev = comments
    setComments((cur) => cur.filter((c) => c.id !== commentId))
    try {
      const res = await fetch(`/api/email-comments/${commentId}`, { method: "DELETE" })
      const data = await safeReadJson<ApiOkResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to delete comment")
    } catch {
      setComments(prev)
    }
  }

  const toggleReaction = async (commentId: string, emoji: string) => {
    const prev = comments

    // optimistic
    setComments((cur) =>
      cur.map((c) => {
        if (c.id !== commentId) return c
        const existing = c.reactions.find((r) => r.emoji === emoji)
        if (!existing) {
          return { ...c, reactions: [...c.reactions, { emoji, count: 1, reacted: true }] }
        }
        const next = c.reactions
          .map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.reacted ? r.count - 1 : r.count + 1, reacted: !r.reacted }
              : r
          )
          .filter((r) => r.count > 0)
        return { ...c, reactions: next }
      })
    )

    try {
      const res = await fetch(`/api/email-comments/${commentId}/reactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emoji }),
      })
      const data = await safeReadJson<ApiReactionToggleResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to toggle reaction")

      setComments((cur) => cur.map((c) => (c.id === commentId ? { ...c, reactions: data.reactions } : c)))
    } catch {
      setComments(prev)
    }
  }

  const availableEmojis = ["👍", "❤️", "🔥", "💡", "😂", "🤔", "👀", "🎉"]

  /** -----------------------------
   * Loading/Error UI
   * ------------------------------*/
  if (loading) {
    return (
      <div className="flex min-h-full flex-col bg-background">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-3 backdrop-blur-sm">
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
          <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => forceToggle(setShowCreateOptions)}
            className="rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-secondary/80"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-secondary/80"
            aria-label="Share"
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
        </div>

        {/* AI Summary */}
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
        </ShineBorder>

        {/* My Highlights */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Highlighter className="h-4 w-4" />
            My Highlights ({highlights.length})
            {highlightsLoading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
          </h3>

          {highlights.length > 0 ? (
            <div className="space-y-2">
              {highlights.map((h) => (
                <div key={h.id} className="rounded-xl bg-yellow-500/10 p-3 border-l-2 border-yellow-500">
                  <p className="text-sm text-foreground/90 italic">"{h.quote}"</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatTimeRelative(h.createdAt)}</span>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleShareHighlight(h)}
                        className={cn(
                          "text-xs hover:underline",
                          h.isShared ? "text-muted-foreground cursor-default" : "text-primary"
                        )}
                        disabled={h.isShared}
                      >
                        {h.isShared ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Shared
                          </span>
                        ) : (
                          "Share"
                        )}
                      </button>

                      <button
                        onClick={() => deleteHighlight(h.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                        aria-label="Remove highlight"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No highlights yet. Select text and highlight it.</p>
          )}
        </div>

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
                  className={cn(
                    "mt-3 rounded-xl bg-card p-4 text-sm text-foreground/80 leading-relaxed",
                    sanitizedHtml ? "whitespace-normal" : "whitespace-pre-wrap",
                    "[&_*]:max-w-full [&_*]:break-words",
                    "[&_p]:my-2 [&_br]:block",
                    "[&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80",
                    "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-3",
                    "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-3",
                    "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-2",
                    "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2",
                    "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2",
                    "[&_li]:my-1",
                    "[&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-3 [&_blockquote]:text-muted-foreground",
                    "[&_img]:rounded-lg [&_img]:my-3 [&_img]:h-auto",
                    "[&_table]:w-full [&_table]:my-3 [&_table]:border-collapse",
                    "[&_th]:border [&_td]:border [&_th]:p-2 [&_td]:p-2 [&_th]:bg-secondary/40",
                    "[&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-secondary/40 [&_pre]:p-3 [&_pre]:my-3",
                    "[&_code]:rounded [&_code]:bg-secondary/40 [&_code]:px-1 [&_code]:py-0.5"
                  )}
                >
                  {sanitizedHtml ? (
                    <div className="space-y-3" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                  ) : (
                    email.body
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Comments */}
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <MessageCircle className="h-4 w-4" />
            Comments ({comments.length})
            {commentsLoading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
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

                      <div className="mt-2 flex items-center gap-1 flex-wrap">
                        {comment.reactions.map((reaction) => (
                          <button
                            key={reaction.emoji}
                            onClick={() => toggleReaction(comment.id, reaction.emoji)}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors",
                              reaction.reacted
                                ? "bg-primary/20 text-primary"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                            )}
                          >
                            <span>{reaction.emoji}</span>
                            <span>{reaction.count}</span>
                          </button>
                        ))}

                        <div className="relative group">
                          <button className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80">
                            <Plus className="h-3 w-3" />
                          </button>

                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:flex bg-card rounded-lg shadow-lg ring-1 ring-border p-1 gap-1 z-10">
                            {availableEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(comment.id, emoji)}
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

              {highlightToShare?.quote && (
                <div className="mb-4 rounded-xl bg-yellow-500/10 p-3 border-l-2 border-yellow-500">
                  <p className="text-sm italic">"{highlightToShare.quote}"</p>
                </div>
              )}

              <div className="space-y-2">
                {["Tech Enthusiasts", "Investment Club", "News Junkies"].map((circle) => (
                  <button
                    key={circle}
                    onClick={async () => {
                      // 헤더 Share 버튼으로 들어온 경우: 그냥 닫기
                      if (!highlightToShare?.quote) {
                        setShowShareModal(false)
                        return
                      }

                      // 선택 텍스트 공유(아직 highlight id 없음) -> 먼저 생성 -> shared 처리
                      if (!highlightToShare.id) {
                        const created = await createHighlight(highlightToShare.quote)
                        if (created) await markHighlightShared(created.id)
                      } else {
                        await markHighlightShared(highlightToShare.id)
                      }

                      setShowShareModal(false)
                      setHighlightToShare(null)
                    }}
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

/** tiny helper */
function forceToggle(setter: (v: boolean) => void) {
  setter((prev) => !prev)
}
