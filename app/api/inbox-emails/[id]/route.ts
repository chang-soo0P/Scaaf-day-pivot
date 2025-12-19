import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ParamsSchema = z.object({ id: z.string().uuid() })

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const parsed = ParamsSchema.safeParse(ctx.params)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid email id" }, { status: 400 })
  }

  const supabase = createSupabaseServerClient()

  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const emailId = parsed.data.id
  const userId = auth.user.id // ✅ auth uid

  // ✅ 소유권 체크: user_id = auth.uid
  const { data: email, error } = await supabase
    .from("inbox_emails")
    .select("id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at")
    .eq("id", emailId)
    .eq("user_id", userId)
    .single()

  if (error || !email) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ ok: true, email }, { status: 200 })
}
