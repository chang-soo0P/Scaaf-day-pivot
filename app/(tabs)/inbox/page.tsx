"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"
import { Mail, RefreshCw, Sparkles, Target, Copy, AtSign } from "lucide-react"
import { TodayMissionCard } from "@/components/today-mission-card"
import { useDailyMission } from "@/hooks/use-daily-mission"
import { useToast } from "@/hooks/use-toast"

type InboxEmailRow = {
  id: string
  from_address: string | null
  subject: string | null
  received_at: string | null
}

type ApiInboxListResponse = { ok: true; items: InboxEmailRow[] } | { ok: false; error?: string }

type AddressRow = {
  id: string
  local_part: string
  domain: string
  full_address: string
  status: string
}

type ApiAddressMeResponse = { ok: true; address: AddressRow } | { ok: false; error?: string }

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

function SkeletonRow() {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
      <div className="h-4 w-40 animate-pulse rounded bg-secondary" />
      <div className="mt-2 h-3 w-64 animate-pulse rounded bg-secondary" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-secondary" />
    </div>
  )
}

export default function InboxPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<InboxEmailRow[]>([])
  const [error, setError] = useState<string | null>(null)

  // ✅ Address card state
  const [addrLoading, setAddrLoading] = useState(true)
  const [address, setAddress] = useState<AddressRow | null>(null)
  const [addrError, setAddrError] = useState<string | null>(null)

  // ✅ Daily mission
  const { state: missionState } = useDailyMission()

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch("/api/inbox-emails?limit=50", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await safeReadJson<ApiInboxListResponse>(res)

      if (!res.ok || !data.ok) {
        setItems([])
        setError((data as any)?.error ?? `HTTP ${res.status}`)
        setLoading(false)
        return
      }

      setItems(data.items ?? [])
      setLoading(false)
    } catch (e: any) {
      setItems([])
      setError(e?.message ?? "Failed to load inbox")
      setLoading(false)
    }
  }

  async function loadAddress() {
    try {
      setAddrLoading(true)
      setAddrError(null)

      const res = await fetch("/api/addresses/me", { cache: "no-store", credentials: "include" })
      const data = await safeReadJson<ApiAddressMeResponse>(res)

      if (!res.ok || !data.ok) {
        setAddress(null)
        setAddrError((data as any)?.error ?? `HTTP ${res.status}`)
        setAddrLoading(false)
        return
      }

      setAddress(data.address)
      setAddrLoading(false)
    } catch (e: any) {
      setAddress(null)
      setAddrError(e?.message ?? "Failed to load address")
      setAddrLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadAddress()
  }, [])

  const mapped = useMemo(() => {
    return items.map((row) => {
      const from = row.from_address ?? "Unknown"
      const sender = extractNameFromEmail(from)
      return {
        ...row,
        sender,
        subject: row.subject ?? "(no subject)",
        when: formatTime(row.received_at),
      }
    })
  }, [items])

  const openEmail = (id: string) => {
    const href = emailDetailHref(id) ?? `/inbox/${id}`
    router.push(href)
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Inbox</h1>
          </div>

          <button
            onClick={load}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80",
              loading && "opacity-60 cursor-not-allowed"
            )}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">Latest emails you received.</p>
      </div>

      <div className="flex-1 px-4 pb-24">
        {/* ✅ 0) Your Scaaf Address */}
        <div className="mt-3 mb-4 rounded-2xl bg-card p-4 ring-1 ring-border/60 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <AtSign className="h-4 w-4 text-primary" />
                <div className="text-sm font-semibold text-foreground">Your Scaaf address</div>
              </div>

              {addrLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Issuing address…</p>
              ) : addrError ? (
                <p className="mt-2 text-sm text-destructive">{addrError}</p>
              ) : address ? (
                <>
                  <p className="mt-2 text-base font-semibold text-foreground">{address.full_address}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    뉴스레터 구독 이메일 주소를 위 주소로 바꾸면 바로 수신/요약/하이라이트/공유 테스트 가능.
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No address</p>
              )}
            </div>

            <button
              type="button"
              disabled={!address?.full_address || addrLoading}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(address?.full_address ?? "")
                  toast({ title: "Copied", description: "수신 주소를 클립보드에 복사했어." })
                } catch {
                  toast({ title: "Copy failed", description: "브라우저 권한 때문에 복사에 실패했어." })
                }
              }}
              className={cn(
                "shrink-0 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80",
                (!address?.full_address || addrLoading) && "opacity-60 cursor-not-allowed"
              )}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
        </div>

        {/* ✅ 1) Daily mission (기존 유지) */}
        <div className="mb-4">
          <TodayMissionCard state={missionState} />
        </div>

        {loading ? (
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <div className="text-sm font-semibold text-foreground">Failed to load</div>
            <div className="mt-1 text-sm text-muted-foreground">{error}</div>
          </div>
        ) : mapped.length === 0 ? (
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border/60">
            <div className="text-sm font-semibold text-foreground">No emails</div>
            <div className="mt-1 text-sm text-muted-foreground">There are no emails yet.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {mapped.map((row) => (
              <button
                key={row.id}
                onClick={() => openEmail(row.id)}
                className="w-full text-left rounded-2xl bg-card p-4 ring-1 ring-border/60 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground line-clamp-1">{row.subject}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-1">from {row.sender}</div>
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground">{row.when}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
