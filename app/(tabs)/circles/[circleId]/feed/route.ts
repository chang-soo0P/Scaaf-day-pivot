import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ circlesID: string }> } // ✅ Next15 params Promise

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // ✅ Next15: cookies() is Promise

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

/**
 * circlesID는 프로젝트에 따라 id(uuid)일 수도, slug일 수도 있어서
 * 둘 다 안전하게 처리:
 * - uuid면 circles.id로 조회
 * - 아니면 circles.slug(없으면 name/handle 등으로 바꿔서 사용)
 */
async function resolveCircleId(admin: ReturnType<typeof createSupabaseAdminClient>, circlesID: string) {
  if (isUuid(circlesID)) {
    const { data, error } = await admin.from("circles").select("id, name, slug").eq("id", circlesID).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  }

  // ✅ slug 컬럼명이 다르면 여기만 바꿔줘 (예: handle / key 등)
  const { data, error } = await admin.from("circles").select("id, name, slug").eq("slug", circlesID).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

function pickDisplayName(u: any) {
  return (
    u?.display_name ||
    u?.name ||
    (u?.email ? String(u.email).split("@")[0] : null) ||
    "Someone"
  )
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { circlesID } = await ctx.params

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 30), 100)

  // ✅ 로그인 확인
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user
  if (userErr || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  // ✅ circle id 해석 (uuid or slug)
  let circle: { id: string; name?: string | null; slug?: string | null } | null = null
  try {
    circle = await resolveCircleId(admin, circlesID)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed to resolve circle" }, { status: 500 })
  }

  if (!circle?.id) {
    return NextResponse.json({ ok: false, error: "Circle not found" }, { status: 404 })
  }

  // ✅ 멤버십 체크
  const { data: member, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id, user_id")
    .eq("circle_id", circle.id)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // ✅ 공유된 이메일 목록
  const { data: ceRows, error: ceErr } = await admin
    .from("circle_emails")
    .select("email_id, shared_by, created_at")
    .eq("circle_id", circle.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (ceErr) return NextResponse.json({ ok: false, error: ceErr.message }, { status: 500 })

  const rows = ceRows ?? []
  const emailIds = Array.from(new Set(rows.map((r: any) => r.email_id).filter(Boolean)))
  const userIds = Array.from(new Set(rows.map((r: any) => r.shared_by).filter(Boolean)))

  // ✅ inbox_emails fetch
  const emailsById = new Map<string, any>()
  if (emailIds.length) {
    const { data: emails, error: eErr } = await admin
      .from("inbox_emails")
      .select("id, subject, from_address, received_at, body_text, body_html")
      .in("id", emailIds)

    if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 })
    for (const e of emails ?? []) emailsById.set(e.id, e)
  }

  // ✅ sharer users fetch (컬럼명은 프로젝트 스키마에 맞춰 사용)
  const usersById = new Map<string, any>()
  if (userIds.length) {
    const { data: users, error: uErr } = await admin
      .from("users")
      .select("id, display_name, name, email")
      .in("id", userIds)

    if (uErr) {
      // users 테이블이 없거나 컬럼이 다를 수도 있으니 fail-soft
      // (이 경우 shared_by는 "Someone"으로 표시됨)
    } else {
      for (const u of users ?? []) usersById.set(u.id, u)
    }
  }

  const feed = rows
    .map((r: any) => {
      const e = emailsById.get(r.email_id) ?? null
      const u = usersById.get(r.shared_by) ?? null
      return {
        emailId: r.email_id,
        sharedAt: r.created_at,
        sharedBy: r.shared_by,
        sharedByName: pickDisplayName(u),
        subject: e?.subject ?? "(no subject)",
        fromAddress: e?.from_address ?? "Unknown",
        receivedAt: e?.received_at ?? null,
      }
    })
    .filter((x) => Boolean(x.emailId))

  return NextResponse.json(
    { ok: true, circle: { id: circle.id, name: circle.name ?? null, slug: circle.slug ?? null }, feed },
    { status: 200 }
  )
}
