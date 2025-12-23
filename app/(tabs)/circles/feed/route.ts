import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200)

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase.rpc("get_circle_feed", { p_limit: limit })

    if (error) {
      console.error("[circles/feed] rpc error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, items: data ?? [] }, { status: 200 })
  } catch (e) {
    console.error("[circles/feed] fatal:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
