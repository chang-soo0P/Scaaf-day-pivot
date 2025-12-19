import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const { commentId } = await params
    if (!isUuid(commentId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // 내 이메일에 달린 댓글인지 확인 (RLS/권한 루프 방지)
    const { data: row, error: findErr } = await supabase
      .from("comments")
      .select(
        `
        id,
        user_id,
        email_id,
        inbox_emails:inbox_emails (
          id,
          user_id
        )
      `
      )
      .eq("id", commentId)
      .maybeSingle()

    if (findErr) {
      console.error("[email-comments:delete] findErr", findErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }
    if (!row) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    const ownerUserId = (row as any)?.inbox_emails?.user_id
    if (!ownerUserId || ownerUserId !== user.id) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const { error: delErr } = await supabase.from("comments").delete().eq("id", commentId)
    if (delErr) {
      console.error("[email-comments:delete] delErr", delErr)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("[email-comments:delete] fatal", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
