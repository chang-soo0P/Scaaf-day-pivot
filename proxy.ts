import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  /** -------------------------------------------------------
   * 0) API는 무조건 통과 (웹훅/세션루프 방지)
   * ------------------------------------------------------*/
  if (pathname.startsWith("/api")) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  /** -------------------------------------------------------
   * 1) Coming soon (Production 도메인에서만)
   * ------------------------------------------------------*/
  const comingSoonEnabled = (process.env.COMING_SOON_ENABLED || "").toLowerCase() === "true"

  // 운영 도메인 판별 (PROD_DOMAIN 없으면 scaaf.day fallback)
  const prodDomain = (process.env.PROD_DOMAIN || "scaaf.day").toLowerCase()

  // host 헤더에서 포트 제거
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0]

  const isProdHost = host === prodDomain || host === `www.${prodDomain}`

  // coming-soon 자체/정적 파일은 제외(404 방지)
  const passThroughPaths = ["/coming-soon", "/favicon.ico", "/robots.txt", "/sitemap.xml"]

  const isPassThrough = passThroughPaths.some((p) => pathname === p)

  if (comingSoonEnabled && isProdHost && !isPassThrough) {
    // URL은 그대로 두고, 내용만 coming-soon 페이지로 rewrite
    const url = request.nextUrl.clone()
    url.pathname = "/coming-soon"
    return NextResponse.rewrite(url)
  }

  /** -------------------------------------------------------
   * 2) 기존 auth proxy 로직
   * ------------------------------------------------------*/
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
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value)

          response = NextResponse.next({
            request: { headers: request.headers },
          })

          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedPaths = ["/inbox", "/topics", "/circles", "/settings"]
  const isProtectedPath = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuthPath = pathname.startsWith("/auth")

  if (isProtectedPath && !user && !isAuthPath) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/auth/login"
    redirectUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (isAuthPath && user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = "/inbox"
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
