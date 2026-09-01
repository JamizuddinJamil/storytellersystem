<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRight, CheckCircle2, ExternalLink, FileText, PackageCheck, X } from '@lucide/vue'
import { supabase } from '../lib/supabase'

type Lead = { id: string; quotation_number: string; client_id: string; event_type: string; total: number; deposit_amount: number; balance_amount: number; status: string }
type Job = { id: string; job_number: string; client_id: string; event_type: string; status: string; preview_url: string | null; gdrive_url: string | null; quotation_id: string | null }
type Client = { id: string; name: string }

// Quotation-only stages (from quotations_status_check) + job-only stages (from jobs_status_check).
const quotationStages = ['DRAFT', 'SENT', 'ACCEPTED', 'CONVERTED']
const jobStages = ['WAITING_DEPOSIT', 'RELEASED', 'POST_PRODUCTION_SETUP', 'PRODUCTION', 'RAW_FILES_UPLOADED', 'EDITING', 'REVIEW', 'REVISION', 'BALANCE_PENDING', 'BALANCE_VERIFIED', 'FINAL_PREPARATION', 'DELIVERED']
const stages = [...quotationStages, ...jobStages]

const leads = ref<Lead[]>([]); const jobs = ref<Job[]>([]); const clients = ref<Client[]>([]); const error = ref(''); const message = ref(''); const busy = ref('')

// Once a job exists for a quotation, the job card represents its progress —
// hide the quotation card so it doesn't sit "stuck" at CONVERTED forever.
const visibleLeads = computed(() => {
  const quotationIdsWithJob = new Set(jobs.value.map((job) => job.quotation_id).filter(Boolean))
  return leads.value.filter((lead) => !quotationIdsWithJob.has(lead.id))
})

async function load() {
  const [leadResult, jobResult, clientResult] = await Promise.all([
    supabase.from('quotations').select('id, quotation_number, client_id, event_type, total, deposit_amount, balance_amount, status').in('status', quotationStages),
    supabase.from('jobs').select('id, job_number, client_id, event_type, status, preview_url, gdrive_url, quotation_id').in('status', jobStages),
    supabase.from('clients').select('id, name'),
  ])
  if (leadResult.error) error.value = leadResult.error.message
  leads.value = leadResult.data ?? []
  jobs.value = jobResult.data ?? []
  clients.value = clientResult.data ?? []
}

