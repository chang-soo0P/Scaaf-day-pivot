"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, LayoutList, LayoutGrid, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

// --- Types ---
type Reaction = {
  emoji: string
  count: number
}

type EmailItem = {
  id: string
  senderName: string
  newsletterTitle: string
  snippet: string
  receivedAt: string
  topics: string[]
  issueImageEmoji?: string
  topReaction?: Reaction
}

type TopicInfo = {
  id: string
  name: string
  slug: string
}

// --- Mock Data ---
const allTopics: TopicInfo[] = [
  { id: "topic-1", name: "AI", slug: "topic-1" },
  { id: "topic-2", name: "Investing", slug: "topic-2" },
  { id: "topic-3", name: "Korea Stocks", slug: "topic-3" },
  { id: "topic-4", name: "Startups", slug: "topic-4" },
  { id: "topic-5", name: "Business", slug: "topic-5" },
]

const topicEmailsMap: Record<string, EmailItem[]> = {
  "topic-1": [
    {
      id: "nl-1",
      senderName: "Stratechery",
      newsletterTitle: "AI in 2025: What's next for reasoning models",
      snippet: "The reasoning benchmarks are impressive but I wonder about real-world applications...",
      receivedAt: "Today",
      topics: ["AI"],
      issueImageEmoji: "🧠",
      topReaction: { emoji: "🔥", count: 12 },
    },
    {
      id: "nl-6",
      senderName: "The Information",
      newsletterTitle: "OpenAI's next model could reshape the industry",
      snippet: "GPT-5 rumors are heating up with new capabilities that could change everything...",
      receivedAt: "Today",
      topics: ["AI"],
      issueImageEmoji: "🤖",
      topReaction: { emoji: "🤯", count: 8 },
    },
    {
      id: "nl-9",
      senderName: "AI Weekly",
      newsletterTitle: "The rise of AI agents in enterprise",
      snippet: "Companies are rapidly adopting AI agents for customer service and operations...",
      receivedAt: "Yesterday",
      topics: ["AI"],
      issueImageEmoji: "⚡",
      topReaction: { emoji: "👀", count: 5 },
    },
  ],
  "topic-2": [
    {
      id: "nl-2",
      senderName: "Morning Brew",
      newsletterTitle: "Fed signals rate cuts in early 2025",
      snippet: "Finally some good news for growth stocks. Time to re-evaluate portfolios...",
      receivedAt: "Today",
      topics: ["Investing"],
      issueImageEmoji: "📈",
      topReaction: { emoji: "💰", count: 15 },
    },
    {
      id: "nl-7",
      senderName: "Bloomberg Markets",
      newsletterTitle: "Bond yields signal economic shift",
      snippet: "The yield curve is telling us something important about the economy...",
      receivedAt: "Today",
      topics: ["Investing"],
      issueImageEmoji: "📊",
      topReaction: { emoji: "🧐", count: 6 },
    },
  ],
  "topic-3": [
    {
      id: "nl-3",
      senderName: "Korea Economic Daily",
      newsletterTitle: "Samsung's chip demand surges amid AI boom",
      snippet: "Memory prices recovering is huge for the whole sector...",
      receivedAt: "Today",
      topics: ["Korea Stocks"],
      issueImageEmoji: "🇰🇷",
      topReaction: { emoji: "🚀", count: 9 },
    },
    {
      id: "nl-8",
      senderName: "매경이코노미",
      newsletterTitle: "코스피 3000 돌파 가능성 분석",
      snippet: "외국인 매수세가 지속되면서 시장 낙관론 확산...",
      receivedAt: "Yesterday",
      topics: ["Korea Stocks"],
      issueImageEmoji: "💹",
      topReaction: { emoji: "🎉", count: 7 },
    },
  ],
  "topic-4": [
    {
      id: "nl-4",
      senderName: "TechCrunch",
      newsletterTitle: "YC Winter 2025 batch revealed with record AI focus",
      snippet: "60% AI startups is wild. The market is getting saturated...",
      receivedAt: "Today",
      topics: ["Startups"],
      issueImageEmoji: "🦄",
      topReaction: { emoji: "😱", count: 18 },
    },
  ],
  "topic-5": [
    {
      id: "nl-5",
      senderName: "The Hustle",
      newsletterTitle: "Why remote work is here to stay",
      snippet: "Companies are finally accepting the new normal of hybrid work...",
      receivedAt: "Today",
      topics: ["Business"],
      issueImageEmoji: "💼",
      topReaction: { emoji: "👍", count: 4 },
    },
  ],
}

// Emoji background gradients
const emojiGradients = [
  "from-violet-400 to-purple-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-indigo-400 to-blue-600",
]

function getGradientForIndex(index: number) {
  return emojiGradients[index % emojiGradients.length]
}

// --- Components ---
function IssueCard({
  email,
  index,
  onClick,
}: {
  email: EmailItem
  index: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-border active:scale-[0.99]"
    >
      {/* Left: Text content */}
      <div className="flex flex-1 min-w-0 flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">{email.senderName}</span>
        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">{email.newsletterTitle}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{email.snippet}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground">{email.receivedAt}</span>
          {email.topReaction && (
            <span className="flex items-center gap-1 text-xs">
              <span>{email.topReaction.emoji}</span>
              <span className="text-muted-foreground">{email.topReaction.count}</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Emoji thumbnail */}
      <div
        className={cn(
          "flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br",
          getGradientForIndex(index),
        )}
      >
        <span className="text-2xl">{email.issueImageEmoji || "📰"}</span>
      </div>
    </button>
  )
}

// --- Main Page ---
export default function TopicNewslettersPage() {
  const params = useParams()
  const router = useRouter()
  const topicId = params.topicId as string

  const [activeView, setActiveView] = useState<"list" | "grid" | "stack">("list")

  const currentTopic = allTopics.find((t) => t.id === topicId) || {
    id: topicId,
    name: "Unknown",
    slug: topicId,
  }

  const emails = topicEmailsMap[topicId] || []
  const todayCount = emails.filter((e) => e.receivedAt === "Today").length

  const handleOpenEmail = (emailId: string) => {
    router.push("/inbox/" + emailId)
  }

  const handleTopicChange = (newTopicId: string) => {
    router.push("/inbox/topics/" + newTopicId)
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        {/* Back button row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <Link
            href="/inbox"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/80 transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
        </div>

        {/* Topic pills - horizontal scroll */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {allTopics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => handleTopicChange(topic.id)}
                className={cn(
                  "flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  topic.id === topicId
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                )}
              >
                {topic.name}
              </button>
            ))}
          </div>
        </div>

        {/* Topic heading + view toggle */}
        <div className="flex items-end justify-between px-4 pb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground"># {currentTopic.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {todayCount} issue{todayCount !== 1 ? "s" : ""} today
            </p>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
            {[
              { mode: "list" as const, icon: LayoutList },
              { mode: "grid" as const, icon: LayoutGrid },
              { mode: "stack" as const, icon: Layers },
            ].map(({ mode, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => setActiveView(mode)}
                className={cn(
                  "rounded-md p-2 transition-all",
                  activeView === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
                aria-label={`Switch to ${mode} layout`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        {emails.length > 0 ? (
          <div className="space-y-3">
            {emails.map((email, index) => (
              <IssueCard key={email.id} email={email} index={index} onClick={() => handleOpenEmail(email.id)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">No newsletters in this topic yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
