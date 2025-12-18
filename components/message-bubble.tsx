import Link from "next/link"
import { emailDetailHref } from "@/lib/email-href"
import { cn } from "@/lib/utils"

interface HighlightMessageProps {
  type: "highlight"
  senderName: string
  senderColor: string
  time: string
  newsletterName: string
  quote: string
  topic: string
  emailId: string // ✅ uuid string only
}

export function MessageBubble(props: any) {
  // ...기존 그대로
  if (props.type !== "highlight") { /* ... */ }

  const href = emailDetailHref(props.emailId)

  return (
    <div className="mt-1 rounded-2xl rounded-tl-md bg-highlight p-4 ring-1 ring-highlight-border">
      {/* ... */}
      <div className="mt-3 flex items-center justify-between">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
          {props.topic}
        </span>

        {href ? (
          <Link href={href} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Open email
          </Link>
        ) : (
          <span className={cn("text-xs font-medium text-muted-foreground/60 cursor-not-allowed")}>
            Open email
          </span>
        )}
      </div>
    </div>
  )
}