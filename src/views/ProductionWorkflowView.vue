<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ExternalLink, FileUp, Film, WalletCards } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

type Job = { id: string; job_number: string; event_type: string; event_date: string; status: string; gdrive_url: string | null; raw_files_url: string | null; preview_url: string | null; final_file_url: string | null }
const route = useRoute(); const role = computed(() => String(route.meta.role)); const jobs = ref<Job[]>([]); const links = ref<Record<string, string>>({}); const error = ref(''); const message = ref(''); const busy = ref('')
const assignmentIds = ref<Record<string, string>>({})
const assignedRoles = computed(() => role.value === 'editor' ? ['VIDEO_EDITOR'] : role.value === 'photographer' ? ['PHOTOGRAPHER'] : ['VIDEOGRAPHER'])

async function load() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { error.value = 'Not signed in.'; return }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()
  if (!profile) return
  const { data: assignments, error: assignmentError } = await supabase.from('job_assignments').select('id, job_id, role').eq('user_id', profile.id).in('role', assignedRoles.value).in('status', ['CONFIRMED', 'ACTIVE'])
  if (assignmentError) { error.value = assignmentError.message; return }
  for (const assignment of assignments ?? []) { assignmentIds.value[assignment.job_id] = assignment.id }
  const ids = (assignments ?? []).map((item) => item.job_id)
  if (!ids.length) { jobs.value = []; return }
  const { data, error: jobError } = await supabase.from('jobs').select('id, job_number, event_type, event_date, status, gdrive_url, raw_files_url, preview_url, final_file_url').in('id', ids).order('event_date')
  if (jobError) { error.value = jobError.message; return }
  jobs.value = data ?? []
  // Default each stage's link field to the shared Drive folder, but keyed per
  // action so Raw / Preview / Final don't overwrite each other.
  for (const job of jobs.value) {
    for (const action of ['RAW', 'PREVIEW', 'FINAL']) {
      const key = `${job.id}:${action}`
      if (!links.value[key]) links.value[key] = job.gdrive_url ?? ''
    }
  }
}

async function action(job: Job, name: string) {
  const requiresLink = name === 'RAW' || name === 'PREVIEW' || name === 'FINAL'
  const key = `${job.id}:${name}`
  const link = (links.value[key] || '').trim()
  if (requiresLink && !link) { error.value = 'Paste the folder / file URL before submitting.'; return }

  busy.value = job.id
  error.value = ''
  const { error: actionError } = await supabase.rpc('production_action', { target_job_id: job.id, action_name: name, link_url: link || null })
  if (actionError) { error.value = actionError.message; busy.value = ''; return }

  // Videographer/photographer finish their part at RAW; editor finishes at FINAL.
  // Mark their assignment complete so the payout gets queued.
  const isFinalSubmission = (name === 'RAW' && (role.value === 'videographer' || role.value === 'photographer')) || (name === 'FINAL' && role.value === 'editor')
  if (isFinalSubmission) {
    const assignmentId = assignmentIds.value[job.id]
    if (assignmentId) {
      const { error: completeError } = await supabase.rpc('complete_assignment', { target_assignment_id: assignmentId })
      if (completeError) error.value = `Production updated, but payout could not be queued: ${completeError.message}`
    }
  }

  if (!error.value) message.value = 'Production status updated.'
  await load()
  busy.value = ''
}

async function review(job: Job, approve: boolean) {
  busy.value = job.id
  const { error: actionError } = await supabase.rpc('review_action', { target_job_id: job.id, approve })
  if (actionError) error.value = actionError.message
  else await load()
  busy.value = ''
}

onMounted(load)
</script>
<template>
  <div class="production-view">
    <div class="welcome-row"><div><p class="eyebrow">Production workflow</p><h2>My assigned jobs</h2><p class="muted">Use the shared Google Drive folder for every production file.</p></div></div>
    <p v-if="error" class="form-message form-message--error">{{ error }}</p>
    <p v-if="message" class="form-message">{{ message }}</p>
    <section v-if="jobs.length" class="freelancer-job-grid">
      <article v-for="job in jobs" :key="job.id" class="freelancer-job-card">
        <div class="freelancer-job-top">
          <div><p class="eyebrow">{{ job.job_number }}</p><h3>{{ job.event_type }}</h3></div>
          <span class="status-badge">{{ job.status.replaceAll('_', ' ') }}</span>
        </div>
        <p>{{ job.event_date }}</p>
        <a v-if="job.gdrive_url" class="text-button" :href="job.gdrive_url" target="_blank" rel="noreferrer">Open shared Drive <ExternalLink :size="14" /></a>

        <label v-if="(role === 'videographer' || role === 'photographer') && job.status === 'PRODUCTION'">
          <span>Raw footage URL</span>
          <input v-model="links[`${job.id}:RAW`]" type="url" placeholder="Paste Drive folder URL" />
          <button class="primary-button" :disabled="busy === job.id" type="button" @click="action(job, 'RAW')"><FileUp :size="16" />Submit raw footage</button>
        </label>

        <button v-else-if="role === 'editor' && job.status === 'RAW_FILES_UPLOADED'" class="primary-button" :disabled="busy === job.id" type="button" @click="action(job, 'EDITING')"><Film :size="16" />Start editing</button>

        <label v-if="role === 'editor' && job.status === 'EDITING'">
          <span>Watermarked preview URL</span>
          <input v-model="links[`${job.id}:PREVIEW`]" type="url" placeholder="Paste preview URL" />
          <button class="primary-button" :disabled="busy === job.id" type="button" @click="action(job, 'PREVIEW')">Submit preview</button>
        </label>

        <label v-if="role === 'editor' && job.status === 'BALANCE_VERIFIED'">
          <span>Final delivery URL</span>
          <input v-model="links[`${job.id}:FINAL`]" type="url" placeholder="Paste final file URL" />
          <button class="primary-button" :disabled="busy === job.id" type="button" @click="action(job, 'FINAL')">Submit final files</button>
        </label>

        <div v-if="role !== 'editor' && job.status === 'REVIEW'" class="client-actions">
          <button class="primary-button" :disabled="busy === job.id" type="button" @click="review(job, true)"><WalletCards :size="16" />Approve preview</button>
          <button class="text-button danger-button" type="button" @click="review(job, false)">Request revision</button>
        </div>
      </article>
    </section>
    <div v-else class="panel empty-state"><Film :size="28" /><strong>No assigned jobs</strong><span>Confirmed jobs will appear here.</span></div>
  </div>
</template>