<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { BriefcaseBusiness, CheckCircle2, MapPin, Users } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

type Job = { id: string; job_number: string; event_type: string; event_date: string; event_location: string | null; status: string; production_brief: string | null }
type Requirement = { job_id: string; role: string; quantity: number; compensation_type: 'FIXED' | 'PERCENT'; compensation_value: number }
type Assignment = { job_id: string; role: string; status: string }

const route = useRoute()
const role = computed(() => ({ videographer: 'VIDEOGRAPHER', photographer: 'PHOTOGRAPHER', editor: 'VIDEO_EDITOR' }[String(route.meta.role)] ?? 'VIDEOGRAPHER'))
const roleLabel = computed(() => ({ VIDEOGRAPHER: 'Videographer', PHOTOGRAPHER: 'Photographer', VIDEO_EDITOR: 'Video editor' }[role.value]))
const jobs = ref<Job[]>([])
const requirements = ref<Requirement[]>([])
const assignments = ref<Assignment[]>([])
const busyJob = ref('')
const error = ref('')
const message = ref('')

const availableJobs = computed(() => jobs.value.filter((job) => requirements.value.some((item) => item.job_id === job.id && item.role === role.value)))
const requirementFor = (jobId: string) => requirements.value.find((item) => item.job_id === jobId && item.role === role.value)?.quantity ?? 0
const assignmentFor = (jobId: string) => assignments.value.find((item) => item.job_id === jobId && item.role === role.value)
const compensationFor = (jobId: string) => { const item = requirements.value.find((requirement) => requirement.job_id === jobId && requirement.role === role.value); return item?.compensation_type === 'PERCENT' ? `${item.compensation_value}% of invoice` : `RM ${Number(item?.compensation_value ?? 0).toFixed(2)}` }

async function load() {
  error.value = ''
  const { data: profile } = await supabase.from('profiles').select('id').maybeSingle()
  const [jobResult, requirementResult, assignmentResult] = await Promise.all([
    supabase.from('jobs').select('id, job_number, event_type, event_date, event_location, status, production_brief').in('status', ['POST_PRODUCTION_SETUP', 'PRODUCTION']).order('event_date'),
    supabase.from('job_requirements').select('job_id, role, quantity, compensation_type, compensation_value').eq('role', role.value),
    profile ? supabase.from('job_assignments').select('job_id, role, status').eq('user_id', profile.id) : Promise.resolve({ data: [], error: null }),
  ])
  if (jobResult.error) error.value = jobResult.error.message
  if (requirementResult.error) error.value = requirementResult.error.message
  jobs.value = jobResult.data ?? []
  requirements.value = requirementResult.data ?? []
  assignments.value = assignmentResult.data ?? []
}

async function claim(job: Job) {
  busyJob.value = job.id
  error.value = ''
  const { error: claimError } = await supabase.rpc('claim_job', { target_job_id: job.id, target_role: role.value })
  if (claimError) error.value = claimError.message
  else { message.value = `${job.job_number} claimed as ${roleLabel.value}.`; await load() }
  busyJob.value = ''
}

onMounted(load)
</script>

<template>
  <div class="freelancer-jobs-view">
    <div class="welcome-row"><div><p class="eyebrow">Production opportunities</p><h2>Available jobs</h2><p class="muted">Claim a release that matches your {{ roleLabel?.toLowerCase() }} role.</p></div><div class="role-summary"><Users :size="18" /><span>{{ roleLabel }}</span></div></div>
    <p v-if="error" class="form-message form-message--error">{{ error }}</p><p v-if="message" class="form-message">{{ message }}</p>
    <section v-if="availableJobs.length" class="freelancer-job-grid"><article v-for="job in availableJobs" :key="job.id" class="freelancer-job-card"><div class="freelancer-job-top"><div><p class="eyebrow">{{ job.job_number }}</p><h3>{{ job.event_type }}</h3></div><span class="status-badge">{{ requirementFor(job.id) }} needed</span></div><div class="job-meta"><span><BriefcaseBusiness :size="14" /> {{ job.event_date }}</span><span><MapPin :size="14" /> {{ job.event_location || 'Location pending' }}</span></div><p class="job-brief">Freelancer pay: <strong>{{ compensationFor(job.id) }}</strong></p><p v-if="job.production_brief" class="job-brief">{{ job.production_brief }}</p><div v-if="assignmentFor(job.id)" class="claimed-state"><CheckCircle2 :size="16" /> You claimed this job</div><button v-else class="primary-button" type="button" :disabled="busyJob === job.id" @click="claim(job)">{{ busyJob === job.id ? 'Claiming...' : 'Claim job' }}</button></article></section>
    <div v-else class="panel empty-state"><BriefcaseBusiness :size="28" /><strong>No jobs available</strong><span>Released {{ roleLabel?.toLowerCase() }} jobs will appear here.</span></div>
  </div>
</template>