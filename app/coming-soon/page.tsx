"use client"

import { useEffect, useMemo, useState } from "react"
import { Mail, Inbox, Sparkles, Zap } from "lucide-react"

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number }

export default function ComingSoonPage() {
  const [email, setEmail] = useState("")
  const [isSubscribed, setIsSubscribed] = useState(false)

  // 고정 launchDate (리렌더마다 +30일로 밀리는 버그 방지)
  const launchDate = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d
  }, [])

  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = +launchDate - +new Date()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }

    calculateTimeLeft()
    const timer = setInterval(calculateTimeLeft, 1000)
    return () => clearInterval(timer)
  }, [launchDate])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubscribed(true)
    setTimeout(() => {
      setEmail("")
      setIsSubscribed(false)
    }, 3000)
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Decorative blurred circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-8">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Inbox className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Scaaf.day
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-6xl w-full">
            <div className="text-center space-y-12 mb-20">
              {/* Scarf visual */}
              <div className="relative h-24 mb-8 overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="scarfGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" style={{ stopColor: "#4f46e5", stopOpacity: 0.6 }} />
                      <stop offset="50%" style={{ stopColor: "#7c3aed", stopOpacity: 0.8 }} />
                      <stop offset="100%" style={{ stopColor: "#9333ea", stopOpacity: 0.6 }} />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,50 Q300,10 600,50 T1200,50 L1200,70 Q900,90 600,70 T0,70 Z"
                    fill="url(#scarfGradient)"
                    className="animate-wave"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-purple-600 animate-pulse" />
                </div>
              </div>

              {/* Main Copy */}
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 rounded-full text-indigo-700 mb-4">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm">AI-Powered Email Intelligence</span>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-8xl text-gray-900 tracking-tight">
                  Wrap up your inbox.
                  <br />
                  <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Focus on what matters.
                  </span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto">
                  AI-powered email summaries that cut through the noise.
                  <br />
                  Less reading. More doing.
                </p>
              </div>

              {/* Feature Icons */}
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 pt-8">
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-indigo-600" />
                  </div>
                  <span>Smart Summaries</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-purple-600" />
                  </div>
                  <span>Instant Insights</span>
                </div>
                <div className="flex items-center gap-3 text-gray-700">
                  <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-pink-600" />
                  </div>
                  <span>Time Saved</span>
                </div>
              </div>
            </div>

            {/* Countdown Timer */}
            <div className="max-w-3xl mx-auto mb-16">
              <p className="text-center text-gray-600 mb-6 text-lg">Launching in</p>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: "Days", value: timeLeft.days, border: "border-indigo-100", grad: "from-indigo-600 to-purple-600" },
                  { label: "Hours", value: timeLeft.hours, border: "border-purple-100", grad: "from-purple-600 to-pink-600" },
                  { label: "Mins", value: timeLeft.minutes, border: "border-pink-100", grad: "from-pink-600 to-rose-600" },
                  { label: "Secs", value: timeLeft.seconds, border: "border-rose-100", grad: "from-rose-600 to-indigo-600" },
                ].map((t) => (
                  <div key={t.label} className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border ${t.border}`}>
                    <div className={`text-5xl md:text-6xl bg-gradient-to-br ${t.grad} bg-clip-text text-transparent mb-1`}>
                      {String(t.value).padStart(2, "0")}
                    </div>
                    <div className="text-sm text-gray-600 uppercase tracking-wider">{t.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Subscription */}
            <div className="max-w-xl mx-auto">
              <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-10 shadow-2xl border border-indigo-100">
                <h2 className="text-2xl md:text-3xl text-gray-900 mb-2 text-center">Be the first to know</h2>
                <p className="text-gray-600 mb-6 text-center">Get early access when we launch</p>

                {!isSubscribed ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        className="w-full pl-12 h-14 bg-white border-2 border-gray-200 focus:border-indigo-400 text-gray-900 placeholder:text-gray-400 rounded-xl outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full h-14 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                      Notify Me at Launch
                    </button>
                  </form>
                ) : (
                  <div className="h-14 flex items-center justify-center bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl text-green-700">
                    <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    You're on the list!
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-4 text-center">No spam. Unsubscribe anytime.</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="px-6 py-8">
          <div className="max-w-7xl mx-auto text-center space-y-4">
            <p className="text-sm text-gray-500">© 2025 Scaaf.day • All Rights Reserved</p>
          </div>
        </footer>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -30px) scale(1.05); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 30px) scale(1.05); }
        }
        @keyframes wave {
          0%, 100% { d: path("M0,50 Q300,10 600,50 T1200,50 L1200,70 Q900,90 600,70 T0,70 Z"); }
          50% { d: path("M0,50 Q300,90 600,50 T1200,50 L1200,70 Q900,10 600,70 T0,70 Z"); }
        }
        .animate-float { animation: float 10s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 12s ease-in-out infinite; }
        .animate-wave { animation: wave 5s ease-in-out infinite; }
      `}</style>
    </div>
  )
}
