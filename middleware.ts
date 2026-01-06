import { NextRequest, NextResponse } from "next/server"

const PROD_HOSTS = new Set(["scaaf.day", "www.scaaf.day"])

// ✅ 운영에서도 반드시 열어줘야 하는 경로들(웹훅/정적파일/coming-soon)
function isBypassPath(pathname: string) {
  // 1) Mailgun inbound webhook (필수)
  if (pathname === "/api/inbound-email" || pathname.startsWith("/api/inbound-email/")) return true

  // 2) coming soon 페이지 자체(무한루프 방지)
  if (pathname === "/coming-soon") return true

  // 3) Next.js 내부 정적 리소스
  if (pathname.startsWith("/_next/")) return true

  // 4) 공개 정적 파일들(필요 시 추가)
  if (
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/manifest.json"
  ) {
    return true
  }

  // 5) 이미지/아이콘 폴더를 public로 쓰고 있다면(선택)
  if (pathname.startsWith("/icons/") || pathname.startsWith("/images/")) return true

  return false
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl
  const hostname = url.hostname
  const pathname = url.pathname

  // ✅ 운영 도메인에서만 적용 (dev/preview는 그대로 통과)
  if (!PROD_HOSTS.has(hostname)) {
    return NextResponse.next()
  }

  // ✅ 예외 경로는 통과
  if (isBypassPath(pathname)) {
    return NextResponse.next()
  }

  // ✅ 운영 도메인에서는 모두 coming-soon으로 rewrite
  const dest = url.clone()
  dest.pathname = "/coming-soon"
  dest.search = "" // coming-soon에서는 쿼리 필요 없으면 제거(원하면 유지해도 됨)
  return NextResponse.rewrite(dest)
}

// ✅ 미들웨어가 불필요한 경로까지 타지 않게 matcher로 1차 컷
export const config = {
  matcher: [
    /*
      - _next 정적 제외
      - favicon/robots/sitemap 제외
      - 나머지는 전부 middleware를 탄 다음, 내부에서 prod host + bypass 체크
    */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
}
