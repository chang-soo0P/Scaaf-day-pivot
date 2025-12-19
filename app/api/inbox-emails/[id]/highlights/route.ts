import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

async function assertEmailOwnership(emailId: string, userId: string) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("inbox_emails")
    .select("id")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single()

  if (error || !data) return false
  return true
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await params

    if (!isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const ok = await assertEmailOwnership(emailId, user.id)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const { data: highlights, error } = await supabase
      .from("email_highlights") // ✅ 너희 실제 테이블명으로 맞추기
      .select("id,quote,created_at,is_shared,memo")
      .eq("email_id", emailId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("highlights select error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        highlights: (highlights ?? []).map((h: any) => ({
          id: h.id,
          quote: h.quote,
          createdAt: h.created_at,
          isShared: !!h.is_shared,
          memo: h.memo ?? undefined,
        })),
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: emailId } = await params

    if (!isUuid(emailId)) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const ok = await assertEmailOwnership(emailId, user.id)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const body = await req.json().catch(() => null)
    const quote = typeof body?.quote === "string" ? body.quote.trim() : ""

    if (!quote) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const { data: created, error } = await supabase
      .from("email_highlights") // ✅ 너희 실제 테이블명
      .insert({
        email_id: emailId,
        user_id: user.id,
        quote,
        is_shared: false,
      })
      .select("id,quote,created_at,is_shared,memo")
      .single()

    if (error || !created) {
      console.error("highlights insert error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        highlight: {
          id: created.id,
          quote: created.quote,
          createdAt: created.created_at,
          isShared: !!created.is_shared,
          memo: created.memo ?? undefined,
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
