// lib/supabase/server.ts
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { CookieOptions } from "@supabase/ssr"

function getEnv(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

/**
 * ✅ Server-only Supabase client (App Router)
 * - Works in Route Handlers / Server Actions / Server Components
 * - Keeps auth session via cookies
 *
 * IMPORTANT
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createSupabaseServerClient() {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const supabaseAnonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  // Next.js cookie store (read/write in Route Handlers, write may throw in Server Components)
  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },

      set(name: string, value: string, options: CookieOptions) {
        // Server Components에서는 set이 불가해서 throw 날 수 있음 → 무시(공식 패턴)
        try {
          cookieStore.set({ name, value, ...options })
        } catch {
          // ignore
        }
      },

      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 })
        } catch {
          // ignore
        }
      },
    },

    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

/**
 * (선택) Service Role 클라이언트가 필요할 때만 사용
 * - RLS 우회하므로 사용처 제한 필수
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY")

  return createServerClient(supabaseUrl, serviceRoleKey, {
    cookies: {
      // admin은 세션 쿠키 필요 없으니 noop
      get() {
        return undefined
      },
      set() {},
      remove() {},
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
