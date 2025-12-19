import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

export const runtime = "nodejs"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // ✅ Next 16: cookieStore는 await cookies()로 가져와야 getAll이 존재
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // Route Handler에서 set이 막히는 경우가 있어 try/catch로 무조건 안전하게
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component 등에서는 set 불가할 수 있음 → 무시
        }
      },
    },
  })
}
