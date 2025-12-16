import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")

  const redirectTo = requestUrl.searchParams.get("redirect") || "/inbox"
  const next = requestUrl.searchParams.get("next") || redirectTo

  // ✅ B) open redirect 방지: 내부 경로만 허용
  const safeNext = next.startsWith("/") ? next : "/inbox"

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component에서 호출된 경우 무시 가능
            }
          },
        },
      }
    )

    // ✅ A) exchangeCodeForSession 에러 처리
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        new URL(
          `/auth/login?error=${encodeURIComponent(error.message)}`,
          request.url
        )
      )
    }
  } else {
    // code가 없으면 로그인으로 돌려버리면 디버깅이 쉬움
    return NextResponse.redirect(new URL("/auth/login?error=missing_code", request.url))
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(new URL(safeNext, request.url))
}
