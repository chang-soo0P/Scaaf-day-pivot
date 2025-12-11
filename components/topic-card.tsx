import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface TopicCardProps {
  slug: string
  name: string
  period: string
  newsletterCount: number
  bullets: string[]
  sources: { initials: string; color: string }[]
}

export function TopicCard({ slug, name, period, newsletterCount, bullets, sources }: TopicCardProps) {
  return (
    <Link href={`/topics/${slug}`}>
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md active:bg-secondary">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-card-foreground">{name}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {period} · {newsletterCount} newsletters
            </p>
          </div>
          <ChevronRight className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground" />
        </div>

        <ul className="mt-3 space-y-1.5">
          {bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-card-foreground/80">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
              <span className="line-clamp-2">{bullet}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-1.5">
          {sources.map((source, i) => (
            <div
              key={i}
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: source.color }}
            >
              {source.initials}
            </div>
          ))}
          {sources.length > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              {sources.length} source{sources.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
