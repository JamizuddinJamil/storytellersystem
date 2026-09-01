<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, ChevronUp, Download, FileText, Plus, Search } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'

type Invoice = { id: string; invoice_number: string; client_id: string; quotation_id: string | null; total_amount: number; deposit_amount: number; balance_amount: number; payment_status: string }
type Client = { id: string; name: string }
type Payment = { id: string; invoice_id: string; payment_type: 'DEPOSIT' | 'BALANCE'; amount: number; status: string; payment_reference: string | null; notes: string | null; verified_at: string | null }

const route = useRoute()
const managerOnly = computed(() => route.meta.role === 'manager')
const invoices = ref<Invoice[]>([])
const clients = ref<Client[]>([])
const search = ref('')
const error = ref('')
const message = ref('')
const currentProfileId = ref('')

const expandedId = ref<string | null>(null)
const paymentsByInvoice = ref<Record<string, Payment[]>>({})
const busyInvoiceId = ref<string | null>(null)

const showPaymentForm = ref(false)
const paymentForm = ref({ payment_type: 'DEPOSIT' as 'DEPOSIT' | 'BALANCE', amount: 0, payment_reference: '', notes: '' })
const paymentFormError = ref('')

const filteredInvoices = computed(() => invoices.value.filter((invoice) => {
  const clientName = clients.value.find((client) => client.id === invoice.client_id)?.name ?? ''
  return `${invoice.invoice_number} ${clientName} ${invoice.payment_status}`.toLowerCase().includes(search.value.toLowerCase().trim())
}))

function verifiedTotal(invoiceId: string) {
  return (paymentsByInvoice.value[invoiceId] ?? [])
    .filter((p) => p.status === 'VERIFIED')
    .reduce((sum, p) => sum + Number(p.amount), 0)
}
function remainingBalance(invoice: Invoice) {
  return Math.max(Number(invoice.total_amount) - verifiedTotal(invoice.id), 0)
}

async function load() {
  const [invoiceResult, clientResult] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, client_id, quotation_id, total_amount, deposit_amount, balance_amount, payment_status').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name'),
  ])
  if (invoiceResult.error) error.value = invoiceResult.error.message
  invoices.value = invoiceResult.data ?? []
  clients.value = clientResult.data ?? []

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    currentProfileId.value = profile?.id ?? ''
  }
}

async function toggleExpand(invoice: Invoice) {
  if (expandedId.value === invoice.id) {
    expandedId.value = null
    return
  }
  expandedId.value = invoice.id
  showPaymentForm.value = false
  if (!paymentsByInvoice.value[invoice.id]) {
    await loadPayments(invoice.id)
  }
}

async function loadPayments(invoiceId: string) {
  const { data, error: loadError } = await supabase
    .from('payments')
    .select('id, invoice_id, payment_type, amount, status, payment_reference, notes, verified_at')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })
  if (loadError) { error.value = loadError.message; return }
  paymentsByInvoice.value[invoiceId] = data ?? []
}

function openPaymentForm(invoice: Invoice) {
  const hasDepositVerified = (paymentsByInvoice.value[invoice.id] ?? []).some((p) => p.payment_type === 'DEPOSIT' && p.status === 'VERIFIED')
  paymentForm.value = {
    payment_type: hasDepositVerified ? 'BALANCE' : 'DEPOSIT',
    amount: 0,
    payment_reference: '',
    notes: '',
  }
  paymentFormError.value = ''
  showPaymentForm.value = true
}

async function submitPayment(invoice: Invoice) {
  if (paymentForm.value.amount <= 0) { paymentFormError.value = 'Enter an amount greater than zero.'; return }

  const { error: insertError } = await supabase.from('payments').insert({
    invoice_id: invoice.id,
    payment_type: paymentForm.value.payment_type,
    amount: paymentForm.value.amount,
    status: 'PENDING',
    payment_reference: paymentForm.value.payment_reference || null,
    notes: paymentForm.value.notes || null,
  })
  if (insertError) { paymentFormError.value = insertError.message; return }

  showPaymentForm.value = false
  message.value = 'Payment recorded — pending verification.'
  await loadPayments(invoice.id)
}

