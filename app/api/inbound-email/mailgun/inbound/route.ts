import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ✅ 헬스체크(브라우저로 열어도 200)
export async function GET() {
  return NextResponse.json({ ok: true, route: "mailgun-inbound" }, { status: 200 })
}

// ✅ HEAD/OPTIONS도 200으로 응답(405 방지)
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}

export async function POST(req: Request) {
  try {
    const body = await req.formData()

    // Mailgun payload (환경/설정에 따라 recipient 대신 to로 올 수도 있어 방어)
    const from = String(body.get("from") ?? "")
    const to = String(body.get("recipient") ?? body.get("to") ?? "")
    const subject = String(body.get("subject") ?? "")
    const bodyPlain = String(body.get("body-plain") ?? "")
    const bodyHtml = String(body.get("body-html") ?? "")
    const tsRaw = body.get("timestamp")
    const receivedAt = tsRaw
      ? new Date(Number(tsRaw) * 1000).toISOString()
      : new Date().toISOString()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars on server" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data, error } = await supabase
      .from("inbox_emails")
      .insert({
        from_address: from,
        to_address: to,
        subject,
        body_text: bodyPlain,
        body_html: bodyHtml,
        received_at: receivedAt,
      })
      .select()
      .single()

    if (error) {
      console.error("Supabase insert error:", error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, id: data?.id }, { status: 200 })
  } catch (err) {
    console.error("Webhook error:", err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
