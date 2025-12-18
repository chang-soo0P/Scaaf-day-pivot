// app/api/inbox-emails/[id]/highlights/route.ts
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

    // Fetch highlights
    const { data, error } = await supabase
      .from("email_highlights")
      .select("id,quote,memo,is_shared,created_at")
      .eq("email_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, highlights: data ?? [] },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    )
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/highlights error:", e)
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

    const quote = String(body?.quote ?? "").trim()
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
    }

    const memo = body?.memo ? String(body.memo).trim() : null

    // Ownership check
    const isOwner = await validateEmailOwnership(supabase, id, user.id)
    if (!isOwner) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // Create highlight (is_shared defaults to false)
    const { data, error } = await supabase
      .from("email_highlights")
      .insert({ email_id: id, user_id: user.id, quote, memo, is_shared: false })
      .select("id,quote,memo,is_shared,created_at")
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, highlight: data },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
