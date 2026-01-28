// app/circles/join/page.tsx
import { redirect } from "next/navigation"
import { headers } from "next/headers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getBaseUrl() {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (envUrl) return envUrl.replace(/\/+$/, "")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  return `${proto}://${host}`
}

export default async function JoinCirclePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams
  if (!code) redirect("/circles")

  const baseUrl = await getBaseUrl()

  // 서버에서 join API 호출 (쿠키는 브라우저 요청에 의해 자동 포함되어 들어오므로,
  // 여기서 별도 포워딩 없이도 동작하는 경우가 많지만, 안전하게는 클라이언트 join을 추천)
  // MVP: client 페이지를 만들기보단 server redirect로 심플 처리
  const res = await fetch(`${baseUrl}/api/circles/join`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.ok) redirect("/circles")

  redirect(`/circles/${data.circleId}`)
}
