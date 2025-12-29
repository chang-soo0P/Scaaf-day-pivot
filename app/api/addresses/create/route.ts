import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"

const DOMAIN_DEFAULT = "scaaf.day"

function isValidLocalPart(v: string) {
  // a-z 0-9, ., _, -, 3~32 (원하면 조정)
  return /^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/.test(v)
}

function normalizeLocalPart(v: string) {
  return v.trim().toLowerCase()
}

function randomLocalPart() {
  // 예: scaaf-7k3p9d
  const s = Math.random().toString(36).slice(2, 8)
  return `scaaf-${s}`
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function safeReadJson(req: NextRequest) {
  try {
    return await req.json()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const routeSb = await createSupabaseRouteClient()
  const adminSb = getAdminSupabase() // 있으면 RLS 무시 가능

  // 로그인 유저 (있으면 연결)
  const {
    data: { user },
  } = await routeSb.auth.getUser()

  const body = await safeReadJson(req)
  const desiredRaw = typeof body?.localPart === "string" ? body.localPart : ""
  const desired = desiredRaw ? normalizeLocalPart(desiredRaw) : ""

  const domain =
    (typeof body?.domain === "string" && body.domain.trim()) ||
    process.env.MAIL_DOMAIN ||
    DOMAIN_DEFAULT

  let localPart = desired || randomLocalPart()

  if (!isValidLocalPart(localPart)) {
    // 사용자가 넣은 값이 이상하면 자동 생성으로 fallback
    localPart = randomLocalPart()
  }

  const writer = adminSb ?? routeSb

  // 충돌 방지 재시도
  for (let i = 0; i < 6; i++) {
    const full = `${localPart}@${domain}`

    // 이미 존재하는지 확인
    const { data: exists, error: exErr } = await writer
      .from("addresses")
      .select("id")
      .eq("full_address", full)
      .maybeSingle()

    if (exErr) {
      return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 })
    }

    if (exists?.id) {
      localPart = randomLocalPart()
      continue
    }

    // 생성
    const claimToken = crypto.randomUUID()

    const { data: inserted, error: insErr } = await writer
      .from("addresses")
      .insert({
        user_id: user?.id ?? null,          // 로그인 유저면 연결
        local_part: localPart,
        domain,
        full_address: full,
        claim_token: claimToken,            // 로그인 유저여도 유지(옵션)
        status: "active",                   // inbound에서 active만 받도록 되어 있으니 active로
      })
      .select("id,user_id,local_part,domain,full_address,claim_token,status,created_at,last_received_at")
      .single()

    if (insErr) {
      // 혹시 local_part unique 제약 등이 있다면 재시도
      const msg = String(insErr.message || "").toLowerCase()
      if (msg.includes("duplicate") || msg.includes("unique")) {
        localPart = randomLocalPart()
        continue
      }
      return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, address: inserted }, { status: 200 })
  }

  return NextResponse.json(
    { ok: false, error: "Failed to generate unique address. Try again." },
    { status: 500 }
  )
}
