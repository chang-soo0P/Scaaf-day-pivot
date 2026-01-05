import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
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

function domainPartOf(email: string) {
  const at = email.indexOf("@")
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ""
}

// (선택) <abc@host> 형태면 꺽쇠 제거
function normalizeMessageId(v: string | null) {
  if (!v) return null
  const s = v.trim()
  const m = s.match(/<([^>]+)>/)
  return (m?.[1] ?? s) || null
}

function verifyMailgunSignature(params: Record<string, string>, signingKey: string) {
  const timestamp = params["timestamp"] ?? ""
  const token = params["token"] ?? ""
  const signature = params["signature"] ?? ""
  if (!timestamp || !token || !signature) return false

  const digestHex = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex")

  try {
    // ✅ Node22+ 타입 이슈 회피: Buffer -> Uint8Array
    const a = new Uint8Array(Buffer.from(digestHex, "hex"))
    const b = new Uint8Array(Buffer.from(signature, "hex"))
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
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

  // ✅ env 이름 통일
  const signingKey =
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY ||
    process.env.MAILGUN_SIGNING_KEY ||
    ""

  // signingKey 있으면 검증. 없으면 개발 단계로 패스.
  if (signingKey) {
    const ok = verifyMailgunSignature(payload, signingKey)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
    }
  }

  // recipient 추출 (Mailgun: recipient / To / to / envelope)
  const toRaw =
    payload["recipient"] ||
    payload["to"] ||
    payload["To"] ||
    payload["envelope"] ||
    ""

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
  const domain = domainPartOf(toEmail)

  // ✅ B안 프로덕션: scaaf.day 주소만 받기
  const HOST_DOMAIN = (process.env.HOST_DOMAIN || "scaaf.day").toLowerCase()
  if (domain !== HOST_DOMAIN) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "domain_mismatch", toEmail, domain, hostDomain: HOST_DOMAIN },
      { status: 200 }
    )
  }

  // ✅ addresses에서 full_address 우선 매칭 → 없으면 local_part+domain fallback
  // (FK 때문에 반드시 "addresses" 테이블이어야 함)
  type AddressRow = { id: string; status: string; user_id: string | null }
  let address: AddressRow | null = null

  {
    const { data, error } = await supabase
      .from("addresses")
      .select("id, status, user_id")
      .eq("full_address", toEmail)
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    address = data ?? null
  }

  if (!address) {
    const { data, error } = await supabase
      .from("addresses")
      .select("id, status, user_id")
      .eq("local_part", local)
      .eq("domain", HOST_DOMAIN)
      .maybeSingle()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    address = data ?? null
  }

  if (!address?.id || address.status !== "active") {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "address_inactive_or_missing", toEmail },
      { status: 200 }
    )
  }

  // ✅ user_id 비어있으면 저장하지 않음 (폭탄 방지)
  if (!address.user_id) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "address_has_no_user_id", addressId: address.id, toEmail },
      { status: 200 }
    )
  }

  const fromEmail = pickFirstEmail(String(payload["from"] || payload["From"] || ""))
  const subject = (payload["subject"] || payload["Subject"] || "").toString() || null

  const bodyText =
    (payload["stripped-text"] || payload["body-plain"] || payload["text"] || "").toString() || null
  const bodyHtml =
    (payload["stripped-html"] || payload["body-html"] || payload["html"] || "").toString() || null

  const rawMessageId = (
    payload["Message-Id"] ||
    payload["message-id"] ||
    payload["message_id"] ||
    payload["Message-ID"] ||
    ""
  ).toString() || null

  const messageId = normalizeMessageId(rawMessageId)

  const receivedAt = new Date().toISOString()

  const insertRow = {
    address_id: address.id,        // ✅ addresses.id
    user_id: address.user_id,      // ✅ addresses.user_id
    message_id: messageId,
    from_address: fromEmail || null,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    raw: JSON.stringify(payload),
    received_at: receivedAt,
  }

  // ✅ message_id 있으면 upsert(중복 무시), 없으면 insert
  let insErr: any = null

  if (messageId) {
    const { error } = await supabase
      .from("inbox_emails")
      .upsert(insertRow, { onConflict: "message_id", ignoreDuplicates: true })
    insErr = error
  } else {
    const { error } = await supabase.from("inbox_emails").insert(insertRow)
    insErr = error
  }

  if (insErr) {
    return NextResponse.json(
      { ok: false, error: insErr.message, toEmail, addressId: address.id, messageId },
      { status: 500 }
    )
  }

  // last_received_at은 없을 수도 있으니 실패해도 무시
  await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)

  return NextResponse.json({ ok: true }, { status: 200 })
}
