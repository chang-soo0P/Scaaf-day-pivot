import Link from "next/link"
import { emailDetailHref } from "@/lib/email-href"
import Image from "next/image"
import { ArrowLeft, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ShineBorder } from "@/components/ui/shine-border"

const topicsData: Record<
  string,
  {
    name: string
    period: string
    summary: string
    keyPoints: string[]
    newsletters: {
      id: string
      name: string
      subject: string
      receivedTime: string
      oneLiner: string
      topic: string
      thumbnail: string
    }[]
  }
> = {
  ai: {
    name: "AI",
    period: "Today",
    summary:
      "Today's AI news is dominated by OpenAI's announcement of GPT-5, which features significantly improved reasoning and multimodal capabilities. Google DeepMind countered with their own research release, while the EU continues to debate the implementation timeline for the AI Act. Industry experts are divided on the implications for enterprise adoption.",
    keyPoints: [
      "OpenAI announces GPT-5 with improved reasoning capabilities and native multimodal support",
      "Google DeepMind releases Gemini 2.0 for research preview with enhanced code generation",
      "EU Parliament debates accelerated AI Act implementation timeline",
      "Enterprise AI adoption expected to grow 40% in 2025 according to Gartner",
      "Open-source AI models close the gap with proprietary alternatives",
    ],
    newsletters: [
      {
        id: "5",
        name: "The AI Weekly",
        subject: "GPT-5 is here: What you need to know",
        receivedTime: "8:30 AM",
        oneLiner: "Deep dive into GPT-5's new capabilities and enterprise pricing.",
        topic: "AI",
        thumbnail: "/ai-neural-network-abstract.jpg",
      },
      {
        id: "6",
        name: "Silicon Valley Daily",
        subject: "AI Wars Heat Up: OpenAI vs Google",
        receivedTime: "7:15 AM",
        oneLiner: "Analysis of the competitive landscape as both giants release new models.",
        topic: "AI",
        thumbnail: "/google-ai-technology.jpg",
      },
      {
        id: "7",
        name: "Tech Headlines",
        subject: "EU AI Act: Implementation Timeline Revealed",
        receivedTime: "6:00 AM",
        oneLiner: "Breaking down the regulatory timeline and what it means for startups.",
        topic: "AI",
        thumbnail: "/eu-parliament-building.jpg",
      },
    ],
  },
  investing: {
    name: "Investing",
    period: "Today",
    summary:
      "Markets rallied today as the Federal Reserve signaled potential rate cuts in early 2025. Tech stocks led the charge with strong earnings reports from major players. Emerging markets showed signs of recovery, particularly in Southeast Asia, while bond yields continued their downward trend.",
    keyPoints: [
      "Fed signals 2-3 rate cuts expected in first half of 2025",
      "NASDAQ hits new all-time high on strong tech earnings",
      "Emerging market ETFs see largest inflows in 18 months",
      "Treasury yields drop to lowest level since March 2024",
      "Analysts upgrade outlook for semiconductor sector",
    ],
    newsletters: [
      {
        id: "8",
        name: "Morning Brew Markets",
        subject: "Fed Pivot: What It Means for Your Portfolio",
        receivedTime: "6:00 AM",
        oneLiner: "Breaking down the Fed's latest signals and investment implications.",
        topic: "Investing",
        thumbnail: "/federal-reserve-building.png",
      },
      {
        id: "9",
        name: "Financial Times Brief",
        subject: "Tech Earnings Roundup: Winners and Losers",
        receivedTime: "7:30 AM",
        oneLiner: "Q4 earnings analysis for FAANG and semiconductor stocks.",
        topic: "Investing",
        thumbnail: "/stock-market-chart-green.png",
      },
      {
        id: "2",
        name: "Bloomberg Daily",
        subject: "Emerging Markets: The Recovery Play",
        receivedTime: "8:00 AM",
        oneLiner: "Why institutional investors are rotating into EM equities.",
        topic: "Investing",
        thumbnail: "/stock-market-chart.png",
      },
    ],
  },
  "korea-stocks": {
    name: "Korea Stocks",
    period: "Today",
    summary:
      "Korean equities performed strongly today, led by Samsung Electronics' positive Q4 guidance on chip demand. The Korean won strengthened against the dollar as export data exceeded expectations. Foreign investors returned to net buying positions for the first time in three weeks.",
    keyPoints: [
      "Samsung Electronics shares up 4% on strong chip demand forecast",
      "Korean won strengthens to 1,280 against USD",
      "KOSPI index closes above 2,600 for first time in 2 months",
      "Foreign investors net buyers of $500M in Korean equities",
      "Hyundai Motor Group announces EV expansion plans",
    ],
    newsletters: [
      {
        id: "10",
        name: "Korea Economics Daily",
        subject: "Samsung's Chip Comeback: Full Analysis",
        receivedTime: "9:00 AM",
        oneLiner: "Why Samsung's memory chip outlook is bullish for 2025.",
        topic: "Korea Stocks",
        thumbnail: "/samsung-semiconductor-chip.jpg",
      },
      {
        id: "11",
        name: "Seoul Market Watch",
        subject: "Foreign Flows Return to Korean Stocks",
        receivedTime: "10:30 AM",
        oneLiner: "Tracking institutional money flows and sector preferences.",
        topic: "Korea Stocks",
        thumbnail: "/korean-won-currency.jpg",
      },
    ],
  },
  startups: {
    name: "Startups",
    period: "Today",
    summary:
      "The startup ecosystem shows strong signs of recovery as YC announces their largest Winter batch yet. Series A funding has rebounded significantly from 2024 lows, with AI and climate tech leading deal flow. Remote-first companies continue to demonstrate superior metrics in retention and productivity.",
    keyPoints: [
      "Y Combinator Winter 2025 batch includes 280 companies, 60% AI-focused",
      "Series A median valuation rebounds to $45M, up 30% from 2024",
      "Climate tech startups raise record $8B in Q4",
      "Remote-first startups show 25% better employee retention",
      "Developer tools category sees renewed investor interest",
    ],
    newsletters: [
      {
        id: "12",
        name: "TechCrunch Daily",
        subject: "YC W25: The Most Exciting Startups to Watch",
        receivedTime: "7:00 AM",
        oneLiner: "Our picks for the breakout companies from the latest batch.",
        topic: "Startups",
        thumbnail: "/y-combinator-startup-office.jpg",
      },
      {
        id: "13",
        name: "Crunchbase News",
        subject: "Funding Rebounds: Q4 Startup Report",
        receivedTime: "8:00 AM",
        oneLiner: "Complete analysis of startup funding trends and top deals.",
        topic: "Startups",
        thumbnail: "/startup-funding-money.jpg",
      },
      {
        id: "14",
        name: "StrictlyVC",
        subject: "Climate Tech's Big Moment",
        receivedTime: "6:30 AM",
        oneLiner: "Why VCs are betting big on sustainability startups.",
        topic: "Startups",
        thumbnail: "/climate-tech-solar-panels.jpg",
      },
    ],
  },
  design: {
    name: "Design",
    period: "This week",
    summary:
      "This week in design saw Figma's major announcement of AI-powered design tools that promise to streamline workflows. The industry continues to embrace minimalism with a focus on accessibility-first approaches. Design systems are evolving to accommodate new interaction patterns for AI interfaces.",
    keyPoints: [
      "Figma launches AI features for auto-layout and component suggestions",
      "Minimalist design trends dominate Dribbble's year-end review",
      "WCAG 3.0 draft pushes accessibility standards forward",
      "Design systems now include AI interaction patterns",
      "Motion design sees renaissance with Lottie adoption",
    ],
    newsletters: [
      {
        id: "15",
        name: "Designer News",
        subject: "Figma's AI Revolution: First Look",
        receivedTime: "Monday",
        oneLiner: "Hands-on with Figma's new AI-powered design features.",
        topic: "Design",
        thumbnail: "/figma-design-tool.jpg",
      },
      {
        id: "16",
        name: "Sidebar.io",
        subject: "The Return of Minimalism",
        receivedTime: "Tuesday",
        oneLiner: "Why designers are stripping back to essentials in 2025.",
        topic: "Design",
        thumbnail: "/minimalist-design-white.jpg",
      },
      {
        id: "17",
        name: "UX Collective",
        subject: "Accessibility-First: A New Standard",
        receivedTime: "Wednesday",
        oneLiner: "How WCAG 3.0 will change the way we design.",
        topic: "Design",
        thumbnail: "/accessibility-icons.jpg",
      },
    ],
  },
}

