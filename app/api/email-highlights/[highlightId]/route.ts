// app/api/email-highlights/[highlightId]/route.ts
import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export async function DELETE(_req: Request, { params }: { params: { highlightId: string } }) {
  try {
    const highlightId = params.highlightId
    if (!isUuid(highlightId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const { error } = await supabase
      .from("email_highlights")
      .delete()
      .eq("id", highlightId)
      .eq("user_id", auth.user.id)

    if (error) {
      console.error("[email-highlights:delete] error", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error("[email-highlights:delete] fatal", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: { highlightId: string } }) {
  try {
    const highlightId = params.highlightId
    if (!isUuid(highlightId)) return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const isShared = Boolean(body?.isShared ?? body?.is_shared ?? false)

    const { data, error } = await supabase
      .from("email_highlights")
      .update({ is_shared: isShared })
      .eq("id", highlightId)
      .eq("user_id", auth.user.id)
      .select("id, quote, created_at, is_shared, memo")
      .maybeSingle()

    if (error) {
      console.error("[email-highlights:patch] error", error)
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }
    if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })

    return NextResponse.json(
      {
        ok: true,
        highlight: {
          id: data.id,
          quote: data.quote,
          createdAt: data.created_at,
          isShared: Boolean(data.is_shared),
          memo: data.memo ?? undefined,
        },
      },
      { status: 200 }
    )
  } catch (e) {
    console.error("[email-highlights:patch] fatal", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
