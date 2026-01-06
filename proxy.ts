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

  /**
   * ✅ Coming-soon (PROD 도메인에서만)
   * - 운영 도메인: scaaf.day
   * - webhook 예외: /api/inbound-email/* (이미 /api는 상단에서 return이라 사실상 이중 안전장치)
   * - coming-soon 페이지 자체, auth 페이지, 정적 리소스는 예외
   */
  const host = (request.headers.get("host") || "").toLowerCase()
  const PROD_DOMAIN = (process.env.PROD_DOMAIN || "scaaf.day").toLowerCase()
  const COMING_SOON_ENABLED = (process.env.COMING_SOON_ENABLED || "false") === "true"

  const isProdHost =
    host === PROD_DOMAIN ||
    host === `www.${PROD_DOMAIN}`

  const isComingSoonPath = pathname === "/coming-soon" || pathname.startsWith("/coming-soon/")
  const isAuthPath = pathname.startsWith("/auth")

  // 혹시 모를 예외 경로(정적/파일류). matcher에서 대부분 걸러지지만 안전하게 한번 더.
  const isStaticLike =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$/i.test(pathname)

  if (
    COMING_SOON_ENABLED &&
    isProdHost &&
    !isComingSoonPath &&
    !isAuthPath &&
    !isStaticLike
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/coming-soon"
    url.searchParams.set("from", pathname) // 나중에 원복 시 참고용
    return NextResponse.rewrite(url)
  }

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
