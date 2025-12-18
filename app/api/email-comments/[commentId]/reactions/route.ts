import { NextResponse } from "next/server"
import { supabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: { commentId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const commentId = params.commentId
    const body = await req.json().catch(() => ({}))
    const emoji = String(body?.emoji ?? "").trim()
    if (!emoji) return NextResponse.json({ ok: false, error: "Missing emoji" }, { status: 400 })

    // 존재하면 삭제, 없으면 추가 (토글)
    const { data: existing } = await supabase
      .from("comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from("comment_reactions").delete().eq("id", existing.id)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from("comment_reactions").insert({ comment_id: commentId, user_id: user.id, emoji })
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    // 최신 집계 반환
    const { data: rows, error: rErr } = await supabase
      .from("comment_reactions")
      .select("emoji,user_id")
      .eq("comment_id", commentId)

    if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 })

    const map = new Map<string, { count: number; reacted: boolean }>()
    for (const r of rows ?? []) {
      const curr = map.get(r.emoji) ?? { count: 0, reacted: false }
      map.set(r.emoji, { count: curr.count + 1, reacted: curr.reacted || r.user_id === user.id })
    }

    const reactions = Array.from(map.entries()).map(([emoji, v]) => ({ emoji, count: v.count, reacted: v.reacted }))
    return NextResponse.json({ ok: true, reactions }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
