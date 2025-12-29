"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Copy, Mail, RefreshCw, Sparkles, AlertTriangle } from "lucide-react"

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

const DOMAIN_FALLBACK = "scaaf.day"

// 3~32 chars, first must be a-z0-9, allowed: a-z0-9._-
const LOCAL_PART_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/

function normalizeLocalPart(input: string) {
  let v = (input ?? "").trim().toLowerCase()

  // 사용자가 email을 통째로 붙여넣은 경우(local@domain) → local만 추출
  if (v.includes("@")) v = v.split("@")[0] ?? ""

  // 공백 제거
  v = v.replace(/\s+/g, "")

  // 허용 문자만 남기기(UX)
  v = v.replace(/[^a-z0-9._-]/g, "")

  return v
}

function localPartError(v: string) {
  if (!v) return "원하는 주소를 입력해줘."
  if (v.length < 3) return "너무 짧아. 3자 이상이어야 해."
  if (v.length > 32) return "너무 길어. 32자 이하로 입력해줘."
  if (!/^[a-z0-9]/.test(v)) return "첫 글자는 a-z 또는 0-9 로 시작해야 해."
  if (!/^[a-z0-9._-]+$/.test(v)) return "허용 문자는 a-z, 0-9, . _ - 만 가능해."
  if (!LOCAL_PART_RE.test(v)) return "형식이 맞지 않아. (예: marv_01, scaaf.day)"
  return null
}

export default function AddressSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [address, setAddress] = useState<AddressRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ✅ 입력 UI
  const [rawLocalPart, setRawLocalPart] = useState("")
  const localPart = useMemo(() => normalizeLocalPart(rawLocalPart), [rawLocalPart])
  const localPartErr = useMemo(() => localPartError(localPart), [localPart])
  const canCreate = !localPartErr && !!localPart

  const domainForPreview = address?.domain || DOMAIN_FALLBACK
  const previewAddress = localPart ? `${localPart}@${domainForPreview}` : `yourname@${domainForPreview}`

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
      const payload = { localPart } // 서버에서 localPart 받도록 맞춰둔 기준
      const res = await fetch("/api/addresses/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0">{error}</div>
          </div>
        ) : address ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Your address</div>
                <div className="mt-1 text-sm font-semibold text-foreground break-all">{address.full_address}</div>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  Status: {address.status}
                  {address.last_received_at
                    ? ` • Last received: ${new Date(address.last_received_at).toLocaleString()}`
                    : ""}
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
            <div className="text-sm font-semibold text-foreground">Create your @scaaf.day</div>
            <p className="mt-1 text-sm text-muted-foreground">
              원하는 주소를 정하고, 그 주소로 뉴스레터를 구독해보자.
            </p>

            {/* ✅ localPart 입력 */}
            <div className="mt-4">
              <label className="block text-xs font-medium text-muted-foreground">Address</label>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 rounded-2xl bg-secondary/40 ring-1 ring-border/60 px-3 py-2">
                  <input
                    value={rawLocalPart}
                    onChange={(e) => setRawLocalPart(e.target.value)}
                    placeholder="e.g. marv_01"
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setRawLocalPart((v) => (v ? "" : "marv_01"))}
                  className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
                >
                  {rawLocalPart ? "Clear" : "Example"}
                </button>
              </div>

              <div className="mt-2 text-xs">
                <span className="text-muted-foreground">Preview: </span>
                <span className="font-medium text-foreground">{previewAddress}</span>
              </div>

              {localPartErr ? (
                <div className="mt-2 text-xs text-destructive">{localPartErr}</div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">
                  규칙: 3~32자 / a-z, 0-9, . _ - / 첫 글자는 a-z 또는 0-9
                </div>
              )}
            </div>

            <button
              onClick={createAddress}
              disabled={creating || !canCreate}
              className={cn(
                "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90",
                (creating || !canCreate) && "opacity-60 cursor-not-allowed"
              )}
            >
              <Sparkles className="h-4 w-4" />
              {creating ? "Creating…" : "Create my @scaaf.day"}
            </button>

            <button
              onClick={load}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/80"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </>
        )}
      </div>
    </div>
  )
}
