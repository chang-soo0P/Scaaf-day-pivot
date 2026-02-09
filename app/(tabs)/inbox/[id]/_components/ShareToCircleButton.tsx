// app/(tabs)/inbox/[id]/_components/ShareToCircleButton.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type CircleItem = { id: string; name?: string | null }
type ApiCirclesListResponse = { ok: true; circles: CircleItem[] } | { ok: false; error?: string }
type ApiShareResponse = { ok: true; duplicated?: boolean } | { ok: false; error?: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

export default function ShareToCircleButton({
  emailId,
  highlightId, // ✅ 선택
  className,
  children,
}: {
  emailId: string
  highlightId?: string
  className?: string
  children?: React.ReactNode
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [circles, setCircles] = useState<CircleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    ;(async () => {
      setLoading(true)
      const res = await fetch("/api/circles?limit=50", { cache: "no-store", credentials: "include" })
      const data = await safeReadJson<ApiCirclesListResponse>(res)
      if (cancelled) return
      setLoading(false)

      if (!res.ok || !data.ok) {
        toast({ title: "Failed to load circles", description: (data as any)?.error ?? "" })
        setCircles([])
        return
      }
      setCircles(data.circles ?? [])
    })()

    return () => {
      cancelled = true
    }
  }, [open, toast])

  async function share(circleId: string) {
    setSharing(true)
    try {
      const body: any = { circleId, emailId }
      if (highlightId) body.highlightId = highlightId // ✅ 있을 때만

      const res = await fetch("/api/circles/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      })

      const data = await safeReadJson<ApiShareResponse>(res)
      if (!res.ok || !data.ok) {
        toast({ title: "Share failed", description: (data as any)?.error ?? `HTTP ${res.status}` })
        return
      }

      if (data.duplicated) {
        toast({ title: "Already shared", description: "This email is already shared to that circle." })
      } else {
        toast({ title: "Shared ✅", description: "Added to your circle feed." })
      }

      setOpen(false)
      router.refresh()
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("rounded-xl bg-secondary px-3 py-2 text-sm", className)}
      >
        {children ?? "Share to circle"}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div
            className="mx-auto mt-20 w-full max-w-md rounded-2xl bg-card p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 text-sm font-semibold">Choose a circle</div>

            {loading ? (
              <div className="py-6 text-sm text-muted-foreground">Loading…</div>
            ) : circles.length === 0 ? (
              <div className="py-6 text-sm text-muted-foreground">No circles.</div>
            ) : (
              <div className="space-y-2">
                {circles.map((c) => (
                  <button
                    key={c.id}
                    disabled={sharing}
                    onClick={() => share(c.id)}
                    className={cn(
                      "w-full rounded-xl bg-secondary p-3 text-left text-sm hover:bg-secondary/80",
                      sharing && "opacity-60"
                    )}
                  >
                    {c.name ?? c.id.slice(0, 6)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
