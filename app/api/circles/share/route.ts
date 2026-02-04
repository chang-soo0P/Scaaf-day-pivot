// app/api/circles/share/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = {
  circleId?: string
  emailId?: string
}

type Resp =
  | { ok: true; shareId: string; circleId: string; emailId: string }
  | { ok: false; error: string }

const SHARES_TABLE = "circle_shares"
const MEMBERS_TABLE = "circle_members"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    const circleId = (body.circleId ?? "").trim()
    const emailId = (body.emailId ?? "").trim()

    if (!circleId || !emailId) {
      return NextResponse.json<Resp>({ ok: false, error: "Missing circleId/emailId" }, { status: 400 })
    }

    // ✅ auth user
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json<Resp>({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // ✅ membership check
    const { data: membership, error: memErr } = await supabase
      .from(MEMBERS_TABLE)
      .select("circle_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json<Resp>({ ok: false, error: memErr.message }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json<Resp>({ ok: false, error: "Not a member of this circle" }, { status: 403 })
    }

    // ✅ insert share (admin로 처리하면 RLS에 덜 걸림)
    const admin = createSupabaseAdminClient()

    // ⚠️ 중복 공유 방지하고 싶으면: (circle_id,email_id,shared_by) unique + upsert 추천
    const { data: inserted, error: insErr } = await admin
      .from(SHARES_TABLE)
      .insert({
        circle_id: circleId,
        email_id: emailId,
        shared_by: user.id,
        // shared_at 컬럼이 있으면 넣고, 없으면 created_at 사용
        shared_at: new Date().toISOString(),
      })
      .select("id,circle_id,email_id")
      .maybeSingle()

    if (insErr) {
      return NextResponse.json<Resp>({ ok: false, error: insErr.message }, { status: 500 })
    }
    if (!inserted) {
      return NextResponse.json<Resp>({ ok: false, error: "Failed to create share" }, { status: 500 })
    }

    return NextResponse.json<Resp>({
      ok: true,
      shareId: inserted.id,
      circleId: inserted.circle_id,
      emailId: inserted.email_id,
    })
  } catch (e: any) {
    return NextResponse.json<Resp>({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 })
  }
}
