import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function POST(req: NextRequest) {
  const routeSb = await createSupabaseRouteClient()
  const adminSb = getAdminSupabase()
  const writer = adminSb ?? routeSb

  const {
    data: { user },
  } = await routeSb.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
  }

  const claimToken = String(body?.claimToken ?? "")
  if (!claimToken) {
    return NextResponse.json({ ok: false, error: "Missing claimToken" }, { status: 400 })
  }

  const { data: addr, error: aErr } = await writer
    .from("addresses")
    .select("id,user_id,full_address,status")
    .eq("claim_token", claimToken)
    .maybeSingle()

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 })
  if (!addr?.id) return NextResponse.json({ ok: false, error: "Invalid claim token" }, { status: 404 })

  // 이미 누가 소유 중이면 방지
  if (addr.user_id && addr.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Already claimed" }, { status: 409 })
  }

  const { data: updated, error: uErr } = await writer
    .from("addresses")
    .update({
      user_id: user.id,
      claim_token: null, // 재사용 방지
      status: "active",
    })
    .eq("id", addr.id)
    .select("id,user_id,local_part,domain,full_address,status,last_received_at")
    .single()

  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, address: updated }, { status: 200 })
}
