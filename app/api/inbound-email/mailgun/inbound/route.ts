import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ✅ 헬스체크(브라우저로 열어도 200)
export async function GET() {
  return NextResponse.json({ ok: true, route: "mailgun-inbound" }, { status: 200 })
}

// ✅ HEAD/OPTIONS도 200으로 응답(간헐적 405 방지)
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 })
}

function extractFirstEmail(raw: string): string {
  // "Name <email@domain>" / "email@domain" / "a@b, c@d" 모두 대응
  const m = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return (m?.[0] ?? "").toLowerCase()
}

function verifyMailgunSignature(params: {
  timestamp: string
  token: string
  signature: string
  signingKey: string
}) {
  const { timestamp, token, signature, signingKey } = params
  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex")

  // timing-safe 비교
  const a = Buffer.from(expected)
  const b = Buffer.from(signature || "")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  try {
    const body = await req.formData()

    // ✅ Mailgun signature fields (보통 최상위로 들어옴)
    const timestamp = String(body.get("timestamp") ?? "")
    const token = String(body.get("token") ?? "")
    const signature = String(body.get("signature") ?? "")

    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || process.env.MAILGUN_PRIVATE_API_KEY
    const disableSigCheck = process.env.MAILGUN_DISABLE_SIGNATURE_CHECK === "true"

    if (!disableSigCheck) {
      if (!signingKey) {
        return NextResponse.json(
          { ok: false, error: "Missing MAILGUN_WEBHOOK_SIGNING_KEY (or MAILGUN_PRIVATE_API_KEY)" },
          { status: 500 }
        )
      }

      const ok = verifyMailgunSignature({ timestamp, token, signature, signingKey })
      if (!ok) {
        return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
      }
    }

    // ✅ payload fields (설정/플랜/route 옵션에 따라 키가 조금씩 다를 수 있어 방어)
    const fromRaw = String(body.get("from") ?? "")
    const toRaw =
      String(body.get("recipient") ?? "") ||
      String(body.get("to") ?? "") ||
      String(body.get("To") ?? "") ||
      ""

    const subject = String(body.get("subject") ?? "")
    const bodyText = String(body.get("stripped-text") ?? body.get("body-plain") ?? "")
    const bodyHtml = String(body.get("stripped-html") ?? body.get("body-html") ?? "")
    const messageId = String(body.get("Message-Id") ?? body.get("message-id") ?? body.get("Message-ID") ?? "")

    const fromAddress = extractFirstEmail(fromRaw)
    const toAddress = extractFirstEmail(toRaw)

    const receivedAt = timestamp
      ? new Date(Number(timestamp) * 1000).toISOString()
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

    // ✅ 11단계: to_address → user_id 매핑 (user_addresses 테이블)
    // user_addresses: { id, user_id, email_address }
    let user_id: string | null = null
    let address_id: string | null = null

    if (toAddress) {
      const { data: addrRow, error: addrErr } = await supabase
        .from("user_addresses")
        .select("id,user_id,email_address")
        .eq("email_address", toAddress)
        .maybeSingle()

      if (addrErr) {
        console.error("Supabase user_addresses lookup error:", addrErr)
      } else if (addrRow) {
        user_id = addrRow.user_id
        address_id = addrRow.id
      }
    }

    // ✅ 저장 (inbox_emails 테이블에 user_id/address_id 컬럼이 있으면 같이 저장)
    const { data, error } = await supabase
      .from("inbox_emails")
      .insert({
        user_id,
        address_id,
        from_address: fromAddress || fromRaw,
        to_address: toAddress || toRaw,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        message_id: messageId || null,
        received_at: receivedAt,
