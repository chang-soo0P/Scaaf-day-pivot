// app/api/circles/[circleId]/invite/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"
import crypto from "crypto"

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

function makeCode() {
  // url-safe, 짧고 충돌 확률 낮음
  return crypto.randomBytes(9).toString("base64url") // ~12 chars
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await context.params
    if (!circleId) {
      return NextResponse.json({ ok: false, error: "Missing circleId" }, { status: 400 })
    }

    const supabaseAuth = await createSupabaseAuthedServerClient()
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()

    // ✅ 멤버만 초대 코드 발급
    const { data: membership, error: memErr } = await admin
      .from("circle_members")
      .select("id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
    if (!membership) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const body = await req.json().catch(() => ({} as any))
    const expiresInDays = Math.min(Math.max(Number(body?.expiresInDays ?? 7), 1), 30)
    const maxUses = Math.min(Math.max(Number(body?.maxUses ?? 50), 1), 500)

    const code = makeCode()
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

    const { error: insErr } = await admin.from("circle_invites").insert({
      circle_id: circleId,
      code,
      created_by: user.id,
      expires_at: expiresAt,
      max_uses: maxUses,
      uses: 0,
    })

    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

    const origin = req.nextUrl.origin
    const inviteUrl = `${origin}/circles/join?code=${encodeURIComponent(code)}`

    return NextResponse.json(
      { ok: true, code, inviteUrl, expiresAt, maxUses },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
