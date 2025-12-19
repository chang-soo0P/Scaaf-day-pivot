import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

const CreateSchema = z.object({
  quote: z.string().min(1).max(5000),
})

async function getAuthedUserId() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

async function assertEmailOwnership(emailId: string, userId: string) {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from("inbox_emails")
    .select("id,user_id")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single()

  if (error || !data) return false
  return true
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { id: emailId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // email 소유권 체크 (Option A)
    const ok = await assertEmailOwnership(emailId, userId)
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("email_highlights")
      .select("id, quote, created_at, is_shared, memo")
      .eq("email_id", emailId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    const highlights =
      (data ?? []).map((h) => ({
        id: h.id,
        quote: h.quote,
        createdAt: h.created_at,
        isShared: h.is_shared,
        memo: h.memo ?? undefined,
      })) ?? []

    return NextResponse.json({ ok: true, highlights }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { id: emailId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // email 소유권 체크 (Option A)
    const ok = await assertEmailOwnership(emailId, userId)
    if (!ok) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const bodyJson = await req.json().catch(() => null)
    const parsedBody = CreateSchema.safeParse(bodyJson)
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: created, error } = await supabase
      .from("email_highlights")
      .insert({
        email_id: emailId,
        user_id: userId,
        quote: parsedBody.data.quote,
        is_shared: false,
      })
      .select("id, quote, created_at, is_shared, memo")
      .single()

    if (error || !created) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        highlight: {
          id: created.id,
          quote: created.quote,
          createdAt: created.created_at,
          isShared: created.is_shared,
          memo: created.memo ?? undefined,
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