function NewsletterCard({
  newsletter,
}: {
  newsletter: {
    id: string
    name: string
    subject: string
    receivedTime: string
    oneLiner: string
    topic: string
    thumbnail: string
  }
}) {
  const href = emailDetailHref(newsletter.id)

  const CardInner = (
    <div
      className={cn(
        "flex gap-3 rounded-2xl bg-card p-3 shadow-sm ring-1 ring-border transition-shadow hover:shadow-md",
        href ? "cursor-pointer" : "cursor-not-allowed opacity-60"
      )}
      aria-disabled={!href}
    >
      {/* Left side - text content */}
      <div className="flex flex-1 min-w-0 flex-col justify-between">
        {/* Source name */}
        <span className="text-xs text-muted-foreground truncate mb-1">{newsletter.name}</span>

        {/* Large bold subject/headline */}
        <h3 className="text-base font-semibold leading-snug line-clamp-2 text-card-foreground">
          {newsletter.subject}
        </h3>

        {/* Topic chip and time */}
        <div className="flex items-center gap-2 mt-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {newsletter.topic}
          </span>
          <span className="text-xs text-muted-foreground">{newsletter.receivedTime}</span>
        </div>
      </div>

      {/* Right side - thumbnail */}
      <div className="relative h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">
        <Image src={newsletter.thumbnail || "/placeholder.svg"} alt="" fill className="object-cover" />
      </div>
    </div>
  )

  // ✅ href가 없으면 Link를 쓰지 않는다 (클릭 "안 되는" 상태를 명확히)
  if (!href) {
    return (
      <div title="This is demo data. Connect a real email to open detail.">
        {CardInner}
      </div>
    )
  }

  return (
    <Link href={href} prefetch={false} className="block">
      {CardInner}
    </Link>
  )
}

