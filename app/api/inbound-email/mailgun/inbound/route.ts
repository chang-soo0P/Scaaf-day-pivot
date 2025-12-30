import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "node:crypto"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

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

function verifyMailgunSignature(params: Record<string, string>, signingKey: string) {
  const timestamp = params["timestamp"] ?? ""
  const token = params["token"] ?? ""
  const signature = params["signature"] ?? ""
  if (!timestamp || !token || !signature) return false

  const digest = createHmac("sha256", signingKey).update(timestamp + token).digest("hex")

  try {
    // ✅ TS/런타임 안정: Buffer -> Uint8Array 로 변환해서 timingSafeEqual에 전달
    const a = Uint8Array.from(Buffer.from(digest, "hex"))
    const b = Uint8Array.from(Buffer.from(signature, "hex"))
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient()

  // Mailgun inbound: multipart/form-data
  const form = await req.formData()
  const payload: Record<string, string> = {}
  form.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : ""
  })

  // 1) signature verify (있으면 검증)
  const signingKey = process.env.MAILGUN_SIGNING_KEY
  if (signingKey) {
    const ok = verifyMailgunSignature(payload, signingKey)
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
    }
  }

  // 2) recipient(to) 추출
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

  // 3) addresses 매칭
  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("id, status")
    .eq("local_part", local)
    .maybeSingle()

  if (addrErr) return NextResponse.json({ ok: false, error: addrErr.message }, { status: 500 })

  // 없거나 비활성: Mailgun 재시도 폭탄 방지 위해 200으로 먹고 종료
  if (!address?.id || address.status !== "active") {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
  }

  // 4) payload 정리
  const fromEmail = pickFirstEmail(String(payload["from"] || payload["From"] || ""))
  const subject = (payload["subject"] || payload["Subject"] || "").toString() || null

  const bodyText =
    (payload["stripped-text"] || payload["body-plain"] || payload["text"] || "").toString() || null
  const bodyHtml =
    (payload["stripped-html"] || payload["body-html"] || payload["html"] || "").toString() || null

  const messageId =
    (payload["Message-Id"] || payload["message-id"] || payload["message_id"] || "").toString() || null

  const receivedAt = new Date().toISOString()

  const insertRow: any = {
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

  // to_address 컬럼은 있을 수도/없을 수도 → 있으면 넣고, 에러면 제거 후 재시도
  insertRow.to_address = toEmail

  const { error: insErr } = await supabase.from("inbox_emails").insert(insertRow)

  if (insErr) {
    const msg = String(insErr.message || "").toLowerCase()
    if (msg.includes("to_address")) {
      delete insertRow.to_address
      const { error: retryErr } = await supabase.from("inbox_emails").insert(insertRow)
      if (retryErr) return NextResponse.json({ ok: false, error: retryErr.message }, { status: 500 })
    } else {
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }
  }

  // 5) last_received_at 업데이트
  await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)

  return NextResponse.json({ ok: true }, { status: 200 })
}
