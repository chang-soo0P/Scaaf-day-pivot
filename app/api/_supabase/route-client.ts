import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export async function createSupabaseRouteClient() {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY")

  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Next cookies() API
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

// (옵션) 기존 이름도 유지하고 싶으면 alias 제공
export const supabaseRouteClient = createSupabaseRouteClient
