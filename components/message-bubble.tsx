// components/message-bubble.tsx
import Link from "next/link"

interface TextMessageProps {
  type: "text"
  senderName: string
  senderColor: string
  time: string
  message: string
}

interface HighlightMessageProps {
  type: "highlight"
  senderName: string
  senderColor: string
  time: string
  newsletterName: string
  quote: string
  topic: string

  /** ✅ 반드시 inbox_emails.id (uuid/string) */
  emailId: string
}

type MessageProps = TextMessageProps | HighlightMessageProps

export function MessageBubble(props: MessageProps) {
  return (
    <div className="flex gap-3">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: props.senderColor }}
      >
        {props.senderName.charAt(0).toUpperCase()}
      </div>

      <div className="flex-1 min-w-0">
        {/* Name and time */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground">{props.senderName}</span>
          <span className="text-xs text-muted-foreground">{props.time}</span>
        </div>

        {/* Content */}
        {props.type === "text" ? (
          <div className="mt-1 rounded-2xl rounded-tl-md bg-secondary px-4 py-2.5">
            <p className="text-sm text-secondary-foreground">{props.message}</p>
          </div>
        ) : (
          <div className="mt-1 rounded-2xl rounded-tl-md bg-highlight p-4 ring-1 ring-highlight-border">
            <p className="text-xs font-medium text-highlight-foreground">Highlight from {props.newsletterName}</p>
            <p className="mt-2 text-sm italic text-foreground/80">"{props.quote}"</p>

            <div className="mt-3 flex items-center justify-between">
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {props.topic}
              </span>

              {/* ✅ DB uuid로 이동 */}
              <Link
                href={`/inbox/${props.emailId}`}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Open email
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
