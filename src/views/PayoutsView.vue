<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, Clock3, Search, Send, WalletCards } from '@lucide/vue'
import { supabase } from '../lib/supabase'

type EntityType = 'self' | 'freelancer' | 'salesman'
type StatusFilter = 'ALL' | 'PENDING' | 'PAID'

type PayoutEntry = {
  id: string
  jobId: string
  amount: number
  status: string
  createdAt: string
  releasedAt: string | null
  recipientName: string
  jobNumber: string
  eventType: string
  entity: EntityType
  source: 'commission' | 'freelancer'
  commissionType: string | null
}

const entries = ref<PayoutEntry[]>([])
const activeTab = ref<'all' | EntityType>('all')
const statusFilter = ref<StatusFilter>('ALL')
const search = ref('')
const loading = ref(false)
const error = ref('')
const message = ref('')
const releasingId = ref<string | null>(null)

const money = (value: number) => `RM ${value.toFixed(2)}`
const normalizeStatus = (value: unknown) => String(value ?? '').toUpperCase()
const isReleasedStatus = (status: string) => ['PAID', 'RELEASED'].includes(status)
const isReleased = (entry: PayoutEntry) => isReleasedStatus(entry.status)
const formatDate = (value: string) => new Intl.DateTimeFormat('en-MY', {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(value))

const pendingEntries = computed(() => entries.value.filter((entry) => !isReleased(entry)))
const personalEntries = computed(() => entries.value.filter((entry) => entry.entity === 'self'))
const externalPendingEntries = computed(() => pendingEntries.value.filter((entry) => entry.entity !== 'self'))
const personalPendingTotal = computed(() => personalEntries.value
  .filter((entry) => !isReleased(entry))
  .reduce((total, entry) => total + entry.amount, 0))
const personalReleasedTotal = computed(() => personalEntries.value
  .filter(isReleased)
  .reduce((total, entry) => total + entry.amount, 0))
const hasPersonalPendingBalance = computed(() => personalPendingTotal.value > 0)
const externalPendingTotal = computed(() => externalPendingEntries.value
  .reduce((total, entry) => total + entry.amount, 0))
const externalReleasedYtd = computed(() => {
  const year = new Date().getFullYear()
  return entries.value
    .filter((entry) => entry.entity !== 'self' && isReleased(entry) && new Date(entry.releasedAt ?? entry.createdAt).getFullYear() === year)
    .reduce((total, entry) => total + entry.amount, 0)
})

const filteredEntries = computed(() => {
  const query = search.value.trim().toLowerCase()
  return entries.value.filter((entry) => {
    const matchesTab = activeTab.value === 'all' || entry.entity === activeTab.value
    const matchesStatus = statusFilter.value === 'ALL' || (statusFilter.value === 'PAID' ? isReleased(entry) : entry.status === statusFilter.value)
    const matchesSearch = !query || [entry.jobNumber, entry.recipientName].some((value) => value.toLowerCase().includes(query))
    return matchesTab && matchesStatus && matchesSearch
  })
})

const entityLabel = (entity: EntityType) => ({ self: 'SELF / MANAGER', freelancer: 'FREELANCER', salesman: 'SALESMAN' })[entity]
const entryActionLabel = (entry: PayoutEntry) => entry.entity === 'self' ? 'Release Self' : 'Release'

function focusSelf() {
  activeTab.value = 'self'
  statusFilter.value = 'PENDING'
  document.getElementById('payout-queue')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (profileError) throw profileError
    if (!profile) throw new Error('Manager profile not found.')
    const [commissionResult, freelancerResult] = await Promise.all([
      supabase.from('salesman_commissions').select('id, salesman_id, job_id, amount, status, created_at, commission_type').order('created_at', { ascending: false }),
      supabase.from('freelancer_payouts').select('id, user_id, job_id, amount, status, created_at, released_at').order('created_at', { ascending: false }),
    ])
    if (commissionResult.error) throw commissionResult.error
    if (freelancerResult.error) throw freelancerResult.error

    const commissionRows = commissionResult.data ?? []
    const freelancerRows = freelancerResult.data ?? []
    const profileIds = [...new Set([...commissionRows.map((row) => row.salesman_id), ...freelancerRows.map((row) => row.user_id)])]
    const jobIds = [...new Set([...commissionRows.map((row) => row.job_id), ...freelancerRows.map((row) => row.job_id)])]
    const [{ data: profiles }, { data: jobs }] = await Promise.all([
      profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] }),
      jobIds.length ? supabase.from('jobs').select('id, job_number, event_type').in('id', jobIds) : Promise.resolve({ data: [] }),
    ])
    const profileName = (id: string) => profiles?.find((item) => item.id === id)?.full_name ?? 'Team member'
    const job = (id: string) => jobs?.find((item) => item.id === id)
    const isPersonalRecipient = (id: string) => id === profile.id

    entries.value = [
      ...commissionRows.map((row): PayoutEntry => ({
        id: row.id, jobId: row.job_id, amount: Number(row.amount), status: normalizeStatus(row.status),
        createdAt: row.created_at, releasedAt: isReleasedStatus(normalizeStatus(row.status)) ? row.created_at : null,
        recipientName: isPersonalRecipient(row.salesman_id) ? 'My earnings' : profileName(row.salesman_id),
        jobNumber: job(row.job_id)?.job_number ?? 'Job', eventType: job(row.job_id)?.event_type ?? 'Sales commission',
        entity: isPersonalRecipient(row.salesman_id) ? 'self' : 'salesman', source: 'commission',
        commissionType: row.commission_type ?? null,
      })),
      ...freelancerRows.map((row): PayoutEntry => ({
        id: row.id, jobId: row.job_id, amount: Number(row.amount), status: normalizeStatus(row.status),
        createdAt: row.created_at, releasedAt: row.released_at ?? null, recipientName: isPersonalRecipient(row.user_id) ? 'My earnings' : profileName(row.user_id),
        jobNumber: job(row.job_id)?.job_number ?? 'Job', eventType: job(row.job_id)?.event_type ?? 'Production job',
        entity: isPersonalRecipient(row.user_id) ? 'self' : 'freelancer', source: 'freelancer', commissionType: null,
      })),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : 'Unable to load payout records.'
  } finally {
    loading.value = false
  }
}

