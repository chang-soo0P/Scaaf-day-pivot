'use client'

import { createClient } from './supabase-client'

/**
 * Send magic link email (client-side)
 */
export async function sendMagicLink(email: string, redirectTo?: string) {
  const supabaseClient = createClient()
  const redirectUrl = redirectTo || `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`
  
  const { data, error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectUrl,
    },
  })

  return { data, error }
}

/**
 * Sign out user (client-side)
 */
export async function signOut() {
  const supabaseClient = createClient()
  const { error } = await supabaseClient.auth.signOut()
  return { error }
}

/**
 * Get current user on the client
 */
export async function getClientUser() {
  const supabaseClient = createClient()
  const {
    data: { user },
  } = await supabaseClient.auth.getUser()
  return user
}
