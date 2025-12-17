"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ChevronLeft, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

type InboxEmail = {
  id: string
  from_address: string | null
  subject: string | null
  body_text: string | null
  body_html: string | null
  received_at: string | null
  message_id: string | null
  raw: any
}

function formatTime(iso: string | null) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function InboxEmailDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = String(params?.id ?? "")

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<InboxEmail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/inbox-emails/${id}`, { cache: "no-store" })
        const json = await res.json()

        if (!mounted) return

        if (!res.ok) {
          setEmail(null)
          setError(json?.error ?? "Failed to load email")
          return
        }

        setEmail(json.email)
      } catch (e: any) {
        if (!mounted) return
        setError(e?.message ?? "Unexpected error")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (id) run()
    return () => {
      mounted = false
    }
  }, [id])

  const hasHtml = useMemo(() => Boolean(email?.body_html && email.body_html.trim()), [email])

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-border p-6">
          <p className="text-sm text-red-500">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            (If you see 401, you’re not logged in. If 404, the email may not belong to you.)
          </p>
        </div>
      ) : !email ? (
        <div className="rounded-2xl border border-border p-6">
          <p className="text-sm text-muted-foreground">No email found.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border/60 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted-foreground">{email.from_address ?? "Unknown sender"}</div>
                <h1 className="mt-1 text-xl font-semibold leading-snug">
                  {email.subject || "(no subject)"}
                </h1>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {email.received_at ? <span>{formatTime(email.received_at)}</span> : null}
                  {email.message_id ? <span className="truncate">msg: {email.message_id}</span> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-card p-5 ring-1 ring-border/60 shadow-sm">
            {hasHtml ? (
              <div
                className={cn("prose max-w-none")}
                // ⚠️ HTML은 원본 그대로라 XSS 위험 가능.
                // 지금은 “뉴스레터” 목적이라 허용하지만, 나중엔 sanitize 추천.
                dangerouslySetInnerHTML={{ __html: email.body_html! }}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {email.body_text || "(empty body)"}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  )
}
