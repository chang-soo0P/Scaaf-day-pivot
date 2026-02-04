// app/(tabs)/inbox/[id]/_components/ShareToCircleButton.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Share2, Check, X } from "lucide-react"

type Circle = { id: string; name: string | null }

type CirclesResp =
  | { ok: true; circles: Circle[] }
  | { ok: false; error?: string }

type ShareResp =
  | { ok: true; shareId: string; circleId: string; emailId: string }
  | { ok: false; error: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

export default function ShareToCircleButton({ emailId }: { emailId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loadingCircles, setLoadingCircles] = useState(false)
  const [circles, setCircles] = useState<Circle[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  const [sharing, setSharing] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadCircles = async () => {
    setLoadingCircles(true)
    setError(null)
    try {
      const res = await fetch("/api/circles?limit=50", {
        cache: "no-store",
        credentials: "include",
      })
      const data = await safeReadJson<CirclesResp>(res)
      if (!res.ok || !data.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`)

      setCircles((data as any).circles ?? [])
    } catch (e: any) {
      setError(e?.message ?? "Failed to load circles")
      setCircles([])
    } finally {
      setLoadingCircles(false)
    }
  }

  useEffect(() => {
    if (open && circles.length === 0) void loadCircles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedCircle = useMemo(() => circles.find((c) => c.id === selected) ?? null, [circles, selected])

  const share = async () => {
    if (!selected) return
    setSharing(true)
    setError(null)
    try {
      const res = await fetch("/api/circles/share", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ circleId: selected, emailId }),
      })
      const data = await safeReadJson<ShareResp>(res)
      if (!res.ok || !data.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`)

      setDone(true)

      // ✅ 공유 후: circle 상세로 이동 (원하면 toast만 띄우고 stay도 가능)
      setTimeout(() => {
        setOpen(false)
        router.push(`/circles/${data.circleId}`)
        router.refresh()
      }, 350)
    } catch (e: any) {
      setError(e?.message ?? "Share failed")
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <Button className="w-full gap-2 rounded-xl" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        Share to circle
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background p-4 shadow-xl ring-1 ring-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Share to a circle</h3>
                <p className="text-xs text-muted-foreground">Choose a circle to share this email.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-secondary p-3">
              {loadingCircles ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading circles…
                </div>
              ) : circles.length ? (
                <div className="max-h-64 space-y-2 overflow-auto">
                  {circles.map((c) => {
                    const active = c.id === selected
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelected(c.id)}
                        className={[
                          "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ring-1 transition-colors",
                          active ? "bg-card ring-primary" : "bg-background ring-border hover:bg-card",
                        ].join(" ")}
                      >
                        <span className="truncate">{c.name ?? "Circle"}</span>
                        {active ? <Check className="h-4 w-4 text-primary" /> : null}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No circles yet.</div>
              )}
            </div>

            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1 rounded-xl" onClick={loadCircles} disabled={loadingCircles}>
                Reload
              </Button>

              <Button
                className="flex-1 rounded-xl"
                onClick={share}
                disabled={!selected || sharing || loadingCircles}
              >
                {sharing ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sharing…
                  </span>
                ) : done ? (
                  <span className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Shared
                  </span>
                ) : (
                  `Share${selectedCircle?.name ? ` to ${selectedCircle.name}` : ""}`
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
