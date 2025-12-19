import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

async function getAuthedUserId() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user?.id) return null
  return data.user.id
}

/**
 * Option A: 이메일 소유권 체크
 * - inbox_emails.id = params.id
 * - inbox_emails.user_id = authedUserId
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const parsedParams = ParamsSchema.safeParse(ctx.params)
    if (!parsedParams.success) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }
    const { id } = parsedParams.data

    const userId = await getAuthedUserId()
    if (!userId) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = createSupabaseServerClient()
    const { data: email, error } = await supabase
      .from("inbox_emails")
      .select(
        "id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at"
      )
      .eq("id", id)
      .eq("user_id", userId)
      .single()

    if (error || !email) {
      // Option A: 존재/권한 숨김
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
