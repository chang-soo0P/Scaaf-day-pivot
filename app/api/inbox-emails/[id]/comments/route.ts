import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

function avatarColorFromUserId(userId?: string | null) {
  if (!userId) return "#64748b"
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return `hsl(${hue} 70% 45%)`
}

type RpcRow = {
  id: string
  email_id: string
  user_id: string
  content: string | null
  created_at: string
  author_name: string | null
  reactions: any // jsonb
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

    // ✅ 소유권 체크는 DB 함수에서도 하지만, API 레벨에서도 404로 깔끔하게
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

    // ✅ RPC: 댓글 + 리액션 집계 한번에
    const { data, error } = await supabase.rpc("get_email_comments_with_reactions", {
      p_email_id: emailId,
    })

    if (error) {
      console.error("comments rpc error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const rows = (data ?? []) as RpcRow[]

    const comments = rows.map((r) => ({
      id: r.id,
      authorName: r.author_name ?? "Unknown",
      authorAvatarColor: avatarColorFromUserId(r.user_id),
      text: r.content ?? "",
      createdAt: r.created_at,
      reactions: Array.isArray(r.reactions) ? r.reactions : [],
    }))

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
    const text = (payload?.text ?? "").toString()

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // ✅ RPC: 소유권 체크 + insert + author_name resolve 까지 한번에
    const { data, error } = await supabase.rpc("create_email_comment", {
      p_email_id: emailId,
      p_content: text,
    })

    if (error) {
      console.error("[comments rpc:create] error:", error)
      // RPC에서 raise exception 시 500으로 오므로, 여기서 메시지를 매핑해도 됨(옵션)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: row.id,
          authorName: row.author_name ?? "You",
          authorAvatarColor: avatarColorFromUserId(row.user_id),
          text: row.content ?? "",
          createdAt: row.created_at,
          reactions: Array.isArray(row.reactions) ? row.reactions : [],
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/comments error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
