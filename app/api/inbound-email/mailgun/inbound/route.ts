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

async function logEvent(
  supabase: ReturnType<typeof createClient> | null,
  evt: {
    status: number
    note: string
    payload?: Record<string, any>
  }
) {
  if (!supabase) return
  try {
    await supabase.from("webhook_events").insert({
      source: "mailgun",
      path: "/api/inbound-email/mailgun/inbound",
      method: "POST",
      status: evt.status,
      note: evt.note,
      payload: evt.payload ?? null,
    })
  } catch {
    // 로깅 실패는 무시 (본 로직에 영향 X)
  }
}

export async function POST(req: Request) {
  // ✅ Supabase 클라이언트는 최대한 빨리 만들고, 이후 모든 단계에서 로그를 남길 수 있게 함
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null

  try {
    const body = await req.formData()

    // ✅ Mailgun signature fields (보통 최상위로 들어옴)
    const timestamp = String(body.get("timestamp") ?? "")
    const token = String(body.get("token") ?? "")
    const signature = String(body.get("signature") ?? "")

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
    const messageId = String(
      body.get("Message-Id") ?? body.get("message-id") ?? body.get("Message-ID") ?? ""
    )

    const fromAddress = extractFirstEmail(fromRaw)
    const toAddress = extractFirstEmail(toRaw)

    const receivedAt = timestamp
      ? new Date(Number(timestamp) * 1000).toISOString()
      : new Date().toISOString()

    // ✅ “요청이 들어왔는지” 여부를 확실히 기록
    await logEvent(supabase, {
      status: 100,
      note: "hit",
      payload: {
        hasTimestamp: Boolean(timestamp),
        hasToken: Boolean(token),
        hasSignature: Boolean(signature),
        toRaw,
        toAddress,
        subject,
      },
    })

    // ✅ Supabase env 체크 (없으면 여기서 바로 종료)
    if (!supabaseUrl || !serviceKey || !supabase) {
      await logEvent(null, { status: 500, note: "missing_supabase_env" })
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars on server" },
        { status: 500 }
      )
    }

    // ✅ 서명 검증
    const signingKey =
      process.env.MAILGUN_WEBHOOK_SIGNING_KEY || process.env.MAILGUN_PRIVATE_API_KEY
    const disableSigCheck = process.env.MAILGUN_DISABLE_SIGNATURE_CHECK === "true"

    if (!disableSigCheck) {
      if (!signingKey) {
        await logEvent(supabase, { status: 500, note: "missing_mailgun_signing_key" })
        return NextResponse.json(
          {
            ok: false,
            error: "Missing MAILGUN_WEBHOOK_SIGNING_KEY (or MAILGUN_PRIVATE_API_KEY)",
          },
          { status: 500 }
        )
      }

      const ok = verifyMailgunSignature({ timestamp, token, signature, signingKey })
      if (!ok) {
        await logEvent(supabase, { status: 401, note: "invalid_signature" })
        return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
      }
    } else {
      await logEvent(supabase, { status: 101, note: "signature_check_disabled" })
    }

    // ✅ 11단계: to_address → user_id 매핑 (user_addresses 테이블)
    let user_id: string | null = null
    let address_id: string | null = null

    if (toAddress) {
      const { data: addrRow, error: addrErr } = await supabase
        .from("user_addresses")
        .select("id,user_id,email_address")
        .eq("email_address", toAddress)
        .maybeSingle()

      if (addrErr) {
        await logEvent(supabase, {
          status: 500,
          note: "user_addresses_lookup_error",
          payload: { message: addrErr.message, toAddress },
        })
      } else if (addrRow) {
        user_id = addrRow.user_id
        address_id = addrRow.id
      }
    }

    await logEvent(supabase, {
      status: 110,
      note: "mapping_checked",
      payload: { toAddress, mapped: Boolean(user_id), user_id, address_id },
    })

    // ✅ 저장
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
      })
      .select("id")
      .single()

    if (error) {
      await logEvent(supabase, {
        status: 500,
        note: "supabase_insert_error",
        payload: { message: error.message, code: (error as any).code ?? null },
      })
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    await logEvent(supabase, {
      status: 200,
      note: "insert_ok",
      payload: { id: data?.id, mapped: Boolean(user_id), user_id },
    })

    return NextResponse.json(
      { ok: true, id: data?.id, mapped: Boolean(user_id), user_id },
      { status: 200 }
    )
  } catch (err: any) {
    if (supabase) {
      await logEvent(supabase, {
        status: 500,
        note: "webhook_exception",
        payload: { message: err?.message ?? String(err) },
      })
    }
    console.error("Webhook error:", err)
    return NextResponse.json({ ok: false, error: "Webhook error" }, { status: 500 })
  }
}