async function verifyPayment(invoice: Invoice, payment: Payment) {
  if (!window.confirm(`Confirm ${payment.amount} received and verified for ${invoice.invoice_number}?`)) return

  busyInvoiceId.value = invoice.id
  const { error: verifyError } = await supabase
    .from('payments')
    .update({ status: 'VERIFIED', verified_by: currentProfileId.value, verified_at: new Date().toISOString() })
    .eq('id', payment.id)

  if (verifyError) { error.value = verifyError.message; busyInvoiceId.value = null; return }

  await loadPayments(invoice.id)
  await syncInvoiceStatus(invoice)
  busyInvoiceId.value = null
}

async function rejectPayment(invoice: Invoice, payment: Payment) {
  if (!window.confirm(`Reject this ${payment.payment_type.toLowerCase()} record of ${payment.amount}?`)) return
  const { error: rejectError } = await supabase.from('payments').update({ status: 'REJECTED' }).eq('id', payment.id)
  if (rejectError) { error.value = rejectError.message; return }
  await loadPayments(invoice.id)
}

function generateJobNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 900 + 100)
  return `JOB-${stamp}-${rand}`
}

async function ensureJobCreated(invoice: Invoice) {
  const { data: existingJob } = await supabase.from('jobs').select('id').eq('invoice_id', invoice.id).maybeSingle()
  if (existingJob) return

  if (!invoice.quotation_id) {
    error.value = `${invoice.invoice_number} has no linked quotation — could not create job automatically.`
    return
  }

  const { data: quotation, error: quotationError } = await supabase
    .from('quotations')
    .select('client_id, package_id, event_type, event_date, event_start_time, event_end_time, event_location')
    .eq('id', invoice.quotation_id)
    .single()

  if (quotationError || !quotation) {
    error.value = `Could not load quotation details to create job for ${invoice.invoice_number}.`
    return
  }

  const { error: jobError } = await supabase.from('jobs').insert({
    job_number: generateJobNumber(),
    client_id: quotation.client_id,
    package_id: quotation.package_id,
    event_type: quotation.event_type,
    event_date: quotation.event_date,
    event_start_time: quotation.event_start_time,
    event_end_time: quotation.event_end_time,
    event_location: quotation.event_location,
    invoice_id: invoice.id,
    quotation_id: invoice.quotation_id,
    created_by: currentProfileId.value,
    status: 'RELEASED',
  })

  if (jobError) { error.value = jobError.message; return }
  message.value = `${invoice.invoice_number} deposit verified — job sent to Jobs setup.`
}

async function syncJobStatus(invoice: Invoice, targetStatus: string) {
  const { data: job } = await supabase.from('jobs').select('id, status').eq('invoice_id', invoice.id).maybeSingle()
  if (!job) return
  if (targetStatus === 'BALANCE_VERIFIED' && job.status !== 'BALANCE_PENDING') return

  const { error: jobStatusError } = await supabase.from('jobs').update({ status: targetStatus }).eq('id', job.id)
  if (jobStatusError) { error.value = jobStatusError.message; return }
  message.value = `${invoice.invoice_number}'s job moved to ${targetStatus.replaceAll('_', ' ').toLowerCase()}.`
}

async function syncInvoiceStatus(invoice: Invoice) {
  const payments = paymentsByInvoice.value[invoice.id] ?? []
  const verified = payments.filter((p) => p.status === 'VERIFIED')
  const verifiedDeposit = verified.filter((p) => p.payment_type === 'DEPOSIT').reduce((sum, p) => sum + Number(p.amount), 0)
  const hasVerifiedBalance = verified.some((p) => p.payment_type === 'BALANCE')
  const totalVerified = verified.reduce((sum, p) => sum + Number(p.amount), 0)

  let nextStatus = invoice.payment_status
  if (totalVerified <= 0) nextStatus = 'DEPOSIT_PENDING'
  else if (totalVerified >= Number(invoice.total_amount)) nextStatus = 'PAID'
  else if (verifiedDeposit < Number(invoice.deposit_amount)) nextStatus = 'DEPOSIT_PENDING'
  else if (!hasVerifiedBalance) nextStatus = 'DEPOSIT_VERIFIED'
  else nextStatus = 'BALANCE_PENDING'

  if (nextStatus !== invoice.payment_status) {
    const { error: statusError } = await supabase.from('invoices').update({ payment_status: nextStatus }).eq('id', invoice.id)
    if (statusError) { error.value = statusError.message; return }

    if (nextStatus === 'DEPOSIT_VERIFIED' || nextStatus === 'PAID') {
      await ensureJobCreated(invoice)
    } else {
      message.value = `${invoice.invoice_number} is now ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`
    }
    if (nextStatus === 'PAID') {
      await syncJobStatus(invoice, 'BALANCE_VERIFIED')
    }
    await load()
  }
}

