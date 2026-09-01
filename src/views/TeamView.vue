<script setup lang="ts">
import { ref } from 'vue'
import { MailPlus, UserPlus, Users } from '@lucide/vue'
import { supabase } from '../lib/supabase'

const fullName = ref('')
const email = ref('')
const selectedRoles = ref<string[]>(['SALESMAN'])
const busy = ref(false)
const message = ref('')
const error = ref('')
const roleOptions = [{ value: 'SALESMAN', label: 'Salesman' }, { value: 'VIDEOGRAPHER', label: 'Videographer' }, { value: 'PHOTOGRAPHER', label: 'Photographer' }, { value: 'VIDEO_EDITOR', label: 'Video Editor' }, { value: 'MANAGER', label: 'Manager' }]

function toggleRole(role: string) {
  if (selectedRoles.value.includes(role)) selectedRoles.value = selectedRoles.value.filter((item) => item !== role)
  else if (selectedRoles.value.length < 3) selectedRoles.value.push(role)
}

async function invite() {
  busy.value = true; message.value = ''; error.value = ''
  const { error: inviteError } = await supabase.functions.invoke('invite-user', { body: { fullName: fullName.value, email: email.value, roles: selectedRoles.value } })
  busy.value = false
  if (inviteError) {
    error.value = inviteError.message
    if ('context' in inviteError && inviteError.context instanceof Response) {
      const responseBody = await inviteError.context.json().catch(() => null) as { error?: string } | null
      if (responseBody?.error) error.value = responseBody.error
    }
    return
  }
  message.value = `Invitation sent to ${email.value}`; fullName.value = ''; email.value = ''; selectedRoles.value = ['SALESMAN']
}
</script>

<template>
  <div class="team-view"><div class="welcome-row"><div><p class="eyebrow">People & access</p><h2>Build your team</h2><p class="muted">Invite a teammate and choose the responsibilities they can hold.</p></div></div>
    <section class="team-layout"><form class="panel invite-panel" @submit.prevent="invite"><div class="panel-heading"><div><p class="eyebrow">New invitation</p><h3>Invite by email</h3></div><MailPlus :size="22" class="panel-icon" /></div><label><span>Full name</span><input v-model="fullName" required placeholder="Teammate name" /></label><label><span>Email address</span><input v-model="email" required type="email" placeholder="name@company.com" /></label><fieldset><legend>Roles <small>Choose 1 to 3</small></legend><button v-for="option in roleOptions" :key="option.value" class="role-option" :class="{ 'role-option--selected': selectedRoles.includes(option.value) }" type="button" @click="toggleRole(option.value)"><span class="role-check">{{ selectedRoles.includes(option.value) ? '✓' : '' }}</span>{{ option.label }}</button></fieldset><p v-if="error" class="form-message form-message--error">{{ error }}</p><p v-if="message" class="form-message">{{ message }}</p><button class="primary-button" :disabled="busy || selectedRoles.length === 0" type="submit"><UserPlus :size="17" />{{ busy ? 'Sending...' : 'Send invitation' }}</button></form><section class="panel access-panel"><div class="panel-heading"><div><p class="eyebrow">Access model</p><h3>Flexible by design</h3></div><Users :size="22" class="panel-icon" /></div><p class="muted">One person can cover several responsibilities. Assign only what they need today; you can update access later.</p><div class="access-rule"><strong>Manager limit</strong><span>Maximum 2 accounts</span></div><div class="access-rule"><strong>Team roles</strong><span>1–3 per person</span></div><div class="access-rule"><strong>Invitation</strong><span>Email activation link</span></div></section></section>
  </div>
</template>
