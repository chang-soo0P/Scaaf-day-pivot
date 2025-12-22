import EmailDetailClient from "./email-detail-client"
import { notFound } from "next/navigation"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

/** EmailDetailClient가 기대하는 Comment/Highlight 형태로 매핑 */
function mapCommentRowToClient(row: any) {
  return {
    id: row.id,
    authorName: row.author_name ?? "Unknown",
    authorAvatarColor: row.author_avatar_color ?? "#64748b",
    text: row.text ?? "",
    createdAt: row.created_at,
    reactions: [], // reactions는 별도 API에서 계산/가져옴
  }
}

function mapHighlightRowToClient(row: any) {
  // DB 컬럼이 quote/is_shared/created_at 라고 가정 (다르면 여기만 고치면 됨)
  return {
    id: row.id,
    quote: row.quote ?? "",
    createdAt: row.created_at,
    isShared: Boolean(row.is_shared ?? row.isShared ?? false),
    memo: row.memo ?? undefined,
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: emailId } = await params
  if (!isUuid(emailId)) notFound()

  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) notFound()

  // 1) 이메일 (내 소유만)
  const { data: email, error: emailErr } = await supabase
    .from("inbox_emails")
    .select("id,user_id,address_id,message_id,from_address,subject,body_text,body_html,raw,received_at")
    .eq("id", emailId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (emailErr || !email) notFound()

  // 2) 댓글: email_comments (너 라우트에서 쓰던 테이블)
  const { data: commentRows, error: commentsErr } = await supabase
    .from("email_comments")
    .select("id, author_name, author_avatar_color, text, created_at")
    .eq("email_id", emailId)
    .order("created_at", { ascending: true })

  if (commentsErr) {
    console.error("[inbox/[id]] commentsErr:", commentsErr)
  }

  // 3) 하이라이트: email_highlights (컬럼명은 매핑으로 흡수)
  const { data: highlightRows, error: highlightsErr } = await supabase
    .from("email_highlights")
    .select("*")
    .eq("email_id", emailId)
    .order("created_at", { ascending: false })

  if (highlightsErr) {
    console.error("[inbox/[id]] highlightsErr:", highlightsErr)
  }

  const initialComments = (commentRows ?? []).map(mapCommentRowToClient)
  const initialHighlights = (highlightRows ?? []).map(mapHighlightRowToClient)

  return (
    <EmailDetailClient
      emailId={emailId}
      initialEmail={email}
      initialComments={initialComments}
      initialHighlights={initialHighlights}
    />
  )
}
