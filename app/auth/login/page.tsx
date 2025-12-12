'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Loader2 } from 'lucide-react'
import { sendMagicLink } from '@/lib/auth-client'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const redirectTo = searchParams.get('redirect') || '/inbox'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await sendMagicLink(email, `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`)

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to send magic link',
          variant: 'destructive',
        })
      } else {
        setEmailSent(true)
        toast({
          title: 'Magic link sent!',
          description: 'Check your email for the login link.',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (emailSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Mail className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>

          <h1 className="text-center text-3xl font-semibold text-foreground mb-4">
            Check your email
          </h1>

          <p className="text-center text-muted-foreground mb-8">
            We've sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
          </p>

          <button
            onClick={() => {
              setEmailSent(false)
              setEmail('')
            }}
            className="w-full rounded-xl bg-secondary py-3 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Mail className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-center text-3xl font-semibold text-foreground mb-2">
          Welcome back
        </h1>

        <p className="text-center text-muted-foreground mb-8">
          Enter your email to receive a magic link
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send magic link'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
