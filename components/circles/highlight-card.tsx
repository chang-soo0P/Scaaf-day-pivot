// components/circles/highlight-card.tsx
"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export type HighlightItem = {
  id: string // highlightId
  circleId: string
  circleName: string | null
  emailId: string
  quote: string
  memo: string | null
  createdAt: string
  sharedBy: string
  sharedByProfile: { id: string; name: string; avatarUrl: string | null } | null
  subject: string
  fromAddress: string
  receivedAt: string | null
}

function formatDateTime(iso?: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString()
}

export default function HighlightCard({ item }: { item: HighlightItem }) {
  const isShort = (item.quote ?? "").trim().length < 15

  // ✅ 이메일 상세로 이동 (highlightId도 같이 넘겨두면 추후 딥링크/강조 UX에 활용 가능)
  const href = `/inbox/${item.emailId}?fromCircle=1&highlightId=${encodeURIComponent(item.id)}&circleId=${encodeURIComponent(
    item.circleId
  )}`

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border bg-white/60 backdrop-blur p-4 shadow-sm",
        "transition-colors hover:bg-white/80",
        "focus:outline-none focus:ring-2 focus:ring-primary/30"
      )}
      aria-label={`Open email: ${item.subject || "No subject"}`}
      prefetch={false}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">
            {item.subject || "(No subject)"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground truncate">
            {item.fromAddress}
            {item.receivedAt ? ` · received ${formatDateTime(item.receivedAt)}` : ""}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">
            {formatDateTime(item.createdAt)}
          </div>
          <div className="mt-1 text-xs">
            <span className="font-medium">
              {item.sharedByProfile?.name ?? "Unknown"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        {isShort ? (
          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs">
            {item.quote}
          </div>
        ) : (
          <p className={cn("text-sm leading-relaxed whitespace-pre-wrap")}>
            {item.quote}
          </p>
        )}
      </div>

      {item.memo ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm">
          {item.memo}
        </div>
      ) : null}
    </Link>
  )
}
