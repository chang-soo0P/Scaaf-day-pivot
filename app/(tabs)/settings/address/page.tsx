"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Copy, Mail, RefreshCw, Sparkles } from "lucide-react"

type AddressRow = {
  id: string
  user_id: string | null
  local_part: string
  domain: string
  full_address: string
  claim_token: string | null
  status: string
  last_received_at: string | null
}

type ApiMe = { ok: true; address: AddressRow | null } | { ok: false; error?: string }
type ApiCreate = { ok: true; address: AddressRow } | { ok: false; error?: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

export default function AddressSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [address, setAddress] = useState<AddressRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/addresses/me", { cache: "no-store", credentials: "include" })
      const data = await safeReadJson<ApiMe>(res)
      if (!res.ok || !data.ok) {
        setAddress(null)
        setError((data as any)?.error ?? `HTTP ${res.status}`)
      } else {
        setAddress(data.address ?? null)
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load")
      setAddress(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const createAddress = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/addresses/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}), // 원하면 { localPart: "myname" }도 가능
        credentials: "include",
      })
      const data = await safeReadJson<ApiCreate>(res)
      if (!res.ok || !data.ok) {
        setError((data as any)?.error ?? `HTTP ${res.status}`)
        return
      }
      setAddress(data.address)
    } catch (e: any) {
      setError(e?.message ?? "Failed to create")
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => {
    if (!address?.full_address) return
    await navigator.clipboard.writeText(address.full_address)
  }

  return (
    <div className="px-4 pb-24">
      <div className="pt-4">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">Your Scaaf Address</h1>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          이 주소로 뉴스레터를 구독하면 메일이 자동으로 Inbox에 들어와.
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-card p-4 ring-1 ring-border/60">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : address ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Your address</div>
                <div className="mt-1 text-sm font-semibold text-foreground break-all">
                  {address.full_address}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Status: {address.status}
                  {address.last_received_at ? ` • Last received: ${new Date(address.last_received_at).toLocaleString()}` : ""}
                </div>
              </div>

              <button
                onClick={copy}
                className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-secondary/40 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Sparkles className="h-4 w-4" />
                Test steps
              </div>
              <ol className="mt-2 space-y-1 text-xs text-muted-foreground list-decimal pl-4">
                <li>위 주소로 뉴스레터(또는 테스트 메일) 1통 보내기</li>
                <li>Mailgun inbound webhook이 /api/inbound-email/mailgun/inbound 로 들어오는지 확인</li>
                <li>Supabase 테이블 inbox_emails에 row 생성 확인</li>
                <li>앱 Inbox에서 메일 표시되는지 확인</li>
              </ol>
            </div>

            <button
              onClick={load}
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
              )}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-foreground">No address yet</div>
            <p className="mt-1 text-sm text-muted-foreground">
              먼저 @scaaf.day 주소를 만들고, 그 주소로 뉴스레터를 구독해보자.
            </p>
            <button
              onClick={createAddress}
              disabled={creating}
              className={cn(
                "mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90",
                creating && "opacity-60 cursor-not-allowed"
              )}
            >
              <Sparkles className="h-4 w-4" />
              {creating ? "Creating…" : "Create my @scaaf.day"}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
