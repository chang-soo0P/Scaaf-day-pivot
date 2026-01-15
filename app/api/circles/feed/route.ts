import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"
type Ctx = { params: Promise<{ circleId: string }> } // Next15

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

function buildSnippet(subject: string | null, bodyText: string | null) {
  const src = (bodyText ?? subject ?? "").replace(/\s+/g, " ").trim()
  return src.length > 90 ? src.slice(0, 90) + "…" : src
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { circleId } = await ctx.params
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20), 100)

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data: userData, error: userErr } = await supabaseAuth.auth.getUser()
  const user = userData?.user
  if (userErr || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const admin = createSupabaseAdminClient()

  // ✅ membership check
  const { data: member, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) return NextResponse.json({ ok: false, error: memErr.message }, { status: 500 })
  if (!member) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  // 1) circle_emails
  const { data: shares, error: sErr } = await admin
    .from("circle_emails")
    .select("email_id, shared_by, created_at")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (sErr) return NextResponse.json({ ok: false, error: sErr.message }, { status: 500 })

  const emailIds = (shares ?? []).map((r: any) => r.email_id).filter(Boolean)
  if (emailIds.length === 0) return NextResponse.json({ ok: true, items: [] }, { status: 200 })

  // 2) emails meta
  const { data: emails, error: eErr } = await admin
    .from("inbox_emails")
    .select("id, from_address, subject, body_text, received_at")
    .in("id", emailIds)

  if (eErr) return NextResponse.json({ ok: false, error: eErr.message }, { status: 500 })

  const emailMap = new Map((emails ?? []).map((e: any) => [e.id, e]))

  // 3) counts (현재 유저 기준)
  const { data: hRows } = await admin
    .from("email_highlights")
    .select("email_id")
    .eq("user_id", user.id)
    .in("email_id", emailIds)

  const { data: cRows } = await admin
    .from("email_comments")
    .select("email_id")
    .eq("user_id", user.id)
    .in("email_id", emailIds)

  const hCount: Record<string, number> = {}
  for (const r of hRows ?? []) hCount[(r as any).email_id] = (hCount[(r as any).email_id] ?? 0) + 1

  const cCount: Record<string, number> = {}
  for (const r of cRows ?? []) cCount[(r as any).email_id] = (cCount[(r as any).email_id] ?? 0) + 1

  // response
  const items = (shares ?? []).map((s: any) => {
    const e = emailMap.get(s.email_id)
    return {
      emailId: s.email_id,
      sharedAt: s.created_at,
      sender: e?.from_address ?? "Unknown",
      subject: e?.subject ?? "(no subject)",
      snippet: buildSnippet(e?.subject ?? null, e?.body_text ?? null),
      highlightCount: hCount[s.email_id] ?? 0,
      commentCount: cCount[s.email_id] ?? 0,
      latestActivity: "", // MVP: 빈값 (원하면 다음 단계에서 채워줌)
    }
  })

  return NextResponse.json({ ok: true, items }, { status: 200 })
}
