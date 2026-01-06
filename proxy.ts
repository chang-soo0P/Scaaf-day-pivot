import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  /**
   * ✅ Production 도메인에서만 Coming-soon 리라이트
   * - ON/OFF는 환경변수(COMING_SOON_ENABLED)로 제어
   * - 웹훅(/api/inbound-email/*)은 항상 통과
   * - /coming-soon 자체도 통과
   */
  const host = (request.headers.get("host") || "").toLowerCase()
  const hostname = host.split(":")[0]

  const PROD_DOMAIN = (process.env.PROD_DOMAIN || "scaaf.day").toLowerCase()
  const COMING_SOON_ENABLED =
    process.env.COMING_SOON_ENABLED === "1" || process.env.COMING_SOON_ENABLED === "true"

  const isProdHost = hostname === PROD_DOMAIN || hostname.endsWith(`.${PROD_DOMAIN}`)
  const isWebhookPath = pathname.startsWith("/api/inbound-email") // ✅ Mailgun inbound allow
  const isComingSoonPath = pathname === "/coming-soon"

  // ✅ 정적/내부 리소스는 항상 통과
  const isNextInternal =
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"

  if (COMING_SOON_ENABLED && isProdHost && !isNextInternal) {
    // 1) 웹훅은 통과
    if (isWebhookPath) {
      return NextResponse.next({ request: { headers: request.headers } })
    }

    // 2) coming-soon 페이지 자체는 통과
    if (isComingSoonPath) {
      return NextResponse.next({ request: { headers: request.headers } })
    }

    // 3) 그 외 모든 "페이지" 요청은 coming-soon으로 리라이트
    //    (API는 기존처럼 그냥 통과시키고 싶으면 아래 조건 유지)
    if (!pathname.startsWith("/api")) {
      const url = request.nextUrl.clone()
      url.pathname = "/coming-soon"
      url.search = ""
      return NextResponse.rewrite(url)
    }
  }

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
  if (isAuthPath && user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/inbox"
    return NextResponse.redirect(redirectUrl)
  }

  // ✅ 마지막엔 항상 response 반환
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
