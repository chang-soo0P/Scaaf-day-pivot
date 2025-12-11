import Link from "next/link"
import Image from "next/image"

export interface IssueCardProps {
  id: string
  sourceName: string
  headline: string
  subline: string
  thumbnail: string | null
  topicSlug: string
}

export function IssueCard({ id, sourceName, headline, subline, thumbnail, topicSlug }: IssueCardProps) {
  return (
    <Link href={`/topics/${topicSlug}`}>
      <div className="flex gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md active:bg-secondary">
        {/* Left side - 70% */}
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-xs font-medium text-muted-foreground">{sourceName}</p>

          <h3 className="mt-1.5 text-base font-semibold leading-snug text-card-foreground line-clamp-2">{headline}</h3>

          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground line-clamp-2">{subline}</p>
        </div>

        {/* Right side - thumbnail 30% */}
        <div className="flex-shrink-0">
          {thumbnail ? (
            <div className="relative h-20 w-20 overflow-hidden rounded-lg">
              <Image src={thumbnail || "/placeholder.svg"} alt="" fill className="object-cover" />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-secondary">
              <div className="h-8 w-8 rounded bg-muted" />
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
