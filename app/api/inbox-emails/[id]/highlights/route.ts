import { NextResponse } from "next/server"
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
 * Returns true if email exists and is owned by user
 */
async function validateEmailOwnership(emailId: string, userId: string): Promise<boolean> {
  try {
    const supabase = supabaseRouteClient()
    const { data: emailRow, error } = await supabase
      .from("inbox_emails")
      .select("id,user_id")
      .eq("id", emailId)
      .single()

    if (error || !emailRow) return false
    return emailRow.user_id === userId
  } catch {
    return false
  }
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const { id: emailId } = params

    // Auth check
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // Ownership check
    const isOwner = await validateEmailOwnership(emailId, user.id)
    if (!isOwner) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // Fetch highlights
    const supabase = supabaseRouteClient()
    const { data, error } = await supabase
      .from("email_highlights")
      .select("id,quote,memo,is_shared,created_at")
      .eq("email_id", emailId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, highlights: data ?? [] }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id: emailId } = params

    // Auth check
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // Parse body
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
    }

    const quote = String(body?.quote ?? "").trim()
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 })
    }

    const memo = body?.memo ? String(body.memo).trim() : null

    // Ownership check
    const isOwner = await validateEmailOwnership(emailId, user.id)
    if (!isOwner) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 })
    }

    // Create highlight (is_shared defaults to false)
    const supabase = supabaseRouteClient()
    const { data, error } = await supabase
      .from("email_highlights")
      .insert({ email_id: emailId, user_id: user.id, quote, memo, is_shared: false })
      .select("id,quote,memo,is_shared,created_at")
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, highlight: data }, { status: 200 })
  } catch (e) {
    console.error("POST /api/inbox-emails/[id]/highlights error:", e)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}
