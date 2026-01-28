import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"
import CircleFeedClient from "./_components/CircleFeedClient"
import type { CircleFeedItem } from "@/types/circle-feed"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DbCircle = { id: string; name: string | null }
type DbShare = {
  id: string
  circle_id: string
  email_id: string
  shared_by: string | null
  created_at: string
}
type DbEmail = {
  id: string
  subject: string | null
  from_address: string | null
  received_at: string | null
}
type DbUser = {
  id: string
  username: string | null
  display_name: string | null
  email_address: string | null
}

export default async function CircleDetailPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params

  // 1) 로그인 확인
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  const admin = createSupabaseAdminClient()

  // 2) 멤버십 확인
  const { data: mem, error: memErr } = await admin
    .from("circle_members")
    .select("id")
    .eq("circle_id", circleId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (memErr) {
    console.error("[circles/[circleId]] membership error:", memErr)
    notFound()
  }
  if (!mem) notFound()

  // 3) circle 정보
  const { data: circle, error: circleErr } = await admin
    .from("circles")
    .select("id, name")
    .eq("id", circleId)
    .maybeSingle<DbCircle>()

  if (circleErr) {
    console.error("[circles/[circleId]] circle error:", circleErr)
    notFound()
  }
  if (!circle) notFound()

  // 4) 최신 공유글 20개
  const { data: sharesRaw, error: shareErr } = await admin
    .from("circle_emails")
    .select("id, circle_id, email_id, shared_by, created_at")
    .eq("circle_id", circleId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (shareErr) {
    console.error("[circles/[circleId]] share error:", shareErr)
    notFound()
  }

  const shares = (sharesRaw ?? []) as DbShare[]
  const nextCursor = shares.length === 20 ? shares[shares.length - 1]?.created_at ?? null : null

  // 5) 이메일 메타
  const emailIds = Array.from(new Set(shares.map((s) => s.email_id).filter(Boolean)))
  let emailById = new Map<string, DbEmail>()
  if (emailIds.length > 0) {
    const { data: emailsRaw, error: emailErr } = await admin
      .from("inbox_emails")
      .select("id, subject, from_address, received_at")
      .in("id", emailIds)

    if (emailErr) {
      console.error("[circles/[circleId]] email meta error:", emailErr)
      notFound()
    }

    const emails = (emailsRaw ?? []) as DbEmail[]
    emailById = new Map(emails.map((e) => [e.id, e]))
  }

  // 6) 공유자 프로필: public.users에서 name만 가져오기 (avatarUrl 없음)
  const userIds = Array.from(new Set(shares.map((s) => s.shared_by).filter(Boolean))) as string[]
  let userById = new Map<string, DbUser>()
  if (userIds.length > 0) {
    const { data: usersRaw, error: usersErr } = await admin
      .from("users")
      .select("id, username, display_name, email_address")
      .in("id", userIds)

    if (usersErr) {
      console.error("[circles/[circleId]] users error:", usersErr)
      // users 조회 실패해도 feed는 렌더 가능
    } else {
      const users = (usersRaw ?? []) as DbUser[]
      userById = new Map(users.map((u) => [u.id, u]))
    }
  }

  // 7) ✅ CircleFeedItem은 "공통 타입" 그대로 사용
  //    sharedByProfile은 optional이 아니라 "필수 key"로 넣고, 값은 null 가능하게!
  const initialFeed: CircleFeedItem[] = shares.map((s) => {
    const e = emailById.get(s.email_id)
    const u = s.shared_by ? userById.get(s.shared_by) : null

    const name =
      (u?.display_name && u.display_name.trim()) ||
      (u?.username && u.username.trim()) ||
      "Member"

    return {
      id: s.id,
      circleId: s.circle_id,
      emailId: s.email_id,
      sharedAt: s.created_at,
      sharedBy: s.shared_by ?? null,

      subject: e?.subject ?? null,
      fromAddress: e?.from_address ?? null,
      receivedAt: e?.received_at ?? null,

      highlightCount: 0,
      commentCount: 0,
      latestActivity: null,

      // ✅ 중요: 반드시 넣기 (undefined 금지)
      sharedByProfile: s.shared_by ? { id: s.shared_by, name, avatarUrl: null } : null,
    }
  })

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/circles"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
        >
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </Link>

        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">
            {circle.name ?? "Circle"}
          </h1>
          <p className="text-xs text-muted-foreground">Circle detail</p>
        </div>
      </div>

      <CircleFeedClient circleId={circleId} initialFeed={initialFeed} initialNextCursor={nextCursor} />
    </div>
  )
}
