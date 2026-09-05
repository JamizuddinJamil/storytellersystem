<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronDown, ChevronUp, Download, FileText, Plus, Search } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { jsPDF } from 'jspdf'
import { supabase } from '../lib/supabase'

type Invoice = { id: string; invoice_number: string; client_id: string; quotation_id: string | null; total_amount: number; deposit_amount: number; balance_amount: number; payment_status: string }
type Client = { id: string; name: string }
type Payment = { id: string; invoice_id: string; payment_type: 'DEPOSIT' | 'BALANCE'; amount: number; status: string; payment_reference: string | null; notes: string | null; verified_at: string | null }
type AlaCarteItem = { id: string; name: string; price: number; freelancer_role: string | null }

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

// Add extra item (upsell) to an existing invoice
const alaCarteItems = ref<AlaCarteItem[]>([])
const showExtraItemForm = ref<Record<string, boolean>>({})
const extraItemSearch = ref('')
const extraItemForm = ref({ mode: 'ALA_CARTE' as 'ALA_CARTE' | 'CUSTOM', selectedId: '', customName: '', customPrice: 0, quantity: 1 })
const extraItemFormError = ref('')
const extraItemBusy = ref<string | null>(null)

const filteredAlaCarteItems = computed(() => {
  const query = extraItemSearch.value.toLowerCase().trim()
  return alaCarteItems.value.filter((item) => !query || item.name.toLowerCase().includes(query))
})

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
  const [invoiceResult, clientResult, alaCarteResult] = await Promise.all([
    supabase.from('invoices').select('id, invoice_number, client_id, quotation_id, total_amount, deposit_amount, balance_amount, payment_status').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name'),
    supabase.from('package_items').select('id, name, price, freelancer_role').is('package_id', null).eq('item_type', 'ALA_CARTE').order('name'),
  ])
  if (invoiceResult.error) error.value = invoiceResult.error.message
  invoices.value = invoiceResult.data ?? []
  clients.value = clientResult.data ?? []
  alaCarteItems.value = alaCarteResult.data ?? []

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    currentProfileId.value = profile?.id ?? ''
  }
}

function openExtraItemForm(invoice: Invoice) {
  showExtraItemForm.value[invoice.id] = true
  extraItemSearch.value = ''
  extraItemFormError.value = ''
  extraItemForm.value = { mode: 'ALA_CARTE', selectedId: '', customName: '', customPrice: 0, quantity: 1 }
}

