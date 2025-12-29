import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"

function normalizeLocalPart(v: string) {
  return v.trim().toLowerCase()
}

// 너무 빡세지 않게: 영문/숫자/.-_ 허용, 3~32자, 시작은 영문/숫자
function isValidLocalPart(v: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(v)
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseRouteClient()

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr) {
    return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 })
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const localPart = normalizeLocalPart(String(body?.localPart ?? ""))
  const domain = String(process.env.SCAAF_DOMAIN ?? "scaaf.day").toLowerCase()
  const fullAddress = `${localPart}@${domain}`

  if (!isValidLocalPart(localPart)) {
    return NextResponse.json(
      { ok: false, error: "Invalid localPart (use 3~32 chars: a-z, 0-9, . _ -)" },
      { status: 400 }
    )
  }

  // 중복 확인
  const { data: existing, error: exErr } = await supabase
    .from("addresses")
    .select("id")
    .eq("domain", domain)
    .eq("local_part", localPart)
    .maybeSingle()

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 })
  if (existing?.id) {
    return NextResponse.json({ ok: false, error: "Address already taken" }, { status: 409 })
  }

  // ✅ RLS 통과 핵심: user_id를 auth.uid()로 넣어야 함
  const { data: created, error: insErr } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      local_part: localPart,
      domain,
      full_address: fullAddress,
      status: "active",
    })
    .select("id, user_id, local_part, domain, full_address, status, created_at, last_received_at")
    .single()

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, address: created }, { status: 200 })
}
