"use client"

import type React from "react"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { MessageCircle, Megaphone, Grid3X3, LayoutList } from "lucide-react"
import { getAllEmails, adItems, type Comment, type Reaction } from "@/lib/email-mock-data"

// --- Types ---
type TopicFeedItem = {
  id: string
  emailId: string
  topic: string
  newsletterTitle: string
  senderName: string
  comments: Comment[]
  totalComments: number
  totalReactions: number
}

type AdItem = {
  id: string
  emailId: string
  newsletterSource: string
  brand: string
  headline: string
  ctaLabel: string
  thumbnail: string | null
}

function useFeedItems(): TopicFeedItem[] {
  const emails = getAllEmails()
  return emails.map((email) => {
    const totalReactions = email.comments.reduce(
      (sum, c) => sum + c.reactions.reduce((rSum, r) => rSum + r.count, 0),
      0,
    )
    return {
      id: `feed-${email.id}`,
      emailId: email.id,
      topic: email.topics[0] || "General",
      newsletterTitle: email.newsletterTitle,
      senderName: email.senderName,
      comments: email.comments.slice(0, 2), // Show first 2 comments
      totalComments: email.comments.length,
      totalReactions,
    }
  })
}

// --- Components ---

function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
      {topic}
    </span>
  )
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function ReactionPill({ emoji, count }: Reaction) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-xs">
      <span>{emoji}</span>
      <span className="text-muted-foreground">{count}</span>
    </span>
  )
}

function CommentBubble({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-2">
      <Avatar name={comment.authorName} color={comment.authorAvatarColor} />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm bg-secondary/60 px-3 py-2">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">{comment.authorName}</span>
            <span className="text-[10px] text-muted-foreground">{comment.createdAt}</span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{comment.text}</p>
        </div>
        {comment.reactions.length > 0 && (
          <div className="flex gap-1 mt-1 ml-1">
            {comment.reactions.map((r, i) => (
              <ReactionPill key={i} emoji={r.emoji} count={r.count} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FeedCardComponent({
  item,
  layout,
  onOpenEmail,
}: { item: TopicFeedItem; layout: string; onOpenEmail: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <TopicChip topic={item.topic} />
          <h3 className="mt-2 text-base font-semibold leading-snug text-foreground line-clamp-2">
            {item.newsletterTitle}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">from {item.senderName}</p>
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-3">
        {item.comments.map((comment) => (
          <CommentBubble key={comment.id} comment={comment} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {item.totalComments} comments
          </span>
          <span>{item.totalReactions} reactions</span>
        </div>
        <button onClick={onOpenEmail} className="text-xs font-medium text-primary hover:underline">
          Open email
        </button>
      </div>
    </div>
  )
}

function AdCardComponent({ item, onOpenEmail }: { item: AdItem; onOpenEmail: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border/80 transition-shadow hover:shadow-md">
      <div className="flex gap-3">
        {/* Thumbnail */}
        {item.thumbnail && (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
            <Image src={item.thumbnail || "/placeholder.svg"} alt={item.brand} fill className="object-cover" />
          </div>
        )}
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
              Sponsored
            </span>
            <span className="text-[10px] text-muted-foreground truncate">via {item.newsletterSource}</span>
          </div>
          <p className="text-xs font-semibold text-foreground">{item.brand}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.headline}</p>
        </div>
      </div>
      <button
        onClick={onOpenEmail}
        className="mt-2 w-full rounded-lg bg-secondary py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
      >
        Open newsletter
      </button>
    </div>
  )
}

// --- Main Page ---
type TabType = "feed" | "ads"
type LayoutMode = "list" | "grid"

const layoutIcons = {
  list: LayoutList,
  grid: Grid3X3,
}

function MasonryGrid({ children }: { children: React.ReactNode[] }) {
  const leftColumn: React.ReactNode[] = []
  const rightColumn: React.ReactNode[] = []

  children.forEach((child, index) => {
    if (index % 2 === 0) {
      leftColumn.push(child)
    } else {
      rightColumn.push(child)
    }
  })

  return (
    <div className="flex gap-3">
      <div className="flex-1 flex flex-col gap-3">{leftColumn}</div>
      <div className="flex-1 flex flex-col gap-3">{rightColumn}</div>
    </div>
  )
}

export default function TopicsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>("feed")
  const [layout, setLayout] = useState<LayoutMode>("list")

  const feedItems = useFeedItems()

  const handleOpenEmail = (emailId: string) => {
    router.push(`/inbox/${emailId}`)
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* Tab Switcher */}
      <div className="sticky top-0 z-10 bg-background pt-4 pb-2">
        <div className="mx-4 flex rounded-xl bg-secondary/50 p-1">
          <button
            onClick={() => setActiveTab("feed")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "feed"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Feed
          </button>
          <button
            onClick={() => setActiveTab("ads")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
              activeTab === "ads" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Megaphone className="h-4 w-4" />
            Ad Board
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-24">
        {activeTab === "feed" ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">What your friends are saying</p>
              <div className="flex items-center justify-end gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
                {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
                  const Icon = layoutIcons[mode]
                  return (
                    <button
                      key={mode}
                      onClick={() => setLayout(mode)}
                      className={cn(
                        "rounded-md p-2 transition-all",
                        layout === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                      )}
                      aria-label={`Switch to ${mode} layout`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            {layout === "list" && (
              <div className="space-y-4">
                {feedItems.map((item) => (
                  <FeedCardComponent
                    key={item.id}
                    item={item}
                    layout={layout}
                    onOpenEmail={() => handleOpenEmail(item.emailId)}
                  />
                ))}
              </div>
            )}

            {layout === "grid" && (
              <MasonryGrid>
                {feedItems.map((item) => (
                  <FeedCardComponent
                    key={item.id}
                    item={item}
                    layout={layout}
                    onOpenEmail={() => handleOpenEmail(item.emailId)}
                  />
                ))}
              </MasonryGrid>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">Sponsored sections from your newsletters</p>
              <div className="flex items-center justify-end gap-1 rounded-lg bg-secondary/50 p-1 w-fit">
                {(Object.keys(layoutIcons) as LayoutMode[]).map((mode) => {
                  const Icon = layoutIcons[mode]
                  return (
                    <button
                      key={mode}
                      onClick={() => setLayout(mode)}
                      className={cn(
                        "rounded-md p-2 transition-all",
                        layout === mode
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                      )}
                      aria-label={`Switch to ${mode} layout`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>

            {layout === "list" && (
              <div className="space-y-3">
                {adItems.map((item) => (
                  <AdCardComponent key={item.id} item={item} onOpenEmail={() => handleOpenEmail(item.emailId)} />
                ))}
              </div>
            )}

            {layout === "grid" && (
              <MasonryGrid>
                {adItems.map((item) => (
                  <AdCardComponent key={item.id} item={item} onOpenEmail={() => handleOpenEmail(item.emailId)} />
                ))}
              </MasonryGrid>
            )}
          </>
        )}
      </div>
    </div>
  )
}
