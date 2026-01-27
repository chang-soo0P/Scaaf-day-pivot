import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShineBorder } from "@/components/ui/shine-border"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { createSupabaseAdminClient } from "@/app/api/_supabase/admin-client"
import { notFound } from "next/navigation"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DbEmail = {
  id: string
  from_address: string | null
  subject: string | null
  received_at: string | null
  body_text: string | null
  body_html: string | null
}

type CircleFeedItem = {
  id: string // share id
  circle_id: string
  email_id: string
  shared_by: string | null
  created_at: string
}

function extractNameFromEmail(addr: string) {
  const emailMatch = addr.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const email = emailMatch?.[0] ?? addr
  const name = email.split("@")[0]
  return name || email
}

function formatTime(iso: string | null) {
  if (!iso) return ""
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function oneLinerFromEmail(e: DbEmail) {
  const subject = (e.subject ?? "").trim()
  const body =
    (e.body_text && e.body_text.trim()) ||
    (e.body_html && stripHtml(e.body_html)) ||
    ""
  const t = body.replace(/\s+/g, " ").trim()
  const base = t || subject || "No content"
  return base.length > 90 ? base.slice(0, 90) + "…" : base
}

function getTopicConfig(topicSlug: string) {
  const map: Record<string, { name: string; period: string; keywords: string[]; thumbnail?: string }> =
    {
      ai: {
        name: "AI",
        period: "Recent",
        keywords: [
          "ai",
          "openai",
          "gpt",
          "llm",
          "agent",
          "deepmind",
          "gemini",
          "anthropic",
          "claude",
          "nvidia",
          "inference",
          "fine-tuning",
        ],
        thumbnail: "/ai-neural-network-abstract.jpg",
      },
      investing: {
        name: "Investing",
        period: "Recent",
        keywords: ["market", "stocks", "etf", "fed", "rate", "inflation", "earnings", "yield", "crypto"],
        thumbnail: "/stock-market-chart.png",
      },
      "korea-stocks": {
        name: "Korea Stocks",
        period: "Recent",
        keywords: ["kospi", "kosdaq", "samsung", "sk hynix", "won", "seoul", "korea", "krx"],
        thumbnail: "/korean-won-currency.jpg",
      },
      startups: {
        name: "Startups",
        period: "Recent",
        keywords: ["startup", "yc", "y combinator", "seed", "series a", "funding", "vc", "pitch"],
        thumbnail: "/startup-funding-money.jpg",
      },
      design: {
        name: "Design",
        period: "Recent",
        keywords: ["design", "figma", "ux", "ui", "dribbble", "accessibility", "wcag", "lottie"],
        thumbnail: "/figma-design-tool.jpg",
      },
    }

  return map[topicSlug] ?? null
}

function matchesTopic(email: DbEmail, keywords: string[]) {
  const hay = `${email.subject ?? ""} ${email.body_text ?? ""} ${email.body_html ?? ""}`.toLowerCase()
  return keywords.some((k) => hay.includes(k.toLowerCase()))
}

function NewsletterCard({
  newsletter,
}: {
  newsletter: {
    id: string // email id
    name: string
    subject: string
    receivedTime: string
    oneLiner: string
    topic: string
    thumbnail: string
  }
}) {
  // ✅ email detail로 이동
  const href = `/inbox/${newsletter.id}`

  return (
    <Link href={href} prefetch={false} className="block">
      <div className="flex gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md cursor-pointer">
        <div className="flex flex-1 min-w-0 flex-col justify-between">
          <span className="text-xs text-muted-foreground truncate mb-1">{newsletter.name}</span>

          <h3 className="text-base font-semibold leading-snug line-clamp-2 text-card-foreground">
            {newsletter.subject}
          </h3>

          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{newsletter.oneLiner}</p>

          <div className="flex items-center gap-2 mt-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {newsletter.topic}
            </span>
            <span className="text-xs text-muted-foreground">{newsletter.receivedTime}</span>
          </div>
        </div>

        <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">
          <Image src={newsletter.thumbnail || "/placeholder.svg"} alt="" fill className="object-cover" />
        </div>
      </div>
    </Link>
  )
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ topicSlug: string }>
}) {
  const { topicSlug } = await params
  const cfg = getTopicConfig(topicSlug)
  if (!cfg) notFound()

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  /**
   * A) Circles Feed (공유된 이메일)
   * - Server Component에서 API 호출 대신 DB 직접 조회(쿠키/credentials 이슈 방지)
   * - admin client로 memberships/shares/email 메타를 한번에 모음
   */
  const admin = createSupabaseAdminClient()

  const { data: memberships, error: memErr } = await admin
    .from("circle_members")
    .select("circle_id")
    .eq("user_id", user.id)

  if (memErr) {
    console.error("[topics/[topicSlug]] circle_members error:", memErr)
  }

  const circleIds = (memberships ?? []).map((m: any) => m.circle_id).filter(Boolean)

  let circleNewsletters: Array<{
    id: string
    name: string
    subject: string
    receivedTime: string
    oneLiner: string
    topic: string
    thumbnail: string
  }> = []

  if (circleIds.length) {
    const { data: shares, error: shareErr } = await admin
      .from("circle_emails")
      .select("id, circle_id, email_id, shared_by, created_at")
      .in("circle_id", circleIds)
      .order("created_at", { ascending: false })
      .limit(50)

    if (shareErr) {
      console.error("[topics/[topicSlug]] circle_emails error:", shareErr)
    } else {
      const emailIds = Array.from(new Set((shares ?? []).map((s: any) => s.email_id).filter(Boolean)))

      if (emailIds.length) {
        const { data: emails, error: emailErr } = await admin
          .from("inbox_emails")
          .select("id,from_address,subject,received_at,body_text,body_html")
          .in("id", emailIds)

        if (emailErr) {
          console.error("[topics/[topicSlug]] inbox_emails(in circle feed) error:", emailErr)
        } else {
          const byId = new Map((emails ?? []).map((e: any) => [e.id, e as DbEmail]))

          const merged = (shares ?? [])
            .map((s: CircleFeedItem) => byId.get(s.email_id))
            .filter(Boolean) as DbEmail[]

          const filteredCircle = merged.filter((e) => matchesTopic(e, cfg.keywords)).slice(0, 20)

          circleNewsletters = filteredCircle.map((e) => {
            const from = e.from_address ?? "Unknown"
            return {
              id: e.id, // ✅ email id
              name: extractNameFromEmail(from),
              subject: (e.subject ?? "(no subject)").toString(),
              receivedTime: formatTime(e.received_at) || "—",
              oneLiner: oneLinerFromEmail(e),
              topic: cfg.name,
              thumbnail: cfg.thumbnail ?? "/placeholder.svg",
            }
          })
        }
      }
    }
  }

  /**
   * B) From your inbox (기존 로직 유지)
   */
  const { data: emails, error } = await supabase
    .from("inbox_emails")
    .select("id,from_address,subject,received_at,body_text,body_html")
    .eq("user_id", user.id)
    .order("received_at", { ascending: false })
    .limit(200)

  if (error) {
    console.error("[topics/[topicSlug]] inbox_emails error:", error)
    notFound()
  }

  const filteredInbox = (emails ?? []).filter((e: any) => matchesTopic(e as DbEmail, cfg.keywords)) as DbEmail[]

  const inboxNewsletters = filteredInbox.slice(0, 30).map((e) => {
    const from = e.from_address ?? "Unknown"
    return {
      id: e.id,
      name: extractNameFromEmail(from),
      subject: (e.subject ?? "(no subject)").toString(),
      receivedTime: formatTime(e.received_at) || "—",
      oneLiner: oneLinerFromEmail(e),
      topic: cfg.name,
      thumbnail: cfg.thumbnail ?? "/placeholder.svg",
    }
  })

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/topics"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
        >
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{cfg.name}</h1>
          <p className="text-sm text-muted-foreground">{cfg.period}</p>
        </div>
      </div>

      <ShineBorder
        className="mb-6 shadow-sm ring-1 ring-border"
        borderRadius={16}
        color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
        duration={10}
      >
        <div className="p-5">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Summary
          </h2>
          <p className="leading-relaxed text-card-foreground/80">
            Showing recent emails matched by topic keywords (MVP). Connect topic taxonomy later.
          </p>
        </div>
      </ShineBorder>

      {/* ✅ NEW: From circles */}
      <div className="mb-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          From circles ({circleNewsletters.length})
        </h2>

        {circleNewsletters.length ? (
          <div className="flex flex-col gap-3">
            {circleNewsletters.map((nl) => (
              <NewsletterCard key={nl.id} newsletter={nl} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border text-sm text-muted-foreground">
            No shared posts matched this topic yet.
          </div>
        )}
      </div>

      {/* 기존: From your inbox */}
      <div className="mb-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          From your inbox ({inboxNewsletters.length})
        </h2>

        {inboxNewsletters.length ? (
          <div className="flex flex-col gap-3">
            {inboxNewsletters.map((nl) => (
              <NewsletterCard key={nl.id} newsletter={nl} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border text-sm text-muted-foreground">
            No matching emails yet.
          </div>
        )}
      </div>

      <Button className="w-full gap-2 rounded-xl bg-primary py-6 text-base font-medium hover:bg-primary/90">
        <Share2 className="h-5 w-5" />
        Share to circle
      </Button>
    </div>
  )
}
