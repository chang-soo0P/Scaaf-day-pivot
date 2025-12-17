import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ ok: true, route: "mailgun-inbound" }, { status: 200 })
}
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
    process.env.PROD_INBOUND_URL || "https://scaaf.day/api/inbound-email/mailgun/inbound"

  const res = await fetch(prodUrl, {
    method: "POST",
    headers: { "x-scaaf-relay": "1" },
    body: original,
  })

  const text = await res.text()
  return { status: res.status, text }
}

function formDataToObject(fd: FormData) {
  const obj: Record<string, any> = {}
  fd.forEach((value, key) => {
    // Mailgun은 대부분 string이지만, file이 올 수도 있어 방어
    if (typeof value === "string") obj[key] = value
    else obj[key] = { filename: value.name, type: value.type, size: value.size }
  })
  return obj
}

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase =
    supabaseUrl && serviceKey
      ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      : null

  try {
    if (process.env.INBOUND_PAUSED === "true") {
      return NextResponse.json({ ok: true, paused: true }, { status: 200 })
    }

    const relayed = req.headers.get("x-scaaf-relay") === "1"
    const body = await req.formData()

    // signature fields
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
      payload: { relayed, toRaw, toAddress, subject },
    })

    if (!supabase) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars on server" },
        { status: 500 }
      )
    }

    // signature verify
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

    // DEV test routing
    const TEST_PREFIX = "273fcf3e."
    const isDevTest = toAddress.startsWith(TEST_PREFIX)

    // Not dev test => relay to production (avoid loop)
    if (!isDevTest && !relayed) {
      await logEvent(supabase, { status: 120, note: "relay_to_prod" })
      const { status, text } = await relayToProduction(body)
      await logEvent(supabase, { status, note: "relay_result", payload: { status } })
      return new NextResponse(text, { status })
    }

    // Map to user
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
      payload: { mapped: Boolean(user_id), user_id, address_id, toAddress },
    })

    // ✅ IMPORTANT: inbox_emails에는 to_address 컬럼이 없음 → raw로 저장
    const rawObj = formDataToObject(body)

    const { data, error } = await supabase
