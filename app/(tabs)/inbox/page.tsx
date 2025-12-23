"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"
import { Grid3X3, LayoutList, Mail } from "lucide-react"

// ---- Types ----
type InboxEmailRow = {
  id: string
  from_address: string | null
  subject: string | null
  received_at: string | null
}

type ApiInboxListResponse =
  | { ok: true; items: InboxEmailRow[]; nextCursor?: string | null }
  | { ok: false; error?: string }

// ---- Helpers ----
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

function formatTime(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleString()
}

// ---- UI ----
type LayoutMode = "list" | "grid"

function EmailCard({
  item,
  onOpen,
  layout,
}: {
  item: InboxEmailRow
  onOpen: () => void
  layout: LayoutMode
}) {
  const from = item.from_address ?? "Unknown"
  const sender = extractNameFromEmail(from)
  const subject = item.subject ?? "(no subject)"
  const time = formatTime(item.received_at)

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md",
        layout === "grid" && "min-h-[120px]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
          <Mail className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">{sender}</div>
              <div className="mt-0.5 line-clamp-2 text-sm text-foreground/80">{subject}</div>
            </div>
            {time ? <div className="shrink-0 text-[10px] text-muted-foreground">{time}</div> : null}
          </div>
        </div>
      </div>
    </button>
  )
}

export default function InboxPage() {
  const router = useRouter()

  const [layout, setLayout] = useState<LayoutMode>("list")
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InboxEmailRow[]>([])
  const [error, setError] = useState<string | null>(null)

  // (Optional) 간단 검색
  const [q, setQ] = useState("")
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return items
    return items.filter((it) => {
      const from = (it.from_address ?? "").toLowerCase()
      const subject = (it.subject ?? "").toLowerCase()
      return from.includes(qq) || subject.includes(qq)
    })
  }, [items, q])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)

        // ✅ 여기서 "내 inbox 메일 목록" API를 호출해야 함
        // 프로젝트에 이미 존재하는 리스트 API 경로에 맞춰 사용해줘.
        const res = await fetch(`/api/inbox-emails?limit=50`, {
          cache: "no-store",
          credentials: "include",
        })
        const data = await safeReadJson<ApiInboxListResponse>(res)
        if (cancelled) return

        if (!data.ok) {
          setItems([])
          setError(data.error ?? "Failed to load inbox")
          setLoading(false)
          return
        }

        setItems(data.items ?? [])
        setLoading(false)
      } catch (e: any) {
        if (cancelled) return
        setItems([])
        setError(e?.message ?? "Failed to load inbox")
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const openEmail = (id: string) => {
    const href = emailDetailHref(id)
    if (!href) return
    router.push(href)
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-background pt-4 pb-3">
        <div className="mx-4 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-semibold text-foreground">Inbox</div>
            <div className="text-xs text-muted-foreground">Your emails</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLayout("list")}
              className={cn(
                "rounded-xl p-2 ring-1 ring-border/70",
                layout === "list" ? "bg-card text-foreground" : "bg-transparent text-muted-foreground"
              )}
              aria-label="List layout"
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setLayout("grid")}
              className={cn(
                "rounded-xl p-2 ring-1 ring-border/70",
                layout === "grid" ? "bg-card text-foreground" : "bg-transparent text-muted-foreground"
              )}
              aria-label="Grid layout"
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-4 mt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sender or subject…"
            className="w-full rounded-xl bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No emails.</div>
        ) : layout === "list" ? (
          <div className="space-y-3">
            {filtered.map((it) => (
              <EmailCard key={it.id} item={it} layout={layout} onOpen={() => openEmail(it.id)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filtered.map((it) => (
              <EmailCard key={it.id} item={it} layout={layout} onOpen={() => openEmail(it.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
