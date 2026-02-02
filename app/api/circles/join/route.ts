// app/api/circles/join/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ✅ 여기만 네 실제 테이블명에 맞추면 됨
const INVITES_TABLE = "circle_invites"
const MEMBERS_TABLE = "circle_members"
const CIRCLES_TABLE = "circles"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // Next15/16: Promise

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

type JoinBody = { code?: string }

type JoinResponse =
  | {
      ok: true
      circleId: string
      circleName: string | null
      alreadyMember: boolean
    }
  | { ok: false; error: string }

function isExpired(expiresAt: string | null) {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() <= Date.now()
}

export async function POST(req: NextRequest) {
  try {
    // 1) 로그인 체크
    const supabaseAuth = await createSupabaseAuthedServerClient()
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user
    if (userErr || !user) {
      return NextResponse.json<JoinResponse>({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // 2) body.code 파싱
    const body = (await req.json().catch(() => ({}))) as JoinBody
    const code = (body.code ?? "").trim()
    if (!code) {
      return NextResponse.json<JoinResponse>({ ok: false, error: "Missing invite code" }, { status: 400 })
    }

    const admin = createSupabaseAdminClient()

    // 3) invite 조회
    const { data: invite, error: invErr } = await admin
      .from(INVITES_TABLE)
      .select("code,circle_id,expires_at,max_uses,uses")
      .eq("code", code)
      .maybeSingle()

    if (invErr) {
      return NextResponse.json<JoinResponse>({ ok: false, error: invErr.message }, { status: 500 })
    }
    if (!invite) {
      return NextResponse.json<JoinResponse>({ ok: false, error: "Invalid invite code" }, { status: 404 })
    }

    const circleId: string = invite.circle_id
    const expiresAt: string | null = invite.expires_at ?? null
    const maxUses: number | null = invite.max_uses ?? null
    const uses: number = Number(invite.uses ?? 0)

    if (isExpired(expiresAt)) {
      return NextResponse.json<JoinResponse>({ ok: false, error: "Invite expired" }, { status: 410 })
    }
    if (maxUses !== null && uses >= maxUses) {
      return NextResponse.json<JoinResponse>({ ok: false, error: "Invite max uses reached" }, { status: 409 })
    }

    // 4) 이미 멤버인지 체크 (✅ 중복 join 시 uses 증가 방지)
    const { data: existingMember, error: memCheckErr } = await admin
      .from(MEMBERS_TABLE)
      .select("circle_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memCheckErr) {
      return NextResponse.json<JoinResponse>({ ok: false, error: memCheckErr.message }, { status: 500 })
    }

    const alreadyMember = !!existingMember

    // 5) 멤버 추가 (upsert)
    if (!alreadyMember) {
      const { error: upErr } = await admin
        .from(MEMBERS_TABLE)
        .upsert(
          {
            circle_id: circleId,
            user_id: user.id,
            // role 같은 컬럼이 있으면 여기서 추가 가능: role: "member"
          },
          { onConflict: "circle_id,user_id" }
        )

      if (upErr) {
        return NextResponse.json<JoinResponse>({ ok: false, error: upErr.message }, { status: 500 })
      }

      // 6) uses +1 (race 완벽 방지는 RPC가 베스트지만, 일단 안전하게)
      await admin
        .from(INVITES_TABLE)
        .update({ uses: uses + 1 })
        .eq("code", code)
    }

    // 7) circle 이름 가져오기 (UI 이동/표시용)
    const { data: circle, error: circleErr } = await admin
      .from(CIRCLES_TABLE)
      .select("id,name")
      .eq("id", circleId)
      .maybeSingle()

    if (circleErr) {
      return NextResponse.json<JoinResponse>({ ok: false, error: circleErr.message }, { status: 500 })
    }

    return NextResponse.json<JoinResponse>({
      ok: true,
      circleId,
      circleName: circle?.name ?? null,
      alreadyMember,
    })
  } catch (e: any) {
    return NextResponse.json<JoinResponse>(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500 }
    )
  }
}
