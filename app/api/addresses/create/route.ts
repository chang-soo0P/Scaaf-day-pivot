import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function randomKey(len = 12) {
  return crypto.randomBytes(24).toString("base64url").slice(0, len)
}

export async function POST() {
  const cookieStore = await cookies()

  // 1) 로그인 유저 확인(anon key, 세션 쿠키 기반)
  const authed = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const {
    data: { user },
    error: userErr,
  } = await authed.auth.getUser()

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  // 2) DB 작업은 service role(서버 전용)로
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars on server" },
      { status: 500 }
    )
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // 3) 이미 발급된 주소가 있으면 그대로 반환
  const { data: existing, error: existingErr } = await admin
    .from("user_addresses")
    .select("id,email_address,created_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (existingErr) {
    return NextResponse.json({ ok: false, error: existingErr.message }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ ok: true, ...existing }, { status: 200 })
  }

  // 4) 새 주소 발급
  // NEWSLETTER_DOMAIN = Mailgun receiving domain (예: mg.scaaf.day)
  const domain = (process.env.NEWSLETTER_DOMAIN || "mg.scaaf.day").toLowerCase()
  const localPart = `${user.id.slice(0, 8)}.${randomKey(12)}`
  const email_address = `${localPart}@${domain}`.toLowerCase()

  const { data, error } = await admin
    .from("user_addresses")
    .insert({ user_id: user.id, email_address })
    .select("id,email_address,created_at")
    .single()

  if (error) {
    // 동시 요청으로 unique 충돌 시 재조회로 복구
    if (String(error.code) === "23505") {
      const { data: again } = await admin
        .from("user_addresses")
        .select("id,email_address,created_at")
        .eq("user_id", user.id)
        .maybeSingle()

      if (again) return NextResponse.json({ ok: true, ...again }, { status: 200 })
    }

    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...data }, { status: 200 })
}
