<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { KeyRound, Landmark, Save, User } from '@lucide/vue'
import { supabase } from '../lib/supabase'

const profileId = ref('')
const profileForm = ref({ full_name: '', phone: '', address: '' })
const bankForm = ref({ bank_name: '', bank_account_number: '', bank_account_holder: '' })
const emailForm = ref({ email: '' })
const passwordForm = ref({ password: '', confirm: '' })

const profileBusy = ref(false)
const bankBusy = ref(false)
const emailBusy = ref(false)
const passwordBusy = ref(false)

const profileMessage = ref('')
const profileError = ref('')
const bankMessage = ref('')
const bankError = ref('')
const emailMessage = ref('')
const emailError = ref('')
const passwordMessage = ref('')
const passwordError = ref('')

async function load() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  emailForm.value.email = user.email ?? ''

  const { data: profile, error: loadError } = await supabase
    .from('profiles')
    .select('id, full_name, phone, address, bank_name, bank_account_number, bank_account_holder')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (loadError) { profileError.value = loadError.message; return }
  if (!profile) return

  profileId.value = profile.id
  profileForm.value = { full_name: profile.full_name ?? '', phone: profile.phone ?? '', address: profile.address ?? '' }
  bankForm.value = {
    bank_name: profile.bank_name ?? '',
    bank_account_number: profile.bank_account_number ?? '',
    bank_account_holder: profile.bank_account_holder ?? '',
  }
}

async function saveProfile() {
  if (profileBusy.value || !profileId.value) return
  profileBusy.value = true
  profileError.value = ''
  profileMessage.value = ''

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ full_name: profileForm.value.full_name.trim(), phone: profileForm.value.phone.trim() || null, address: profileForm.value.address.trim() || null })
    .eq('id', profileId.value)

  profileBusy.value = false
  if (updateError) { profileError.value = updateError.message; return }
  profileMessage.value = 'Profile updated.'
}

async function saveBank() {
  if (bankBusy.value || !profileId.value) return
  bankBusy.value = true
  bankError.value = ''
  bankMessage.value = ''

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      bank_name: bankForm.value.bank_name.trim() || null,
      bank_account_number: bankForm.value.bank_account_number.trim() || null,
      bank_account_holder: bankForm.value.bank_account_holder.trim() || null,
    })
    .eq('id', profileId.value)

  bankBusy.value = false
  if (updateError) { bankError.value = updateError.message; return }
  bankMessage.value = 'Bank details updated.'
}

async function saveEmail() {
  if (emailBusy.value) return
  if (!emailForm.value.email.trim()) { emailError.value = 'Email cannot be empty.'; return }

  emailBusy.value = true
  emailError.value = ''
  emailMessage.value = ''

  const { error: updateError } = await supabase.auth.updateUser({ email: emailForm.value.email.trim() })

  emailBusy.value = false
  if (updateError) { emailError.value = updateError.message; return }
  emailMessage.value = 'Check your new email inbox to confirm the change.'
}

async function savePassword() {
  if (passwordBusy.value) return
  if (passwordForm.value.password.length < 8) { passwordError.value = 'Password must be at least 8 characters.'; return }
  if (passwordForm.value.password !== passwordForm.value.confirm) { passwordError.value = 'Passwords do not match.'; return }

  passwordBusy.value = true
  passwordError.value = ''
  passwordMessage.value = ''

  const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.value.password })

  passwordBusy.value = false
  if (updateError) { passwordError.value = updateError.message; return }
  passwordMessage.value = 'Password updated.'
  passwordForm.value = { password: '', confirm: '' }
}

onMounted(load)
</script>

<template>
  <div class="settings-view">
    <div class="welcome-row">
      <div><p class="eyebrow">Account</p><h2>Settings</h2><p class="muted">Manage your profile, bank details, and login credentials.</p></div>
    </div>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Profile</p><h3>Your information</h3></div><User :size="20" class="panel-icon" /></div>
      <form class="settings-form" @submit.prevent="saveProfile">
        <label><span>Full name</span><input v-model="profileForm.full_name" required /></label>
        <label><span>Phone number</span><input v-model="profileForm.phone" type="tel" placeholder="e.g. 012-3456789" /></label>
        <label><span>Address</span><textarea v-model="profileForm.address" rows="2" placeholder="Mailing address"></textarea></label>
        <p v-if="profileError" class="form-message form-message--error">{{ profileError }}</p>
        <p v-if="profileMessage" class="form-message">{{ profileMessage }}</p>
        <button class="primary-button" type="submit" :disabled="profileBusy"><Save :size="15" />{{ profileBusy ? 'Saving...' : 'Save profile' }}</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Payouts</p><h3>Bank details</h3></div><Landmark :size="20" class="panel-icon" /></div>
      <form class="settings-form" @submit.prevent="saveBank">
        <label><span>Bank name</span><input v-model="bankForm.bank_name" placeholder="e.g. Maybank" /></label>
        <label><span>Account number</span><input v-model="bankForm.bank_account_number" placeholder="Account number" /></label>
        <label><span>Account holder name</span><input v-model="bankForm.bank_account_holder" placeholder="As per bank record" /></label>
        <p v-if="bankError" class="form-message form-message--error">{{ bankError }}</p>
        <p v-if="bankMessage" class="form-message">{{ bankMessage }}</p>
        <button class="primary-button" type="submit" :disabled="bankBusy"><Save :size="15" />{{ bankBusy ? 'Saving...' : 'Save bank details' }}</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Login</p><h3>Email address</h3></div><KeyRound :size="20" class="panel-icon" /></div>
      <form class="settings-form" @submit.prevent="saveEmail">
        <label><span>Email</span><input v-model="emailForm.email" type="email" required /></label>
        <p v-if="emailError" class="form-message form-message--error">{{ emailError }}</p>
        <p v-if="emailMessage" class="form-message">{{ emailMessage }}</p>
        <button class="primary-button" type="submit" :disabled="emailBusy">{{ emailBusy ? 'Saving...' : 'Update email' }}</button>
      </form>
    </section>

    <section class="panel">
      <div class="panel-heading"><div><p class="eyebrow">Login</p><h3>Password</h3></div><KeyRound :size="20" class="panel-icon" /></div>
      <form class="settings-form" @submit.prevent="savePassword">
        <label><span>New password</span><input v-model="passwordForm.password" type="password" minlength="8" required placeholder="At least 8 characters" /></label>
        <label><span>Confirm new password</span><input v-model="passwordForm.confirm" type="password" minlength="8" required /></label>
        <p v-if="passwordError" class="form-message form-message--error">{{ passwordError }}</p>
        <p v-if="passwordMessage" class="form-message">{{ passwordMessage }}</p>
        <button class="primary-button" type="submit" :disabled="passwordBusy">{{ passwordBusy ? 'Saving...' : 'Update password' }}</button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 420px;
}
.settings-form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
}
</style>
