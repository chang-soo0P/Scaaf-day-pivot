// Shared mock data module for Scaaf Day
// All email, highlight, comment, and reaction data lives here

export type Reaction = {
  emoji: string
  count: number
  reacted?: boolean
}

export type Comment = {
  id: string
  authorName: string
  authorAvatarColor: string
  avatar?: string
  text: string
  createdAt: string
  reactions: Reaction[]
}

export type Highlight = {
  id: string
  text: string
  quote: string
  memo?: string
  createdBy: string
  createdAt: string
  topicTag?: string
  isAdRelated?: boolean
  isShared?: boolean
}

export type Email = {
  id: string
  senderName: string
  newsletterTitle: string
  subject: string
  snippet: string
  receivedAt: string
  date: string
  time: string
  topics: string[]
  topicId: string
  hasAdSegment?: boolean
  issueImageEmoji?: string
  summary: string
  bullets: string[]
  body: string
  highlights: Highlight[]
  comments: Comment[]
}

export type TopicInfo = {
  id: string
  name: string
  summary: string
  keyPoints: string[]
}

export type AdItem = {
  id: string
  emailId: string
  newsletterSource: string
  brand: string
  headline: string
  ctaLabel: string
  thumbnail: string | null
}

// --- Topics ---
export const topics: TopicInfo[] = [
  {
    id: "topic-1",
    name: "AI",
    summary:
      "AI development is accelerating rapidly with OpenAI's new reasoning models showing significant improvements. Major tech companies are racing to integrate AI capabilities, while concerns about regulation and safety continue to grow.",
    keyPoints: [
      "OpenAI's GPT-5 shows 40% improvement in reasoning benchmarks",
      "Google DeepMind releases Gemini 2.0 for research applications",
      "EU parliament debates new AI regulation framework",
      "Enterprise AI adoption hits record highs in Q4",
    ],
  },
  {
    id: "topic-2",
    name: "Investing",
    summary:
      "Markets are responding positively to Fed signals about potential rate cuts. Growth stocks are recovering while bond yields adjust to the new monetary policy outlook.",
    keyPoints: [
      "Fed signals rate cuts possible in early 2025",
      "Bond yields drop below 4.2% for first time in months",
      "Tech sector leads market rally on dovish Fed commentary",
      "Emerging markets see increased capital inflows",
    ],
  },
  {
    id: "topic-3",
    name: "Korea Stocks",
    summary:
      "Korean markets are benefiting from the global AI boom, with Samsung and SK Hynix leading gains. Memory chip demand is surging as AI infrastructure buildout accelerates.",
    keyPoints: [
      "Samsung's HBM chip orders surge 200% year-over-year",
      "KOSPI approaches 3000 milestone on foreign buying",
      "Korean won strengthens against major currencies",
      "SK Hynix announces new AI memory factory",
    ],
  },
  {
    id: "topic-4",
    name: "Startups",
    summary:
      "Startup funding is rebounding strongly with AI companies capturing the majority of venture capital. YC's latest batch shows unprecedented focus on AI applications.",
    keyPoints: [
      "YC Winter 2025 batch is 60% AI startups",
      "Seed valuations reach all-time highs",
      "Climate tech emerges as second hottest category",
      "Corporate venture arms increase startup investments",
    ],
  },
  {
    id: "topic-5",
    name: "Business",
    summary:
      "Remote and hybrid work models are becoming permanent fixtures in corporate culture. Companies are adapting their strategies to the new workplace reality.",
    keyPoints: [
      "80% of Fortune 500 adopt permanent hybrid policies",
      "Office real estate market continues to evolve",
      "Employee productivity metrics show positive trends",
      "New collaboration tools see rapid adoption",
    ],
  },
]

