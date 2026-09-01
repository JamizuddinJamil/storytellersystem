<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { CheckCircle2, CircleDollarSign, WalletCards } from '@lucide/vue'
import { supabase } from '../lib/supabase'

type Payout = { id: string; user_id: string; job_id: string; amount: number; status: string; created_at: string; profileName: string; jobNumber: string; eventType: string }
type Commission = { id: string; salesman_id: string; job_id: string; amount: number; status: string; created_at: string; profileName: string; jobNumber: string; eventType: string }

const payouts = ref<Payout[]>([])
const commissions = ref<Commission[]>([])
const busyPayout = ref('')
const busyCommission = ref('')
const error = ref('')
const message = ref('')

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

async function load() {
  error.value = ''
  const [payoutResult, commissionResult] = await Promise.all([
    supabase.from('freelancer_payouts').select('id, user_id, job_id, amount, status, created_at').eq('status', 'PENDING').order('created_at', { ascending: true }),
    supabase.from('salesman_commissions').select('id, salesman_id, job_id, amount, status, created_at').eq('status', 'PENDING').order('created_at', { ascending: true }),
  ])
  if (payoutResult.error) { error.value = payoutResult.error.message; return }
  if (commissionResult.error) { error.value = commissionResult.error.message; return }

  const payoutRows = payoutResult.data ?? []
  const commissionRows = commissionResult.data ?? []

  const userIds = [...new Set([...payoutRows.map((item) => item.user_id), ...commissionRows.map((item) => item.salesman_id)])]
  const jobIds = [...new Set([...payoutRows.map((item) => item.job_id), ...commissionRows.map((item) => item.job_id)])]

  const [{ data: profiles }, { data: jobs }] = await Promise.all([
    userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [] }),
    jobIds.length ? supabase.from('jobs').select('id, job_number, event_type').in('id', jobIds) : Promise.resolve({ data: [] }),
  ])

  payouts.value = payoutRows.map((item) => ({
    ...item,
    profileName: profiles?.find((profile) => profile.id === item.user_id)?.full_name ?? 'Freelancer',
    jobNumber: jobs?.find((job) => job.id === item.job_id)?.job_number ?? 'Job',
    eventType: jobs?.find((job) => job.id === item.job_id)?.event_type ?? 'Production job',
  }))

  commissions.value = commissionRows.map((item) => ({
    ...item,
    profileName: profiles?.find((profile) => profile.id === item.salesman_id)?.full_name ?? 'Salesman',
    jobNumber: jobs?.find((job) => job.id === item.job_id)?.job_number ?? 'Job',
    eventType: jobs?.find((job) => job.id === item.job_id)?.event_type ?? 'Production job',
  }))
}

async function releasePayment(payout: Payout) {
  if (!window.confirm(`Release RM ${Number(payout.amount).toFixed(2)} to ${payout.profileName}?`)) return
  busyPayout.value = payout.id
  error.value = ''
  message.value = ''
  const { error: releaseError } = await supabase.rpc('release_freelancer_payment', { target_payout_id: payout.id })
  if (releaseError) error.value = releaseError.message
  else { message.value = `Payment released for ${payout.jobNumber}.`; payouts.value = payouts.value.filter((item) => item.id !== payout.id) }
  busyPayout.value = ''
}

async function releaseCommission(commission: Commission) {
  if (!window.confirm(`Release RM ${Number(commission.amount).toFixed(2)} commission to ${commission.profileName}?`)) return
  busyCommission.value = commission.id
  error.value = ''
  message.value = ''
  const { error: releaseError } = await supabase.rpc('release_salesman_commission', { target_commission_id: commission.id })
  if (releaseError) error.value = releaseError.message
  else { message.value = `Commission released for ${commission.jobNumber}.`; commissions.value = commissions.value.filter((item) => item.id !== commission.id) }
  busyCommission.value = ''
}

onMounted(load)
</script>

<template>
  <div class="payments-view">
    <div class="welcome-row">
      <div><p class="eyebrow">Affiliate payments</p><h2>Payment requests</h2><p class="muted">Review completed work and mark external payments as released.</p></div>
      <div class="role-summary"><WalletCards :size="18" /><span>{{ payouts.length + commissions.length }} pending</span></div>
    </div>

    <p v-if="error" class="form-message form-message--error">{{ error }}</p>
    <p v-if="message" class="form-message">{{ message }}</p>

    <section class="panel payment-panel">
      <div class="panel-heading"><div><p class="eyebrow">Freelancer queue</p><h3>Awaiting release</h3></div><CircleDollarSign :size="22" class="panel-icon" /></div>
      <div v-if="payouts.length" class="payment-list">
        <article v-for="payout in payouts" :key="payout.id" class="payment-row">
          <div class="payment-avatar"><CircleDollarSign :size="17" /></div>
          <div class="payment-info"><strong>{{ payout.profileName }}</strong><span>{{ payout.jobNumber }} · {{ payout.eventType }}</span><small>Requested {{ formatDate(payout.created_at) }}</small></div>
          <div class="payment-amount"><strong>RM {{ Number(payout.amount).toFixed(2) }}</strong><span>External release</span></div>
          <button class="primary-button" type="button" :disabled="busyPayout === payout.id" @click="releasePayment(payout)"><CheckCircle2 :size="16" />{{ busyPayout === payout.id ? 'Releasing...' : 'Release payment' }}</button>
        </article>
      </div>
      <div v-else class="empty-state"><CheckCircle2 :size="28" /><strong>All freelancer payments are up to date</strong><span>Released payments remain stored in Supabase history.</span></div>
    </section>

    <section class="panel payment-panel">
      <div class="panel-heading"><div><p class="eyebrow">Salesman queue</p><h3>Commissions awaiting release</h3></div><CircleDollarSign :size="22" class="panel-icon" /></div>
      <div v-if="commissions.length" class="payment-list">
        <article v-for="commission in commissions" :key="commission.id" class="payment-row">
          <div class="payment-avatar"><CircleDollarSign :size="17" /></div>
          <div class="payment-info"><strong>{{ commission.profileName }}</strong><span>{{ commission.jobNumber }} · {{ commission.eventType }}</span><small>Requested {{ formatDate(commission.created_at) }}</small></div>
          <div class="payment-amount"><strong>RM {{ Number(commission.amount).toFixed(2) }}</strong><span>Commission</span></div>
          <button class="primary-button" type="button" :disabled="busyCommission === commission.id" @click="releaseCommission(commission)"><CheckCircle2 :size="16" />{{ busyCommission === commission.id ? 'Releasing...' : 'Release commission' }}</button>
        </article>
      </div>
      <div v-else class="empty-state"><CheckCircle2 :size="28" /><strong>All commissions are up to date</strong><span>Released commissions remain stored in Supabase history.</span></div>
    </section>
  </div>
</template>