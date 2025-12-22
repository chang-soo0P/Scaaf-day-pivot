import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function avatarColorFromUserId(userId?: string | null) {
  if (!userId) return "#64748b" // fallback
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

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

    const { data, error } = await supabase
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

    const comments =
      (data ?? []).map((c: any) => ({
        id: c.id,
        authorName: c.users?.display_name ?? c.users?.username ?? "Unknown",
        authorAvatarColor: avatarColorFromUserId(c.user_id),
        text: c.content ?? "",
        createdAt: c.created_at,
        reactions: [],
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

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

    const { data: profile } = await supabase.from("users").select("display_name,username").eq("id", user.id).maybeSingle()

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
