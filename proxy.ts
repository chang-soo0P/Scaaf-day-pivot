import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ✅ API 요청은 proxy auth 체크/세션 refresh 스킵 (성능 + 루프 방지)
  if (pathname.startsWith("/api")) {
    return NextResponse.next({
      request: { headers: request.headers },
    })
  }

  // ✅ response는 항상 함수 스코프 최상단에서 정의 (절대 undefined 방지)
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // request 쿠키도 동기화
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }

          // response는 항상 재생성해서 최신 헤더를 유지
          response = NextResponse.next({
            request: { headers: request.headers },
          })

          // response 쿠키 세팅
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect routes that require authentication
  const protectedPaths = ["/inbox", "/topics", "/circles", "/settings"]
  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthPath = pathname.startsWith("/auth")

  // Redirect to login if accessing protected route without auth
  if (isProtectedPath && !user && !isAuthPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/auth/login"
    redirectUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect to home if accessing auth pages while logged in
  if (
    isAuthPath &&
    user &&
    (pathname === "/auth/login" || pathname === "/auth/signup")
  ) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/inbox"
    return NextResponse.redirect(redirectUrl)
  }

  // ✅ 마지막엔 항상 response 반환
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
