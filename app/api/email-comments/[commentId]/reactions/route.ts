import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function avatarColorFromUserId(userId: string) {
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue} 70% 45%)`
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await params
    if (!isUuid(emailId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: auth, error: userError } = await supabase.auth.getUser()
    const user = auth?.user
    if (userError || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // 소유권 체크
    const { data: owned, error: ownedError } = await supabase
      .from("inbox_emails")
      .select("id")
      .eq("id", emailId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (ownedError) {
      console.error("owned check error:", ownedError)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }
    if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    // comments + users join
    const { data: rows, error } = await supabase
      .from("comments")
      .select(
        `
        id,
        email_id,
        user_id,
        content,
        created_at,
        users:users (
          id,
          username,
          display_name
        )
      `
      )
      .eq("email_id", emailId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("comments select error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    // ✅ reactions 한번에 가져와서 집계
    const commentIds = (rows ?? []).map((r: any) => r.id)
    let reactionsByComment = new Map<
      string,
      { emoji: string; count: number; reacted: boolean }[]
    >()

    if (commentIds.length) {
      const { data: reactionRows, error: rErr } = await supabase
        .from("comment_reactions")
        .select("comment_id, user_id, emoji")
        .in("comment_id", commentIds)

      if (rErr) {
        console.error("reactions select error:", rErr)
      } else {
        const agg = new Map<string, Map<string, { emoji: string; count: number; reacted: boolean }>>()

        for (const r of reactionRows ?? []) {
          const byEmoji = agg.get(r.comment_id) ?? new Map()
          const cur = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, reacted: false }
          cur.count += 1
          if (r.user_id === user.id) cur.reacted = true
          byEmoji.set(r.emoji, cur)
          agg.set(r.comment_id, byEmoji)
        }

        for (const [cid, byEmoji] of agg.entries()) {
          reactionsByComment.set(cid, Array.from(byEmoji.values()))
        }
      }
    }

    const comments =
      (rows ?? []).map((c: any) => ({
        id: c.id,
        authorName: c.users?.display_name ?? c.users?.username ?? "Unknown",
        authorAvatarColor: avatarColorFromUserId(c.user_id),
        text: c.content ?? "",
        createdAt: c.created_at,
        reactions: reactionsByComment.get(c.id) ?? [],
      })) ?? []

    return NextResponse.json({ ok: true, comments }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await params
    if (!isUuid(emailId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const payload = await req.json().catch(() => null)
    const text = (payload?.text ?? "").toString().trim()
    if (!text) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: auth, error: userError } = await supabase.auth.getUser()
    const user = auth?.user
    if (userError || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // 소유권 체크
    const { data: owned, error: ownedError } = await supabase
      .from("inbox_emails")
      .select("id")
      .eq("id", emailId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (ownedError) {
      console.error("owned check error:", ownedError)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }
    if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const { data: created, error: createError } = await supabase
      .from("comments")
      .insert({ email_id: emailId, user_id: user.id, content: text })
      .select("id,user_id,content,created_at")
      .single()

    if (createError || !created) {
      console.error("comment insert error:", createError)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const { data: profile } = await supabase
      .from("users")
      .select("display_name,username")
      .eq("id", user.id)
      .maybeSingle()

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: created.id,
          authorName: profile?.display_name ?? profile?.username ?? "You",
          authorAvatarColor: avatarColorFromUserId(user.id),
          text: created.content ?? "",
          createdAt: created.created_at,
          reactions: [],
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
