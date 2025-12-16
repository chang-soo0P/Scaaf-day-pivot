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

  const a = Buffer.from(expected)
  const b = Buffer.from(signature || "")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

async function logEvent(
  supabase: ReturnType<typeof createClient> | null,
  evt: { status: number; note: string; payload?: Record<string, any> }
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
    // ignore
  }
}

async function relayToProduction(original: FormData) {
  const prodUrl =
    process.env.PROD_INBOUND_URL ||
    "https://scaaf.day/api/inbound-email/mailgun/inbound"

  // 무한 루프 방지용 헤더
  const res = await fetch(prodUrl, {
    method: "POST",
    headers: {
      "x-scaaf-relay": "1",
    },
    body: original, // Mailgun 원본 FormData 그대로 전달(서명 검증도 통과 가능)
  })

  const text = await res.text()
  return { status: res.status, text }
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null

  try {
    // ✅ 무한 relay 방지: prod -> dev로 다시 오거나, dev가 prod로 전달한 요청이면 그냥 처리/중단
    const relayed = req.headers.get("x-scaaf-relay") === "1"

    const body = await req.formData()

    // Mailgun signature fields
    const timestamp = String(body.get("timestamp") ?? "")
    const token = String(body.get("token") ?? "")
    const signature = String(body.get("signature") ?? "")

    // payload fields
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

    await logEvent(supabase, {
      status: 100,
      note: "hit",
      payload: {
        relayed,
        toRaw,
        toAddress,
        subject,
        hasTimestamp: Boolean(timestamp),
        hasToken: Boolean(token),
        hasSignature: Boolean(signature),
      },
    })

    // ✅ Supabase env 없으면 여기서 종료(로그도 못 남길 수 있음)
    if (!supabase) {
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
          { ok: false, error: "Missing MAILGUN_WEBHOOK_SIGNING_KEY (or MAILGUN_PRIVATE_API_KEY)" },
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

    // ✅ 분기 기준(테스트 prefix)
    // 발급된 테스트 주소 prefix: 273fcf3e.
    const TEST_PREFIX = "273fcf3e."
    const isDevTest = toAddress.startsWith(TEST_PREFIX)

    // ✅ 운영 유지: 테스트 주소가 아니면 운영으로 그대로 전달 (Route 1개로 B 구현)
    // relayed 요청은 다시 relay하지 않음(루프 방지)
    if (!isDevTest && !relayed) {
      await logEvent(supabase, { status: 120, note: "relay_to_prod" })
      const { status, text } = await relayToProduction(body)
      await logEvent(supabase, { status, note: "relay_result", payload: { status } })
      return new NextResponse(text, { status })
    }

    // ✅ 여기부터는 "dev 테스트" 또는 "이미 relay된 요청"만 dev에서 처리
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
    console.error("Webhook error:", err)
    if (supabase) {
      await logEvent(supabase, {
        status: 500,
        note: "webhook_exception",
        payload: { message: err?.message ?? String(err) },
      })
    }
    return NextResponse.json({ ok: false, error: "Webhook error" }, { status: 500 })
  }
}
