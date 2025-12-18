import { NextRequest, NextResponse } from "next/server"
import { supabaseRouteClient } from "@/app/api/_supabase/route-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Helper: Get authenticated user or return null
 */
async function getAuthenticatedUser() {
  try {
    const supabase = supabaseRouteClient()
    const { data: auth } = await supabase.auth.getUser()
    return auth.user
  } catch {
    return null
  }
}

/**
 * Helper: Validate email ownership
 * Returns email row if found and owned by user, null otherwise
 */
async function validateEmailOwnership(emailId: string, userId: string) {
  try {
    const supabase = supabaseRouteClient()
    const { data: emailRow, error } = await supabase
      .from("inbox_emails")
      .select("id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at")
      .eq("id", emailId)
      .single()

    if (error || !emailRow) return null
    if (emailRow.user_id !== userId) return null

    return emailRow
  } catch {
    return null
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params

    // Auth check
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // Ownership check
    const email = await validateEmailOwnership(id, user.id)
    if (!email) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
