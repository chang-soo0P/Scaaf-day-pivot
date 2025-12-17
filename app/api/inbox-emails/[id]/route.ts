import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { ok: false, error: "Missing Supabase env vars (URL / ANON KEY)" },
        { status: 500 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    // auth
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr) return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 })
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

    // 내 address ids
    const { data: addrRows } = await supabase
      .from("user_addresses")
      .select("id")
      .eq("user_id", user.id)

    const addressIds = (addrRows ?? []).map((a) => a.id).filter(Boolean)

    let q = supabase
      .from("inbox_emails")
      .select(
        "id,user_id,address_id,message_id,from_address,to_address,subject,body_text,body_html,raw,received_at"
      )
      .eq("id", id)
      .limit(1)
      .single()

    if (addressIds.length > 0) {
      q = q.or(`user_id.eq.${user.id},address_id.in.(${addressIds.join(",")})`)
    } else {
      q = q.eq("user_id", user.id)
    }

    const { data, error } = await q

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 })
    }

    return NextResponse.json({ ok: true, email: data }, { status: 200 })
  } catch (e) {
    console.error("GET /api/inbox-emails/[id] error:", e)
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
