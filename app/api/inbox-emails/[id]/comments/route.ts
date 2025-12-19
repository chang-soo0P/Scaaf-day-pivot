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
async function assertOwnedEmail(supabase: any, emailId: string, userId: string) {
  const { data, error } = await supabase.from("inbox_emails").select("id,user_id").eq("id", emailId).single()
  if (error || !data) return null
  if (data.user_id !== userId) return null
  return data
}

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const emailId = await getParam(ctx, "id")
    if (!emailId || !isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid id" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const owned = await assertOwnedEmail(supabase, emailId, auth.user.id)
    if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const { data: rows, error } = await supabase
      .from("email_comments")
      .select("id,email_id,user_id,text,created_at")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

    const commentIds = (rows ?? []).map((r: any) => r.id)
    let reactionsByComment: Record<string, any[]> = {}

    if (commentIds.length) {
      const { data: reacts } = await supabase
        .from("email_comment_reactions")
        .select("comment_id,user_id,emoji,created_at")
        .in("comment_id", commentIds)

      const map: Record<string, { emoji: string; count: number; reacted: boolean }[]> = {}
      const countMap: Record<string, Record<string, number>> = {}
      const reactedMap: Record<string, Record<string, boolean>> = {}

      for (const r of reacts ?? []) {
        const cid = r.comment_id
        const emoji = r.emoji
        countMap[cid] ||= {}
        reactedMap[cid] ||= {}
        countMap[cid][emoji] = (countMap[cid][emoji] ?? 0) + 1
        if (r.user_id === auth.user.id) reactedMap[cid][emoji] = true
      }

      for (const cid of Object.keys(countMap)) {
        map[cid] = Object.keys(countMap[cid]).map((emoji) => ({
          emoji,
          count: countMap[cid][emoji],
          reacted: !!reactedMap[cid]?.[emoji],
        }))
      }

      reactionsByComment = map as any
    }

    const comments =
      (rows ?? []).map((c: any) => ({
        id: c.id,
        authorName: "You",
        authorAvatarColor: "#3b82f6",
        text: c.text,
        createdAt: c.created_at,
        reactions: reactionsByComment[c.id] ?? [],
      })) ?? []

    return NextResponse.json({ ok: true, comments }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const emailId = await getParam(ctx, "id")
    if (!emailId || !isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid id" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const owned = await assertOwnedEmail(supabase, emailId, auth.user.id)
    if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    if (!text) return NextResponse.json({ ok: false, error: "Bad Request: empty text" }, { status: 400 })

    const { data, error } = await supabase
      .from("email_comments")
      .insert({ email_id: emailId, user_id: auth.user.id, text })
      .select("id,text,created_at")
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

    const comment = {
      id: data.id,
      authorName: "You",
      authorAvatarColor: "#3b82f6",
      text: data.text,
      createdAt: data.created_at,
      reactions: [],
    }

    return NextResponse.json({ ok: true, comment }, { status: 200 })
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