function download(invoice: Invoice) {
  const document = new jsPDF()
  document.setFontSize(22)
  document.text('STORYTELLER', 20, 25)
  document.setFontSize(12)
  document.text(invoice.invoice_number, 150, 27)
  document.setFontSize(11)
  document.text('Total', 120, 100)
  document.text(Number(invoice.total_amount).toFixed(2), 165, 100)
  document.save(`${invoice.invoice_number}.pdf`)
}

async function cancel(invoice: Invoice) {
  if (!window.confirm(`Cancel ${invoice.invoice_number}?`)) return
  const { error: cancelError } = await supabase.rpc('manager_cancel_record', { record_type: 'INVOICE', record_id: invoice.id })
  if (cancelError) error.value = cancelError.message
  else { message.value = 'Invoice cancelled.'; await load() }
}

onMounted(load)
</script>

<template>
  <div class="invoices-view">
    <div class="welcome-row">
      <div>
        <p class="eyebrow">Billing workflow</p>
        <h2>Invoices</h2>
        <p class="muted">Track deposits, balances, and payment verification.</p>
      </div>
    </div>

    <section class="panel invoice-list-panel">
      <div class="invoice-toolbar">
        <div class="search-wrap">
          <Search :size="17" />
          <input v-model="search" placeholder="Search invoices" aria-label="Search invoices" />
        </div>
        <span class="client-count">{{ filteredInvoices.length }} of {{ invoices.length }} invoices</span>
      </div>

      <p v-if="error" class="form-message form-message--error">{{ error }}</p>
      <p v-if="message" class="form-message">{{ message }}</p>

      <div v-if="filteredInvoices.length" class="invoice-list">
        <div v-for="invoice in filteredInvoices" :key="invoice.id" class="invoice-block">
          <article class="quotation-row invoice-row" @click="toggleExpand(invoice)">
            <div class="quote-icon"><FileText :size="17" /></div>
            <div class="quote-info">
              <strong>{{ invoice.invoice_number }}</strong>
              <span>{{ clients.find((client) => client.id === invoice.client_id)?.name || 'Client' }}</span>
            </div>
            <strong class="quote-total">{{ Number(invoice.total_amount).toFixed(2) }}</strong>
            <span class="status-badge" :class="`status-badge--${invoice.payment_status.toLowerCase()}`">{{ invoice.payment_status.replaceAll('_', ' ') }}</span>

            <div class="client-actions" @click.stop>
              <button class="icon-button" type="button" title="Download invoice PDF" @click="download(invoice)"><Download :size="16" /></button>
              <button v-if="managerOnly && invoice.payment_status !== 'CANCELLED'" class="text-button danger-button" type="button" @click="cancel(invoice)">Cancel</button>
              <button class="icon-button" type="button" :aria-label="expandedId === invoice.id ? 'Collapse' : 'Expand'" @click="toggleExpand(invoice)">
                <component :is="expandedId === invoice.id ? ChevronUp : ChevronDown" :size="16" />
              </button>
            </div>
          </article>

          <section v-if="expandedId === invoice.id" class="payment-panel">
            <div class="payment-summary">
              <div><span>Total</span><strong>RM {{ Number(invoice.total_amount).toFixed(2) }}</strong></div>
              <div><span>Verified so far</span><strong>RM {{ verifiedTotal(invoice.id).toFixed(2) }}</strong></div>
              <div><span>Remaining balance</span><strong>RM {{ remainingBalance(invoice).toFixed(2) }}</strong></div>
            </div>

            <div v-if="paymentsByInvoice[invoice.id]?.length" class="payment-history">
              <div v-for="payment in paymentsByInvoice[invoice.id]" :key="payment.id" class="payment-row">
                <span class="payment-type" :class="`payment-type--${payment.payment_type.toLowerCase()}`">{{ payment.payment_type }}</span>
                <span class="payment-amount">RM {{ Number(payment.amount).toFixed(2) }}</span>
                <span v-if="payment.payment_reference" class="payment-ref muted">{{ payment.payment_reference }}</span>
                <span class="payment-status" :class="`payment-status--${payment.status.toLowerCase()}`">{{ payment.status }}</span>
                <span v-if="payment.status === 'PENDING'" class="payment-actions">
                  <button class="text-button" type="button" :disabled="busyInvoiceId === invoice.id" @click="verifyPayment(invoice, payment)">Verify</button>
                  <button class="text-button danger-button" type="button" @click="rejectPayment(invoice, payment)">Reject</button>
                </span>
              </div>
            </div>
            <p v-else class="muted payment-empty">No payments recorded yet.</p>

            <div v-if="!showPaymentForm">
              <button class="text-button" type="button" @click="openPaymentForm(invoice)"><Plus :size="15" /> Record payment</button>
            </div>

            <form v-else class="payment-form" @submit.prevent="submitPayment(invoice)">
              <div class="form-row form-row--3">
                <label>
                  <span>Type</span>
                  <select v-model="paymentForm.payment_type">
                    <option value="DEPOSIT">Deposit</option>
                    <option value="BALANCE">Balance</option>
                  </select>
                </label>
                <label>
                  <span>Amount (RM)</span>
                  <input v-model.number="paymentForm.amount" type="number" min="0.01" step="0.01" required />
                </label>
                <label>
                  <span>Reference</span>
                  <input v-model="paymentForm.payment_reference" placeholder="Receipt no. / txn ref" />
                </label>
              </div>
              <label>
                <span>Notes</span>
                <input v-model="paymentForm.notes" placeholder="Optional" />
              </label>
              <p v-if="paymentFormError" class="form-message form-message--error">{{ paymentFormError }}</p>
              <div class="payment-form-actions">
                <button class="text-button" type="button" @click="showPaymentForm = false">Cancel</button>
                <button class="primary-button" type="submit">Save payment</button>
              </div>
            </form>
          </section>
        </div>
      </div>
      <div v-else class="empty-state">
        <FileText :size="28" />
        <strong>{{ invoices.length ? 'No matching invoices' : 'No invoices yet' }}</strong>
        <span>{{ invoices.length ? 'Try another invoice number, client, or status.' : 'Accepted quotations can be converted into invoices.' }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.invoice-row {
  cursor: pointer;
}
.invoice-block {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.invoice-block:last-child {
  border-bottom: none;
}

.status-badge--deposit_pending, .status-badge--balance_pending {
  background: rgba(234, 179, 8, 0.15);
  color: #92730b;
}
.status-badge--deposit_verified, .status-badge--balance_verified {
  background: rgba(59, 130, 246, 0.15);
  color: #1d4ed8;
}
.status-badge--paid {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}
.status-badge--cancelled {
  background: rgba(0, 0, 0, 0.08);
  color: #666;
}

.payment-panel {
  padding: 0.85rem 1rem 1.1rem 3.2rem;
  background: rgba(0, 0, 0, 0.015);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.payment-summary {
  display: flex;
  gap: 1.75rem;
}
.payment-summary div {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.8rem;
}
.payment-summary span {
  color: var(--muted-color, #999);
}

.payment-history {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.payment-row {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  gap: 0.6rem;
  align-items: center;
  font-size: 0.82rem;
  padding: 0.35rem 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.07);
}
.payment-type {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
}
.payment-type--deposit {
  background: rgba(99, 102, 241, 0.12);
  color: #4338ca;
}
.payment-type--balance {
  background: rgba(20, 184, 166, 0.12);
  color: #0f766e;
}
.payment-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.payment-status {
  font-size: 0.72rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
}
.payment-status--pending {
  background: rgba(234, 179, 8, 0.15);
  color: #92730b;
}
.payment-status--verified {
  background: rgba(34, 197, 94, 0.15);
  color: #15803d;
}
.payment-status--rejected {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}
.payment-actions {
  display: flex;
  gap: 0.4rem;
}
.payment-empty {
  font-size: 0.82rem;
}

.payment-form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 0.75rem;
  background: #fff;
}
.payment-form label {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
}
.form-row {
  display: grid;
  gap: 0.5rem;
}
.form-row--3 {
  grid-template-columns: repeat(3, 1fr);
}
.payment-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>