async function submitExtraItem(invoice: Invoice) {
  if (!invoice.quotation_id) { extraItemFormError.value = 'This invoice has no linked quotation.'; return }

  let name = ''
  let unitPrice = 0
  let packageItemId: string | null = null

  if (extraItemForm.value.mode === 'ALA_CARTE') {
    const item = alaCarteItems.value.find((i) => i.id === extraItemForm.value.selectedId)
    if (!item) { extraItemFormError.value = 'Pick a service from the list.'; return }
    name = item.name
    unitPrice = Number(item.price)
    packageItemId = item.id
  } else {
    if (!extraItemForm.value.customName.trim()) { extraItemFormError.value = 'Enter an item name.'; return }
    if (extraItemForm.value.customPrice <= 0) { extraItemFormError.value = 'Enter a price greater than zero.'; return }
    name = extraItemForm.value.customName.trim()
    unitPrice = extraItemForm.value.customPrice
  }

  const quantity = Math.max(extraItemForm.value.quantity, 1)
  const addedAmount = quantity * unitPrice

  extraItemBusy.value = invoice.id
  extraItemFormError.value = ''

  const { data: insertedItem, error: itemError } = await supabase.from('quotation_items').insert({
    quotation_id: invoice.quotation_id,
    package_item_id: packageItemId,
    name,
    quantity,
    unit_price: unitPrice,
  }).select('id').single()
  if (itemError || !insertedItem) { extraItemFormError.value = itemError?.message ?? 'Could not add item.'; extraItemBusy.value = null; return }

  const { error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update({
      total_amount: Number(invoice.total_amount) + addedAmount,
      balance_amount: Number(invoice.balance_amount) + addedAmount,
    })
    .eq('id', invoice.id)
  if (invoiceUpdateError) { extraItemFormError.value = invoiceUpdateError.message; extraItemBusy.value = null; return }

  // Upsell commission for the salesman who owns the original quotation (7%, matches base rate).
  const { data: quotation } = await supabase.from('quotations').select('created_by').eq('id', invoice.quotation_id).maybeSingle()
  const { data: job } = await supabase.from('jobs').select('id').eq('invoice_id', invoice.id).maybeSingle()
  if (quotation?.created_by && job?.id) {
    await supabase.from('salesman_commissions').insert({
      job_id: job.id,
      salesman_id: quotation.created_by,
      amount: Math.max(addedAmount * 0.07, 0.01),
      commission_type: 'UPSELL',
      quotation_item_id: insertedItem.id,
    })
  }

  showExtraItemForm.value[invoice.id] = false
  extraItemBusy.value = null
  message.value = `${name} added to ${invoice.invoice_number} (RM ${addedAmount.toFixed(2)}).`
  await load()
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

// ── Company details — placeholders, edit to real business info ──
const COMPANY_INFO = {
  name: 'STORYTELLERSTUDIOMY',
  addressLines: ['[Company address line 1]', '[Company address line 2]'],
  email: '[company@email.com]',
  phone: '[+60 1X-XXX XXXX]',
  bankName: '[Bank Name]',
  bankAccountNumber: '[0000 0000 0000]',
  bankAccountHolder: '[Account Holder Name]',
}

async function download(invoice: Invoice) {
  const client = clients.value.find((c) => c.id === invoice.client_id)
  const items = paymentsByInvoice.value[invoice.id] ?? (await (async () => {
    const { data } = await supabase.from('payments').select('id, invoice_id, payment_type, amount, status, payment_reference, notes, verified_at').eq('invoice_id', invoice.id).order('created_at', { ascending: false })
    return data ?? []
  })())
  const verifiedPaid = items.filter((p) => p.status === 'VERIFIED').reduce((sum, p) => sum + Number(p.amount), 0)
  const balanceDue = Math.max(Number(invoice.total_amount) - verifiedPaid, 0)

  let quotationItems: { name: string; quantity: number; unit_price: number; total_price: number | null }[] = []
  if (invoice.quotation_id) {
    const { data } = await supabase.from('quotation_items').select('name, quantity, unit_price, total_price').eq('quotation_id', invoice.quotation_id)
    quotationItems = data ?? []
  }

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 20
  let y = 22

  // Header — company
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(COMPANY_INFO.name, marginX, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(110)
  COMPANY_INFO.addressLines.forEach((line) => { y += 5; doc.text(line, marginX, y) })
  y += 5
  doc.text(`${COMPANY_INFO.email}  ·  ${COMPANY_INFO.phone}`, marginX, y)
  doc.setTextColor(0)

  // Header — invoice meta (right aligned)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('INVOICE', pageWidth - marginX, 22, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(invoice.invoice_number, pageWidth - marginX, 29, { align: 'right' })
  doc.setTextColor(110)
  doc.text(invoice.payment_status.replaceAll('_', ' '), pageWidth - marginX, 35, { align: 'right' })
  doc.setTextColor(0)

  y = Math.max(y, 35) + 10
  doc.setDrawColor(220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  // Bill to
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text('BILL TO', marginX, y)
  doc.setTextColor(0)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  y += 6
  doc.text(client?.name ?? 'Client', marginX, y)
  doc.setFont('helvetica', 'normal')

  y += 12

  // Line items table
  if (quotationItems.length) {
    doc.setFillColor(245, 245, 245)
    doc.rect(marginX, y - 5, pageWidth - marginX * 2, 8, 'F')
    doc.setFontSize(9)
    doc.setTextColor(90)
    doc.text('ITEM', marginX + 2, y)
    doc.text('QTY', pageWidth - marginX - 70, y, { align: 'right' })
    doc.text('UNIT PRICE', pageWidth - marginX - 35, y, { align: 'right' })
    doc.text('TOTAL', pageWidth - marginX - 2, y, { align: 'right' })
    doc.setTextColor(0)
    y += 9

    doc.setFontSize(10)
    for (const item of quotationItems) {
      const lineTotal = item.total_price ?? item.quantity * item.unit_price
      doc.text(item.name, marginX + 2, y, { maxWidth: pageWidth - marginX * 2 - 90 })
      doc.text(String(item.quantity), pageWidth - marginX - 70, y, { align: 'right' })
      doc.text(Number(item.unit_price).toFixed(2), pageWidth - marginX - 35, y, { align: 'right' })
      doc.text(Number(lineTotal).toFixed(2), pageWidth - marginX - 2, y, { align: 'right' })
      y += 7
    }
    y += 3
    doc.setDrawColor(220)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 8
  }

  // Totals summary (right-aligned block)
  const summaryX = pageWidth - marginX - 60
  const rows: [string, number, boolean?][] = [
    ['Total amount', Number(invoice.total_amount)],
    ['Deposit required', Number(invoice.deposit_amount)],
    ['Amount paid (verified)', verifiedPaid],
    ['Balance due', balanceDue, true],
  ]
  for (const [label, value, emphasis] of rows) {
    doc.setFontSize(emphasis ? 12 : 10)
    doc.setFont('helvetica', emphasis ? 'bold' : 'normal')
    doc.text(label, summaryX, y)
    doc.text(`RM ${value.toFixed(2)}`, pageWidth - marginX - 2, y, { align: 'right' })
    y += emphasis ? 8 : 7
  }
  doc.setFont('helvetica', 'normal')

  y += 6
  doc.setDrawColor(220)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 10

  // Banking info
  doc.setFontSize(9)
  doc.setTextColor(110)
  doc.text('PAYMENT DETAILS', marginX, y)
  doc.setTextColor(0)
  y += 6
  doc.setFontSize(10)
  doc.text(`Bank: ${COMPANY_INFO.bankName}`, marginX, y); y += 6
  doc.text(`Account number: ${COMPANY_INFO.bankAccountNumber}`, marginX, y); y += 6
  doc.text(`Account holder: ${COMPANY_INFO.bankAccountHolder}`, marginX, y)

  y += 16
  doc.setFontSize(8)
  doc.setTextColor(140)
  doc.text('Thank you for your business. Please quote the invoice number as payment reference.', marginX, y)

  doc.save(`${invoice.invoice_number}.pdf`)
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

            <div class="extra-item-block">
              <div v-if="!showExtraItemForm[invoice.id]">
                <button class="text-button" type="button" @click="openExtraItemForm(invoice)"><Plus :size="15" /> Add extra item</button>
              </div>

              <form v-else class="payment-form" @submit.prevent="submitExtraItem(invoice)">
                <div class="form-row form-row--3">
                  <label>
                    <span>Source</span>
                    <select v-model="extraItemForm.mode">
                      <option value="ALA_CARTE">A-La-Carte service</option>
                      <option value="CUSTOM">Custom item</option>
                    </select>
                  </label>
                  <label>
                    <span>Quantity</span>
                    <input v-model.number="extraItemForm.quantity" type="number" min="1" />
                  </label>
                  <label v-if="extraItemForm.mode === 'CUSTOM'">
                    <span>Price (RM)</span>
                    <input v-model.number="extraItemForm.customPrice" type="number" min="0.01" step="0.01" />
                  </label>
                </div>

                <label v-if="extraItemForm.mode === 'CUSTOM'">
                  <span>Item name</span>
                  <input v-model="extraItemForm.customName" placeholder="Describe the extra work" />
                </label>

                <template v-else>
                  <input v-model="extraItemSearch" class="ala-carte-search" type="text" placeholder="Search services (e.g. subtitle, colour grading, revision)" />
                  <div class="ala-carte-list">
                    <label v-for="item in filteredAlaCarteItems" :key="item.id" class="ala-carte-option">
                      <input v-model="extraItemForm.selectedId" type="radio" :value="item.id" name="extra-item-pick" />
                      <span>{{ item.name }}</span>
                      <em>RM {{ Number(item.price).toFixed(2) }}</em>
                    </label>
                    <p v-if="!filteredAlaCarteItems.length" class="muted">No matching service.</p>
                  </div>
                </template>

                <p v-if="extraItemFormError" class="form-message form-message--error">{{ extraItemFormError }}</p>
                <div class="payment-form-actions">
                  <button class="text-button" type="button" @click="showExtraItemForm[invoice.id] = false">Cancel</button>
                  <button class="primary-button" type="submit" :disabled="extraItemBusy === invoice.id">{{ extraItemBusy === invoice.id ? 'Adding...' : 'Add to invoice' }}</button>
                </div>
              </form>
            </div>
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

.extra-item-block {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}
.ala-carte-search {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 0.82rem;
  width: 100%;
}
.ala-carte-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.ala-carte-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.4rem;
  font-size: 0.82rem;
  border-radius: 6px;
  cursor: pointer;
}
.ala-carte-option:hover {
  background: rgba(0, 0, 0, 0.03);
}
.ala-carte-option em {
  margin-left: auto;
  font-style: normal;
  color: var(--muted-color, #999);
}
</style>