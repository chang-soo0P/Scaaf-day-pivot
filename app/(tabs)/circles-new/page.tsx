"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Search, X, Link2, Check, Users } from "lucide-react"

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

export default function CreateCirclePage() {
  const router = useRouter()
  const [circleName, setCircleName] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const filteredFriends = friends.filter(
    (friend) =>
      friend.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      friend.handle.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) => (prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]))
  }

  const removeFriend = (friendId: string) => {
    setSelectedFriends((prev) => prev.filter((id) => id !== friendId))
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText("https://scaaf.day/join/abcd1234")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCreate = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (circleName.trim().length > 0 && selectedFriends.length > 0) {
      setShowSuccess(true)
    }
  }

  const isValid = circleName.trim().length > 0 && selectedFriends.length > 0

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Circle created!</h1>
        <p className="mb-8 text-center text-muted-foreground">
          Your circle has been created and invites sent to your friends.
        </p>
        <button
          type="button"
          onClick={() => router.push("/circles")}
          className="w-full max-w-xs rounded-full bg-primary py-3.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Go to circles
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Create new circle</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-32">
        <div className="mb-6 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <label className="mb-2 block text-sm font-medium text-foreground">Circle name</label>
          <input
            type="text"
            value={circleName}
            onChange={(e) => setCircleName(e.target.value)}
            placeholder="e.g. AI Enthusiasts"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="mt-2 text-xs text-muted-foreground">You can change this later in settings.</p>
        </div>

        <div className="mb-6 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <label className="mb-3 block text-sm font-medium text-foreground">Add friends</label>

          {/* Search input */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search friends..."
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Selected friends chips */}
          {selectedFriends.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {selectedFriends.map((friendId) => {
                const friend = friends.find((f) => f.id === friendId)
                if (!friend) return null
                return (
                  <div key={friend.id} className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-2.5">
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium text-white"
                      style={{ backgroundColor: friend.color }}
                    >
                      {friend.name[0]}
                    </div>
                    <span className="text-xs font-medium text-foreground">{friend.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFriend(friend.id)}
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Friends list */}
          <div className="flex flex-col divide-y divide-border">
            {filteredFriends.map((friend) => {
              const isSelected = selectedFriends.includes(friend.id)
              return (
                <button
                  type="button"
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                  className="flex items-center justify-between py-3 text-left transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-3">
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
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {isSelected ? "Invited" : "Invite"}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
          <div className="mb-2 flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Invite by link</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">Share the invite link via iMessage, WhatsApp, etc.</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 truncate rounded-xl bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
              scaaf.day/join/abcd1234
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                copied ? "bg-primary/10 text-primary" : "bg-secondary text-foreground hover:bg-secondary/80"
              }`}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-20 left-0 right-0 border-t border-border/60 bg-background/80 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!isValid}
            className={`flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-medium transition-colors ${
              isValid
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <Users className="h-5 w-5" />
            Create circle
          </button>
          {!isValid && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Enter a circle name and select at least one friend.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
