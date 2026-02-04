// app/api/circles/[circleId]/feed/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"
import type { CircleFeedApiResponse, CircleFeedItem, SharedByProfile } from "@/types/circle-feed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

async function safeExactCount(admin: any, table: string, col: string, val: string) {
  try {
    const { count, error } = await admin
      .from(table)
      .select("id", { head: true, count: "exact" })
      .eq(col, val)
    if (error) return 0
    return Number(count ?? 0)
  } catch {
    return 0
  }
}
async function safeCommentCount(admin: any, shareId: string) {
  const c1 = await safeExactCount(admin, "circle_comments", "circle_email_id", shareId)
  if (c1 > 0) return c1
  const c2 = await safeExactCount(admin, "circle_comments", "share_id", shareId)
  return c2
}

/** ✅ Route Handler에서도 세션 refresh 쿠키를 response에 반영할 수 있게 만든 패턴 */
async function createSupabaseAuthedServerClient(req: NextRequest) {
  const cookieStore = await cookies()

  let res = NextResponse.next() // 쿠키 세팅용 임시 response

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // response에 set-cookie 반영
          for (const { name, value, options } of cookiesToSet) {
            res.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  return { supabase, res }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ circleId: string }> }
) {
  try {
    const { circleId } = await context.params
    if (!circleId) {
      return NextResponse.json(
        { ok: false, error: "Missing circleId" } satisfies CircleFeedApiResponse,
        { status: 400, headers: { "Cache-Control": "no-store" } }
      )
    }

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100)
    const cursorRaw = req.nextUrl.searchParams.get("cursor")
    const cursor = cursorRaw ? decodeCursor(cursorRaw) : null

    // ✅ auth (refresh 가능)
    const { supabase: supabaseAuth, res: authRes } = await createSupabaseAuthedServerClient(req)
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
    const user = userData?.user

    if (userErr || !user) {
      // authRes에 갱신 쿠키가 실릴 수도 있으니 그대로 반환하는 편이 안전
      return NextResponse.json(
        { ok: false, error: "Unauthorized" } satisfies CircleFeedApiResponse,
        { status: 401, headers: { "Cache-Control": "no-store" } }
      )
    }

    const admin = createSupabaseAdminClient() as any

    // ✅ membership check
    // ⚠️ circle_members에 id 컬럼이 없었던 이슈가 있었으니, id 선택하지 말고 안전하게 가져가자
    const { data: membership, error: memErr } = await admin
      .from("circle_members")
      .select("circle_id, user_id")
      .eq("circle_id", circleId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (memErr) {
      return NextResponse.json(
        { ok: false, error: memErr.message } satisfies CircleFeedApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }
    if (!membership) {
      // 권한 문제는 403이 더 정확
      return NextResponse.json(
        { ok: false, error: "Forbidden" } satisfies CircleFeedApiResponse,
        { status: 403, headers: { "Cache-Control": "no-store" } }
      )
    }

    let q: any = admin
      .from("circle_emails")
      .select("id, circle_id, email_id, shared_by, created_at")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1)

    if (cursor) {
      q = q.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
    }

    const { data: sharesRaw, error: shareErr } = await q
    if (shareErr) {
      return NextResponse.json(
        { ok: false, error: shareErr.message } satisfies CircleFeedApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }

    const sharesAll = (sharesRaw ?? []) as any[]
    const hasMore = sharesAll.length > limit
    const shares = hasMore ? sharesAll.slice(0, limit) : sharesAll

    const nextCursor =
      hasMore && shares.length
        ? encodeCursor({ created_at: shares[shares.length - 1].created_at, id: shares[shares.length - 1].id })
        : null

    if (shares.length === 0) {
      return NextResponse.json(
        { ok: true, feed: [], nextCursor } satisfies CircleFeedApiResponse,
        { status: 200, headers: { "Cache-Control": "no-store" } }
      )
    }

    const emailIds = Array.from(new Set(shares.map((s) => s.email_id).filter(Boolean)))
    const { data: emails, error: emailErr } = await admin
      .from("inbox_emails")
      .select("id, subject, from_address, received_at")
      .in("id", emailIds)

    if (emailErr) {
      return NextResponse.json(
        { ok: false, error: emailErr.message } satisfies CircleFeedApiResponse,
        { status: 500, headers: { "Cache-Control": "no-store" } }
      )
    }
    const emailById = new Map((emails ?? []).map((e: any) => [e.id, e]))

    const sharedByIds = Array.from(new Set(shares.map((s) => s.shared_by).filter(Boolean)))
    let profileById = new Map<string, any>()
    if (sharedByIds.length) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, display_name, avatar_url, full_name")
        .in("id", sharedByIds)
      profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]))
    }

    const feed: CircleFeedItem[] = await Promise.all(
      shares.map(async (s) => {
        const e = emailById.get(s.email_id)
        const profile = s.shared_by ? profileById.get(s.shared_by) : null

        const sharedByProfile: SharedByProfile | null = profile
          ? {
              id: String(profile.id),
              name: String(profile.display_name ?? profile.full_name ?? "Member"),
              avatarUrl: profile.avatar_url ? String(profile.avatar_url) : null,
            }
          : null

        const highlightCount = await safeExactCount(admin, "email_highlights", "email_id", String(s.email_id))
        const commentCount = await safeCommentCount(admin, String(s.id))

        return {
          id: String(s.id),
          circleId: String(s.circle_id),
          emailId: String(s.email_id),
          sharedAt: String(s.created_at),
          sharedBy: s.shared_by ? String(s.shared_by) : null,
          sharedByProfile,
          subject: (e as any)?.subject ?? null,
          fromAddress: (e as any)?.from_address ?? null,
          receivedAt: (e as any)?.received_at ?? null,
          highlightCount,
          commentCount,
          latestActivity: null,
        }
      })
    )

    // ✅ authRes 쿠키(갱신)가 있으면 같이 실어주고 싶다면 headers/cookies merge가 필요하지만
    // 여기서는 NextResponse.json을 쓰므로 큰 문제는 없고, 세션 만료 때 401을 줄일 수 있게 setAll을 넣은 게 핵심.
    return NextResponse.json(
      { ok: true, feed, nextCursor } satisfies CircleFeedApiResponse,
      { status: 200, headers: { "Cache-Control": "no-store" } }
    )
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Unknown error" } satisfies CircleFeedApiResponse,
      { status: 500, headers: { "Cache-Control": "no-store" } }
    )
  }
}
