import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"

const COOKIE_NAME = "scaaf_addr"
const DOMAIN = "scaaf.day"

type AddressRow = {
  id: string
  user_id: string | null
  local_part: string
  domain: string
  full_address: string
  claim_token: string
  status: string
  created_at: string
  last_received_at: string | null
}

function randomLocalPart() {
  // user-xxxxxxxx 형태
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10)
  return `user-${id}`
}

async function issueAddress(supabase: any): Promise<AddressRow> {
  // unique 충돌 대비 간단 재시도
  for (let i = 0; i < 5; i++) {
    const local = randomLocalPart()
    const { data, error } = await supabase
      .from("addresses")
      .insert({ local_part: local, domain: DOMAIN, status: "active" })
      .select("*")
      .single()

    if (!error && data) return data as AddressRow

    // unique violation이면 재시도, 그 외는 throw
    const msg = String(error?.message ?? "")
    if (!msg.toLowerCase().includes("duplicate") && !msg.toLowerCase().includes("unique")) {
      throw error
    }
  }
  throw new Error("Failed to issue address (too many collisions)")
}

export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseRouteClient()
  const jar = await cookies()

  const token = jar.get(COOKIE_NAME)?.value

  // 1) 기존 쿠키가 있으면 그 토큰으로 address 조회
  if (token) {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("claim_token", token)
      .maybeSingle()

    if (!error && data) {
      return NextResponse.json({ ok: true, address: data }, { status: 200 })
    }
  }

  // 2) 없으면 신규 발급
  try {
    const created = await issueAddress(supabase)

    const res = NextResponse.json({ ok: true, address: created }, { status: 200 })
    res.cookies.set({
      name: COOKIE_NAME,
      value: created.claim_token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1y
    })
    return res
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to issue address" }, { status: 500 })
  }
}
