// app/api/circles/feed/route.ts
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

type CursorPayload = { created_at: string; id: string }

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url")
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8")
    const parsed = JSON.parse(json)
    if (!parsed?.created_at || !parsed?.id) return null
    return { created_at: String(parsed.created_at), id: String(parsed.id) }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100)
    const cursorRaw = req.nextUrl.searchParams.get("cursor")
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null

    // ✅ 로그인 유저 확인
    const supabaseAuth = await createSupabaseAuthedServerClient()
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const admin = createSupabaseAdminClient()

    // 1) 내가 속한 circle_id 목록
    const { data: memberships, error: memErr } = await admin
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", user.id)

    if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })

    const circleIds = (memberships ?? []).map((m: any) => m.circle_id).filter(Boolean)
    if (circleIds.length === 0) {
      return NextResponse.json(
        { ok: true, items: [], feed: [], nextCursor: null },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      )
    }

    // 2) circle_emails 최근 공유글 (cursor paging)
    let q = admin
      .from("circle_emails")
      .select("id, circle_id, email_id, shared_by, created_at")
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1)

    // cursor: (created_at, id) 기준으로 "이전 것들"만 가져오기
    if (cursor) {
      // created_at < cursor.created_at OR (created_at = cursor.created_at AND id < cursor.id)
      q = q.or(
        `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
      )
    }

    const { data: sharesRaw, error: shareErr } = await q
    if (shareErr) return NextResponse.json({ ok: false, error: shareErr.message }, { status: 500 })

    const sharesAll = sharesRaw ?? []
    const hasMore = sharesAll.length > limit
    const shares = hasMore ? sharesAll.slice(0, limit) : sharesAll

    const nextCursor =
      hasMore && shares.length
        ? encodeCursor({ created_at: shares[shares.length - 1].created_at, id: shares[shares.length - 1].id })
        : null

    if (shares.length === 0) {
      return NextResponse.json(
        { ok: true, items: [], feed: [], nextCursor },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      )
    }

    // 3) circleName 붙이기
    const circleIdsOnPage = Array.from(new Set(shares.map((s: any) => s.circle_id).filter(Boolean)))
    const { data: circles, error: circlesErr } = await admin
      .from("circles")
      .select("id, name")
      .in("id", circleIdsOnPage)

    if (circlesErr) return NextResponse.json({ ok: false, error: circlesErr.message }, { status: 500 })
    const circleNameById = new Map((circles ?? []).map((c: any) => [c.id, c.name]))

    // 4) inbox_emails 메타 붙이기
    const emailIds = Array.from(new Set(shares.map((s: any) => s.email_id).filter(Boolean)))
    const { data: emails, error: emailErr } = await admin
      .from("inbox_emails")
      .select("id, subject, from_address, received_at")
      .in("id", emailIds)

    if (emailErr) return NextResponse.json({ ok: false, error: emailErr.message }, { status: 500 })
    const emailById = new Map((emails ?? []).map((e: any) => [e.id, e]))

    // ✅ (A) 프론트가 원래 기대하던 구조: items + email + circle_name
    const items = shares.map((s: any) => {
      const email = emailById.get(s.email_id) ?? null
      return {
        id: s.id,
        circle_id: s.circle_id,
        circle_name: circleNameById.get(s.circle_id) ?? null,
        email_id: s.email_id,
        shared_by: s.shared_by ?? null,
        created_at: s.created_at,
        email,
      }
    })

    // ✅ (B) 네가 현재 확인했던 구조: feed (flat)
    const feed = shares.map((s: any) => {
      const e = emailById.get(s.email_id)
      return {
        id: s.id,
        circleId: s.circle_id,
        circleName: circleNameById.get(s.circle_id) ?? null,
        emailId: s.email_id,
        sharedAt: s.created_at,
        sharedBy: s.shared_by ?? null,
        subject: e?.subject ?? null,
        fromAddress: e?.from_address ?? null,
        receivedAt: e?.received_at ?? null,
        highlightCount: 0,
        commentCount: 0,
        latestActivity: null,
      }
    })

    return NextResponse.json(
      { ok: true, items, feed, nextCursor },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
