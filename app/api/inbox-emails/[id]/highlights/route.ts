import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ id: string }> } // ✅ Next15 params Promise

async function createSupabaseAuthedServerClient() {
  // ✅ Next15: cookies() is Promise
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        // Route Handler에서는 세션 갱신 쿠키 set/remove가 필요 없으면 noop로 둬도 OK
        set() {},
        remove() {},
      },
    }
  )
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: emailId } = await ctx.params

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !data.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  const { data: rows, error } = await admin
    .from("email_highlights")
    .select("id, quote, memo, is_shared, created_at")
    .eq("email_id", emailId)
    .eq("user_id", data.user.id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const highlights = (rows ?? []).map((r: any) => ({
    id: r.id,
    quote: r.quote,
    memo: r.memo ?? undefined,
    isShared: Boolean(r.is_shared),
    createdAt: r.created_at,
  }))

  return NextResponse.json({ ok: true, highlights }, { status: 200 })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: emailId } = await ctx.params

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !data.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const quote = String(body?.quote ?? "").trim()
  const memo = body?.memo != null ? String(body.memo) : null

  if (!quote) {
    return NextResponse.json({ ok: false, error: "Missing quote" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  const { data: row, error } = await admin
    .from("email_highlights")
    .insert({
      email_id: emailId,
      user_id: data.user.id,
      quote,
      memo,
      is_shared: false,
    })
    .select("id, quote, memo, is_shared, created_at")
    .single()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const highlight = {
    id: row.id,
    quote: row.quote,
    memo: row.memo ?? undefined,
    isShared: Boolean(row.is_shared),
    createdAt: row.created_at,
  }

  return NextResponse.json({ ok: true, highlight }, { status: 200 })
}
