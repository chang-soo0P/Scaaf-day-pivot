import { supabase } from './supabase'
import type { Email, TopicInfo, Highlight, Comment, Reaction } from './email-mock-data'

// Helper function to format date
function formatDate(dateString: string): { date: string; time: string; receivedAt: string } {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  let receivedAt: string
  if (diffDays < 1) {
    receivedAt = 'Today'
  } else if (diffDays < 2) {
    receivedAt = 'Yesterday'
  } else {
    receivedAt = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return { date: dateStr, time, receivedAt }
}

// Fetch all topics
export async function getAllTopics(): Promise<TopicInfo[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching topics:', error)
    return []
  }

  return (data || []).map((topic) => ({
    id: topic.id,
    name: topic.name,
    summary: topic.summary || '',
    keyPoints: (topic.key_points as string[]) || [],
  }))
}

// Fetch topic by ID
export async function getTopicById(id: string): Promise<TopicInfo | null> {
  const { data, error } = await supabase
    .from('topics')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching topic:', error)
    return null
  }

  return {
    id: data.id,
    name: data.name,
    summary: data.summary || '',
    keyPoints: (data.key_points as string[]) || [],
  }
}

// Fetch emails with topics, highlights, and comments
export async function getEmailsWithRelations(topicId?: string): Promise<Email[]> {
  let query = supabase
    .from('emails')
    .select(`
      *,
      email_topics (
        topic_id,
        topics (
          id,
          name,
          slug
        )
      ),
      highlights (*),
      comments (*)
    `)
    .order('received_at', { ascending: false })

  if (topicId) {
    query = query.eq('email_topics.topic_id', topicId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching emails:', error)
    return []
  }

  return (data || []).map((email: any) => {
    const { date, time, receivedAt } = formatDate(email.received_at)

    // Extract topics
    const topics = (email.email_topics || [])
      .map((et: any) => et.topics?.name)
      .filter(Boolean) as string[]
    const topicId = (email.email_topics || [])?.[0]?.topic_id || ''

    // Map highlights
    const highlights: Highlight[] = (email.highlights || []).map((h: any) => ({
      id: h.id,
      text: h.text,
      quote: h.quote,
      memo: h.memo || undefined,
      createdBy: h.created_by,
      createdAt: h.created_at,
      topicTag: h.topic_tag || undefined,
      isAdRelated: h.is_ad_related || false,
      isShared: h.is_shared || false,
    }))

    // Map comments with reactions
    const comments: Comment[] = (email.comments || []).map((c: any) => ({
      id: c.id,
      authorName: c.author_name,
      authorAvatarColor: c.author_avatar_color || '#6366f1',
      avatar: c.avatar || undefined,
      text: c.text,
      createdAt: c.created_at,
      reactions: (c.reactions as Reaction[]) || [],
    }))

    return {
      id: email.id,
      senderName: email.sender || '',
      newsletterTitle: email.newsletter_title || email.subject || '',
      subject: email.subject || '',
      snippet: email.snippet || email.body_text?.substring(0, 200) || '',
      receivedAt,
      date,
      time,
      topics,
      topicId,
      hasAdSegment: email.has_ad_segment || false,
      issueImageEmoji: email.issue_image_emoji || undefined,
      summary: email.summary || '',
      bullets: (email.bullets as string[]) || [],
      body: email.body_html || email.body_text || '',
      highlights,
      comments,
    }
  })
}

// Fetch emails by topic ID
export async function getEmailsByTopicId(topicId: string): Promise<Email[]> {
  // First, get all email IDs for this topic
  const { data: emailTopics, error: emailTopicsError } = await supabase
    .from('email_topics')
    .select('email_id')
    .eq('topic_id', topicId)

  if (emailTopicsError) {
    console.error('Error fetching email topics:', emailTopicsError)
    return []
  }

  if (!emailTopics || emailTopics.length === 0) {
    return []
  }

  const emailIds = emailTopics.map((et) => et.email_id)

  // Then fetch all emails with their relations
  const { data: emailsData, error: emailsError } = await supabase
    .from('emails')
    .select(`
      *,
      email_topics (
        topic_id,
        topics (
          id,
          name,
          slug
        )
      ),
      highlights (*),
      comments (*)
    `)
    .in('id', emailIds)
    .order('received_at', { ascending: false })

  if (emailsError) {
    console.error('Error fetching emails:', emailsError)
    return []
  }

  return (emailsData || []).map((email: any) => {
    const { date, time, receivedAt } = formatDate(email.received_at)

    // Extract topics
    const topics = (email.email_topics || [])
      .map((et: any) => et.topics?.name)
      .filter(Boolean) as string[]
    const emailTopicId = (email.email_topics || [])?.[0]?.topic_id || ''

    // Map highlights
    const highlights: Highlight[] = (email.highlights || []).map((h: any) => ({
      id: h.id,
      text: h.text,
      quote: h.quote,
      memo: h.memo || undefined,
      createdBy: h.created_by,
      createdAt: h.created_at,
      topicTag: h.topic_tag || undefined,
      isAdRelated: h.is_ad_related || false,
      isShared: h.is_shared || false,
    }))

    // Map comments with reactions
    const comments: Comment[] = (email.comments || []).map((c: any) => ({
      id: c.id,
      authorName: c.author_name,
      authorAvatarColor: c.author_avatar_color || '#6366f1',
      avatar: c.avatar || undefined,
      text: c.text,
      createdAt: c.created_at,
      reactions: (c.reactions as Reaction[]) || [],
    }))

    return {
      id: email.id,
      senderName: email.sender || '',
      newsletterTitle: email.newsletter_title || email.subject || '',
      subject: email.subject || '',
      snippet: email.snippet || email.body_text?.substring(0, 200) || '',
      receivedAt,
      date,
      time,
      topics,
      topicId: emailTopicId,
      hasAdSegment: email.has_ad_segment || false,
      issueImageEmoji: email.issue_image_emoji || undefined,
      summary: email.summary || '',
      bullets: (email.bullets as string[]) || [],
      body: email.body_html || email.body_text || '',
      highlights,
      comments,
    }
  })
}

// Fetch single email by ID
export async function getEmailById(id: string): Promise<Email | null> {
  const { data, error } = await supabase
    .from('emails')
    .select(`
      *,
      email_topics (
        topic_id,
        topics (
          id,
          name,
          slug
        )
      ),
      highlights (*),
      comments (*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching email:', error)
    return null
  }

  const email = data
  const { date, time, receivedAt } = formatDate(email.received_at)

  // Extract topics
  const topics = (email.email_topics || [])
    .map((et: any) => et.topics?.name)
    .filter(Boolean) as string[]
  const topicId = (email.email_topics || [])?.[0]?.topic_id || ''

  // Map highlights
  const highlights: Highlight[] = (email.highlights || []).map((h: any) => ({
    id: h.id,
    text: h.text,
    quote: h.quote,
    memo: h.memo || undefined,
    createdBy: h.created_by,
    createdAt: h.created_at,
    topicTag: h.topic_tag || undefined,
    isAdRelated: h.is_ad_related || false,
    isShared: h.is_shared || false,
  }))

  // Map comments with reactions
  const comments: Comment[] = (email.comments || []).map((c: any) => ({
    id: c.id,
    authorName: c.author_name,
    authorAvatarColor: c.author_avatar_color || '#6366f1',
    avatar: c.avatar || undefined,
    text: c.text,
    createdAt: c.created_at,
    reactions: (c.reactions as Reaction[]) || [],
  }))

  return {
    id: email.id,
    senderName: email.sender || '',
    newsletterTitle: email.newsletter_title || email.subject || '',
    subject: email.subject || '',
    snippet: email.snippet || email.body_text?.substring(0, 200) || '',
    receivedAt,
    date,
    time,
    topics,
    topicId,
    hasAdSegment: email.has_ad_segment || false,
    issueImageEmoji: email.issue_image_emoji || undefined,
    summary: email.summary || '',
    bullets: (email.bullets as string[]) || [],
    body: email.body_html || email.body_text || '',
    highlights,
    comments,
  }
}

// Get topic statistics
export async function getTopicStats(topicId: string): Promise<{
  newsletterCount: number
  highlightCount: number
  commentCount: number
  topReaction: Reaction | null
}> {
  const emails = await getEmailsByTopicId(topicId)
  const allComments = emails.flatMap((e) => e.comments)
  const allHighlights = emails.flatMap((e) => e.highlights)

  // Calculate top reaction across all emails in topic
  const reactionCounts: Record<string, number> = {}
  allComments.forEach((comment) => {
    comment.reactions.forEach((r) => {
      reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + r.count
    })
  })

  let topReaction: Reaction | null = null
  let maxCount = 0
  Object.entries(reactionCounts).forEach(([emoji, count]) => {
    if (count > maxCount) {
      maxCount = count
      topReaction = { emoji, count }
    }
  })

  return {
    newsletterCount: emails.length,
    highlightCount: allHighlights.length,
    commentCount: allComments.length,
    topReaction,
  }
}

// Get today's activity for a topic
export async function getTodayActivity(topicId: string): Promise<{
  newHighlightsToday: number
  newCommentsToday: number
}> {
  const emails = await getEmailsByTopicId(topicId)
  const today = new Date().toDateString()

  let newHighlightsToday = 0
  let newCommentsToday = 0

  emails.forEach((email) => {
    email.highlights.forEach((h) => {
      if (new Date(h.createdAt).toDateString() === today) {
        newHighlightsToday++
      }
    })
    email.comments.forEach((c) => {
      if (new Date(c.createdAt).toDateString() === today) {
        newCommentsToday++
      }
    })
  })

  return { newHighlightsToday, newCommentsToday }
}


