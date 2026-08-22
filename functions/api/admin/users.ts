// ADMIN USERS API — the only door that may manage auth users, because it is
// the only place the service-role key exists. Browser + anon key cannot
// create users or set passwords; this function can.
//
// Contract: POST { action: 'create'|'update'|'delete', ... }
// Gates in order: method(405) -> config(501) -> session(401) -> role(403).

interface PagesEnv {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' },
  })

async function readAuthUser(env: PagesEnv, request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function onRequest(context: { request: Request; env: PagesEnv }) {
  const { request, env } = context

  if (request.method !== 'POST')
    return json({ error: 'Method not allowed. Use POST.' }, 405)

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return json(
      { error: 'Not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as Pages secrets.' },
      501,
    )

  // Session gate: verify the caller's JWT against Supabase.
  const authUser = await readAuthUser(env, request)
  if (!authUser?.id) return json({ error: 'Sign in required.' }, 401)

  // Role gate: only the super admin manages the team book.
  const profRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?auth_user_id=eq.${authUser.id}&select=id,role`,
    { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}` } },
  )
  const profiles = (await profRes.json()) as Array<{ id: string; role: string }>
  if (!profiles.length || profiles[0].role !== 'super_admin')
    return json({ error: 'Admins only.' }, 403)

  const serviceHeaders = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
    'Content-Type': 'application/json',
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  const action = body.action as string

  // ---------- CREATE ----------
  if (action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const fullName = String(body.fullName ?? '').trim() || email.split('@')[0]
    const role = String(body.role ?? 'viewer')
    if (!email || password.length < 6)
      return json({ error: 'Email and a password of at least 6 characters are required.' }, 400)

    // Create the auth user, pre-confirmed so they can log in immediately.
    const created = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
    const createdJson = (await created.json()) as Record<string, unknown> & {
      id?: string
      msg?: string
      message?: string
    }
    if (!created.ok || !createdJson.id)
      return json({ error: createdJson.msg ?? createdJson.message ?? 'Could not create the user.' }, 400)

    // Their team profile row, already linked.
    const profileId = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: serviceHeaders,
      body: JSON.stringify({
        id: profileId,
        organization_id: 'org_afkar',
        email,
        full_name: fullName,
        role,
        auth_user_id: createdJson.id,
        is_active: true,
      }),
    })
    return json({ ok: true, id: profileId })
  }

  // ---------- UPDATE ----------
  if (action === 'update') {
    const id = String(body.id ?? '')
    if (!id) return json({ error: 'Profile id required.' }, 400)

    const curRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=*`,
      { headers: serviceHeaders },
    )
    const cur = ((await curRes.json()) as Array<Record<string, unknown>>)[0]
    if (!cur) return json({ error: 'Profile not found.' }, 404)

    // Profile fields
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.fullName != null) patch.full_name = String(body.fullName).trim() || cur.full_name
    if (body.role != null) patch.role = String(body.role)
    if (body.isActive != null) patch.is_active = Boolean(body.isActive)
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH',
      headers: serviceHeaders,
      body: JSON.stringify(patch),
    })

    // Optional password reset on the linked auth user.
    const newPassword = typeof body.password === 'string' ? body.password : ''
    if (newPassword) {
      if (newPassword.length < 6)
        return json({ error: 'New password must be at least 6 characters.' }, 400)
      if (!cur.auth_user_id) return json({ error: 'This member has no login yet.' }, 400)
      const upd = await fetch(
        `${env.SUPABASE_URL}/auth/v1/admin/users/${cur.auth_user_id}`,
        {
          method: 'PUT',
          headers: serviceHeaders,
          body: JSON.stringify({ password: newPassword }),
        },
      )
      if (!upd.ok) {
        const e = (await upd.json()) as { msg?: string }
        return json({ error: e.msg ?? 'Password update failed.' }, 400)
      }
    }
    return json({ ok: true })
  }

  // ---------- DELETE ----------
  if (action === 'delete') {
    const id = String(body.id ?? '')
    if (!id) return json({ error: 'Profile id required.' }, 400)
    if (id === profiles[0].id)
      return json({ error: 'You cannot delete your own account.' }, 400)

    const curRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=auth_user_id`,
      { headers: serviceHeaders },
    )
    const cur = ((await curRes.json()) as Array<{ auth_user_id?: string }>)[0]

    // Remove tasks/comments references gracefully by nulling assignee first
    // is unnecessary: FKs are ON DELETE SET NULL / CASCADE for auth user,
    // but the PROFILE row itself is referenced by tasks.assignee_id with
    // ON DELETE SET NULL, so deleting the profile is safe.
    await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    })
    if (cur?.auth_user_id) {
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${cur.auth_user_id}`, {
        method: 'DELETE',
        headers: serviceHeaders,
      })
    }
    return json({ ok: true })
  }

  return json({ error: 'Unknown action.' }, 400)
}
