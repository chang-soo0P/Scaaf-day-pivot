// src/types/circle-feed.ts
export type SharedByProfile = {
    id: string
    name: string
    avatarUrl: string | null
  }
  
  export type CircleFeedItem = {
    id: string
    circleId: string
    emailId: string
    sharedAt: string
    sharedBy: string | null
    sharedByProfile: SharedByProfile | null
  
    subject: string | null
    fromAddress: string | null
    receivedAt: string | null
  
    highlightCount: number
    commentCount: number
    latestActivity: string | null
  }
  
  export type CircleFeedApiResponse =
    | { ok: true; feed: CircleFeedItem[]; nextCursor: string | null }
    | { ok: false; error?: string }
  