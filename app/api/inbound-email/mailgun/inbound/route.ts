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

function domainOf(email: string) {
  const at = email.indexOf("@")
  return at >= 0 ? email.slice(at + 1).toLowerCase() : ""
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
    // Buffer -> Uint8Array로 감싸서 타입 충돌 회피
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

  // ✅ env 이름 통일: MAILGUN_WEBHOOK_SIGNING_KEY 사용(없으면 fallback)
  const signingKey =
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY || process.env.MAILGUN_SIGNING_KEY || ""

  if (signingKey) {
    const ok = verifyMailgunSignature(payload, signingKey)
    if (!ok) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
  }

  // recipient(to) 추출
  const toRaw =
    payload["recipient"] ||
    payload["to"] ||
    payload["To"] ||
    payload["envelope"] ||
    payload["Envelope"] ||
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
  const toDomain = domainOf(toEmail)

  // ✅ 여기서도 환경변수 기반 도메인으로 필터 (실수로 다른 도메인 들어오는 것 방지)
  const HOST_DOMAIN = (process.env.HOST_DOMAIN || "scaaf.day").toLowerCase()
  if (toDomain !== HOST_DOMAIN) {
    // 다른 도메인으로 들어온 메일은 무시(폭탄 방지)
    return NextResponse.json({ ok: true, ignored: true, reason: "domain_mismatch" }, { status: 200 })
  }

  // ✅ user_id까지 가져와서 inbox_emails.user_id 채우기
  // ✅ local_part + domain 둘 다 매칭 (B안 프로덕션에서 중요)
  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("id, status, user_id, domain")
    .eq("local_part", local)
    .eq("domain", HOST_DOMAIN)
    .maybeSingle()

  if (addrErr) return NextResponse.json({ ok: false, error: addrErr.message }, { status: 500 })

  if (!address?.id || address.status !== "active") {
    // 재시도 폭탄 방지: 200 OK로 무시 처리
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }

  if (!address.user_id) {
    // 주소가 아직 유저에 귀속 안 된 상태면 저장하지 않고 종료(폭탄 방지)
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }

  const fromEmail = pickFirstEmail(String(payload["from"] || payload["From"] || ""))
  const subject = (payload["subject"] || payload["Subject"] || "").toString() || null

  const bodyText =
    (payload["stripped-text"] || payload["body-plain"] || payload["text"] || "").toString() || null
  const bodyHtml =
    (payload["stripped-html"] || payload["body-html"] || payload["html"] || "").toString() || null

  const messageId =
    (payload["Message-Id"] || payload["message-id"] || payload["message_id"] || "").toString() ||
    null

  const receivedAt = new Date().toISOString()

  // ✅ raw 컬럼이 jsonb인지 text인지 모르는 상태에서도 안전하게 insert
  // 1) jsonb로 넣어보고 실패하면 stringify로 재시도
  const baseRow: any = {
    address_id: address.id,
    user_id: address.user_id,
    message_id: messageId,
    from_address: fromEmail || null,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    received_at: receivedAt,
  }

  // 우선 json/object로 시도
  let insertRow: any = { ...baseRow, raw: payload }

  let insErrMsg: string | null = null
  {
    const { error } = await supabase.from("inbox_emails").insert(insertRow)
    if (!error) {
      await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)
      return NextResponse.json({ ok: true }, { status: 200 })
    }
    insErrMsg = error.message || String(error)
  }

  // raw 타입이 text일 가능성 → stringify로 재시도
  insertRow = { ...baseRow, raw: JSON.stringify(payload) }
  {
    const { error } = await supabase.from("inbox_emails").insert(insertRow)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)

  return NextResponse.json({ ok: true, note: "raw_stringified_fallback", prev_error: insErrMsg }, { status: 200 })
}
