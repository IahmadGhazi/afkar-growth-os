import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { initStore, resetForSignOut } from './store'

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

type Listener = () => void

let status: AuthStatus = 'loading'
let email: string | null = null
// useSyncExternalStore requires getSnapshot to return a CACHED value:
// a fresh object per call reads as "changed" every render -> infinite loop.
let snapshot: { status: AuthStatus; email: string | null } = { status, email }
const listeners = new Set<Listener>()

function set(s: AuthStatus, e: string | null = null) {
  status = s
  email = e
  snapshot = { status, email }
  listeners.forEach((l) => l())
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot() {
  return snapshot
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** Boot: resolve the session once, then follow auth changes forever. */
export function initAuth() {
  if (!supabase) {
    // No env configured: nothing to authenticate against.
    set('signed-out')
    return
  }

  supabase.auth.getSession().then(({ data }) => {
    const user = data.session?.user
    if (user) {
      set('signed-in', user.email ?? null)
      initStore()
    } else {
      set('signed-out')
    }
  })

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      set('signed-in', session.user.email ?? null)
      initStore()
    } else if (event === 'SIGNED_OUT') {
      set('signed-out')
      resetForSignOut()
    }
  })
}

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase is not configured.' }
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return { error: error?.message ?? null }
}

/** First-time owner setup: creates the auth account; the DB trigger links it
    to the super-admin profile waiting under this email. Requires email
    confirmation to be disabled in the dashboard (internal tool). */
export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
  if (!supabase) return { error: 'Supabase is not configured.', needsConfirmation: false }
  const { data, error } = await supabase.auth.signUp({ email, password })
  return {
    error: error?.message ?? null,
    needsConfirmation: !error && !data.session,
  }
}

export async function signOut() {
  await supabase?.auth.signOut()
}
