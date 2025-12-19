import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({ id: z.string().uuid() })
const CreateSchema = z.object({ quote: z.string().min(1).max(4000) })

async function assertEmailOwned(supabase: ReturnType<typeof createSupabaseServerClient>, emailId: string, userId: string) {
  const { data, error } = await supabase
    .from("inbox_emails")
    .select("id")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single()
  return !error && !!data
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const parsed = ParamsSchema.safeParse(ctx.params)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })

  const supabase = createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const emailId = parsed.data.id
  const userId = auth.user.id

  const owned = await assertEmailOwned(supabase, emailId, userId)
  if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  const { data: rows, error } = await supabase
    .from("email_highlights")
    .select("id,quote,created_at,is_shared,memo")
    .eq("email_id", emailId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

  const highlights = (rows ?? []).map((r) => ({
    id: r.id,
    quote: r.quote,
    createdAt: r.created_at,
    isShared: r.is_shared,
    memo: r.memo ?? undefined,
  }))

  return NextResponse.json({ ok: true, highlights }, { status: 200 })
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const parsed = ParamsSchema.safeParse(ctx.params)
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })

  const body = await req.json().catch(() => null)
  const bodyParsed = CreateSchema.safeParse(body)
  if (!bodyParsed.success) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })

  const supabase = createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const emailId = parsed.data.id
  const userId = auth.user.id

  const owned = await assertEmailOwned(supabase, emailId, userId)
  if (!owned) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

  const { data: row, error } = await supabase
    .from("email_highlights")
    .insert({
      email_id: emailId,
      user_id: userId,      // ✅ auth uid
      quote: bodyParsed.data.quote,
      is_shared: false,
    })
    .select("id,quote,created_at,is_shared,memo")
    .single()

  if (error || !row) return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })

  const highlight = {
    id: row.id,
    quote: row.quote,
    createdAt: row.created_at,
    isShared: row.is_shared,
    memo: row.memo ?? undefined,
  }

  return NextResponse.json({ ok: true, highlight }, { status: 200 })
}
