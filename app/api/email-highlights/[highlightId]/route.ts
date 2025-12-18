import { NextResponse } from "next/server"
import { supabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(req: Request, { params }: { params: { highlightId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const highlightId = params.highlightId
    const body = await req.json().catch(() => ({}))
    const is_shared = Boolean(body?.is_shared)

    const { data, error } = await supabase
      .from("email_highlights")
      .update({ is_shared })
      .eq("id", highlightId)
      .eq("user_id", user.id)
      .select("id,quote,memo,is_shared,created_at")
      .single()

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, highlight: data }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(_: Request, { params }: { params: { highlightId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const highlightId = params.highlightId

    const { error } = await supabase.from("email_highlights").delete().eq("id", highlightId).eq("user_id", user.id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
