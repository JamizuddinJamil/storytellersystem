<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CheckCircle2, Clock3, WalletCards, Send } from '@lucide/vue'
import { supabase } from '../lib/supabase'

type Entry = {
  id: string
  job_id: string
  amount: number
  status: string
  created_at: string
  released_at: string | null
  jobNumber: string
  eventType: string
  ownerName: string
  type: 'sales' | 'freelance'
}

type Role = 'developer' | 'manager' | 'sales' | 'videographer' | 'photographer' | 'editor'

const route = useRoute()
const entries = ref<Entry[]>([])
const error = ref('')
const loading = ref(false)
const releasingId = ref<string | null>(null)

const currentRole = computed<Role>(() => {
  const roleFromMeta = String(route.meta.role ?? '').toLowerCase() as Role
  return roleFromMeta || 'sales'
})

const isSalesman = computed(() => currentRole.value === 'sales')
const isManagerOrDev = computed(() => ['manager', 'developer'].includes(currentRole.value))

const roleConfig = computed(() => {
  if (isManagerOrDev.value) {
    return {
      title: 'Commission & Payout Management',
      subtitle: 'Review and release pending commissions for salesmen and payouts for freelancers.',
      term: 'payout',
    }
  }
  if (isSalesman.value) {
    return {
      title: 'Sales Commission',
      subtitle: 'Track your personal commissions earned from closed deals.',
      term: 'commission',
    }
  }
  return {
    title: 'My Payout Wallet',
    subtitle: 'Track your earnings and payouts for completed assignments.',
    term: 'payout',
  }
})

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

const pendingTotal = computed(() => entries.value.filter((item) => item.status === 'PENDING').reduce((sum, item) => sum + Number(item.amount), 0))
const paidTotal = computed(() => entries.value.filter((item) => item.status === 'PAID').reduce((sum, item) => sum + Number(item.amount), 0))
const pendingEntries = computed(() => entries.value.filter((item) => item.status === 'PENDING'))
const historyEntries = computed(() => entries.value.filter((item) => item.status !== 'PENDING'))

async function load() {
  error.value = ''
  loading.value = true

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    if (!profile) return

    let rawSales: any[] = []
    let rawFreelance: any[] = []

    // 1. Dapatkan data mengikut Akses Peranan
    if (isManagerOrDev.value) {
      // Manager & Dev ambil SEMUA data dari kedua-dua jadual
      const [salesRes, freeRes] = await Promise.all([
        supabase.from('salesman_commissions').select('id, job_id, amount, status, created_at, salesman_id').order('created_at', { ascending: false }),
        supabase.from('freelancer_payouts').select('id, job_id, amount, status, created_at, released_at, user_id').order('created_at', { ascending: false }),
      ])

      if (salesRes.error) throw salesRes.error
      if (freeRes.error) throw freeRes.error

      rawSales = salesRes.data ?? []
      rawFreelance = freeRes.data ?? []
    } else if (isSalesman.value) {
      // Salesman ambil data komisen salesman sendiri sahaja
      const { data, error: salesError } = await supabase
        .from('salesman_commissions')
        .select('id, job_id, amount, status, created_at')
        .eq('salesman_id', profile.id)
        .order('created_at', { ascending: false })

      if (salesError) throw salesError
      rawSales = data ?? []
    } else {
      // Freelancer (Video Editor, Videographer, Photographer) ambil bayaran mereka sahaja
      const { data, error: freeError } = await supabase
        .from('freelancer_payouts')
        .select('id, job_id, amount, status, created_at, released_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (freeError) throw freeError
      rawFreelance = data ?? []
    }

    // 2. Kumpul profil ID untuk nama pemilik (Hanya untuk Manager / Dev)
    const profileIds = [
      ...new Set([
        ...rawSales.map((item) => item.salesman_id),
        ...rawFreelance.map((item) => item.user_id),
      ].filter(Boolean))
    ]

    const { data: profiles } = profileIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      : { data: [] }

    // 3. Kumpul Job ID untuk Maklumat Job
    const jobIds = [
      ...new Set([
        ...rawSales.map((item) => item.job_id),
        ...rawFreelance.map((item) => item.job_id),
      ].filter(Boolean))
    ]

    const { data: jobs } = jobIds.length
      ? await supabase.from('jobs').select('id, job_number, event_type').in('id', jobIds)
      : { data: [] }

    // 4. Gabungkan dan format rekod
    const formattedSales: Entry[] = rawSales.map((item) => ({
      id: item.id,
      job_id: item.job_id,
      amount: Number(item.amount),
      status: item.status,
      created_at: item.created_at,
      released_at: item.released_at ?? null,
      jobNumber: jobs?.find((j) => j.id === item.job_id)?.job_number ?? 'Job',
      eventType: jobs?.find((j) => j.id === item.job_id)?.event_type ?? 'Sales Deal',
      ownerName: profiles?.find((p) => p.id === item.salesman_id)?.full_name ?? 'Salesman',
      type: 'sales',
    }))

    const formattedFreelance: Entry[] = rawFreelance.map((item) => ({
      id: item.id,
      job_id: item.job_id,
      amount: Number(item.amount),
      status: item.status,
      created_at: item.created_at,
      released_at: item.released_at ?? null,
      jobNumber: jobs?.find((j) => j.id === item.job_id)?.job_number ?? 'Job',
      eventType: jobs?.find((j) => j.id === item.job_id)?.event_type ?? 'Production Job',
      ownerName: profiles?.find((p) => p.id === item.user_id)?.full_name ?? 'Freelancer',
      type: 'freelance',
    }))

    entries.value = [...formattedSales, ...formattedFreelance].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  } catch (err: any) {
    error.value = err.message || 'An error occurred while loading wallet data.'
  } finally {
    loading.value = false
  }
}

