// app/api/inbox-emails/[id]/comments/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getParamId(ctx: any) {
  const p = ctx?.params
  if (p && typeof p.then === "function") return (await p).id
  return p?.id
}

function colorFromUserId(userId: string) {
  // 아주 단순한 deterministic color
  let hash = 0
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0
  const r = 50 + (hash % 150)
  const g = 50 + ((hash >> 8) % 150)
  const b = 50 + ((hash >> 16) % 150)
  return `rgb(${r}, ${g}, ${b})`
}

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const id = await getParamId(ctx)
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase
      .from("email_comments")
      .select("id,user_id,text,created_at")
      .eq("email_id", id)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    const comments = (data ?? []).map((c) => ({
      id: c.id,
      authorName: c.user_id === user.id ? "You" : "Member",
      authorAvatarColor: colorFromUserId(c.user_id),
      text: c.text,
      createdAt: c.created_at,
      reactions: [],
    }))

    return NextResponse.json({ ok: true, comments }, { status: 200 })
  } catch (e: any) {
    console.error("GET comments error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: any) {
  try {
    const id = await getParamId(ctx)
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const text = typeof body?.text === "string" ? body.text.trim() : ""
    if (!text) return NextResponse.json({ ok: false, error: "Missing text" }, { status: 400 })

    const { data, error } = await supabase
      .from("email_comments")
      .insert({ email_id: id, user_id: user.id, text })
      .select("id,user_id,text,created_at")
      .single()

    if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "Insert failed" }, { status: 500 })

    return NextResponse.json(
      {
        ok: true,
        comment: {
          id: data.id,
          authorName: "You",
          authorAvatarColor: colorFromUserId(user.id),
          text: data.text,
          createdAt: data.created_at,
          reactions: [],
        },
      },
      { status: 200 }
    )
  } catch (e: any) {
    console.error("POST comments error:", e?.message ?? e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
