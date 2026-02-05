// app/api/circles/[circleId]/highlights/route.ts
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

type DbCircleMember = { user_id: string }
type DbCircleEmail = { email_id: string }

type DbHighlight = {
  id: string
  email_id: string
  user_id: string
  quote: string | null
  memo: string | null
  is_shared: boolean | null
  created_at: string
}

type DbInboxEmail = {
  id: string
  subject: string | null
  from_address: string | null
  received_at: string | null
}

type DbUser = {
  id: string
  username: string | null
  display_name: string | null
  email_address: string | null
}

type DbCircle = {
  id: string
  name: string | null
}

type ApiItem = {
  id: string
  circleId: string
  circleName: string
  emailId: string
  quote: string
  memo: string | null
  createdAt: string
  sharedBy: string
  sharedByProfile: { id: string; name: string; avatarUrl: string | null } | null
  subject: string | null
  fromAddress: string | null
  receivedAt: string | null
}

type ApiResp =
  | { ok: true; highlights: ApiItem[]; nextCursor: string | null }
  | { ok: false; error: string }

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await context.params
    if (!circleId) {
      return NextResponse.json({ ok: false, error: "Missing circleId" } satisfies ApiResp, { status: 400 })
    }

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 30), 100)
    const cursor = req.nextUrl.searchParams.get("cursor") // ISO

    // ✅ auth
    const supabaseAuth = await createSupabaseAuthedServerClient()
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" } satisfies ApiResp, { status: 401 })
    }

    const admin = createSupabaseAdminClient() as any

    // ✅ 내가 이 circle 멤버인지 확인
    const { data: me, error: meErr } = await admin
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (meErr) return NextResponse.json({ ok: false, error: meErr.message } satisfies ApiResp, { status: 500 })
    if (!me) return NextResponse.json({ ok: false, error: "Forbidden" } satisfies ApiResp, { status: 403 })

    // 1) circle 멤버 ids
    const { data: membersRaw, error: memErr } = await admin
      .from("circle_members")
      .select("user_id")
      .eq("circle_id", circleId)

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message } satisfies ApiResp, { status: 500 })

    const members = (membersRaw ?? []) as DbCircleMember[]
    const memberIds = members.map((m) => m.user_id).filter(Boolean)

    if (memberIds.length === 0) {
      return NextResponse.json({ ok: true, highlights: [], nextCursor: null } satisfies ApiResp, { status: 200 })
    }

    // 2) circle에 공유된 이메일 ids
    const { data: sharesRaw, error: shareErr } = await admin
      .from("circle_emails")
      .select("email_id")
      .eq("circle_id", circleId)

    if (shareErr) return NextResponse.json({ ok: false, error: shareErr.message } satisfies ApiResp, { status: 500 })

    const shares = (sharesRaw ?? []) as DbCircleEmail[]
    const emailIds = Array.from(new Set(shares.map((s) => s.email_id).filter(Boolean)))

    if (emailIds.length === 0) {
      return NextResponse.json({ ok: true, highlights: [], nextCursor: null } satisfies ApiResp, { status: 200 })
    }

    // 3) highlights (circle 공유 이메일 + circle 멤버 작성 + 공유 on)
    let q: any = admin
      .from("email_highlights")
      .select("id, email_id, user_id, quote, memo, is_shared, created_at")
      .in("email_id", emailIds)
      .in("user_id", memberIds)
      .eq("is_shared", true)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (cursor) q = q.lt("created_at", cursor)

    const { data: hlRaw, error: hlErr } = await q
    if (hlErr) return NextResponse.json({ ok: false, error: hlErr.message } satisfies ApiResp, { status: 500 })

    const highlights = (hlRaw ?? []) as DbHighlight[]
    const nextCursor = highlights.length === limit ? (highlights[highlights.length - 1]?.created_at ?? null) : null

    if (highlights.length === 0) {
      return NextResponse.json({ ok: true, highlights: [], nextCursor } satisfies ApiResp, { status: 200 })
    }

    // 4) email meta
    const uniqueEmailIds = Array.from(new Set(highlights.map((h) => h.email_id).filter(Boolean)))
    const { data: emailsRaw, error: emailErr } = await admin
      .from("inbox_emails")
      .select("id, subject, from_address, received_at")
      .in("id", uniqueEmailIds)

    if (emailErr) return NextResponse.json({ ok: false, error: emailErr.message } satisfies ApiResp, { status: 500 })

    const emails = (emailsRaw ?? []) as DbInboxEmail[]
    const emailById = new Map<string, DbInboxEmail>(emails.map((e) => [e.id, e]))

    // 5) users profile
    const uniqueUserIds = Array.from(new Set(highlights.map((h) => h.user_id).filter(Boolean)))
    const { data: usersRaw, error: usersErr } = await admin
      .from("users")
      .select("id, username, display_name, email_address")
      .in("id", uniqueUserIds)

    // users는 없을 수도 있으니(권한/테이블) 에러는 치명 처리 X
    const users = (!usersErr && usersRaw ? (usersRaw as DbUser[]) : []) as DbUser[]
    const userById = new Map<string, DbUser>(users.map((u) => [u.id, u]))

    // 6) circle meta
    const { data: circleRaw } = await admin
      .from("circles")
      .select("id, name")
      .eq("id", circleId)
      .maybeSingle()

    const circle = (circleRaw ?? null) as DbCircle | null
    const circleName = circle?.name ?? "Circle"

    // 7) compose
    const items: ApiItem[] = highlights.map((h) => {
      const e = emailById.get(h.email_id)
      const u = userById.get(h.user_id)

      const name =
        (u?.display_name && u.display_name.trim()) ||
        (u?.username && u.username.trim()) ||
        "Member"

      return {
        id: String(h.id),
        circleId,
        circleName,
        emailId: String(h.email_id),
        quote: String(h.quote ?? ""),
        memo: h.memo != null ? String(h.memo) : null,
        createdAt: String(h.created_at),
        sharedBy: String(h.user_id),
        sharedByProfile: {
          id: String(h.user_id),
          name,
          avatarUrl: null,
        },
        subject: e?.subject ?? null,
        fromAddress: e?.from_address ?? null,
        receivedAt: e?.received_at ?? null,
      }
    })

    return NextResponse.json({ ok: true, highlights: items, nextCursor } satisfies ApiResp, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" } satisfies ApiResp, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    })
  }
}
