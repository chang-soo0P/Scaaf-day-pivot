import { NextResponse } from "next/server"
import { supabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_: Request, { params }: { params: { commentId: string } }) {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const commentId = params.commentId
    const { error } = await supabase.from("email_comments").delete().eq("id", commentId).eq("user_id", user.id)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
