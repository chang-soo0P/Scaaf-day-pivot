import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  highlightId: z.string().uuid(),
})

const PatchBodySchema = z.object({
  isShared: z.boolean().optional(),
  memo: z.string().max(5000).nullable().optional(),
})

async function getAuthedUserId() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

/**
 * Ownership check (Option A)
 * - highlight 존재 + highlight.user_id === userId
 * - + email도 inbox_emails.user_id === userId (2중 체크)
 */
async function assertHighlightOwnership(highlightId: string, userId: string) {
  const supabase = createSupabaseServerClient()

  const { data: h, error: hErr } = await supabase
    .from("email_highlights")
    .select("id, email_id, user_id, is_shared, memo")
    .eq("id", highlightId)
    .single()

  if (hErr || !h) return null
  if (h.user_id !== userId) return null

  // email 소유권도 확인 (원치 않으면 이 블록 제거 가능)
  if (h.email_id) {
    const { data: e, error: eErr } = await supabase
      .from("inbox_emails")
      .select("id, user_id")
      .eq("id", h.email_id)
      .single()

    if (eErr || !e) return null
    if (e.user_id !== userId) return null
  }

  return h
}

export async function PATCH(req: NextRequest, ctx: { params: { highlightId: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { highlightId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const bodyJson = await req.json().catch(() => null)
    const parsedBody = PatchBodySchema.safeParse(bodyJson)
    if (!parsedBody.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    // ownership
    const owned = await assertHighlightOwnership(highlightId, userId)
    if (!owned) {
      // 옵션 A: 존재/권한 숨김
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()
    const patch: Record<string, any> = {}
    if (typeof parsedBody.data.isShared === "boolean") patch.is_shared = parsedBody.data.isShared
    if ("memo" in parsedBody.data) patch.memo = parsedBody.data.memo ?? null

    const { data: updated, error: upErr } = await supabase
      .from("email_highlights")
      .update(patch)
      .eq("id", highlightId)
      .select("id, quote, created_at, is_shared, memo")
      .single()

    if (upErr || !updated) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json(
      {
        ok: true,
        highlight: {
          id: updated.id,
          quote: updated.quote,
          createdAt: updated.created_at,
          isShared: updated.is_shared,
          memo: updated.memo ?? undefined,
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("PATCH /api/email-highlights/[highlightId] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: { highlightId: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { highlightId } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // ownership
    const owned = await assertHighlightOwnership(highlightId, userId)
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()
    const { error: delErr } = await supabase.from("email_highlights").delete().eq("id", highlightId)
    if (delErr) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("DELETE /api/email-highlights/[highlightId] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
