import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"

const DOMAIN = process.env.SCAAF_MAIL_DOMAIN || "scaaf.day"

// 3~32 chars, first must be a-z0-9, allowed: a-z0-9._-
const LOCAL_PART_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/

function normalizeLocalPart(input: string) {
  let v = (input ?? "").trim().toLowerCase()
  if (v.includes("@")) v = v.split("@")[0] ?? ""
  v = v.replace(/\s+/g, "")
  v = v.replace(/[^a-z0-9._-]/g, "")
  return v
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

  // body optional
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // localPart 필수 (없으면 기본값을 만들거나 에러)
  const localPartRaw = String(body?.localPart ?? "")
  const localPart = normalizeLocalPart(localPartRaw)

  if (!LOCAL_PART_RE.test(localPart)) {
    return NextResponse.json(
      { ok: false, error: "Invalid localPart (use 3~32 chars: a-z, 0-9, . _ -)" },
      { status: 400 }
    )
  }

  // 이미 주소가 있으면 그대로 반환
  const { data: existing, error: exErr } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (exErr) return NextResponse.json({ ok: false, error: exErr.message }, { status: 500 })
  if (existing?.id) return NextResponse.json({ ok: true, address: existing }, { status: 200 })

  // local_part 중복 체크(도메인까지 포함해 유니크라면 domain도 함께)
  const { data: dup, error: dupErr } = await supabase
    .from("addresses")
    .select("id")
    .eq("local_part", localPart)
    .eq("domain", DOMAIN)
    .maybeSingle()

  if (dupErr) return NextResponse.json({ ok: false, error: dupErr.message }, { status: 500 })
  if (dup?.id) {
    return NextResponse.json({ ok: false, error: "That address is already taken." }, { status: 409 })
  }

  /**
   * ✅ 핵심:
   * - full_address는 DB에서 GENERATED/DEFAULT로 관리 중이므로 insert에 포함하지 않음
   */
  const { data: inserted, error: insErr } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      local_part: localPart,
      domain: DOMAIN,
      status: "active",
      // full_address ❌ 넣지 말 것
      // claim_token은 필요하면 여기서 생성해서 넣어도 됨(선택)
    })
    .select("*")
    .single()

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, address: inserted }, { status: 200 })
}
