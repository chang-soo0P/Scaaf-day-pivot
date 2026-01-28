// app/api/circles/join/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies()
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

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = await createSupabaseAuthedServerClient()
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const { code } = (await req.json().catch(() => ({} as any))) as { code?: string }
    if (!code) return NextResponse.json({ ok: false, error: "Missing code" }, { status: 400 })

    const admin = createSupabaseAdminClient()

    // invite 조회
    const { data: invite, error: invErr } = await admin
      .from("circle_invites")
      .select("*")
      .eq("code", code)
      .maybeSingle()

    if (invErr) return NextResponse.json({ ok: false, error: invErr.message }, { status: 500 })
    if (!invite) return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 404 })

    const now = Date.now()
    const expiresAt = invite.expires_at ? new Date(invite.expires_at).getTime() : null
    if (expiresAt && now > expiresAt) {
      return NextResponse.json({ ok: false, error: "Invite expired" }, { status: 400 })
    }

    const uses = Number(invite.uses ?? 0)
    const maxUses = Number(invite.max_uses ?? 0)
    if (maxUses > 0 && uses >= maxUses) {
      return NextResponse.json({ ok: false, error: "Invite usage limit reached" }, { status: 400 })
    }

    const circleId = invite.circle_id as string

    // 이미 멤버면 그대로 성공
    const { data: existing } = await admin
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!existing) {
      const { error: insErr } = await admin.from("circle_members").insert({
        circle_id: circleId,
        user_id: user.id,
        role: "member",
      })
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })
    }

    // uses 증가 (경합 최소화를 위해 업데이트)
    await admin
      .from("circle_invites")
      .update({ uses: uses + 1 })
      .eq("id", invite.id)

    return NextResponse.json(
      { ok: true, circleId },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
