import { Suspense } from "react"
import LoginClient from "./login-client"

export const dynamic = "force-dynamic"

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginClient />
    </Suspense>
  )
}