// Fungsi Meluluskan (Release) Bayaran - Khas untuk Manager & Developer
async function releasePayment(entry: Entry) {
  if (!isManagerOrDev.value || releasingId.value) return

  releasingId.value = entry.id
  error.value = ''

  try {
    const table = entry.type === 'sales' ? 'salesman_commissions' : 'freelancer_payouts'
    const now = new Date().toISOString()

    const updateData: Record<string, any> = { status: 'PAID' }
    if (entry.type === 'freelance') {
      updateData.released_at = now
    }

    const { error: updateError } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', entry.id)

    if (updateError) throw updateError

    // Kemaskini paparan lokal
    const target = entries.value.find((item) => item.id === entry.id)
    if (target) {
      target.status = 'PAID'
      target.released_at = now
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to release payment.'
  } finally {
    releasingId.value = null
  }
}

onMounted(load)
watch(() => route.meta.role, load)
</script>

<template>
  <div class="wallet-view">
    <div class="welcome-row">
      <div>
        <p class="eyebrow">Affiliate & Wallet</p>
        <h2>{{ roleConfig.title }}</h2>
        <p class="muted">{{ roleConfig.subtitle }}</p>
      </div>
    </div>

    <p v-if="error" class="form-message form-message--error">{{ error }}</p>

    <section class="wallet-balance-grid">
      <div class="panel wallet-balance-card">
        <span class="eyebrow">Pending</span>
        <strong>RM {{ pendingTotal.toFixed(2) }}</strong>
        <span class="muted">{{ isManagerOrDev ? 'Total pending release' : 'Awaiting manager release' }}</span>
      </div>
      <div class="panel wallet-balance-card">
        <span class="eyebrow">Released</span>
        <strong>RM {{ paidTotal.toFixed(2) }}</strong>
        <span class="muted">{{ isManagerOrDev ? 'Total payouts released' : 'Already paid out' }}</span>
      </div>
    </section>

    <!-- Senarai Menunggu (Pending) -->
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Queue</p>
          <h3>Pending Release</h3>
        </div>
        <Clock3 :size="20" class="panel-icon" />
      </div>

      <div v-if="pendingEntries.length" class="payment-list">
        <article v-for="entry in pendingEntries" :key="entry.id" class="payment-row">
          <div class="payment-avatar"><WalletCards :size="17" /></div>
          
          <div class="payment-info">
            <strong>{{ entry.jobNumber }} <span v-if="isManagerOrDev" class="owner-tag">• {{ entry.ownerName }} ({{ entry.type }})</span></strong>
            <span>{{ entry.eventType }}</span>
            <small>Recorded {{ formatDate(entry.created_at) }}</small>
          </div>

          <div class="payment-actions">
            <div class="payment-amount">
              <strong>RM {{ entry.amount.toFixed(2) }}</strong>
              <span class="status-badge">Pending</span>
            </div>

            <!-- Butang Release HANYA muncul untuk Manager & Developer -->
            <button
              v-if="isManagerOrDev"
              type="button"
              class="release-button"
              :disabled="releasingId === entry.id"
              @click="releasePayment(entry)"
            >
              <Send :size="14" />
              <span>{{ releasingId === entry.id ? 'Releasing...' : 'Release' }}</span>
            </button>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <Clock3 :size="24" />
        <strong>Nothing pending</strong>
        <span>New {{ roleConfig.term }}s will show up here.</span>
      </div>
    </section>

    <!-- Senarai Sejarah (Released) -->
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">History</p>
          <h3>Released Payouts</h3>
        </div>
        <CheckCircle2 :size="20" class="panel-icon" />
      </div>

      <div v-if="historyEntries.length" class="payment-list">
        <article v-for="entry in historyEntries" :key="entry.id" class="payment-row">
          <div class="payment-avatar"><CheckCircle2 :size="17" /></div>
          
          <div class="payment-info">
            <strong>{{ entry.jobNumber }} <span v-if="isManagerOrDev" class="owner-tag">• {{ entry.ownerName }} ({{ entry.type }})</span></strong>
            <span>{{ entry.eventType }}</span>
            <small>Released {{ entry.released_at ? formatDate(entry.released_at) : formatDate(entry.created_at) }}</small>
          </div>

          <div class="payment-amount">
            <strong>RM {{ entry.amount.toFixed(2) }}</strong>
            <span class="status-badge status-badge--success">{{ entry.status }}</span>
          </div>
        </article>
      </div>

      <div v-else class="empty-state">
        <CheckCircle2 :size="24" />
        <strong>No history yet</strong>
        <span>Released {{ roleConfig.term }}s will appear here.</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wallet-balance-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}
.wallet-balance-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.wallet-balance-card strong {
  font-size: 1.6rem;
}
.payment-actions {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.owner-tag {
  font-weight: normal;
  color: #6b7280;
  font-size: 0.85rem;
}
.release-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background-color: #2563eb;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}
.release-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.status-badge--success {
  background-color: #d1fae5;
  color: #065f46;
}
</style>