"use client"

import { Highlighter, Share2, X } from "lucide-react"

interface FloatingHighlightBarProps {
  position: { x: number; y: number }
  onHighlight: () => void
  onShare?: () => void
  onClose?: () => void
}

export function FloatingHighlightBar({ position, onHighlight, onShare, onClose }: FloatingHighlightBarProps) {
  return (
    <div
      className="fixed z-50 -translate-x-1/2 -translate-y-full animate-in fade-in slide-in-from-bottom-2"
      style={{ left: position.x, top: position.y - 8 }}
      data-highlight-bar
    >
      <div className="flex items-center gap-1 rounded-full bg-foreground px-2 py-1.5 shadow-lg">
        <button
          onClick={onHighlight}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-background hover:bg-background/10 transition-colors"
        >
          <Highlighter className="h-4 w-4" />
          Highlight
        </button>
        {onShare && (
          <button
            onClick={onShare}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-background hover:bg-background/10 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center justify-center h-6 w-6 rounded-full text-background/70 hover:text-background hover:bg-background/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
