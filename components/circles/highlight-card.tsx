// components/circles/highlight-card.tsx
"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"

export type HighlightItem = {
  id: string
  circleId: string
  circleName: string | null
  emailId: string
  quote: string
  memo: string | null
  createdAt: string
  sharedBy: string
  sharedByProfile: { id: string; name: string; avatarUrl: string | null }
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

  // ✅ 이메일 상세 라우트가 다르면 여기만 바꾸면 됨
  const href = `/inbox/${item.emailId}`

  return (
    <Link href={href} className="block">
      <div className="rounded-2xl border bg-white/60 backdrop-blur p-4 shadow-sm transition hover:bg-white/80">
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
      </div>
    </Link>
  )
}
