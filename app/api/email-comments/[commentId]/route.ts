// app/api/email-comments/[commentId]/route.ts
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function DELETE(_req: Request, { params }: { params: { commentId: string } }) {
  try {
    const commentId = params.commentId
    if (!isUuid(commentId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("user_id", auth.user.id)
    if (error) {
      console.error("[email-comments:delete] error", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("[email-comments:delete] fatal", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
