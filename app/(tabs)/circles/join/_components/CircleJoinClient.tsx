// app/(tabs)/circles/join/_components/CircleJoinClient.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type JoinResponse =
  | { ok: true; circleId: string; circleName: string | null; alreadyMember: boolean }
  | { ok: false; error: string }

async function safeReadJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    return { ok: false, error: text || `HTTP ${res.status}` } as unknown as T
  }
}

export default function CircleJoinClient() {
  const router = useRouter()
  const sp = useSearchParams()

  const code = useMemo(() => (sp.get("code") ?? "").trim(), [sp])

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<JoinResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        setLoading(true)
        setData(null)

        if (!code) {
          setData({ ok: false, error: "Missing invite code" })
          return
        }

        const res = await fetch("/api/circles/join", {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        })

        const json = await safeReadJson<JoinResponse>(res)
        if (!res.ok || !json.ok) {
          setData({ ok: false, error: (json as any)?.error ?? `HTTP ${res.status}` })
          return
        }

        setData(json)

        // ✅ 자동 이동
        if (!cancelled) {
          router.replace(`/circles/${json.circleId}`)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, router])

  // UX: 자동 이동 전에 잠깐 보여주는 화면
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Joining circle…</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We’re validating your invite and adding you to the circle.
      </p>

      <div className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </div>
        ) : data?.ok ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Joined {data.circleName ?? "circle"} {data.alreadyMember ? "(already a member)" : ""}
            </div>
            <Button
              className="w-full rounded-xl"
              onClick={() => router.push(`/circles/${data.circleId}`)}
            >
              Go to circle
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {data?.error ?? "Failed to join"}
            </div>
            <Button
              variant="secondary"
              className="w-full rounded-xl"
              onClick={() => router.push("/circles")}
            >
              Back to circles
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
