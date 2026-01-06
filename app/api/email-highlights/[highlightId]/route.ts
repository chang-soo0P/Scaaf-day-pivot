import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"

export const runtime = "nodejs"

type Ctx = { params: Promise<{ highlightId: string }> } // ✅ Next15 params Promise

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

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { highlightId } = await ctx.params

  const supabaseAuth = await createSupabaseAuthedServerClient()
  const { data, error: userErr } = await supabaseAuth.auth.getUser()

  if (userErr || !data.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const isShared = body?.isShared

  const patch: any = {}
  if (typeof isShared === "boolean") patch.is_shared = isShared

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 })
  }

  const admin = createSupabaseAdminClient()

  const { data: row, error } = await admin
    .from("email_highlights")
    .update(patch)
    .eq("id", highlightId)
    .eq("user_id", data.user.id)
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
    .eq("user_id", data.user.id)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 200 })
}
