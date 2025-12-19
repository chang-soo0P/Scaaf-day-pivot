// app/api/email-comments/[commentId]/route.ts
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/**
 * DELETE /api/email-comments/:commentId
 * - params Promise 대응
 * - createSupabaseServerClient await 대응
 * - 소유권 체크(내 이메일의 댓글만 삭제 가능)
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const { commentId } = await params
    if (!isUuid(commentId)) {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // 1) 댓글 존재 + (댓글이 달린 이메일이 내 소유인지) 확인
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
    if (!row) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    const ownerUserId = (row as any)?.inbox_emails?.user_id
    if (!ownerUserId || ownerUserId !== user.id) {
      // 내 이메일의 댓글이 아니면 존재 유무 숨김
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // 2) 삭제 권한: (a) 내가 쓴 댓글이거나 (b) 내 이메일에 달린 댓글이면 삭제 허용 중 선택
    // 여기선 "내 이메일에 달린 댓글이면 삭제 허용"으로 처리(필요 시 아래 조건으로 좁히면 됨)
    // if (row.user_id !== user.id) return NextResponse.json({ ok:false, error:"Forbidden"},{status:403})

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
