"use client"

import { useState } from "react"
import { X, Link2, Check } from "lucide-react"
import { CircleCard } from "@/components/circle-card"

const friends = [
  { id: "1", name: "Marvin", handle: "@marvin", color: "#6366f1" },
  { id: "2", name: "Jane", handle: "@jane", color: "#ec4899" },
  { id: "3", name: "David", handle: "@david", color: "#10b981" },
  { id: "4", name: "Sophie", handle: "@sophie", color: "#f59e0b" },
  { id: "5", name: "Alex", handle: "@alex", color: "#3b82f6" },
  { id: "6", name: "Emma", handle: "@emma", color: "#8b5cf6" },
  { id: "7", name: "Chris", handle: "@chris", color: "#14b8a6" },
  { id: "8", name: "Yuna", handle: "@yuna", color: "#f43f5e" },
]

type Member = {
  id: string
  name: string
  color: string
}

type Circle = {
  id: string
  name: string
  members: Member[]
  sharedNewsletterCount: number
  latestActivity: string
  hasUnread?: boolean
}

const circles: Circle[] = [
  {
    id: "ai-builders",
    name: "AI Builders",
    members: [
      { id: "1", name: "Marvin", color: "#6366f1" },
      { id: "2", name: "Jane", color: "#ec4899" },
      { id: "3", name: "David", color: "#10b981" },
    ],
    sharedNewsletterCount: 8,
    latestActivity: "Marvin commented on AI in 2025: What's next",
    hasUnread: true,
  },
  {
    id: "macro-watchers",
    name: "Macro Watchers",
    members: [
      { id: "1", name: "Alex", color: "#3b82f6" },
      { id: "2", name: "Sophie", color: "#f59e0b" },
    ],
    sharedNewsletterCount: 5,
    latestActivity: "Sophie highlighted a paragraph from The Korean stock wave",
    hasUnread: false,
  },
  {
    id: "tech-founders",
    name: "Tech Founders",
    members: [
      { id: "1", name: "Alex", color: "#6366f1" },
      { id: "2", name: "Sam", color: "#ec4899" },
      { id: "3", name: "Jordan", color: "#10b981" },
      { id: "4", name: "Taylor", color: "#f59e0b" },
      { id: "5", name: "Morgan", color: "#3b82f6" },
    ],
    sharedNewsletterCount: 12,
    latestActivity: "Alex shared a highlight from Stratechery",
    hasUnread: true,
  },
  {
    id: "design-team",
    name: "Design Team",
    members: [
      { id: "1", name: "Casey", color: "#8b5cf6" },
      { id: "2", name: "Riley", color: "#14b8a6" },
      { id: "3", name: "Jamie", color: "#f43f5e" },
      { id: "4", name: "Drew", color: "#0ea5e9" },
    ],
    sharedNewsletterCount: 6,
    latestActivity: "Great article on design systems!",
    hasUnread: false,
  },
]

export default function CirclesPage() {
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://scaaf.day/join?ref=marvin123")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCreateCircle = () => {
    console.log("Create circle clicked")
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Circles</h2>
        <p className="mt-1 text-sm text-muted-foreground">Browse what your groups are reading</p>
      </div>

      <div className="mb-6 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">My Friends</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Manage friends to invite to circles.</p>
          </div>
          {/* Stacked avatars (max 3) */}
          <div className="flex -space-x-2">
            {friends.slice(0, 3).map((friend, index) => (
              <div
                key={friend.id}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-medium text-white"
                style={{ backgroundColor: friend.color, zIndex: 3 - index }}
              >
                {friend.name[0]}
              </div>
            ))}
            {friends.length > 3 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-medium text-muted-foreground">
                +{friends.length - 3}
              </div>
            )}
          </div>
        </div>
        {/* Two action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsFriendsModalOpen(true)}
            className="flex-1 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            View friend list
          </button>
          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex-1 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Invite friends
          </button>
        </div>
      </div>

      {/* 
      <button
        type="button"
        onClick={handleCreateCircle}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-5 w-5" />
        Create circle
      </button>
      */}

      <div className="flex flex-col gap-3">
        {circles.map((circle) => (
          <CircleCard
            key={circle.id}
            id={circle.id}
            name={circle.name}
            members={circle.members}
            sharedNewsletterCount={circle.sharedNewsletterCount}
            latestActivity={circle.latestActivity}
            hasUnread={circle.hasUnread}
          />
        ))}
      </div>

      {isFriendsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setIsFriendsModalOpen(false)}
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-background pb-8" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <h3 className="text-lg font-semibold text-foreground">Friend list</h3>
              <button
                type="button"
                onClick={() => setIsFriendsModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            {/* Friend list */}
            <div className="max-h-[60vh] overflow-y-auto px-4">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: friend.color }}
                  >
                    {friend.name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{friend.name}</p>
                    <p className="text-sm text-muted-foreground">{friend.handle}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Close button */}
            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={() => setIsFriendsModalOpen(false)}
                className="w-full rounded-full border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setIsInviteModalOpen(false)}
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-background pb-8" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <h3 className="text-lg font-semibold text-foreground">Invite friends</h3>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-secondary"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            {/* Invite content */}
            <div className="px-4 pt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Copy the invite link below and share via iMessage, WhatsApp, etc.
              </p>
              {/* Deep link display */}
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary p-3">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm text-foreground">scaaf.day/join?ref=marvin123</span>
              </div>
              {/* Copy button */}
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-medium transition-colors ${
                  copied ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied!
                  </>
                ) : (
                  "Copy link"
                )}
              </button>
            </div>
            {/* Close button */}
            <div className="px-4 pt-4">
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="w-full rounded-full border border-border py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
