<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, KeyRound } from '@lucide/vue'
import { supabase } from '../lib/supabase'

const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const busy = ref(false)
const error = ref('')
const expired = ref(false)
const ready = ref(false)

onMounted(async () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (hash.get('error_code') === 'otp_expired' || hash.get('error') === 'access_denied') {
    expired.value = true
    error.value = 'This invitation link has expired. Ask the Manager to send a new invitation.'
    return
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    error.value = 'This invitation link is invalid. Ask the Manager to send a new invitation.'
    return
  }
  ready.value = true
})

async function setPassword() {
  error.value = ''
  if (password.value.length < 8) { error.value = 'Password must be at least 8 characters.'; return }
  if (password.value !== confirmPassword.value) { error.value = 'Passwords do not match.'; return }
  busy.value = true
  const { error: updateError } = await supabase.auth.updateUser({ password: password.value })
  busy.value = false
  if (updateError) { error.value = updateError.message; return }
  const { data: profile } = await supabase.from('profiles').select('roles(name)').eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id).maybeSingle()
  const relation = profile?.roles as unknown as { name?: string } | { name?: string }[] | null
  const assignedRole = Array.isArray(relation) ? relation[0]?.name : relation?.name
  const rolePath: Record<string, string> = { MANAGER: 'manager', SALESMAN: 'sales', VIDEOGRAPHER: 'videographer', PHOTOGRAPHER: 'photographer', VIDEO_EDITOR: 'editor' }
  await router.push(`/${rolePath[assignedRole ?? ''] ?? 'auth'}/dashboard`)
}
</script>

<template>
  <main class="auth-page"><section class="auth-panel"><div class="brand auth-brand"><span class="brand-mark">S</span><span>Storyteller</span></div><p class="eyebrow">Team invitation</p><h1>{{ expired ? 'Invitation expired' : 'Set your password' }}</h1><p class="auth-intro">{{ expired ? 'Invitation links are single-use and time-limited.' : 'Choose a password to activate your Storyteller account.' }}</p><form v-if="ready" class="auth-form" @submit.prevent="setPassword"><label><span>New password</span><div class="input-wrap"><KeyRound :size="17" /><input v-model="password" required minlength="8" type="password" autocomplete="new-password" placeholder="At least 8 characters" /></div></label><label><span>Confirm password</span><div class="input-wrap"><KeyRound :size="17" /><input v-model="confirmPassword" required minlength="8" type="password" autocomplete="new-password" placeholder="Repeat your password" /></div></label><p v-if="error" class="form-message form-message--error">{{ error }}</p><button class="primary-button auth-submit" :disabled="busy" type="submit">{{ busy ? 'Saving...' : 'Activate account' }} <ArrowRight :size="17" /></button></form><p v-else-if="error" class="form-message form-message--error">{{ error }}</p></section></main>
</template>
