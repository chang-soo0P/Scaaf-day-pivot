import { NextResponse } from "next/server"
import { supabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function avatarColorFromId(id: string) {
  // deterministic-ish
  const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return colors[hash % colors.length]
}

export async function GET(_: Request, { params }: { params: { emailId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const emailId = params.emailId

    // 소유자 체크
    const { data: emailRow } = await supabase.from("inbox_emails").select("id,user_id").eq("id", emailId).single()
    if (!emailRow) return NextResponse.json({ ok: false, error: "Email not found" }, { status: 404 })
    if (emailRow.user_id !== user.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

    const { data: comments, error: cErr } = await supabase
      .from("email_comments")
      .select("id,user_id,text,created_at")
      .eq("email_id", emailId)
      .order("created_at", { ascending: false })

    if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

    const ids = (comments ?? []).map((c) => c.id)
    let reactionsRows: Array<{ comment_id: string; emoji: string; user_id: string }> = []
    if (ids.length) {
      const { data: r, error: rErr } = await supabase
        .from("comment_reactions")
        .select("comment_id,emoji,user_id")
        .in("comment_id", ids)

      if (rErr) return NextResponse.json({ ok: false, error: rErr.message }, { status: 500 })
      reactionsRows = r ?? []
    }

    const reactionsByComment = new Map<string, Map<string, { count: number; reacted: boolean }>>()
    for (const row of reactionsRows) {
      if (!reactionsByComment.has(row.comment_id)) reactionsByComment.set(row.comment_id, new Map())
      const perEmoji = reactionsByComment.get(row.comment_id)!
      const curr = perEmoji.get(row.emoji) ?? { count: 0, reacted: false }
      perEmoji.set(row.emoji, {
        count: curr.count + 1,
        reacted: curr.reacted || row.user_id === user.id,
      })
    }

    const payload = (comments ?? []).map((c) => {
      const perEmoji = reactionsByComment.get(c.id) ?? new Map()
      const reactions = Array.from(perEmoji.entries()).map(([emoji, v]) => ({
        emoji,
        count: v.count,
        reacted: v.reacted,
      }))

      return {
        id: c.id,
        authorName: c.user_id === user.id ? "You" : "Friend",
        authorAvatarColor: avatarColorFromId(c.user_id ?? c.id),
        text: c.text,
        createdAt: c.created_at,
        reactions,
      }
    })

    return NextResponse.json({ ok: true, comments: payload }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { emailId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const emailId = params.emailId
    const body = await req.json().catch(() => ({}))
    const text = String(body?.text ?? "").trim()
    if (!text) return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 })

    // 소유자 체크
    const { data: emailRow } = await supabase.from("inbox_emails").select("id,user_id").eq("id", emailId).single()
    if (!emailRow) return NextResponse.json({ ok: false, error: "Email not found" }, { status: 404 })
    if (emailRow.user_id !== user.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("email_comments")
      .insert({ email_id: emailId, user_id: user.id, text })
      .select("id,user_id,text,created_at")
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: data.id,
          authorName: "You",
          authorAvatarColor: "#3b82f6",
          text: data.text,
          createdAt: data.created_at,
          reactions: [],
        },
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
