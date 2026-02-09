// types/circle-highlights.ts
export type CircleHighlight = {
    id: string
    circleId: string
    circleName: string | null
    emailId: string
    quote: string
    memo: string | null
    createdAt: string
    sharedBy: string
    sharedByProfile: { id: string; name: string; avatarUrl: string | null }
    subject: string
    fromAddress: string
    receivedAt: string | null
  }
  
  export type CircleHighlightsApiResponse =
    | {
        ok: true
        highlights: CircleHighlight[]
        nextCursor: string | null
      }
    | {
        ok: false
        error?: string
      }
  