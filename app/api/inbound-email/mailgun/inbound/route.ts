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

function verifyMailgunSignature(params: Record<string, string>, signingKey: string) {
  const timestamp = params["timestamp"] ?? ""
  const token = params["token"] ?? ""
  const signature = params["signature"] ?? ""
  if (!timestamp || !token || !signature) return false

  const digestHex = crypto.createHmac("sha256", signingKey).update(timestamp + token).digest("hex")

  try {
    // ✅ Node 22 타입 이슈 회피: ArrayBufferView로 강제
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

  // Mailgun은 form-data or x-www-form-urlencoded로 들어옴
  const form = await req.formData()
  const payload: Record<string, string> = {}
  form.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : ""
  })

  const signingKey =
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY ||
    process.env.MAILGUN_SIGNING_KEY ||
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY?.trim() ||
    ""

  if (signingKey) {
    const ok = verifyMailgunSignature(payload, signingKey)
    if (!ok) return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
  }

  // recipient 추출
  const toRaw = payload["recipient"] || payload["to"] || payload["To"] || payload["envelope"] || ""

  let toEmail = ""
  if (toRaw.startsWith("{")) {
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

  // ✅ 핵심: local_part만으로 찾지 말고 domain까지 필터링
  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("id, status, user_id")
    .eq("local_part", local)
    .eq("domain", domain)
    .maybeSingle()

  if (addrErr) return NextResponse.json({ ok: false, error: addrErr.message }, { status: 500 })

  if (!address?.id || address.status !== "active") {
    // 재시도 폭탄 방지: 200 OK로 무시 처리
    return NextResponse.json({ ok: true, ignored: true, reason: "address_inactive_or_missing" }, { status: 200 })
  }

  // ✅ user_id를 “확정” (혹시 select 결과가 꼬이거나, user_id가 null인 레코드라면 여기서 걸러짐)
  let userId: string | null = address.user_id ?? null

  if (!userId) {
    const { data: addr2, error: addr2Err } = await supabase
      .from("addresses")
      .select("user_id")
      .eq("id", address.id)
      .maybeSingle()

    if (addr2Err) return NextResponse.json({ ok: false, error: addr2Err.message }, { status: 500 })
    userId = (addr2?.user_id as string | null) ?? null
  }

  if (!userId) {
    // 주소가 아직 유저에 귀속 안 된 상태면 저장하지 않고 종료(폭탄 방지)
    return NextResponse.json({ ok: true, ignored: true, reason: "address_has_no_user_id" }, { status: 200 })
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
    user_id: userId, // ✅ 무조건 채움
    message_id: messageId,
    from_address: fromEmail || null,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    raw: JSON.stringify(payload),
    received_at: receivedAt,
  }

  const { error: insErr } = await supabase.from("inbox_emails").insert(insertRow)
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)

  return NextResponse.json({ ok: true }, { status: 200 })
}