async function move(lead: Lead, status: string) {
  if (status === 'CONVERTED') {
    let invoice = (await supabase.from('invoices').select('id').eq('quotation_id', lead.id).maybeSingle()).data
    if (!invoice) {
      const invoiceNumber = `INV-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
      const created = await supabase.from('invoices').insert({ invoice_number: invoiceNumber, quotation_id: lead.id, client_id: lead.client_id, total_amount: lead.total, deposit_amount: lead.deposit_amount, balance_amount: lead.balance_amount }).select('id').maybeSingle()
      if (created.error && !created.error.message.includes('invoices_quotation_id_key') && !created.error.message.includes('invoices_quotation_id_uidx')) { error.value = created.error.message; return }
      invoice = created.data ?? (await supabase.from('invoices').select('id').eq('quotation_id', lead.id).single()).data
    }
    if (!invoice) { error.value = 'Could not find or create the invoice.'; return }
    const { data: jobId, error: jobError } = await supabase.rpc('create_job_from_invoice', { invoice_id: invoice.id })
    if (jobError) { error.value = jobError.message; return }
    if (!jobId) { error.value = 'Job was not created.'; return }
  }
  const result = await supabase.from('quotations').update({ status }).eq('id', lead.id)
  if (result.error) error.value = result.error.message
  else { message.value = status === 'CONVERTED' ? 'Invoice and job created.' : `Lead moved to ${status.toLowerCase()}.`; await load() }
}

async function reviewJob(job: Job, approve: boolean) {
  if (!window.confirm(approve ? `Mark ${job.job_number} as accepted by client?` : `Send ${job.job_number} back for revision?`)) return
  busy.value = job.id
  const { error: reviewError } = await supabase.rpc('review_action', { target_job_id: job.id, approve })
  busy.value = ''
  if (reviewError) { error.value = reviewError.message; return }
  message.value = approve ? `${job.job_number} accepted — moved to balance collection.` : `${job.job_number} sent back for revision.`
  await load()
}

async function markDelivered(job: Job) {
  if (!window.confirm(`Mark ${job.job_number} as delivered?`)) return
  busy.value = job.id
  const { error: deliverError } = await supabase.rpc('deliver_job', { target_job_id: job.id })
  busy.value = ''
  if (deliverError) { error.value = deliverError.message; return }
  message.value = `${job.job_number} marked as delivered.`
  await load()
}

onMounted(load)
</script>

<template>
  <div class="pipeline-view">
    <div class="welcome-row"><div><p class="eyebrow">Sales & production overview</p><h2>Lead pipeline</h2><p class="muted">Follow every job from first draft through delivery.</p></div></div>
    <p v-if="error" class="form-message form-message--error">{{ error }}</p>
    <p v-if="message" class="form-message">{{ message }}</p>

    <section class="lead-pipeline">
      <article v-for="stage in stages" :key="stage" class="pipeline-column">
        <div class="pipeline-heading">
          <span>{{ stage.replaceAll('_', ' ') }}</span>
          <strong>{{ visibleLeads.filter((lead) => lead.status === stage).length + jobs.filter((job) => job.status === stage).length }}</strong>
        </div>

        <div v-for="lead in visibleLeads.filter((item) => item.status === stage)" :key="lead.id" class="pipeline-card">
          <strong>{{ lead.quotation_number }}</strong>
          <span>{{ clients.find((client) => client.id === lead.client_id)?.name || 'Client' }}</span>
          <small>{{ lead.event_type }} · {{ Number(lead.total).toFixed(2) }}</small>
          <button v-if="stage === 'DRAFT'" class="pipeline-action" type="button" @click="move(lead, 'SENT')">Send <ArrowRight :size="13" /></button>
          <button v-else-if="stage === 'SENT'" class="pipeline-action" type="button" @click="move(lead, 'ACCEPTED')">Mark accepted <CheckCircle2 :size="13" /></button>
          <button v-else-if="stage === 'ACCEPTED'" class="pipeline-action" type="button" @click="move(lead, 'CONVERTED')">Create invoice <FileText :size="13" /></button>
        </div>

        <div v-for="job in jobs.filter((item) => item.status === stage)" :key="job.id" class="pipeline-card pipeline-card--job">
          <strong>{{ job.job_number }}</strong>
          <span>{{ clients.find((client) => client.id === job.client_id)?.name || 'Client' }}</span>
          <small>{{ job.event_type }}</small>

          <a v-if="stage === 'REVIEW' && (job.preview_url || job.gdrive_url)" class="pipeline-action" :href="job.preview_url || job.gdrive_url || '#'" target="_blank" rel="noreferrer">
            View preview <ExternalLink :size="13" />
          </a>
          <div v-if="stage === 'REVIEW'" class="pipeline-action-row">
            <button class="pipeline-action" type="button" :disabled="busy === job.id" @click="reviewJob(job, true)">Client accepted <CheckCircle2 :size="13" /></button>
            <button class="pipeline-action pipeline-action--danger" type="button" :disabled="busy === job.id" @click="reviewJob(job, false)">Client rejected <X :size="13" /></button>
          </div>

          <button v-if="stage === 'FINAL_PREPARATION'" class="pipeline-action" type="button" :disabled="busy === job.id" @click="markDelivered(job)">
            Mark delivered <PackageCheck :size="13" />
          </button>
        </div>

        <span v-if="!visibleLeads.some((lead) => lead.status === stage) && !jobs.some((job) => job.status === stage)" class="pipeline-empty">No work here</span>
      </article>
    </section>
  </div>
</template>

<style scoped>
.pipeline-action-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.pipeline-action--danger {
  color: #b91c1c;
}
</style>