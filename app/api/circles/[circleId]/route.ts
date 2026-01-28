// app/api/circles/[circleId]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // Next15: Promise
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set() {},
        remove() {},
      },
    }
  )
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await context.params
    if (!circleId) return NextResponse.json({ ok: false, error: "Missing circleId" }, { status: 400 })

    // ✅ 로그인 유저 확인
    const supabaseAuth = await createSupabaseAuthedServerClient()
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()

    // ✅ 권한(멤버십) 체크: 멤버가 아니면 존재 자체를 숨기기 위해 404
    const { data: membership, error: memErr } = await admin
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
    }
    if (!membership) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // ✅ circle 데이터
    const { data: circle, error: circleErr } = await admin
      .from("circles")
      .select("*")
      .eq("id", circleId)
      .single()

    if (circleErr || !circle) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // ✅ counts (DB 기준)
    const [{ count: memberCount }, { count: shareCount }] = await Promise.all([
      admin.from("circle_members").select("id", { head: true, count: "exact" }).eq("circle_id", circleId),
      admin.from("circle_emails").select("id", { head: true, count: "exact" }).eq("circle_id", circleId),
    ])

    return NextResponse.json(
      {
        ok: true,
        circle,
        counts: {
          members: Number(memberCount ?? 0),
          shares: Number(shareCount ?? 0),
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
