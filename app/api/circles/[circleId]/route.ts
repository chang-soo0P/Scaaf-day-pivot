// app/api/circles/[circleId]/route.ts
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// env 체크는 모듈 로딩 시점에 해두는 게 디버깅이 쉬움
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Route handler에서는 throw해도 dev에서 바로 원인 파악 가능
  // (prod에선 500으로 떨어짐)
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }, // 서버 라우트에서는 세션 저장 불필요
})

export async function GET(
  _req: Request,
  { params }: { params: { circleId: string } }
) {
  const circleId = params.circleId

  if (!circleId || !isUuid(circleId)) {
    return NextResponse.json(
      { ok: false, error: "Invalid circleId" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("circles")
    .select("*")
    .eq("id", circleId)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    )
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "Circle not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({ ok: true, circle: data }, { status: 200 })
}