export default async function TopicDetailPage({
  params,
}: {
  params: Promise<{ topicSlug: string }>
}) {
  const { topicSlug } = await params
  const topic = topicsData[topicSlug]

  if (!topic) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <p className="text-muted-foreground">Topic not found.</p>
        <Link href="/topics" className="mt-4 inline-block text-foreground underline">
          Back to topics
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Header with back button */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/topics"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary transition-colors hover:bg-secondary/80"
        >
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{topic.name}</h1>
          <p className="text-sm text-muted-foreground">{topic.period}</p>
        </div>
      </div>

      <ShineBorder
        className="mb-6 shadow-sm ring-1 ring-border"
        borderRadius={16}
        color={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
        duration={10}
      >
        <div className="p-5">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Summary</h2>
          <p className="leading-relaxed text-card-foreground/80">{topic.summary}</p>
        </div>
      </ShineBorder>

      {/* Key points */}
      <div className="mb-6 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">Key Points</h2>
        <ul className="space-y-3">
          {topic.keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-3 text-card-foreground/80">
              <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-muted-foreground" />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          From these newsletters
        </h2>
        <div className="flex flex-col gap-3">
          {topic.newsletters.map((nl) => (
            <NewsletterCard key={nl.id} newsletter={nl} />
          ))}
        </div>
      </div>

      {/* Share button */}
      <Button className="w-full gap-2 rounded-xl bg-primary py-6 text-base font-medium hover:bg-primary/90">
        <Share2 className="h-5 w-5" />
        Share to circle
      </Button>
    </div>
  )
}

// local helper for cn (so file is self-contained if cn isn't imported here already)
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
