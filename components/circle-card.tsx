import Link from "next/link"

interface Member {
  id: string
  name: string
  color: string
}

interface CircleCardProps {
  id: string
  name: string
  members: Member[]
  sharedNewsletterCount: number
  latestActivity: string
  hasUnread?: boolean
}

export function CircleCard({ id, name, members, sharedNewsletterCount, latestActivity, hasUnread }: CircleCardProps) {
  return (
    <Link href={`/circles/${id}`}>
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3">
          {/* Stacked member avatars */}
          <div className="flex -space-x-2">
            {members.slice(0, 4).map((member, index) => (
              <div
                key={member.id}
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium text-white ring-2 ring-card"
                style={{ backgroundColor: member.color, zIndex: members.length - index }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 4 && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card">
                +{members.length - 4}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-card-foreground truncate">{name}</h3>
              {hasUnread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-info" />}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {members.length} members · {sharedNewsletterCount} shared newsletters
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground truncate">{latestActivity}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}
