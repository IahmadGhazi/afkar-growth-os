import { supabase } from './supabase'

/** Client for the admin users API. The service-role key never touches the
    browser; the function verifies the caller is a super admin themselves. */
async function call(body: Record<string, unknown>): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured.' }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Sign in required.' }

  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const out = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) return { error: out.error ?? `Request failed (${res.status}).` }
  return { error: null }
}

export const adminUsers = {
  create: (input: { email: string; password: string; fullName: string; role: string }) =>
    call({ action: 'create', ...input }),

  update: (input: {
    id: string
    fullName?: string
    role?: string
    isActive?: boolean
    password?: string
  }) => call({ action: 'update', ...input }),

  remove: (id: string) => call({ action: 'delete', id }),
}
