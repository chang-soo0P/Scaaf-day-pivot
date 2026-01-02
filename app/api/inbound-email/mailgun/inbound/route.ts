import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

function pickFirstEmail(v: string) {
  const first = v.split(",")[0]?.trim() ?? ""
  const m = first.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return (m?.[0] ?? first).toLowerCase()
}

function localPartOf(email: string) {
  const at = email.indexOf("@")
  return at >= 0 ? email.slice(0, at).toLowerCase() : email.toLowerCase()
}

function domainOf(email: string) {
  const at = email.indexOf("@")
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ""
}

function safeEqualHex(aHex: string, bHex: string) {
  const a = Uint8Array.from(Buffer.from(aHex, "hex"))
  const b = Uint8Array.from(Buffer.from(bHex, "hex"))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function verifyMailgunSignature(params: Record<string, string>, signingKey: string) {
  const timestamp = params["timestamp"] ?? ""
  const token = params["token"] ?? ""
  const signature = params["signature"] ?? ""
  if (!timestamp || !token || !signature) return false

  const hmac = crypto.createHmac("sha256", signingKey)
  hmac.update(timestamp + token)
  const digestHex = hmac.digest("hex")

  try {
    return safeEqualHex(digestHex, signature)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseAdminClient()

  // Mailgun inbound: multipart/form-data
  const form = await req.formData()
  const payload: Record<string, string> = {}
  form.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : ""
  })

  // (권장) signature verify
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY
  if (signingKey) {
    const ok = verifyMailgunSignature(payload, signingKey)
    if (!ok) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
  }

  // recipient(to) 추출
  const toRaw = payload["recipient"] || payload["to"] || payload["To"] || payload["envelope"] || ""

  let toEmail = ""
  if (toRaw.startsWith("{")) {
    // envelope JSON: {"to":["xxx@scaaf.day"],"from":"..."}
    try {
      const env = JSON.parse(toRaw)
      const arr = Array.isArray(env?.to) ? env.to : []
      toEmail = pickFirstEmail(String(arr?.[0] ?? ""))
    } catch {
      toEmail = ""
    }
  } else {
    toEmail = pickFirstEmail(String(toRaw))
  }

  if (!toEmail || !toEmail.includes("@")) {
    return NextResponse.json({ ok: false, error: "Missing recipient" }, { status: 400 })
  }

  const local = localPartOf(toEmail)
  const domain = domainOf(toEmail)

  // addresses 매칭 (B안: 실제 도메인 scaaf.day 기준)
  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("id, status, domain")
    .eq("local_part", local)
    .eq("domain", domain) // 중요
    .maybeSingle()

  if (addrErr) return NextResponse.json({ ok: false, error: addrErr.message }, { status: 500 })

  // 없거나 비활성: Mailgun 재시도 폭탄 방지 위해 200
  if (!address?.id || address.status !== "active") {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }

  const fromEmail = pickFirstEmail(String(payload["from"] || payload["From"] || ""))
  const subject = (payload["subject"] || payload["Subject"] || "").toString() || null

  const bodyText =
    (payload["stripped-text"] || payload["body-plain"] || payload["text"] || "").toString() || null
  const bodyHtml =
    (payload["stripped-html"] || payload["body-html"] || payload["html"] || "").toString() || null

  const messageId =
    (payload["Message-Id"] || payload["message-id"] || payload["message_id"] || "").toString() || null

  const receivedAt = new Date().toISOString()

  const insertRow = {
    address_id: address.id,
    user_id: null,
    message_id: messageId,
    from_address: fromEmail || null,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    raw: payload,
    received_at: receivedAt,
  }

  const { error: insErr } = await supabase.from("inbox_emails").insert(insertRow)
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)

  return NextResponse.json({ ok: true }, { status: 200 })
}