async function release(entry: PayoutEntry) {
  if (isReleased(entry) || releasingId.value) return
  if (!window.confirm(`Release ${money(entry.amount)} to ${entry.recipientName}?`)) return
  releasingId.value = entry.id
  error.value = ''
  message.value = ''
  try {
    const result = entry.source === 'commission'
      ? await supabase.rpc('release_salesman_commission', { target_commission_id: entry.id })
      : await supabase.rpc('release_freelancer_payment', { target_payout_id: entry.id })
    if (result.error) throw result.error
    const target = entries.value.find((item) => item.id === entry.id)
    if (target) {
      target.status = 'PAID'
      target.releasedAt = new Date().toISOString()
    }
    message.value = entry.entity === 'self' ? 'Personal earning released and recorded as PAID / SELF.' : 'External payout released and recorded as EXTERNAL RELEASED.'
  } catch (releaseError) {
    error.value = releaseError instanceof Error ? releaseError.message : 'Unable to release this payout.'
  } finally {
    releasingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="payouts-view">
    <div class="welcome-row">
      <div>
        <p class="eyebrow">Payouts & revenue</p>
        <h2>Manager payout desk</h2>
        <p class="muted">Release team payouts and track your own direct sales and overriding fees.</p>
      </div>
      <div class="role-summary"><WalletCards :size="18" /><span>{{ pendingEntries.length }} pending</span></div>
    </div>

    <p v-if="error" class="form-message form-message--error">{{ error }}</p>
    <p v-if="message" class="form-message">{{ message }}</p>

    <section class="payout-overview">
      <article class="panel wallet-hero">
        <div class="summary-card-header"><span class="eyebrow">My Wallet (Personal)</span><span class="status-badge status-badge--success">{{ hasPersonalPendingBalance ? 'Pending claim' : 'All released' }}</span></div>
        <div class="wallet-stats">
          <div class="wallet-stat wallet-stat--primary">
            <strong>{{ money(personalReleasedTotal) }}</strong>
            <span>Total Released / Earned</span>
            <small>Lifetime earned</small>
          </div>
          <div class="wallet-stat">
            <strong>{{ money(personalPendingTotal) }}</strong>
            <span>Pending Claim</span>
            <small>Unreleased balance</small>
          </div>
        </div>
        <button
          class="primary-button wallet-action"
          :class="{ 'wallet-action--released': !hasPersonalPendingBalance }"
          type="button"
          :disabled="!hasPersonalPendingBalance"
          @click="hasPersonalPendingBalance && focusSelf()"
        >
          <Send v-if="hasPersonalPendingBalance" :size="16" />
          <CheckCircle2 v-else :size="16" />
          {{ hasPersonalPendingBalance ? 'Release My Earning' : 'All Earnings Released' }}
        </button>
      </article>
      <article class="panel payout-metric">
        <div class="summary-card-header"><span class="eyebrow">Team Pending Payouts</span></div>
        <div class="summary-card-body">
          <strong>{{ externalPendingEntries.length }}</strong>
          <span class="summary-card-amount">{{ money(externalPendingTotal) }} pending release</span>
          <small>Awaiting manager release for third-party team members</small>
        </div>
      </article>
      <article class="panel payout-metric">
        <div class="summary-card-header"><span class="eyebrow">Team Total Released</span></div>
        <div class="summary-card-body">
          <strong>{{ money(externalReleasedYtd) }}</strong>
          <small>External team payouts (YTD)</small>
        </div>
      </article>
    </section>

    <section id="payout-queue" class="panel payout-queue">
      <div class="panel-heading"><div><p class="eyebrow">Combined action queue</p><h3>Pending and released records</h3></div><Clock3 :size="21" class="panel-icon" /></div>
      <div class="payout-toolbar">
        <div class="payout-tabs" role="tablist" aria-label="Payout type filter">
          <button v-for="tab in [{ key: 'all', label: 'All' }, { key: 'self', label: 'Self' }, { key: 'freelancer', label: 'Freelancers' }, { key: 'salesman', label: 'Salesmen' }]" :key="tab.key" type="button" :class="{ 'is-active': activeTab === tab.key }" @click="activeTab = tab.key as typeof activeTab">{{ tab.label }}</button>
        </div>
        <label class="payout-search"><Search :size="17" /><span class="sr-only">Search payouts</span><input v-model="search" type="search" placeholder="Search job ID or recipient" /></label>
        <select v-model="statusFilter" class="payout-status" aria-label="Filter by status"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="PAID">Released</option></select>
      </div>

      <div v-if="loading" class="empty-state"><Clock3 :size="25" /><strong>Loading payout records...</strong></div>
      <div v-else-if="filteredEntries.length" class="payout-list">
        <table class="payout-table"><thead><tr><th>Type</th><th>Recipient</th><th>Job</th><th>Status</th><th>Amount</th><th><span class="sr-only">Action</span></th></tr></thead><tbody><tr v-for="entry in filteredEntries" :key="`${entry.source}-${entry.id}`" :class="`entity-${entry.entity}`"><td><span class="entity-badge">{{ entityLabel(entry.entity) }}</span></td><td><strong>{{ entry.recipientName }}</strong><small>{{ entry.commissionType ?? (entry.entity === 'freelancer' ? 'Assignment payout' : 'Direct / overriding fee') }}</small></td><td><strong>{{ entry.jobNumber }}</strong><small>{{ entry.eventType }} · {{ formatDate(entry.createdAt) }}</small></td><td><span class="status-badge" :class="{ 'status-badge--success': isReleased(entry) }">{{ isReleased(entry) ? (entry.entity === 'self' ? 'PAID / SELF' : 'EXTERNAL RELEASED') : 'PENDING' }}</span></td><td><strong>{{ money(entry.amount) }}</strong></td><td><button v-if="!isReleased(entry)" class="release-button" type="button" :disabled="releasingId === entry.id" @click="release(entry)"><CheckCircle2 :size="15" />{{ releasingId === entry.id ? 'Releasing...' : entryActionLabel(entry) }}</button></td></tr></tbody></table>
        <div class="payout-cards"><article v-for="entry in filteredEntries" :key="`card-${entry.source}-${entry.id}`" class="payout-card" :class="`entity-${entry.entity}`"><div class="payout-card-top"><span class="entity-badge">{{ entityLabel(entry.entity) }}</span><span class="status-badge" :class="{ 'status-badge--success': isReleased(entry) }">{{ isReleased(entry) ? (entry.entity === 'self' ? 'PAID / SELF' : 'EXTERNAL RELEASED') : 'PENDING' }}</span></div><div class="payout-card-copy"><strong>{{ entry.recipientName }}</strong><span>{{ entry.jobNumber }} · {{ entry.eventType }}</span><small>{{ formatDate(entry.createdAt) }}</small></div><div class="payout-card-footer"><strong>{{ money(entry.amount) }}</strong><button v-if="!isReleased(entry)" class="release-button" type="button" :disabled="releasingId === entry.id" @click="release(entry)"><Send :size="15" />{{ releasingId === entry.id ? 'Releasing...' : entryActionLabel(entry) }}</button></div></article></div>
      </div>
      <div v-else class="empty-state"><CheckCircle2 :size="27" /><strong>No matching payout records</strong><span>Try another type, status, or search term.</span></div>
    </section>
  </div>
</template>

<style scoped>
.payout-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: stretch; gap: 16px; margin: 32px 0 22px; }
.payout-overview > .panel { height: 100%; min-height: 0; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; box-shadow: 0 1px 3px rgba(15, 23, 42, .06); }
.wallet-hero { display: grid; gap: 18px; border-top: 4px solid var(--teal) !important; }
.summary-card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; min-height: 22px; }
.summary-card-header .eyebrow { margin: 0; color: #64748b; letter-spacing: 1.2px; line-height: 1.4; }
.wallet-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; overflow: hidden; border: 1px solid #cfe3dc; border-radius: 7px; background: #cfe3dc; }
.wallet-stat { display: flex; flex-direction: column; gap: 6px; padding: 15px; background: rgba(255, 255, 255, .72); }
.wallet-stat--primary { background: rgba(255, 255, 255, .92); }
.wallet-stat strong, .payout-metric strong { font: 700 26px 'Space Grotesk', sans-serif; color: #0f172a; line-height: 1.1; }
.wallet-stat span, .wallet-stat small, .summary-card-body span, .summary-card-body small { color: #64748b; font-size: 12px; line-height: 1.45; }
.wallet-stat span { font-weight: 700; color: var(--ink); }
.wallet-action { justify-self: start; }
.wallet-action--released { color: #9ca3af; background: #f3f4f6; box-shadow: none; cursor: not-allowed; }
.wallet-action--released:active { transform: none; }
.payout-metric { display: flex; flex-direction: column; justify-content: space-between; gap: 16px; }
.summary-card-body { display: flex; flex-direction: column; justify-content: center; gap: 8px; flex: 1; }
.summary-card-body strong { font-size: 30px; }
.summary-card-amount { color: #334155 !important; font-weight: 700; }
.payout-toolbar { display: flex; align-items: center; gap: 12px; margin: 22px 0; flex-wrap: wrap; }
.payout-tabs { display: flex; gap: 5px; overflow-x: auto; }
.payout-tabs button { border: 1px solid var(--line); background: white; color: var(--muted); border-radius: 999px; padding: 9px 13px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.payout-tabs button.is-active { background: var(--navy); border-color: var(--navy); color: white; }
.payout-search { display: flex; align-items: center; gap: 7px; min-width: 220px; flex: 1; padding: 9px 12px; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); background: white; }
.payout-search input { width: 100%; border: 0; outline: 0; color: var(--ink); background: transparent; font-size: 12px; }
.payout-status { padding: 9px 11px; border: 1px solid var(--line); border-radius: 6px; color: var(--ink); background: white; font-size: 12px; }
.payout-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.payout-table th { padding: 0 12px 11px; text-align: left; color: var(--muted); font-size: 10px; letter-spacing: .8px; text-transform: uppercase; }
.payout-table td { padding: 15px 12px; border-top: 1px solid var(--line); vertical-align: middle; }
.payout-table td strong, .payout-table td small { display: block; }
.payout-table td small { color: var(--muted); margin-top: 4px; font-size: 11px; }
.entity-badge, .status-badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 8px; font-size: 10px; font-weight: 700; letter-spacing: .3px; white-space: nowrap; }
.entity-self .entity-badge { color: #6b3ba8; background: #eee5fb; }
.entity-freelancer .entity-badge { color: #1d5f9f; background: #e0effb; }
.entity-salesman .entity-badge { color: #9b5a08; background: #fff0d2; }
.status-badge { color: #8a5e00; background: #fff4d6; }
.status-badge--success { color: #087052; background: #d9f3e8; }
.release-button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; padding: 9px 12px; border: 0; border-radius: 6px; color: white; background: var(--teal); font-size: 11px; font-weight: 700; white-space: nowrap; }
.release-button:disabled { opacity: .55; cursor: wait; }
.payout-cards { display: none; }

@media (max-width: 760px) {
  .payout-overview { grid-template-columns: 1fr; margin-top: 24px; }
  .wallet-hero-heading { align-items: flex-start; flex-direction: column; gap: 2px; }
  .wallet-stats { grid-template-columns: 1fr; }
  .wallet-action { width: 100%; }
  .payout-metric { min-height: 190px !important; }
  .payout-table { display: none; }
  .payout-cards { display: grid; gap: 12px; }
  .payout-card { padding: 16px; border: 1px solid var(--line); border-top: 4px solid var(--teal); border-radius: 7px; background: white; }
  .payout-card.entity-self { border-top-color: #8b5ac2; }
  .payout-card.entity-freelancer { border-top-color: #4f91c9; }
  .payout-card.entity-salesman { border-top-color: #e4a437; }
  .payout-card-top, .payout-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .payout-card-copy { display: grid; gap: 5px; margin: 15px 0; }
  .payout-card-copy span, .payout-card-copy small { color: var(--muted); font-size: 12px; }
  .payout-card-footer > strong { font: 700 18px 'Space Grotesk', sans-serif; }
  .payout-toolbar { align-items: stretch; }
  .payout-tabs { order: 1; width: 100%; }
  .payout-search { order: 2; min-width: 0; width: 100%; }
  .payout-status { order: 3; width: 100%; }
}
</style>