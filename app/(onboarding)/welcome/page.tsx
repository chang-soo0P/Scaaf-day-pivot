"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Mail, X } from "lucide-react"

const termsOfServiceContent = `
Terms of Service

Last updated: December 5, 2025

1. Acceptance of Terms
By accessing or using Scaaf Day, you agree to be bound by these Terms of Service and all applicable laws and regulations.

2. Description of Service
Scaaf Day provides a private newsletter aggregation and social discussion platform. We offer:
- A private email address for newsletter subscriptions
- AI-powered summarization of newsletter content
- Private circles for discussing content with friends

3. User Accounts
You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

4. Acceptable Use
You agree not to:
- Use the service for any unlawful purpose
- Share your account with others
- Attempt to gain unauthorized access to our systems
- Interfere with the proper working of the service

5. Intellectual Property
All content, features, and functionality of Scaaf Day are owned by us and are protected by international copyright, trademark, and other intellectual property laws.

6. Termination
We may terminate or suspend your account at any time, without prior notice, for conduct that we believe violates these Terms or is harmful to other users.

7. Changes to Terms
We reserve the right to modify these terms at any time. We will notify users of any material changes.

8. Contact
If you have any questions about these Terms, please contact us at legal@scaafday.com.
`

const privacyPolicyContent = `
Privacy Policy

Last updated: December 5, 2025

1. Information We Collect
We collect information you provide directly:
- Email address for authentication
- Newsletter subscriptions and reading activity
- Messages shared in private circles

2. How We Use Your Information
We use your information to:
- Provide and maintain our service
- Generate AI-powered summaries of your newsletters
- Enable private discussions with your friends
- Improve and personalize your experience

3. Information Sharing
We do not sell your personal information. We may share information:
- With your consent
- To comply with legal obligations
- To protect our rights and safety

4. Data Security
We implement appropriate security measures to protect your personal information against unauthorized access, alteration, or destruction.

5. Data Retention
We retain your information for as long as your account is active or as needed to provide services. You may request deletion of your account at any time.

6. Your Rights
You have the right to:
- Access your personal information
- Correct inaccurate data
- Request deletion of your data
- Export your data

7. Cookies and Tracking
We use essential cookies to maintain your session. We do not use third-party tracking cookies.

8. Children's Privacy
Our service is not intended for children under 13. We do not knowingly collect information from children.

9. Changes to Privacy Policy
We will notify you of any material changes to this policy via email or in-app notification.

10. Contact Us
For privacy-related inquiries, contact us at privacy@scaafday.com.
`

export default function WelcomePage() {
  const router = useRouter()
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)

  const handleContinueWithApple = () => {
    // TODO: Implement Apple Sign In
    router.push("/email")
  }

  const handleContinueWithGoogle = () => {
    // TODO: Implement Google Sign In
    router.push("/email")
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 py-12">
      <div className="mx-auto flex max-w-md flex-1 flex-col justify-center">
        {/* Icon */}
        <div className="mb-8 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Mail className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-balance text-center text-3xl font-semibold tracking-tight text-foreground">
          Your private newsletter club
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-pretty text-center text-lg leading-relaxed text-muted-foreground">
          Scaaf Day gives you a private email address just for newsletters. Multiple newsletters on the same topic are
          summarized together, and you can talk about them with only your close friends.
        </p>

        {/* Features list */}
        <div className="mt-10 flex flex-col gap-4">
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <p className="font-medium text-card-foreground">One inbox, zero spam</p>
            <p className="mt-1 text-sm text-muted-foreground">Your personal email stays clean and distraction-free.</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <p className="font-medium text-card-foreground">Smart summaries</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Related newsletters grouped and summarized for quick reading.
            </p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
            <p className="font-medium text-card-foreground">Private circles</p>
            <p className="mt-1 text-sm text-muted-foreground">Discuss what you read with friends you trust.</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-md pt-8">
        {/* Continue with Apple */}
        <button
          onClick={handleContinueWithApple}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-foreground py-4 text-base font-medium text-background transition-colors active:bg-foreground/90"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          Continue with Apple
        </button>

        {/* Continue with Google */}
        <button
          onClick={handleContinueWithGoogle}
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-card py-4 text-base font-medium text-card-foreground ring-1 ring-border transition-colors active:bg-secondary"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Terms and Privacy text */}
        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing, you are considered to agree to the{" "}
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="underline underline-offset-2 transition-colors hover:text-foreground"
          >
            Privacy Policy
          </button>{" "}
          of Scaaf Day.
        </p>
      </div>

      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg animate-in slide-in-from-bottom-4 rounded-t-3xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Terms of Service</h2>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                {termsOfServiceContent}
              </pre>
            </div>
            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              className="mt-4 w-full rounded-2xl bg-primary py-3 text-base font-medium text-primary-foreground transition-colors active:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm">
          <div className="max-h-[85vh] w-full max-w-lg animate-in slide-in-from-bottom-4 rounded-t-3xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Privacy Policy</h2>
              <button
                type="button"
                onClick={() => setShowPrivacyModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
                {privacyPolicyContent}
              </pre>
            </div>
            <button
              type="button"
              onClick={() => setShowPrivacyModal(false)}
              className="mt-4 w-full rounded-2xl bg-primary py-3 text-base font-medium text-primary-foreground transition-colors active:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
