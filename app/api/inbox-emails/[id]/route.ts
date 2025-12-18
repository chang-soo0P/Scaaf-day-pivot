import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"

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
  body_text: string | null
  body_html: string | null
  raw: any
  received_at: string | null
}

/**
 * Helper: Validate email ownership
 * - Uses the SAME supabase client created per-request (cookie/session safe)
 * - Returns email row if found and owned by user, null otherwise
 */
async function validateEmailOwnership(
  supabase: SupabaseClient,
  emailId: string,
  userId: string
): Promise<DbEmailRow | null> {
  try {
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
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 })
    }

    // Instantiate Supabase client (per request)
    const supabase = createSupabaseServerClient()

    // Auth check
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    // Debug logging (dev only - remove later if you want)
    console.log("GET /api/inbox-emails/[id] auth user", user?.id, "auth error", userError?.message)

    if (userError || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // Ownership check (reuse same supabase instance)
    const email = await validateEmailOwnership(supabase, id, user.id)
    if (!email) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
