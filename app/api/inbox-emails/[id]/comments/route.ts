// app/api/inbox-emails/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function validateEmailOwnership(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  emailId: string,
  userId: string
): Promise<boolean> {
  const { data: emailRow, error } = await supabase
    .from("inbox_emails")
    .select("id,user_id")
    .eq("id", emailId)
    .single()

  if (error || !emailRow) return false
  return emailRow.user_id === userId
}

/**
 * Helper: Generate avatar color from ID
 */
function avatarColorFromId(id: string): string {
  const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"]
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length]
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params?.id

    // "undefined" 같은 잘못된 호출은 400으로 빨리 컷
    if (!id || id === "undefined" || id === "null") {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // 서버에서 세션 못 읽으면 여기로 떨어짐(401)
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        {
          status: 401,
          headers: { "cache-control": "no-store" },
        }
      )
    }

    // Ownership check
    const isOwner = await validateEmailOwnership(supabase, id, user.id)
    if (!isOwner) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // Fetch comments
    const { data: comments, error: cErr } = await supabase
      .from("email_comments")
      .select("id,user_id,text,created_at")
      .eq("email_id", id)
      .order("created_at", { ascending: false })

    if (cErr) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    // Fetch reactions for all comments
    const commentIds = (comments ?? []).map((c) => c.id)
    let reactionsRows: Array<{ comment_id: string; emoji: string; user_id: string }> = []

    if (commentIds.length > 0) {
      const { data: r, error: rErr } = await supabase
        .from("comment_reactions")
        .select("comment_id,emoji,user_id")
        .in("comment_id", commentIds)

      if (rErr) {
        return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
      }
      reactionsRows = r ?? []
    }

    // Build reactions map
    const reactionsByComment = new Map<string, Map<string, { count: number; reacted: boolean }>>()
    for (const row of reactionsRows) {
      if (!reactionsByComment.has(row.comment_id)) {
        reactionsByComment.set(row.comment_id, new Map())
      }
      const perEmoji = reactionsByComment.get(row.comment_id)!
      const curr = perEmoji.get(row.emoji) ?? { count: 0, reacted: false }
      perEmoji.set(row.emoji, {
        count: curr.count + 1,
        reacted: curr.reacted || row.user_id === user.id,
      })
    }

    // Build response payload
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

    return NextResponse.json(
      { ok: true, comments: payload },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    )
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params?.id

    // "undefined" 같은 잘못된 호출은 400으로 빨리 컷
    if (!id || id === "undefined" || id === "null") {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // 서버에서 세션 못 읽으면 여기로 떨어짐(401)
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        {
          status: 401,
          headers: { "cache-control": "no-store" },
        }
      )
    }

    // Parse body
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
    }

    const text = String(body?.text ?? "").trim()
    if (!text) {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
    }

    // Ownership check
    const isOwner = await validateEmailOwnership(supabase, id, user.id)
    if (!isOwner) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // Create comment
    const { data, error } = await supabase
      .from("email_comments")
      .insert({ email_id: id, user_id: user.id, text })
      .select("id,user_id,text,created_at")
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    // Normalize authorName and authorAvatarColor
    const authorName = body?.authorName ?? "You"
    const authorAvatarColor = body?.authorAvatarColor ?? "#3b82f6"

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: data.id,
          authorName,
          authorAvatarColor,
          text: data.text,
          createdAt: data.created_at,
          reactions: [],
        },
      },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
