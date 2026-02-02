// app/api/circles/[circleId]/invite/route.ts
import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getBaseUrl() {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL

  if (envUrl) return envUrl.startsWith("http") ? envUrl : `https://${envUrl}`

  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "http"
  if (!host) return "http://localhost:3000"
  return `${proto}://${host}`
}

function makeCode(len = 10) {
  // URL-safe invite code
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // 혼동되는 문자 제거
  let out = ""
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await ctx.params

  // body: { expiresInDays?: number, maxUses?: number }
  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  const expiresInDays = Math.min(Math.max(Number(body?.expiresInDays ?? 7), 1), 30)
  const maxUses = Math.min(Math.max(Number(body?.maxUses ?? 50), 1), 999)

  // ✅ 로그인 유저 확인
  const supabase = await createSupabaseServerClient()
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  const user = userData?.user

  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  // ✅ 멤버십 체크: circle_members.id 같은 컬럼 절대 사용 금지
  const { data: membership, error: memErr } = await supabase
    .from("circle_members")
    .select("circle_id") // ✅ 존재하는 컬럼만
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) {
    return NextResponse.json({ ok: false, error: memErr.message }, { status: 400 })
  }
  if (!membership) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })
  }

  // ✅ invite 생성은 admin(client)로 (RLS 회피)
  const admin = createSupabaseAdminClient()

  const code = makeCode(10)
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

  /**
   * ⚠️ 아래 테이블/컬럼명은 너 프로젝트 기준으로 맞춰야 해.
   * 우리가 이전에 만든 invite 흐름 기준: circle_invites 테이블
   * - circle_id (uuid)
   * - code (text)
   * - created_by (uuid)
   * - expires_at (timestamptz)
   * - max_uses (int)
   * - uses (int) default 0
   * - created_at (timestamptz)
   */
  const { data: invite, error: inviteErr } = await admin
    .from("circle_invites")
    .insert({
      circle_id: circleId,
      code,
      created_by: user.id,
      expires_at: expiresAt,
      max_uses: maxUses,
      uses: 0,
    })
    .select("code, expires_at, max_uses")
    .single()

  if (inviteErr) {
    return NextResponse.json({ ok: false, error: inviteErr.message }, { status: 500 })
  }

  const baseUrl = await getBaseUrl()
  const inviteUrl = `${baseUrl}/circles/join?code=${encodeURIComponent(invite.code)}`

  return NextResponse.json({
    ok: true,
    code: invite.code,
    inviteUrl,
    expiresAt: invite.expires_at,
    maxUses: invite.max_uses,
  })
}
