import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> } // ✅ Next 16: params Promise
) {
  try {
    const { commentId } = await params // ✅ 반드시 await
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

    const userId = user.id

    // comment 존재 확인
    const { data: comment, error: cErr } = await supabase
      .from("comments")
      .select("id,email_id")
      .eq("id", commentId)
      .maybeSingle()

    if (cErr) {
      console.error("[reactions] comment read error:", cErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }
    if (!comment) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    // toggle existing reaction
    const { data: existing, error: eErr } = await supabase
      .from("comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .eq("emoji", emoji)
      .maybeSingle()

    if (eErr) {
      console.error("[reactions] existing read error:", eErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    if (existing?.id) {
      const { error: dErr } = await supabase.from("comment_reactions").delete().eq("id", existing.id)
      if (dErr) {
        console.error("[reactions] delete error:", dErr)
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
      }
    } else {
      const { error: iErr } = await supabase
        .from("comment_reactions")
        .insert({ comment_id: commentId, user_id: userId, emoji }) // ✅ 여기 있음

      if (iErr) {
        console.error("[reactions] insert error:", iErr)
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
      }
    }

    // 최신 reactions 재계산
    const { data: rows, error: rErr } = await supabase
      .from("comment_reactions")
      .select("user_id, emoji")
      .eq("comment_id", commentId)

    if (rErr) {
      console.error("[reactions] list error:", rErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const agg = new Map<string, { emoji: string; count: number; reacted: boolean }>()
    for (const r of rows ?? []) {
      const cur = agg.get(r.emoji) ?? { emoji: r.emoji, count: 0, reacted: false }
      cur.count += 1
      if (r.user_id === userId) cur.reacted = true
      agg.set(r.emoji, cur)
    }

    return NextResponse.json({ ok: true, reactions: Array.from(agg.values()) }, { status: 200 })
  } catch (e) {
    console.error("[reactions] fatal:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
