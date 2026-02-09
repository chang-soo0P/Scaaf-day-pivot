// app/(tabs)/circles/join/page.tsx
import { Suspense } from "react"
import CircleJoinClient from "./_components/CircleJoinClient"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default function CircleJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-xl font-semibold">Joining circle…</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We’re validating your invite and adding you to the circle.
          </p>

          <div className="mt-6 rounded-2xl bg-card p-5 ring-1 ring-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Processing…
            </div>
          </div>
        </div>
      }
    >
      <CircleJoinClient />
    </Suspense>
  )
}
