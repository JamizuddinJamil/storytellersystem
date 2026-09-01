import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) throw new Error('Authentication required')
    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await callerClient.auth.getUser()
    if (!user) throw new Error('Authentication required')

    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: managerRole, error: managerRoleError } = await admin.from('roles').select('id').eq('name', 'MANAGER').single()
    if (managerRoleError || !managerRole) throw new Error('Manager role is not configured')
    let { data: callerProfile, error: callerProfileError } = await admin.from('profiles').select('id, role_id').eq('auth_user_id', user.id).maybeSingle()
    if (callerProfileError) throw callerProfileError
    if (!callerProfile) {
      const { count: profileCount } = await admin.from('profiles').select('id', { count: 'exact', head: true })
      if ((profileCount ?? 0) !== 0) throw new Error('Your user profile was not found. Ask an existing Manager to create your account.')
      const { data: createdProfile, error: createProfileError } = await admin.from('profiles').insert({ auth_user_id: user.id, full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Manager', email: user.email, role_id: managerRole.id }).select('id, role_id').single()
      if (createProfileError || !createdProfile) throw createProfileError ?? new Error('Could not create the first Manager profile')
      const { error: createRoleError } = await admin.from('profile_roles').insert({ profile_id: createdProfile.id, role_id: managerRole.id })
      if (createRoleError) throw createRoleError
      callerProfile = createdProfile
    }
    const { data: managerAssignment } = await admin.from('profile_roles').select('profile_id').eq('profile_id', callerProfile.id).eq('role_id', managerRole.id).maybeSingle()
    const isLegacyManager = callerProfile.role_id === managerRole.id
    if (!managerAssignment && !isLegacyManager) throw new Error('Only Managers can invite users')

    const { email, fullName, roles } = await request.json()
    const requestedRoles = [...new Set(roles as string[])]
    const validRoles = ['MANAGER', 'SALESMAN', 'VIDEOGRAPHER', 'PHOTOGRAPHER', 'VIDEO_EDITOR']
    if (!email || !fullName || requestedRoles.length < 1 || requestedRoles.length > 3 || requestedRoles.some((role) => !validRoles.includes(role))) throw new Error('Provide a name, email, and 1 to 3 valid roles')
    if (requestedRoles.includes('MANAGER')) {
      const { count } = await admin.from('profile_roles').select('profile_id', { count: 'exact', head: true }).eq('role_id', managerRole.id)
      if ((count ?? 0) >= 2) throw new Error('Only two Manager accounts are allowed')
    }

    const redirectTo = `${request.headers.get('origin') ?? 'http://localhost:5173'}/set-password`
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo })
    if (inviteError || !invited.user) throw inviteError ?? new Error('Invitation failed')
    const { data: roleRows, error: rolesError } = await admin.from('roles').select('id, name').in('name', requestedRoles)
    if (rolesError || !roleRows?.length) throw rolesError ?? new Error('Roles could not be found')
    const primaryRole = roleRows.find((row) => row.name === requestedRoles[0])!
    const { data: profile, error: profileError } = await admin.from('profiles').upsert({ auth_user_id: invited.user.id, full_name: fullName, email, role_id: primaryRole.id }, { onConflict: 'auth_user_id' }).select('id').single()
    if (profileError || !profile) throw profileError ?? new Error('Profile creation failed')
    const { error: assignmentError } = await admin.from('profile_roles').insert(roleRows.map((row) => ({ profile_id: profile.id, role_id: row.id })))
    if (assignmentError) throw assignmentError
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invitation failed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
