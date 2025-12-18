import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createSupabaseServerClient() {
  const cookieStore = await cookies() // ✅ await 해도 안전 (Next 16 변화 대응)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, // 또는 ANON_KEY 사용 중이면 그걸로
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Server Component에서 set 시도한 경우 무시 가능
          }
        },
      },
    }
  )
}
