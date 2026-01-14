import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

async function getSupabase() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )
}

export async function GET(req: NextRequest) {
  const supabase = await getSupabase()

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr) return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 })
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const emailId = searchParams.get("emailId")

  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200)
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0)

  let q = supabase
    .from("email_highlights")
    .select("id, email_id, quote, memo, is_shared, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (emailId) q = q.eq("email_id", emailId)

  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const highlights = (data ?? []).map((h: any) => ({
    id: h.id,
    quote: h.quote ?? "",
    createdAt: h.created_at,
    isShared: Boolean(h.is_shared),
    memo: h.memo ?? undefined,
    emailId: h.email_id,
  }))

  return NextResponse.json({ ok: true, highlights }, { status: 200 })
}
