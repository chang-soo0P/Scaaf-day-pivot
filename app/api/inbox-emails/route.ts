import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export async function GET(req: NextRequest) {
  try {
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

    // ✅ 로그인 체크
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr) {
      return NextResponse.json({ ok: false, error: userErr.message }, { status: 401 })
    }
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    // ✅ query params
    const { searchParams } = new URL(req.url)
    const limit = clamp(Number(searchParams.get("limit") ?? 50), 1, 500)

    // ✅ 내 address_id 목록 (user_addresses: id, user_id, email_address, created_at)
    const { data: addrRows, error: addrErr } = await supabase
      .from("user_addresses")
      .select("id")
      .eq("user_id", user.id)

    if (addrErr) {
      console.error("user_addresses lookup error:", addrErr)
      // address lookup이 실패해도 user_id 기반으로라도 조회 시도
    }

    const addressIds = (addrRows ?? []).map((a) => a.id).filter(Boolean)

    // ✅ inbox_emails: id, user_id, message_id, from_address, subject, body_html, body_text, raw, received_at, address_id
    let query = supabase
      .from("inbox_emails")
      .select(
        "id,user_id,message_id,from_address,subject,body_text,body_html,raw,received_at,address_id"
      )
      .order("received_at", { ascending: false })
      .limit(limit)

    // 우선순위:
    // 1) user_id = 내 user.id
    // 2) address_id 가 내 user_addresses.id 중 하나
    if (addressIds.length > 0) {
      query = query.or(`user_id.eq.${user.id},address_id.in.(${addressIds.join(",")})`)
    } else {
      query = query.eq("user_id", user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error("inbox_emails query error:", error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, emails: data ?? [] }, { status: 200 })
  } catch (e: any) {
    console.error("GET /api/inbox-emails error:", e)
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 })
  }
}
