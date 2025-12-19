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

export async function GET(_req: NextRequest, ctx: any) {
  try {
    const id = await getParam(ctx, "id")
    if (!id || !isUuid(id)) {
      return NextResponse.json({ ok: false, error: "Bad Request: invalid id" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: auth, error: authErr } = await supabase.auth.getUser()
    if (authErr || !auth?.user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: email, error } = await supabase
      .from("inbox_emails")
      .select("id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at")
      .eq("id", id)
      .single()

    if (error || !email) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // ✅ 소유권 체크
    if (email.user_id !== auth.user.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch (e: any) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
