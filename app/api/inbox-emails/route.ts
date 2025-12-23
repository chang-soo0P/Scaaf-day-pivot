import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/app/api/_supabase/route-client"

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient()

  const {
    data: { user },
    error: uErr,
  } = await supabase.auth.getUser()

  if (uErr) return NextResponse.json({ ok: false, error: uErr.message }, { status: 500 })
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? "50") || 50))

  // ✅ 여기서 user_id 필터를 걸지 않음.
  //    (user_id가 null인 row가 많을 수 있고, 접근 제어는 RLS로 처리)
  const { data, error } = await supabase
    .from("inbox_emails")
    .select("id,from_address,subject,received_at")
    .order("received_at", { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, items: data ?? [] }, { status: 200 })
}