// --- Emails ---
export const emails: Email[] = [
  {
    id: "nl-1",
    senderName: "Stratechery",
    newsletterTitle: "AI in 2025: What's next for reasoning models",
    subject: "AI in 2025: What's next for reasoning models",
    snippet: "The reasoning benchmarks are impressive but I wonder about real-world applications...",
    receivedAt: "Today",
    date: "Today",
    time: "9:30 AM",
    topics: ["AI"],
    topicId: "topic-1",
    issueImageEmoji: "🧠",
    hasAdSegment: true,
    summary:
      "OpenAI's latest model shows remarkable improvements in reasoning capabilities, with benchmarks suggesting a 40% improvement over previous versions. The implications for enterprise adoption are significant.",
    bullets: [
      "GPT-5 demonstrates 40% improvement in reasoning benchmarks",
      "New model shows better performance on complex multi-step problems",
      "Enterprise customers report faster integration times",
      "Safety features have been significantly enhanced",
    ],
    body: `Good morning! Here's your AI briefing for today.

OpenAI just dropped something big. Their latest model shows a 40% improvement in reasoning benchmarks compared to GPT-4. That's not incremental - that's a leap.

What does this mean in practice? The new model can handle multi-step reasoning problems that would have stumped previous versions. Think complex business analysis, scientific research, and code generation that actually works the first time.

Enterprise customers are already seeing faster integration times. One Fortune 500 company reported cutting their AI deployment timeline from 6 months to 6 weeks.

But here's what's really interesting: the safety improvements. OpenAI claims the new model is significantly better at refusing harmful requests while being more helpful for legitimate use cases. The eternal AI balance, finally getting better?`,
    highlights: [
      {
        id: "h1",
        text: "40% improvement in reasoning benchmarks",
        quote: "40% improvement in reasoning benchmarks",
        createdBy: "You",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        topicTag: "AI",
        isShared: true,
      },
      {
        id: "h2",
        text: "Enterprise customers report faster integration times",
        quote: "Enterprise customers report faster integration times",
        createdBy: "You",
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        isShared: false,
      },
    ],
    comments: [
      {
        id: "c1",
        authorName: "Minjun",
        authorAvatarColor: "#6366f1",
        text: "The reasoning benchmarks are impressive but I wonder about real-world applications.",
        createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
        reactions: [
          { emoji: "👍", count: 4, reacted: false },
          { emoji: "💡", count: 2, reacted: true },
        ],
      },
      {
        id: "c2",
        authorName: "Sora",
        authorAvatarColor: "#ec4899",
        text: "This changes everything for enterprise adoption.",
        createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
        reactions: [{ emoji: "🔥", count: 3, reacted: false }],
      },
    ],
  },
  {
    id: "nl-2",
    senderName: "Morning Brew",
    newsletterTitle: "Fed signals rate cuts in early 2025",
    subject: "Fed signals rate cuts in early 2025",
    snippet: "Finally some good news for growth stocks. Time to re-evaluate portfolios...",
    receivedAt: "Today",
    date: "Today",
    time: "7:30 AM",
    topics: ["Investing"],
    topicId: "topic-2",
    issueImageEmoji: "📈",
    hasAdSegment: true,
    summary:
      "Federal Reserve officials hinted at potential rate cuts in September if inflation continues cooling. Markets are now pricing in 75% probability of a 25bps cut.",
    bullets: [
      "Fed Chair Powell emphasized data-dependent approach",
      "Core PCE inflation dropped to 2.6% in May",
      "Labor market showing signs of gradual cooling",
      "Bond yields fell on the dovish commentary",
    ],
    body: `Good morning! Here's what you need to know about the Fed today.

The Fed just dropped some major hints about where rates are headed. In yesterday's testimony, Chair Powell struck a notably dovish tone.

He acknowledged that inflation has made "considerable progress" toward the 2% target and suggested rate cuts could come "fairly soon."

Markets immediately priced in higher odds of a September cut. Bond yields dropped across the curve, with the 10-year falling below 4.2% for the first time in months.

But don't break out the champagne just yet. Powell was careful to note that no decisions have been made and the Fed remains "data dependent."`,
    highlights: [
      {
        id: "h3",
        text: "Rate cuts could come fairly soon",
        quote: "Rate cuts could come fairly soon",
        createdBy: "You",
        createdAt: new Date(Date.now() - 5400000).toISOString(),
        topicTag: "Investing",
        isShared: true,
      },
    ],
    comments: [
      {
        id: "c3",
        authorName: "Jake",
        authorAvatarColor: "#10b981",
        text: "Finally some good news for growth stocks. Time to re-evaluate portfolios.",
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        reactions: [
          { emoji: "📈", count: 8, reacted: false },
          { emoji: "👍", count: 5, reacted: true },
        ],
      },
    ],
  },
  {
    id: "nl-3",
    senderName: "Korea Economic Daily",
    newsletterTitle: "Samsung's chip demand surges amid AI boom",
    subject: "Samsung's chip demand surges amid AI boom",
    snippet: "Memory prices recovering is huge for the whole sector...",
    receivedAt: "Today",
    date: "Today",
    time: "8:00 AM",
    topics: ["Korea Stocks"],
    topicId: "topic-3",
    issueImageEmoji: "🇰🇷",
    hasAdSegment: false,
    summary:
      "Samsung Electronics reports record HBM chip orders as AI infrastructure demand accelerates globally. The company is expanding production capacity to meet growing needs.",
    bullets: [
      "HBM chip orders up 200% year-over-year",
      "New AI memory production line announced",
      "Partnership with major cloud providers expanded",
      "Stock price hits 52-week high",
    ],
    body: `삼성전자가 AI 붐의 중심에 섰습니다.

고대역폭메모리(HBM) 칩 주문이 전년 대비 200% 급증했습니다. AI 인프라 구축 수요가 폭발적으로 늘어나면서 메모리 반도체 가격도 회복세를 보이고 있습니다.

삼성은 평택에 새로운 AI 메모리 생산라인을 구축한다고 발표했습니다. 이는 글로벌 클라우드 기업들과의 파트너십 확대에 대응하기 위한 것입니다.

주가는 52주 신고가를 경신했으며, 외국인 매수세가 지속되고 있습니다.`,
    highlights: [
      {
        id: "h4",
        text: "HBM chip orders up 200% year-over-year",
        quote: "HBM chip orders up 200% year-over-year",
        createdBy: "You",
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        topicTag: "Korea Stocks",
        isShared: true,
      },
    ],
    comments: [
      {
        id: "c4",
        authorName: "Yuna",
        authorAvatarColor: "#f59e0b",
        text: "Memory prices recovering is huge for the whole sector.",
        createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        reactions: [
          { emoji: "🇰🇷", count: 3, reacted: false },
          { emoji: "💰", count: 2, reacted: false },
        ],
      },
      {
        id: "c5",
        authorName: "Chris",
        authorAvatarColor: "#8b5cf6",
        text: "Finally catching up to AI infrastructure demand.",
        createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
        reactions: [{ emoji: "💡", count: 1, reacted: false }],
      },
    ],
  },
  {
    id: "nl-4",
    senderName: "TechCrunch",
    newsletterTitle: "YC Winter 2025 batch revealed with record AI focus",
    subject: "YC Winter 2025 batch revealed with record AI focus",
    snippet: "60% AI startups is wild. The market is getting saturated...",
    receivedAt: "Today",
    date: "Today",
    time: "10:15 AM",
    topics: ["Startups"],
    topicId: "topic-4",
    issueImageEmoji: "🦄",
    hasAdSegment: true,
    summary:
      "Y Combinator's Winter 2025 batch shows unprecedented focus on AI, with 60% of startups building AI-powered products. Seed valuations continue to rise.",
    bullets: [
      "60% of batch focused on AI applications",
      "Average seed valuation reaches $20M",
      "Climate tech represents 15% of batch",
      "Healthcare AI sees surge in applications",
    ],
    body: `YC just revealed their Winter 2025 batch, and it's AI everywhere.

60% of the startups are building AI-powered products. That's not a trend - that's a paradigm shift. The accelerator has never been this concentrated in a single technology.

The average seed valuation has crept up to $20M, reflecting both the hype and the genuine opportunities in the space.

But here's the interesting stat: climate tech represents 15% of the batch, making it the second biggest category. The intersection of AI and climate is becoming a major focus.

Healthcare AI is also seeing a surge. Multiple startups are working on diagnostic tools, drug discovery, and patient care optimization.`,
    highlights: [
      {
        id: "h5",
        text: "60% of batch focused on AI applications",
        quote: "60% of batch focused on AI applications",
        createdBy: "You",
        createdAt: new Date(Date.now() - 900000).toISOString(),
        topicTag: "Startups",
        isShared: false,
      },
    ],
    comments: [
      {
        id: "c6",
        authorName: "Alex",
        authorAvatarColor: "#ef4444",
        text: "60% AI startups is wild. The market is saturated.",
        createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
        reactions: [
          { emoji: "😱", count: 6, reacted: false },
          { emoji: "🤔", count: 4, reacted: true },
        ],
      },
    ],
  },
  {
    id: "nl-5",
    senderName: "The Hustle",
    newsletterTitle: "Why remote work is here to stay",
    subject: "Why remote work is here to stay",
    snippet: "Companies are finally accepting the new normal of hybrid work...",
    receivedAt: "Today",
    date: "Today",
    time: "8:15 AM",
    topics: ["Business"],
    topicId: "topic-5",
    issueImageEmoji: "💼",
    hasAdSegment: true,
    summary:
      "Remote and hybrid work models are becoming permanent fixtures in corporate culture, with 80% of Fortune 500 companies adopting flexible policies.",
    bullets: [
      "80% of Fortune 500 have permanent hybrid policies",
      "Office occupancy stabilizes at 50% of pre-pandemic levels",
      "Collaboration tools market grows 40% YoY",
      "Employee satisfaction scores improve with flexibility",
    ],
    body: `The great return-to-office experiment is over. Hybrid won.

80% of Fortune 500 companies now have permanent hybrid work policies. The remaining 20%? They're either fully remote or watching their talent walk out the door.

Office occupancy has stabilized at about 50% of pre-pandemic levels. That's not changing anytime soon.

The collaboration tools market is booming, growing 40% year-over-year. Companies are investing heavily in making remote work actually work.

And the data is clear: employee satisfaction scores are higher with flexible arrangements. Turns out, trusting people to manage their own time was a good idea all along.`,
    highlights: [],
    comments: [
      {
        id: "c7",
        authorName: "Sarah",
        authorAvatarColor: "#06b6d4",
        text: "Companies are finally accepting the new normal of hybrid work.",
        createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
        reactions: [{ emoji: "👍", count: 4, reacted: false }],
      },
    ],
  },
  {
    id: "nl-6",
    senderName: "The Information",
    newsletterTitle: "OpenAI's next model could reshape the industry",
    subject: "OpenAI's next model could reshape the industry",
    snippet: "GPT-5 rumors are heating up with new capabilities that could change everything...",
    receivedAt: "Today",
    date: "Today",
    time: "11:00 AM",
    topics: ["AI"],
    topicId: "topic-1",
    issueImageEmoji: "🤖",
    hasAdSegment: false,
    summary:
      "Inside sources reveal OpenAI's next model may include breakthrough multimodal capabilities and significantly improved reasoning.",
    bullets: [
      "GPT-5 expected to launch Q1 2025",
      "Multimodal capabilities significantly enhanced",
      "Training costs reportedly exceed $500M",
      "New safety protocols being implemented",
    ],
    body: `We've got the inside scoop on what's coming from OpenAI.

GPT-5 is expected to launch in Q1 2025, and if our sources are correct, it's going to be a big deal. The multimodal capabilities are reportedly "significantly enhanced" - think seamless video understanding and generation.

The training costs? Over $500 million. That's the price of staying at the frontier.

But here's what caught our attention: OpenAI is implementing new safety protocols that go beyond anything they've done before. The pressure from regulators is real.`,
    highlights: [
      {
        id: "h6",
        text: "GPT-5 expected to launch Q1 2025",
        quote: "GPT-5 expected to launch Q1 2025",
        createdBy: "You",
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        topicTag: "AI",
        isShared: true,
      },
    ],
    comments: [
      {
        id: "c8",
        authorName: "David",
        authorAvatarColor: "#8b5cf6",
        text: "GPT-5 rumors are heating up with new capabilities that could change everything.",
        createdAt: new Date(Date.now() - 2.5 * 3600000).toISOString(),
        reactions: [{ emoji: "🤯", count: 8, reacted: false }],
      },
    ],
  },
  {
    id: "nl-7",
    senderName: "Bloomberg Markets",
    newsletterTitle: "Bond yields signal economic shift",
    subject: "Bond yields signal economic shift",
    snippet: "The yield curve is telling us something important about the economy...",
    receivedAt: "Today",
    date: "Today",
    time: "6:45 AM",
    topics: ["Investing"],
    topicId: "topic-2",
    issueImageEmoji: "📊",
    hasAdSegment: false,
    summary:
      "Bond market movements suggest investors are positioning for a significant shift in economic conditions and monetary policy.",
    bullets: [
      "10-year yield falls below 4.2%",
      "Yield curve steepening accelerates",
      "Bond funds see record inflows",
      "Corporate credit spreads tighten",
    ],
    body: `The bond market is sending a clear message.

10-year Treasury yields have fallen below 4.2% for the first time in months. The yield curve is steepening, which historically signals expectations of rate cuts ahead.

Bond funds are seeing record inflows as investors position for the shift. Corporate credit spreads are tightening, suggesting confidence in the economic outlook.

What does this mean for you? If you're holding growth stocks, this is probably good news. Lower rates mean higher valuations for future earnings.`,
    highlights: [],
    comments: [
      {
        id: "c9",
        authorName: "Mike",
        authorAvatarColor: "#10b981",
        text: "The yield curve is telling us something important about the economy.",
        createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
        reactions: [{ emoji: "🧐", count: 6, reacted: false }],
      },
    ],
  },
  {
    id: "nl-8",
    senderName: "매경이코노미",
    newsletterTitle: "코스피 3000 돌파 가능성 분석",
    subject: "코스피 3000 돌파 가능성 분석",
    snippet: "외국인 매수세가 지속되면서 시장 낙관론 확산...",
    receivedAt: "Yesterday",
    date: "Yesterday",
    time: "7:00 AM",
    topics: ["Korea Stocks"],
    topicId: "topic-3",
    issueImageEmoji: "💹",
    hasAdSegment: false,
    summary:
      "코스피 지수가 3000 돌파를 눈앞에 두고 있습니다. 외국인 투자자들의 지속적인 매수세와 반도체 업종 강세가 주요 동력입니다.",
    bullets: [
      "외국인 순매수 10거래일 연속",
      "반도체 업종 시가총액 비중 확대",
      "원화 강세 지속",
      "기관 투자자 비중 확대",
    ],
    body: `코스피가 3000 돌파를 향해 달리고 있습니다.

외국인 투자자들이 10거래일 연속 순매수를 기록했습니다. 특히 반도체 업종에 대한 매수가 집중되면서 삼성전자와 SK하이닉스가 지수 상승을 이끌고 있습니다.

원화도 강세를 보이고 있어 외국인 투자 매력이 높아지고 있습니다. 기관 투자자들의 참여도 늘어나는 추세입니다.

다만 글로벌 경기 불확실성은 여전히 리스크 요인으로 남아있습니다.`,
    highlights: [],
    comments: [
      {
        id: "c10",
        authorName: "민수",
        authorAvatarColor: "#f59e0b",
        text: "외국인 매수세가 지속되면서 시장 낙관론 확산.",
        createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
        reactions: [{ emoji: "🎉", count: 7, reacted: false }],
      },
    ],
  },
  {
    id: "nl-9",
    senderName: "AI Weekly",
    newsletterTitle: "The rise of AI agents in enterprise",
    subject: "The rise of AI agents in enterprise",
    snippet: "Companies are rapidly adopting AI agents for customer service and operations...",
    receivedAt: "Yesterday",
    date: "Yesterday",
    time: "9:00 AM",
    topics: ["AI"],
    topicId: "topic-1",
    issueImageEmoji: "⚡",
    hasAdSegment: true,
    summary:
      "Enterprise adoption of AI agents is accelerating, with companies deploying autonomous systems for customer service, operations, and decision support.",
    bullets: [
      "AI agent deployments up 300% in 2024",
      "Customer service automation leads adoption",
      "ROI metrics show 40% cost reduction",
      "Integration challenges remain key barrier",
    ],
    body: `AI agents are taking over the enterprise.

Deployments are up 300% compared to last year. Customer service is leading the charge - companies are using AI agents to handle routine inquiries, freeing up human agents for complex issues.

The ROI is compelling. Early adopters report 40% cost reductions in customer service operations. But it's not just about cost - customer satisfaction scores are actually improving.

The challenge? Integration. Most enterprises have legacy systems that don't play nice with modern AI tools. That's where the next wave of innovation is happening.`,
    highlights: [
      {
        id: "h7",
        text: "AI agent deployments up 300% in 2024",
        quote: "AI agent deployments up 300% in 2024",
        createdBy: "You",
        createdAt: new Date(Date.now() - 20 * 3600000).toISOString(),
        topicTag: "AI",
        isShared: false,
      },
    ],
    comments: [
      {
        id: "c11",
        authorName: "Emily",
        authorAvatarColor: "#ec4899",
        text: "Companies are rapidly adopting AI agents for customer service and operations.",
        createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
        reactions: [{ emoji: "👀", count: 5, reacted: false }],
      },
    ],
  },
]

