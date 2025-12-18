// app/api/inbox-emails/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DbEmailRow = {
  id: string
  user_id: string | null
  address_id: string | null
  message_id: string | null
  from_address: string | null
  to_address?: string | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  raw: any
  received_at: string | null
}

async function validateEmailOwnership(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  emailId: string,
  userId: string
): Promise<DbEmailRow | null> {
  const { data: emailRow, error } = await supabase
    .from("inbox_emails")
    .select(
      "id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at"
    )
    .eq("id", emailId)
    .single()

  if (error || !emailRow) return null
  if (emailRow.user_id !== userId) return null
  return emailRow as DbEmailRow
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params?.id

    // "undefined" 같은 잘못된 호출은 400으로 빨리 컷
    if (!id || id === "undefined" || id === "null") {
      return NextResponse.json({ ok: false, error: "Bad Request" }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // 서버에서 세션 못 읽으면 여기로 떨어짐(401)
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        {
          status: 401,
          headers: { "cache-control": "no-store" },
        }
      )
    }

    const email = await validateEmailOwnership(supabase, id, user.id)
    if (!email) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json(
      { ok: true, email },
      {
        status: 200,
        headers: { "cache-control": "no-store" },
      }
    )
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
