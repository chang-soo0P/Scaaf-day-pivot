import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

async function createSupabaseAuthedServerClient() {
  const cookieStore = await cookies() // ✅ Next15

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

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200)

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user
  if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const admin = createSupabaseAdminClient()

  // 1) 내 멤버십 circle_id들
  const { data: memRows, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)
    .limit(limit)

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })

  const circleIds = (memRows ?? []).map((r: any) => r.circle_id).filter(Boolean)
  if (circleIds.length === 0) return NextResponse.json({ ok: true, circles: [] }, { status: 200 })

  // 2) circles 가져오기
  const { data: circles, error: cErr } = await admin
    .from("circles")
    .select("id, slug, name, description, created_at")
    .in("id", circleIds)
    .order("created_at", { ascending: false })

  if (cErr) return NextResponse.json({ ok: false, error: cErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, circles: circles ?? [] }, { status: 200 })
}

export async function POST(req: NextRequest) {
  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user
  if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = String(body?.name ?? "").trim()
  const description = body?.description != null ? String(body.description) : null
  const slugInput = body?.slug != null ? String(body.slug) : ""

  if (!name) return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 })

  const admin = createSupabaseAdminClient()

  // slug 자동 생성 + 중복이면 -2, -3…
  let baseSlug = slugInput.trim() ? slugify(slugInput) : slugify(name)
  if (!baseSlug) baseSlug = `circle-${Date.now()}`

  let finalSlug = baseSlug
  for (let i = 0; i < 10; i++) {
    const { data: exist } = await admin.from("circles").select("id").eq("slug", finalSlug).maybeSingle()
    if (!exist) break
    finalSlug = `${baseSlug}-${i + 2}`
  }

  const { data: circle, error: insErr } = await admin
    .from("circles")
    .insert({ name, description, slug: finalSlug })
    .select("id, slug, name, description, created_at")
    .single()

  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 })

  // 생성자를 멤버로 자동 등록
  const { error: memErr } = await admin
    .from("circle_members")
    .insert({ circle_id: circle.id, user_id: user.id })

  if (memErr) {
    // circle은 생성됐는데 멤버 insert 실패 → 롤백은 MVP에선 생략하고 에러만 리턴
    return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, circle }, { status: 200 })
}
