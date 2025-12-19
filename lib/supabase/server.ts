// lib/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Missing Supabase env vars")

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Server Component에서 set 시도하면 실패할 수 있음 (Route Handler에선 정상)
        }
      },
    },
  })
}
