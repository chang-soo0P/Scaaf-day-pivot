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
 * - Next 16 params Promise 대응
 * - delete_comment RPC 사용 (소유권/권한은 DB에서 보장)
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
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

    // ✅ DB에서 원자적으로: 권한 확인 + 삭제
    const { data, error } = await supabase.rpc("delete_comment", {
      p_comment_id: commentId,
    })

    if (error) {
      console.error("[comment delete rpc] error:", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    // delete_comment은 boolean 반환
    if (!data) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("[comment delete] fatal:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
