<script setup lang="ts">
import { ref } from 'vue'
import {
  ArrowRight,
  LockKeyhole,
  Mail,
} from '@lucide/vue'
import { supabase } from '../lib/supabase'

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
  return (
    dashboardRoutes[String(role ?? '').trim().toLowerCase()] ??
    '/manager/dashboard'
  )
}

async function submit() {
  if (busy.value) return

  busy.value = true
  message.value = ''
  error.value = ''

  try {
    const cleanEmail = email.value.trim().toLowerCase()

    if (!cleanEmail || !password.value) {
      error.value = 'Please enter your email and password.'
      return
    }

    // --------------------------------------------------
    // IMPORTANT:
    // Clear any existing Supabase session first.
    //
    // This prevents the previous account/session from
    // remaining active while another user is logging in.
    // --------------------------------------------------
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      console.warn(
        'Could not clear previous session:',
        signOutError.message,
      )
    }

    // --------------------------------------------------
    // Login
    // --------------------------------------------------
    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password.value,
      })

    if (loginError) {
      error.value = loginError.message
      return
    }

    const user = data.user

    if (!user) {
      error.value =
        'Login succeeded, but no user session was returned.'
      return
    }

    // --------------------------------------------------
    // Make sure the new session is actually available
    // before loading the user's profile.
    // --------------------------------------------------
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      error.value =
        `Login succeeded, but the session could not be verified: ${sessionError.message}`
      return
    }

    const sessionUser = sessionData.session?.user

    if (!sessionUser) {
      error.value =
        'Login succeeded, but the active session could not be verified.'
      return
    }

    // Safety check:
    // Make sure the active session belongs to the account
    // that just logged in.
    if (sessionUser.id !== user.id) {
      error.value =
        'The active session does not match the account that just logged in. Please try again.'
      return
    }

    // --------------------------------------------------
    // Load Storyteller profile + role
    // --------------------------------------------------
    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select(`
        id,
        auth_user_id,
        full_name,
        role_id,
        roles!profiles_role_id_fkey (
          id,
          name
        )
      `)
      .eq('auth_user_id', sessionUser.id)
      .maybeSingle()

    if (profileError) {
      error.value =
        `Login succeeded, but your profile could not be loaded: ${profileError.message}`
      return
    }

    if (!profile) {
      error.value =
        'Login succeeded, but no Storyteller profile is linked to this account.'
      return
    }

    // --------------------------------------------------
    // Resolve role
    // --------------------------------------------------
    const roleRow = Array.isArray(profile.roles)
      ? profile.roles[0]
      : profile.roles

    const role = String(
      roleRow?.name ?? '',
    )
      .trim()
      .toLowerCase()

    if (!role) {
      error.value =
        'Your Storyteller profile does not have a valid role assigned.'
      return
    }

    const dashboardRoute = getDashboardRoute(role)

    // --------------------------------------------------
    // Prevent stale dashboard/account state.
    //
    // A normal router.push() can sometimes leave existing
    // application state mounted. Reloading the application
    // after authentication guarantees that:
    //
    // - the new Supabase session is used
    // - the new user's profile is loaded
    // - the previous user's dashboard state is cleared
    // - role-based navigation starts from a clean state
    // --------------------------------------------------
    window.location.replace(dashboardRoute)
  } catch (caught) {
    console.error('Authentication failed:', caught)

    error.value =
      caught instanceof Error
        ? caught.message
        : 'Something went wrong while signing in.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">

      <!-- Brand -->
      <div class="brand auth-brand">
        <span class="brand-mark">S</span>
        <span>Storyteller</span>
      </div>

      <p class="eyebrow">
        Production workspace
      </p>

      <h1>
        Welcome back
      </h1>

      <p class="auth-intro">
        Sign in to continue managing your productions.
      </p>

      <!-- Login Form -->
      <form
        class="auth-form"
        @submit.prevent="submit"
      >

        <!-- Email -->
        <label>
          <span>Email</span>

          <div class="input-wrap">
            <Mail :size="17" />

            <input
              v-model="email"
              required
              type="email"
              autocomplete="username"
              placeholder="you@company.com"
              :disabled="busy"
            />
          </div>
        </label>

        <!-- Password -->
        <label>
          <span>Password</span>

          <div class="input-wrap">
            <LockKeyhole :size="17" />

            <input
              v-model="password"
              required
              minlength="8"
              type="password"
              autocomplete="current-password"
              placeholder="Enter your password"
              :disabled="busy"
            />
          </div>
        </label>

        <!-- Error -->
        <p
          v-if="error"
          class="form-message form-message--error"
        >
          {{ error }}
        </p>

        <!-- Message -->
        <p
          v-if="message"
          class="form-message"
        >
          {{ message }}
        </p>

        <!-- Submit -->
        <button
          class="primary-button auth-submit"
          :disabled="busy"
          type="submit"
        >
          {{
            busy
              ? 'Signing in...'
              : 'Sign in'
          }}

          <ArrowRight :size="17" />
        </button>

      </form>

    </section>
  </main>
</template>
