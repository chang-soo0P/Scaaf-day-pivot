"use client"

import { ChevronLeft, MessageSquare, Highlighter } from "lucide-react"
import Link from "next/link"
import { emailDetailHref } from "@/lib/email-href"
import { useParams } from "next/navigation"
import { getEmailById, getEmailStats } from "@/lib/email-mock-data"
import CircleFeedClient from "./circle-feed-client" // ✅ 추가

type Member = {
  id: string
  name: string
  color: string
}

type SharedNewsletterRef = {
  emailId: string
  sharedAt: string
  latestActivity: string
}

type CircleData = {
  id: string
  name: string
  description: string
  members: Member[]
  sharedNewsletterRefs: SharedNewsletterRef[]
}

const circlesData: Record<string, CircleData> = {
  "ai-builders": {
    id: "ai-builders",
    name: "AI Builders",
    description: "Discussing AI trends and building the future",
    members: [
      { id: "1", name: "Marvin", color: "#6366f1" },
      { id: "2", name: "Jane", color: "#ec4899" },
      { id: "3", name: "David", color: "#10b981" },
    ],
    sharedNewsletterRefs: [
      { emailId: "nl-1", sharedAt: "2h ago", latestActivity: "Marvin: This section on multimodal is key" },
      { emailId: "nl-6", sharedAt: "5h ago", latestActivity: "Jane highlighted 2 paragraphs" },
      { emailId: "nl-9", sharedAt: "1d ago", latestActivity: "David: Great framework for PM's" },
    ],
  },
  "macro-watchers": {
    id: "macro-watchers",
    name: "Macro Watchers",
    description: "Tracking global markets and economic trends",
    members: [
      { id: "1", name: "Alex", color: "#3b82f6" },
      { id: "2", name: "Sophie", color: "#f59e0b" },
    ],
    sharedNewsletterRefs: [
      { emailId: "nl-3", sharedAt: "3h ago", latestActivity: "Sophie highlighted a key insight" },
      { emailId: "nl-2", sharedAt: "1d ago", latestActivity: "Alex: Watch the Dec meeting" },
      { emailId: "nl-7", sharedAt: "2d ago", latestActivity: "Sophie: Yield curve telling us something" },
    ],
  },
  "tech-founders": {
    id: "tech-founders",
    name: "Tech Founders",
    description: "Sharing insights on building startups",
    members: [
      { id: "1", name: "Alex", color: "#6366f1" },
      { id: "2", name: "Sam", color: "#ec4899" },
      { id: "3", name: "Jordan", color: "#10b981" },
      { id: "4", name: "Taylor", color: "#f59e0b" },
      { id: "5", name: "Morgan", color: "#3b82f6" },
    ],
    sharedNewsletterRefs: [
      { emailId: "nl-4", sharedAt: "2h ago", latestActivity: "Alex shared a highlight" },
      { emailId: "nl-5", sharedAt: "6h ago", latestActivity: "Sam: This changed how I think about PMF" },
    ],
  },
  "design-team": {
    id: "design-team",
    name: "Design Team",
    description: "Exploring design systems and UX patterns",
    members: [
      { id: "1", name: "Casey", color: "#8b5cf6" },
      { id: "2", name: "Riley", color: "#14b8a6" },
      { id: "3", name: "Jamie", color: "#f43f5e" },
      { id: "4", name: "Drew", color: "#0ea5e9" },
    ],
    sharedNewsletterRefs: [{ emailId: "nl-5", sharedAt: "4h ago", latestActivity: "Casey: Great article on design systems!" }],
  },
}

function getSharedNewsletters(
  refs: SharedNewsletterRef[]
): Array<{
  id: string
  emailId: string
  title: string
  sender: string
  senderIcon: string
  topics: string[]
  highlightCount: number
  commentCount: number
  latestActivity: string
  sharedAt: string
}> {
  return refs
    .map((ref, index) => {
      const email = getEmailById(ref.emailId)
      if (!email) return null
      const stats = getEmailStats(ref.emailId)

      return {
        id: `shared-${index}`,
        emailId: ref.emailId,
        title: email.newsletterTitle,
        sender: email.senderName,
        senderIcon: email.senderName.substring(0, 2).toUpperCase(),
        topics: email.topics,
        highlightCount: stats.highlightCount,
        commentCount: stats.commentCount,
        latestActivity: ref.latestActivity,
        sharedAt: ref.sharedAt,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
}

function SharedNewsletterCard({
  newsletter,
}: {
  newsletter: {
    id: string
    emailId: string
    title: string
    sender: string
    senderIcon: string
    topics: string[]
    highlightCount: number
    commentCount: number
    latestActivity: string
    sharedAt: string
  }
}) {
  const href = emailDetailHref(newsletter.emailId)
  return (
    <Link href={href ?? "#"}>
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-[10px] font-semibold text-muted-foreground">
            {newsletter.senderIcon}
          </div>
          <span className="text-xs text-muted-foreground">{newsletter.sender}</span>
          <span className="text-xs text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground">{newsletter.sharedAt}</span>
        </div>

        <h3 className="font-medium text-card-foreground line-clamp-2 mb-2">{newsletter.title}</h3>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {newsletter.topics.map((topic) => (
            <span
              key={topic}
              className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Highlighter className="h-3.5 w-3.5" />
            {newsletter.highlightCount}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {newsletter.commentCount}
          </span>
        </div>

        <p className="text-sm text-muted-foreground truncate">{newsletter.latestActivity}</p>
      </div>
    </Link>
  )
}

export default function CircleDetailPage() {
  const params = useParams()

  // ✅ 폴더명이 [circlesID]면 params.circlesID 가 들어올 가능성이 큼
  // ✅ 혹시 기존에 circleId로 쓰고 있다면 둘 다 대응
  const circleId = (params?.circlesID ?? params?.circleId ?? "ai-builders") as string

  const circle = circlesData[circleId] || circlesData["ai-builders"]
  const sharedNewsletters = getSharedNewsletters(circle.sharedNewsletterRefs)

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/circles"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold text-foreground">{circle.name}</h1>
            <p className="text-xs text-muted-foreground">{circle.description}</p>
          </div>

          <div className="flex -space-x-1.5">
            {circle.members.slice(0, 3).map((member, index) => (
              <div
                key={member.id}
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white ring-2 ring-card"
                style={{ backgroundColor: member.color, zIndex: circle.members.length - index }}
              >
                {member.name.charAt(0)}
              </div>
            ))}
            {circle.members.length > 3 && (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
                +{circle.members.length - 3}
              </div>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground pl-[52px]">
          {circle.members.length} members · {sharedNewsletters.length} shared newsletters
        </p>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* ✅ (NEW) 실제 Circle Feed 섹션 */}
        <div className="mb-6">
          <CircleFeedClient circleId={circleId} />
        </div>

        {/* 기존 mock shared newsletters 리스트 (유지) */}
        <div className="flex flex-col gap-4">
          {sharedNewsletters.map((newsletter) => (
            <SharedNewsletterCard key={newsletter.id} newsletter={newsletter} />
          ))}
        </div>

        <div className="h-24" />
      </div>
    </div>
  )
}