// --- Ad Items ---
export const adItems: AdItem[] = [
  {
    id: "ad-1",
    emailId: "nl-2",
    newsletterSource: "Morning Brew",
    brand: "Notion",
    headline: "Build your second brain with AI-powered workspace",
    ctaLabel: "Try Free",
    thumbnail: "/notion-app-logo.jpg",
  },
  {
    id: "ad-2",
    emailId: "nl-5",
    newsletterSource: "The Hustle",
    brand: "Linear",
    headline: "The issue tracker built for speed",
    ctaLabel: "Get Started",
    thumbnail: "/linear-app-logo.jpg",
  },
  {
    id: "ad-3",
    emailId: "nl-1",
    newsletterSource: "Stratechery",
    brand: "Superhuman",
    headline: "The fastest email experience ever made",
    ctaLabel: "Learn More",
    thumbnail: "/superhuman-email-logo.jpg",
  },
  {
    id: "ad-4",
    emailId: "nl-4",
    newsletterSource: "TechCrunch",
    brand: "Raycast",
    headline: "Your shortcut to everything on Mac",
    ctaLabel: "Download",
    thumbnail: "/raycast-app-logo.jpg",
  },
]

// --- Helper Functions ---

export function getEmailById(id: string): Email | undefined {
  return emails.find((email) => email.id === id)
}

