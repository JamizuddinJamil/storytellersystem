<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, LockKeyhole, Mail, UserRound } from '@lucide/vue'
import { supabase } from '../lib/supabase'

const router = useRouter()

const mode = ref<'login' | 'register'>('login')
const fullName = ref('')
const email = ref('')
const password = ref('')
const busy = ref(false)
const message = ref('')
const error = ref('')

// Role → dashboard route
const dashboardRoutes: Record<string, string> = {
  manager: '/manager/dashboard',
  salesman: '/sales/dashboard',
  sales: '/sales/dashboard',
  videographer: '/videographer/dashboard',
  photographer: '/photographer/dashboard',
  editor: '/editor/dashboard',
  video_editor: '/editor/dashboard',
  developer: '/developer/dashboard',
}

function getDashboardRoute(role: string | null | undefined) {
  return dashboardRoutes[String(role ?? '').toLowerCase()] ?? '/manager/dashboard'
}

async function submit() {
  if (busy.value) return

  busy.value = true
  message.value = ''
  error.value = ''

  try {
    // Register
    if (mode.value === 'register') {
      const result = await supabase.auth.signUp({
        email: email.value.trim(),
        password: password.value,
        options: { data: { full_name: fullName.value.trim() } },
      })

      if (result.error) {
        error.value = result.error.message
        return
      }

      if (!result.data.session) {
        message.value = 'Check your email to confirm your account, then sign in.'
        return
      }

      await router.push('/manager/dashboard') // first registered account
      return
    }

    // Login
    const result = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value,
    })

    if (result.error) {
      error.value = result.error.message
      return
    }

    const user = result.data.user
    if (!user) {
      error.value = 'Login succeeded, but no user session was returned.'
      return
    }

    // Get profile + role (explicit FK hint avoids ambiguity with profile_roles junction table)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        role_id,
        roles!profiles_role_id_fkey ( id, name )
      `)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (profileError) {
      error.value = `Login succeeded, but your profile could not be loaded: ${profileError.message}`
      return
    }

    if (!profile) {
      error.value = 'Login succeeded, but no Storyteller profile is linked to this account.'
      return
    }

    // Generated types may still say array even though FK embed returns one row
    const roleRow = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles
    const role = String(roleRow?.name ?? '').toLowerCase()

    if (!role) {
      error.value = 'Your Storyteller profile does not have a valid role assigned.'
      return
    }

    await router.push(getDashboardRoute(role))
  } catch (caught) {
    console.error('Authentication failed:', caught)
    error.value = caught instanceof Error ? caught.message : 'Something went wrong while signing in.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <div class="brand auth-brand">
        <span class="brand-mark">S</span>
        <span>Storyteller</span>
      </div>

      <p class="eyebrow">Production workspace</p>

      <h1>{{ mode === 'login' ? 'Welcome back' : 'Create the first account' }}</h1>

      <p class="auth-intro">
        {{ mode === 'login'
          ? 'Sign in to continue managing your productions.'
          : 'The first account is automatically assigned Manager access.' }}
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <label v-if="mode === 'register'">
          <span>Full name</span>
          <div class="input-wrap">
            <UserRound :size="17" />
            <input v-model="fullName" required autocomplete="name" placeholder="Your name" />
          </div>
        </label>

        <label>
          <span>Email</span>
          <div class="input-wrap">
            <Mail :size="17" />
            <input v-model="email" required type="email" autocomplete="email" placeholder="you@company.com" />
          </div>
        </label>

        <label>
          <span>Password</span>
          <div class="input-wrap">
            <LockKeyhole :size="17" />
            <input v-model="password" required minlength="8" type="password" autocomplete="current-password" placeholder="At least 8 characters" />
          </div>
        </label>

        <p v-if="error" class="form-message form-message--error">{{ error }}</p>
        <p v-if="message" class="form-message">{{ message }}</p>

        <button class="primary-button auth-submit" :disabled="busy" type="submit">
          {{ busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Register as Manager' }}
          <ArrowRight :size="17" />
        </button>
      </form>

      <button
        class="auth-toggle"
        type="button"
        @click="mode = mode === 'login' ? 'register' : 'login'; error = ''; message = ''"
      >
        {{ mode === 'login'
          ? 'First time here? Register the Manager account'
          : 'Already registered? Sign in' }}
      </button>
    </section>
  </main>
</template>