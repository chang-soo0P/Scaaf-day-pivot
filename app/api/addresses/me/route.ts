import { NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createSupabaseRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("addresses")
    .select("id, local_part, domain, full_address, status, created_at, last_received_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, addresses: data ?? [] }, { status: 200 })
}
