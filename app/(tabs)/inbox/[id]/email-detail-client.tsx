"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { useDailyMission } from "@/hooks/use-daily-mission"
import { useToast } from "@/hooks/use-toast"

/** -----------------------------
 * Types
 * ------------------------------*/
type DbEmailRow = {
  id: string
  user_id: string | null
  address_id: string | null
  message_id: string | null
  from_address: string | null
  // NOTE: DB에 없을 수 있어 optional 유지
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

// ✅ circles (이름 충돌 방지 위해 Circle -> CircleItem)
type CircleItem = {
  id: string
  name?: string | null
  created_at?: string | null
}
type ApiCirclesListResponse = { ok: true; circles: CircleItem[] } | { ok: false; error?: string }

// ✅ share target(모달이 “이메일 공유”인지 “하이라이트 공유”인지 구분)
type ShareTarget = { type: "email" } | { type: "highlight"; highlightId?: string; quote: string }

type ApiShareResponse = { ok: true; duplicated?: boolean } | { ok: false; error?: string }

interface EmailDetailClientProps {
  emailId: string
  // ✅ 서버에서 내려줄 수 있는 초기 데이터(옵션)
  initialEmail?: DbEmailRow | null
  initialHighlights?: Highlight[]
  initialComments?: Comment[]
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

  const bodyText = (db.body_text && db.body_text.trim()) || (db.body_html && stripHtml(db.body_html)) || ""
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

function isValidEmailIdValue(v: string) {
  return Boolean(v && v !== "undefined" && v !== "null")
}

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

function forceToggle(setter: (v: boolean | ((prev: boolean) => boolean)) => void) {
  setter((prev: boolean) => !prev)
}

/** iframe srcDoc builder: 원본 뉴스레터 레이아웃을 최대한 그대로 보여주되,
 * - 부모 CSS 영향 최소화
 * - 이미지/테이블 overflow 방지
 * - 링크는 새 탭으로
 */
function buildEmailSrcDoc(innerHtml: string) {
  const css = `
    :root { color-scheme: light; }
    html, body { margin: 0; padding: 0; background: transparent; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height: 1.5; }
    img { max-width: 100% !important; height: auto !important; }
    table { max-width: 100% !important; }
    * { box-sizing: border-box; }
    a { word-break: break-word; overflow-wrap: anywhere; }
  `
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<base target="_blank" />
<style>${css}</style>
</head>
<body>
${innerHtml}
</body>
</html>`
}

export default function EmailDetailClient({
  emailId,
  initialEmail = null,
  initialHighlights = [],
  initialComments = [],
}: EmailDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // ✅ Daily mission
  const { incrementHighlights, incrementCircleShares } = useDailyMission()

  const isValidEmailId = isValidEmailIdValue(emailId) && isUuid(emailId)

  /** -----------------------------
   * DB email state
   * ------------------------------*/
  const [dbEmail, setDbEmail] = useState<DbEmailRow | null>(initialEmail)
  const [loading, setLoading] = useState(!initialEmail && isValidEmailId)
  const [error, setError] = useState<string | null>(null)

  // ✅ StrictMode 2회 실행 방지 가드 (이메일 fetch는 유지 OK)
  const emailFetchedOnceRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!isValidEmailId) {
        setDbEmail(null)
        setLoading(false)
        setError("Invalid email id")
        return
      }

      // ✅ 초기값이 있으면 첫 fetch 스킵
      if (initialEmail) {
        setLoading(false)
        setError(null)
        return
      }

      // ✅ StrictMode에서 첫 mount 2번 실행되는 것 방지
      if (emailFetchedOnceRef.current) return
      emailFetchedOnceRef.current = true

      try {
        setLoading(true)
        const res = await fetch(`/api/inbox-emails/${emailId}`, {
          cache: "no-store",
          credentials: "include",
        })
        const data = await safeReadJson<ApiSingleEmailResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setError(data.error ?? `Failed to load (HTTP ${res.status})`)
          setLoading(false)
          return
        }

        setDbEmail(data.email)
        setError(null)
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message ?? "Failed to load email")
        setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [emailId, isValidEmailId, initialEmail])

  const email = useMemo(() => mapDbEmailToView(dbEmail, emailId), [dbEmail, emailId])

  /** -----------------------------
   * Original HTML rendering
   * - (Fix #3) iframe로 렌더링해 뉴스레터 원본 레이아웃/스페이서 박스 문제 최소화
   * - iframe 내부 선택(하이라이트)을 부모로 전달
   * ------------------------------*/
  const [isOriginalExpanded, setIsOriginalExpanded] = useState(false)
  const sanitizedHtml = useMemo(() => {
    const html = dbEmail?.body_html?.trim()
    if (!html) return ""
    return basicSanitizeHtml(html)
  }, [dbEmail?.body_html])

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const iframeCleanupRef = useRef<(() => void) | null>(null)
  const [iframeHeight, setIframeHeight] = useState<number>(720)

  /** -----------------------------
   * Local UI state
   * ------------------------------*/
  const [showMoreSummary, setShowMoreSummary] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [selectionPosition, setSelectionPosition] = useState<{ x: number; y: number } | null>(null)
  const clearSelectionRef = useRef<() => void>(() => {
    try {
      window.getSelection()?.removeAllRanges()
    } catch {}
  })

  const [showShareModal, setShowShareModal] = useState(false)
  const [showCreateOptions, setShowCreateOptions] = useState(false)

  // ✅ 하이라이트 공유(기존 유지)
  const [highlightToShare, setHighlightToShare] = useState<{ id?: string; quote: string } | null>(null)
  // ✅ 이메일/하이라이트 공유 모드 구분
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null)

  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [newComment, setNewComment] = useState("")
  const [highlightsLoading, setHighlightsLoading] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)

  // ✅ circles for share modal
  const [circles, setCircles] = useState<CircleItem[]>([])
  const [circlesLoading, setCirclesLoading] = useState(false)
  const [circlesError, setCirclesError] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  // ✅ (NEW) reaction picker: hover 대신 click 토글
  const [openReactionFor, setOpenReactionFor] = useState<string | null>(null)
  const reactionPopoverRef = useRef<HTMLDivElement | null>(null)

  // ✅ query param UX (share=1 / highlight=1) — StrictMode guard
  const deepLinkHandledRef = useRef(false)
  useEffect(() => {
    if (deepLinkHandledRef.current) return
    deepLinkHandledRef.current = true

    const wantsShare = searchParams?.get("share") === "1"
    const wantsHighlight = searchParams?.get("highlight") === "1"

    if (wantsShare) {
      setShareTarget({ type: "email" })
      setHighlightToShare(null)
      setShowShareModal(true)
      return
    }

    if (wantsHighlight) {
      setIsOriginalExpanded(true)
      toast({
        title: "Pick a line to highlight",
        description: "원문에서 텍스트를 드래그하면 하이라이트/공유 바가 떠.",
      })
    }
  }, [searchParams, toast])

  // 바깥 클릭/ESC로 닫기
  useEffect(() => {
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!openReactionFor) return
      const target = e.target as Node | null
      const pop = reactionPopoverRef.current
      if (pop && target && pop.contains(target)) return
      setOpenReactionFor(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenReactionFor(null)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown, { passive: true })
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown as any)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [openReactionFor])

  /** -----------------------------
   * (Fix #3) iframe 내부 selection → 부모로 전달 + height 자동 조절
   * ------------------------------*/
  const attachIframeHandlers = useCallback(() => {
    // cleanup existing
    if (iframeCleanupRef.current) {
      iframeCleanupRef.current()
      iframeCleanupRef.current = null
    }

    const iframe = iframeRef.current
    if (!iframe) return

    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    if (!win || !doc) return

    const updateHeight = () => {
      try {
        const h =
          Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0) || 720
        setIframeHeight(Math.min(Math.max(h, 320), 6000))
      } catch {
        // ignore
      }
    }

    const handleSelectionFromIframe = () => {
      try {
        const sel = win.getSelection()
        if (!sel || sel.rangeCount === 0) {
          setSelectedText("")
          setSelectionPosition(null)
          return
        }

        const text = sel.toString().trim()
        if (!text) {
          setSelectedText("")
          setSelectionPosition(null)
          return
        }

        const range = sel.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        const iframeRect = iframe.getBoundingClientRect()

        setSelectedText(text)
        setSelectionPosition({
          x: iframeRect.left + rect.left + rect.width / 2,
          y: iframeRect.top + rect.top - 10,
        })

        clearSelectionRef.current = () => {
          try {
            win.getSelection()?.removeAllRanges()
          } catch {}
        }
      } catch {
        // ignore
      }
    }

    // ResizeObserver로 내부 높이 변화 반영
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updateHeight())
      try {
        if (doc.documentElement) ro.observe(doc.documentElement)
        if (doc.body) ro.observe(doc.body)
      } catch {
        // ignore
      }
    }

    // 내부 링크에 rel 추가 (가능한 범위 내)
    try {
      doc.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        a.setAttribute("target", "_blank")
        a.setAttribute("rel", "noopener noreferrer")
      })
      doc.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
        img.setAttribute("loading", "lazy")
        img.setAttribute("decoding", "async")
      })
    } catch {
      // ignore
    }

    doc.addEventListener("mouseup", handleSelectionFromIframe)
    doc.addEventListener("touchend", handleSelectionFromIframe, { passive: true })
    win.addEventListener("resize", updateHeight)

    // initial
    updateHeight()

    iframeCleanupRef.current = () => {
      try {
        doc.removeEventListener("mouseup", handleSelectionFromIframe)
        doc.removeEventListener("touchend", handleSelectionFromIframe as any)
        win.removeEventListener("resize", updateHeight)
      } catch {}
      try {
        ro?.disconnect()
      } catch {}
    }
  }, [])

  useEffect(() => {
    // collapse 시 selection 정리
    if (!isOriginalExpanded) {
      if (iframeCleanupRef.current) {
        iframeCleanupRef.current()
        iframeCleanupRef.current = null
      }
      return
    }

    // expanded인데 html이 없으면 nothing
    if (!sanitizedHtml) return

    // iframe onLoad에서 attach
    // (여기서는 혹시 이미 로드된 경우 대비)
    const t = window.setTimeout(() => attachIframeHandlers(), 50)
    return () => window.clearTimeout(t)
  }, [isOriginalExpanded, sanitizedHtml, attachIframeHandlers])

  /** -----------------------------
   * circles load (when share modal opens)
   * ------------------------------*/
  useEffect(() => {
    if (!showShareModal) return

    let cancelled = false
    async function loadCircles() {
      try {
        setCirclesLoading(true)
        setCirclesError(null)

        const res = await fetch("/api/circles?limit=50", {
          cache: "no-store",
          credentials: "include",
        })
        const data = await safeReadJson<ApiCirclesListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setCircles([])
          setCirclesError(data.error ?? "Failed to load circles")
          setCirclesLoading(false)
          return
        }

        setCircles(data.circles ?? [])
        setCirclesLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setCircles([])
        setCirclesError(e?.message ?? "Failed to load circles")
        setCirclesLoading(false)
      }
    }

    loadCircles()
    return () => {
      cancelled = true
    }
  }, [showShareModal])

  /** -----------------------------
   * share helpers
   * ------------------------------*/
  async function shareEmailToCircle(circleId: string): Promise<ApiShareResponse> {
    if (!isValidEmailId) return { ok: false, error: "Invalid email id" }

    setSharing(true)
    try {
      const res = await fetch("/api/circles/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ circleId, emailId }),
        credentials: "include",
      })
      const data = await safeReadJson<ApiShareResponse>(res)

      if (!res.ok) {
        return { ok: false, error: (data as any)?.error ?? `HTTP ${res.status}` }
      }
      return data
    } finally {
      setSharing(false)
    }
  }

  /** -----------------------------
   * (Fix #2) highlights load: StrictMode 무한 Loading 방지
   * - "ref로 1회만" 가드 제거
   * - AbortController + finally에서 loading 해제
   * ------------------------------*/
  useEffect(() => {
    if (!isValidEmailId) {
      setHighlights([])
      setHighlightsLoading(false)
      return
    }

    // ✅ 초기값이 있으면 사용
    if (initialHighlights?.length) {
      setHighlights(initialHighlights)
      setHighlightsLoading(false)
      return
    }

    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setHighlightsLoading(true)
      try {
        const res = await fetch(`/api/inbox-emails/${emailId}/highlights`, {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        })
        const data = await safeReadJson<ApiHighlightsListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setHighlights([])
          return
        }

        setHighlights(data.highlights ?? [])
      } catch {
        if (cancelled) return
        setHighlights([])
      } finally {
        if (!cancelled) setHighlightsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [emailId, isValidEmailId, initialHighlights])

  /** -----------------------------
   * (Fix #2) comments load도 동일 패턴
   * ------------------------------*/
  useEffect(() => {
    if (!isValidEmailId) {
      setComments([])
      setCommentsLoading(false)
      return
    }

    // ✅ 초기값이 있으면 사용
    if (initialComments?.length) {
      setComments(initialComments)
      setCommentsLoading(false)
      return
    }

    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setCommentsLoading(true)
      try {
        const res = await fetch(`/api/inbox-emails/${emailId}/comments`, {
          cache: "no-store",
          credentials: "include",
          signal: ac.signal,
        })
        const data = await safeReadJson<ApiCommentsListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setComments([])
          return
        }

        setComments(data.comments ?? [])
      } catch {
        if (cancelled) return
        setComments([])
      } finally {
        if (!cancelled) setCommentsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [emailId, isValidEmailId, initialComments])

  /** -----------------------------
   * text selection (parent document)
   * - iframe selection은 별도 attachIframeHandlers에서 처리
   * ------------------------------*/
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
      clearSelectionRef.current = () => {
        try {
          window.getSelection()?.removeAllRanges()
        } catch {}
      }
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
    if (!isValidEmailId) return null

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
        credentials: "include",
      })
      const data = await safeReadJson<ApiHighlightCreateResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to create highlight")

      setHighlights((prev) => prev.map((h) => (h.id === optimistic.id ? data.highlight : h)))

      // ✅ Daily mission: highlight +1 (서버 생성 성공시에만)
      incrementHighlights()

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
      const res = await fetch(`/api/email-highlights/${highlightId}`, {
        method: "DELETE",
        credentials: "include",
      })
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
        credentials: "include",
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
    clearSelectionRef.current?.()
  }

  // ✅ 선택된 텍스트 “Share” = 하이라이트 공유 모드로 모달 오픈
  const handleShare = () => {
    if (!selectedText) return
    setHighlightToShare({ quote: selectedText })
    setShareTarget({ type: "highlight", quote: selectedText })
    setShowShareModal(true)
    setSelectedText("")
    setSelectionPosition(null)
    clearSelectionRef.current?.()
  }

  const handleShareHighlight = (h: Highlight) => {
    setHighlightToShare({ id: h.id, quote: h.quote })
    setShareTarget({ type: "highlight", highlightId: h.id, quote: h.quote })
    setShowShareModal(true)
  }

  /** comments CRUD */
  const handleAddComment = async () => {
    if (!isValidEmailId) return
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
        // ✅ 서버는 authorName/authorAvatarColor 저장 안 함 → 보내지 않음
        body: JSON.stringify({ text }),
        credentials: "include",
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
      const res = await fetch(`/api/email-comments/${commentId}`, {
        method: "DELETE",
        credentials: "include",
      })
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
        credentials: "include",
      })
      const data = await safeReadJson<ApiReactionToggleResponse>(res)
      if (!data.ok) throw new Error(data.error ?? "Failed to toggle reaction")

      setComments((cur) =>
        cur.map((c) => (c.id === commentId ? { ...c, reactions: data.reactions } : c))
      )
    } catch {
      setComments(prev)
    }
  }

  const availableEmojis = ["👍", "❤️", "🔥", "💡", "😂", "🤔", "👀", "🎉"]

  /** -----------------------------
   * Content (no early returns)
   * ------------------------------*/
  const content = !isValidEmailId ? (
    <div className="px-4 py-10 text-sm text-muted-foreground">Invalid email id.</div>
  ) : loading ? (
    <div className="px-4 py-10 text-sm text-muted-foreground">Loading…</div>
  ) : error ? (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-semibold text-foreground">Failed to load</div>
        <div className="mt-1 text-sm text-muted-foreground">{error}</div>
      </div>
    </div>
  ) : (
    <>
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

          {/* ✅ Fix #1: 긴 URL/문자열 overflow 방지 */}
          <p
            className={cn(
              "text-sm text-foreground/80 leading-relaxed max-w-full overflow-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word]",
              // URL 같은 "무구분 문자열"은 break-all이 가장 확실
              "[&_*]:break-all",
              !showMoreSummary && "line-clamp-3"
            )}
          >
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
            onClick={() => {
              setIsOriginalExpanded(!isOriginalExpanded)
              // 접을 때 떠있는 플로팅 바/선택도 함께 정리
              if (isOriginalExpanded) {
                setSelectedText("")
                setSelectionPosition(null)
                clearSelectionRef.current?.()
              }
            }}
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
                <div className="mt-3 rounded-xl bg-card p-3">
                  {sanitizedHtml ? (
                    // ✅ Fix #3: iframe로 원본 레이아웃 보존 + 더미 박스 문제 최소화
                    <iframe
                      ref={iframeRef}
                      title="Original email"
                      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                      className="w-full rounded-lg border border-border/60 bg-transparent"
                      style={{ height: iframeHeight }}
                      srcDoc={buildEmailSrcDoc(sanitizedHtml)}
                      onLoad={() => {
                        attachIframeHandlers()
                      }}
                    />
                  ) : (
                    <div className="p-1 text-sm text-foreground/80 whitespace-pre-wrap break-words">
                      {email.body}
                    </div>
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

                        {/* ✅ Reaction picker: click to open */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenReactionFor((cur) => (cur === comment.id ? null : comment.id))}
                            className="flex items-center justify-center h-6 w-6 rounded-full bg-secondary text-muted-foreground hover:bg-secondary/80"
                            aria-label="Add reaction"
                          >
                            <Plus className="h-3 w-3" />
                          </button>

                          {openReactionFor === comment.id && (
                            <div
                              ref={reactionPopoverRef}
                              className="absolute bottom-full left-0 mb-1 flex bg-card rounded-lg shadow-lg ring-1 ring-border p-1 gap-1 z-10"
                            >
                              {availableEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={async () => {
                                    await toggleReaction(comment.id, emoji)
                                    setOpenReactionFor(null)
                                  }}
                                  className="h-7 w-7 rounded hover:bg-secondary flex items-center justify-center text-sm"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
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
            clearSelectionRef.current?.()
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
              className={cn(
                "w-full max-w-md rounded-2xl bg-card p-4",
                "max-h-[85vh] overflow-hidden",
                "pb-[calc(env(safe-area-inset-bottom)+96px)]"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Share to Circle</h3>
                <button onClick={() => setShowShareModal(false)}>
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              {/* preview */}
              {shareTarget?.type === "highlight" && highlightToShare?.quote ? (
                <div className="mb-4 rounded-xl bg-yellow-500/10 p-3 border-l-2 border-yellow-500">
                  <p className="text-sm italic break-words [overflow-wrap:anywhere]">"{highlightToShare.quote}"</p>
                </div>
              ) : (
                <div className="mb-4 rounded-xl bg-secondary/40 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sharing this email</p>
                  <p className="text-sm font-medium break-words [overflow-wrap:anywhere]">{email.subject}</p>
                </div>
              )}

              {/* circles list */}
              {circlesLoading ? (
                <div className="py-6 text-sm text-muted-foreground">Loading circles…</div>
              ) : circlesError ? (
                <div className="py-4 text-sm text-destructive">{circlesError}</div>
              ) : circles.length === 0 ? (
                <div className="py-4 text-sm text-muted-foreground">No circles yet. Create or join a circle first.</div>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto pr-1 -mr-1">
                  <div className="space-y-2">
                    {circles.map((c) => (
                      <button
                        key={c.id}
                        disabled={sharing}
                        onClick={async () => {
                          const r = await shareEmailToCircle(c.id)
                          if (!r.ok) {
                            alert(r.error ?? "Share failed")
                            return
                          }

                          // ✅ duplicated 토스트 + 카운트
                          if (r.duplicated) {
                            toast({
                              title: "Already shared",
                              description: "This email is already shared to that circle.",
                            })
                          } else {
                            toast({ title: "Shared to circle ✅", description: "Added to your circle feed." })
                            incrementCircleShares()
                          }

                          // 2) 하이라이트 공유 모드면 기존 기능도 유지
                          if (shareTarget?.type === "highlight" && highlightToShare?.quote) {
                            if (!highlightToShare.id) {
                              const created = await createHighlight(highlightToShare.quote)
                              if (created) await markHighlightShared(created.id)
                            } else {
                              await markHighlightShared(highlightToShare.id)
                            }
                          }

                          setShowShareModal(false)
                          setHighlightToShare(null)
                          setShareTarget(null)
                          router.refresh()
                        }}
                        className={cn(
                          "w-full rounded-xl bg-secondary p-3 text-left text-sm font-medium hover:bg-secondary/80",
                          sharing && "opacity-60 cursor-not-allowed"
                        )}
                      >
                        {c.name ?? `Circle ${c.id.slice(0, 6)}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                    else {
                      toast({
                        title: "Select text first",
                        description: "원문에서 텍스트를 드래그한 다음 하이라이트를 눌러줘.",
                      })
                      setIsOriginalExpanded(true)
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
    </>
  )

  /** -----------------------------
   * Root UI (header is always present)
   * ------------------------------*/
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => forceToggle(setShowCreateOptions)}
            className="rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-secondary/80"
            aria-label="Create"
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={() => {
              setShareTarget({ type: "email" })
              setHighlightToShare(null)
              setShowShareModal(true)
            }}
            className="rounded-full bg-secondary p-2 text-secondary-foreground hover:bg-secondary/80"
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {content}
    </div>
  )
}