export function getEmailsByTopicId(topicId: string): Email[] {
  return emails.filter((email) => email.topicId === topicId)
}

export function getTopicById(id: string): TopicInfo | undefined {
  return topics.find((topic) => topic.id === id)
}

export function getTopicByName(name: string): TopicInfo | undefined {
  return topics.find((topic) => topic.name.toLowerCase() === name.toLowerCase())
}

export function getAllEmails(): Email[] {
  return emails
}

export function getAllTopics(): TopicInfo[] {
  return topics
}

export function getTopicStats(topicId: string): {
  newsletterCount: number
  highlightCount: number
  commentCount: number
  topReaction: Reaction | null
} {
  const topicEmails = getEmailsByTopicId(topicId)
  const allComments = topicEmails.flatMap((e) => e.comments)
  const allHighlights = topicEmails.flatMap((e) => e.highlights)

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
    newsletterCount: topicEmails.length,
    highlightCount: allHighlights.length,
    commentCount: allComments.length,
    topReaction,
  }
}

export function getEmailStats(emailId: string): {
  highlightCount: number
  commentCount: number
  topReaction: Reaction | null
} {
  const email = getEmailById(emailId)
  if (!email) {
    return { highlightCount: 0, commentCount: 0, topReaction: null }
  }

  // Calculate top reaction
  const reactionCounts: Record<string, number> = {}
  email.comments.forEach((comment) => {
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
    highlightCount: email.highlights.length,
    commentCount: email.comments.length,
    topReaction,
  }
}

// Get today's activity for a topic
export function getTodayActivity(topicId: string): {
  newHighlightsToday: number
  newCommentsToday: number
} {
  const topicEmails = getEmailsByTopicId(topicId)
  const today = new Date().toDateString()

  let newHighlightsToday = 0
  let newCommentsToday = 0

  topicEmails.forEach((email) => {
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
