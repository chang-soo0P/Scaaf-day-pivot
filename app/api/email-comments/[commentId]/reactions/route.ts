import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const { commentId } = await params
    if (!isUuid(commentId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const body = await req.json().catch(() => ({}))
    const emoji = typeof body?.emoji === "string" ? body.emoji : ""
    if (!emoji) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // ✅ DB에서 토글 + 최신 집계까지 한 번에 반환
    const { data, error } = await supabase.rpc("toggle_comment_reaction", {
      p_comment_id: commentId,
      p_emoji: emoji,
    })

    if (error) {
      console.error("[reactions rpc] error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    // data = jsonb array
    const reactions = Array.isArray(data) ? data : []

    return NextResponse.json({ ok: true, reactions }, { status: 200 })
  } catch (e) {
    console.error("[reactions] fatal:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
