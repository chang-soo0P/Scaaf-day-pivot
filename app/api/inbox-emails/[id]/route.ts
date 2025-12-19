import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
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

    // ✅ ownership check: inbox_emails.user_id === auth.user.id
    const { data: email, error } = await supabase
      .from("inbox_emails")
      .select("id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at")
      .eq("id", emailId)
      .eq("user_id", user.id)
      .single()

    if (error || !email) {
      // 소유권/존재 둘 다 여기서 걸림
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
