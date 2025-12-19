import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}
async function getParam(ctx: any, key: string) {
  const p = await Promise.resolve(ctx?.params)
  return p?.[key] as string | undefined
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const commentId = await getParam(ctx, "commentId")
    if (!commentId || !isUuid(commentId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid commentId" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const emoji = typeof body?.emoji === "string" ? body.emoji.trim() : ""
    if (!emoji) return NextResponse.json({ ok: false, error: "Bad Request: empty emoji" }, { status: 400 })

    // ✅ 내 반응 존재 여부 확인
    const { data: existing } = await supabase
      .from("email_comment_reactions")
      .select("id")
      .eq("comment_id", commentId)
      .eq("user_id", auth.user.id)
      .eq("emoji", emoji)
      .maybeSingle()

    if (existing?.id) {
      await supabase.from("email_comment_reactions").delete().eq("id", existing.id)
    } else {
      await supabase.from("email_comment_reactions").insert({ comment_id: commentId, user_id: auth.user.id, emoji })
    }

    // ✅ 최신 reactions 재계산
    const { data: reacts } = await supabase
      .from("email_comment_reactions")
      .select("user_id,emoji")
      .eq("comment_id", commentId)

    const countMap: Record<string, number> = {}
    const reactedMap: Record<string, boolean> = {}
    for (const r of reacts ?? []) {
      countMap[r.emoji] = (countMap[r.emoji] ?? 0) + 1
      if (r.user_id === auth.user.id) reactedMap[r.emoji] = true
    }

    const reactions = Object.keys(countMap).map((e) => ({
      emoji: e,
      count: countMap[e],
      reacted: !!reactedMap[e],
    }))

    return NextResponse.json({ ok: true, reactions }, { status: 200 })
  } catch (e) {
    console.error("POST /api/email-comments/[commentId]/reactions error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
