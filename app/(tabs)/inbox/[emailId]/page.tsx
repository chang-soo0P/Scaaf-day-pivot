// ❌ remove "use client"
// "use client" 제거

import { Suspense } from "react"
import EmailDetailClient from "./email-detail-client"

export default async function EmailDetailPage({ params }) {
  const { emailId } = await params

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmailDetailClient emailId={emailId} />
    </Suspense>
  )
}
