"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, Check } from "lucide-react"

const MOCK_EMAIL = "u_demo@letters.scaaf.day"

export default function EmailPage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_EMAIL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = MOCK_EMAIL
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleGoToApp = () => {
    router.push("/topics")
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 py-12">
      <div className="mx-auto flex max-w-md flex-1 flex-col justify-center">
        {/* Title */}
        <h1 className="text-balance text-center text-2xl font-semibold tracking-tight text-foreground">
          Your newsletter address
        </h1>
        <p className="mt-2 text-center text-muted-foreground">Use this email to subscribe to newsletters</p>

        {/* Email Card */}
        <div className="mt-8 rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border">
          <p className="break-all text-center font-mono text-lg font-medium text-card-foreground">{MOCK_EMAIL}</p>
          <button
            onClick={handleCopy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground transition-colors active:bg-secondary/80"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy address
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-10">
          <p className="mb-4 text-sm font-medium text-muted-foreground">How it works</p>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                1
              </span>
              <div className="flex-1 pt-1">
                <p className="font-medium text-foreground">Go to your favorite newsletters</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Visit the subscription settings of newsletters you love.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                2
              </span>
              <div className="flex-1 pt-1">
                <p className="font-medium text-foreground">Change the subscription email</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Update your email to your Scaaf Day address.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                3
              </span>
              <div className="flex-1 pt-1">
                <p className="font-medium text-foreground">Come back to Scaaf Day</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Read and discuss newsletters with your circles.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mx-auto w-full max-w-md pt-8">
        <button
          onClick={handleGoToApp}
          className="w-full rounded-2xl bg-primary py-4 text-base font-medium text-primary-foreground transition-colors active:bg-primary/90"
        >
          Go to app
        </button>
      </div>
    </div>
  )
}
