import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ highlightId: string }> } // ✅ Next15 params Promise

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
        // Route Handler에서 세션 갱신 쿠키 set/remove가 꼭 필요하지 않으면 noop OK
        set() {},
        remove() {},
      },
    }
  )
}

// ✅ PATCH: isShared / memo 업데이트
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { highlightId } = await ctx.params

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !data.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  const patch: Record<string, any> = {}

  // isShared (boolean)
  if (typeof body?.isShared === "boolean") {
    patch.is_shared = body.isShared
  }

  // memo (string | null) - 보내면 갱신, 안 보내면 유지
  if (body?.memo !== undefined) {
    patch.memo = body.memo === null ? null : String(body.memo)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  const { data: row, error } = await admin
    .from("email_highlights")
    .update(patch)
    .eq("id", highlightId)
    .eq("user_id", data.user.id) // ✅ 반드시 본인 것만
    .select("id, quote, memo, is_shared, created_at")
    .maybeSingle()

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  const highlight = {
    id: row.id,
    quote: row.quote,
    memo: row.memo ?? undefined,
    isShared: Boolean(row.is_shared),
    createdAt: row.created_at,
  }

  return NextResponse.json({ ok: true, highlight }, { status: 200 })
}

// ✅ DELETE: 하이라이트 삭제
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { highlightId } = await ctx.params

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !data.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const admin = createSupabaseAdminClient()

  const { error } = await admin
    .from("email_highlights")
    .delete()
    .eq("id", highlightId)
    .eq("user_id", data.user.id) // ✅ 반드시 본인 것만

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 200 })
}
