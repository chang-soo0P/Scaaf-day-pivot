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

function verifyMailgunSignature(params: Record<string, string>, signingKeyRaw: string) {
  const signingKey = signingKeyRaw.trim()
  const timestamp = (params["timestamp"] ?? "").trim()
  const token = (params["token"] ?? "").trim()
  const signature = (params["signature"] ?? "").trim().toLowerCase()
  if (!timestamp || !token || !signature || !signingKey) return false

  const digestHex = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex")

  try {
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

  const form = await req.formData()
  const payload: Record<string, string> = {}
  form.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value : ""
  })

  const signingKey =
    (process.env.MAILGUN_WEBHOOK_SIGNING_KEY || process.env.MAILGUN_SIGNING_KEY || "").trim()

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
  const domain = domainPartOf(toEmail) || (process.env.HOST_DOMAIN || "").trim() || "scaaf.day"

  // 1) addresses에서 “주소 자체” 찾기
  const { data: address, error: addrErr } = await supabase
    .from("addresses")
    .select("id, status, domain, local_part")
    .eq("local_part", local)
    .eq("domain", domain)
    .maybeSingle()

  if (addrErr) {
    return NextResponse.json(
      { ok: false, error: addrErr.message, stage: "select_addresses" },
      { status: 500 }
    )
  }

  if (!address?.id || address.status !== "active") {
    return NextResponse.json(
      { ok: true, ignored: true, reason: "address_not_found_or_inactive", local, domain },
      { status: 200 }
    )
  }

  // 2) user_addresses에서 “유저 귀속 매핑” 찾기
  //    inbox_emails.address_id(FK)는 user_addresses.id를 참조하므로 이 값이 필요!
  const { data: ua, error: uaErr } = await supabase
    .from("user_addresses")
    .select("id, user_id, status, address_id")
    .eq("address_id", address.id)
    .maybeSingle()

  if (uaErr) {
    return NextResponse.json(
      { ok: false, error: uaErr.message, stage: "select_user_addresses" },
      { status: 500 }
    )
  }

  // 매핑이 없거나 비활성이면 저장하지 않음(재시도 폭탄 방지)
  if (!ua?.id || !ua.user_id || (ua.status && ua.status !== "active")) {
    return NextResponse.json(
      {
        ok: true,
        ignored: true,
        reason: "user_address_mapping_missing_or_inactive",
        debug: { address_id: address.id, local, domain },
      },
      { status: 200 }
    )
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

  // ✅ 핵심: address_id에는 addresses.id가 아니라 user_addresses.id를 넣는다
  const insertRow: any = {
    address_id: ua.id, // ✅ FK 충족
    user_id: ua.user_id, // ✅ not null 충족
    message_id: messageId,
    from_address: fromEmail || null,
    subject,
    body_text: bodyText,
    body_html: bodyHtml,
    raw: JSON.stringify(payload),
    received_at: receivedAt,
  }

  const { error: insErr } = await supabase.from("inbox_emails").insert(insertRow)
  if (insErr) {
    return NextResponse.json(
      {
        ok: false,
        error: insErr.message,
        stage: "insert_inbox_emails",
        debug: {
          toEmail,
          local,
          domain,
          addresses_id: address.id,
          user_addresses_id: ua.id,
          user_id: ua.user_id,
        },
      },
      { status: 500 }
    )
  }

  // 주소 테이블에 last_received_at이 있다면 업데이트(없으면 이 줄 제거)
  await supabase.from("addresses").update({ last_received_at: receivedAt }).eq("id", address.id)

  return NextResponse.json({ ok: true }, { status: 200 })
}
