<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileText, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

type Quotation = { id: string; quotation_number: string; client_id: string; event_type: string; event_date: string; total: number; deposit_amount: number; balance_amount: number; status: string }
type Client = { id: string; name: string }
type PackageItem = { id: string; name: string; price: number }
type PackageRecord = { id: string; name: string; description: string | null; base_price: number; is_active: boolean; package_items: PackageItem[] }
type LineItem = { package_item_id: string | null; name: string; quantity: number; unit_price: number }

const route = useRoute()
const managerOnly = computed(() => route.meta.role === 'manager')
const quotations = ref<Quotation[]>([])
const clients = ref<Client[]>([])
const packages = ref<PackageRecord[]>([])
const error = ref('')
const message = ref('')

// New quotation modal
const showModal = ref(false)
const saving = ref(false)
const formError = ref('')
const currentProfileId = ref('')
const editingQuotationId = ref('')
const editingQuotationNumber = ref('')
const form = ref({
  client_id: '',
  event_type: '',
  event_date: '',
  event_start_time: '',
  event_end_time: '',
  event_location: '',
  package_id: '',
  discount: 0,
  deposit_amount: 0,
  expiry_date: '',
  terms: '',
})
const lineItems = ref<LineItem[]>([])
const availableAddOns = computed<PackageItem[]>(() => {
  const pkg = packages.value.find((p) => p.id === form.value.package_id)
  if (!pkg) return []
  const usedIds = new Set(lineItems.value.map((line) => line.package_item_id).filter(Boolean))
  return pkg.package_items.filter((item) => !usedIds.has(item.id))
})
const subtotal = computed(() => lineItems.value.reduce((sum, line) => sum + line.quantity * line.unit_price, 0))
const total = computed(() => Math.max(subtotal.value - Number(form.value.discount || 0), 0))
const balance = computed(() => Math.max(total.value - Number(form.value.deposit_amount || 0), 0))

function openModal() {
  editingQuotationId.value = ''
  editingQuotationNumber.value = ''
  form.value = {
    client_id: '', event_type: '', event_date: '', event_start_time: '', event_end_time: '',
    event_location: '', package_id: '', discount: 0, deposit_amount: 0, expiry_date: '', terms: '',
  }
  lineItems.value = []
  formError.value = ''
  showModal.value = true
}

async function openEdit(quote: Quotation) {
  formError.value = ''
  const [quoteResult, itemsResult] = await Promise.all([
    supabase.from('quotations').select('*').eq('id', quote.id).single(),
    supabase.from('quotation_items').select('package_item_id, name, quantity, unit_price').eq('quotation_id', quote.id),
  ])

  if (quoteResult.error || !quoteResult.data) {
    error.value = quoteResult.error?.message ?? 'Could not load quotation.'
    return
  }

  const q = quoteResult.data
  editingQuotationId.value = q.id
  editingQuotationNumber.value = q.quotation_number
  form.value = {
    client_id: q.client_id ?? '',
    event_type: q.event_type ?? '',
    event_date: q.event_date ?? '',
    event_start_time: q.event_start_time ?? '',
    event_end_time: q.event_end_time ?? '',
    event_location: q.event_location ?? '',
    package_id: q.package_id ?? '',
    discount: Number(q.discount ?? 0),
    deposit_amount: Number(q.deposit_amount ?? 0),
    expiry_date: q.expiry_date ?? '',
    terms: q.terms ?? '',
  }
  lineItems.value = (itemsResult.data ?? []).map((item) => ({
    package_item_id: item.package_item_id,
    name: item.name,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
  }))
  showModal.value = true
}

function closeModal() {
  if (saving.value) return
  showModal.value = false
}

function onPackageChange() {
  const pkg = packages.value.find((p) => p.id === form.value.package_id)
  lineItems.value = []
  if (!pkg) return
  lineItems.value.push({ package_item_id: null, name: `${pkg.name} package`, quantity: 1, unit_price: Number(pkg.base_price) })
  for (const item of pkg.package_items) {
    lineItems.value.push({ package_item_id: item.id, name: item.name, quantity: 1, unit_price: Number(item.price) })
  }
}
function addAddOn(item: PackageItem) {
  lineItems.value.push({ package_item_id: item.id, name: item.name, quantity: 1, unit_price: Number(item.price) })
}
function addCustomItem() {
  lineItems.value.push({ package_item_id: null, name: '', quantity: 1, unit_price: 0 })
}
function removeLineItem(index: number) {
  lineItems.value.splice(index, 1)
}

function generateQuotationNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 900 + 100)
  return `QT-${stamp}-${rand}`
}

function validateForm() {
  if (!currentProfileId.value) return 'Your profile is still loading — try again in a moment.'
  if (!form.value.client_id || !form.value.event_type || !form.value.event_date) {
    return 'Please fill in client, event type and event date.'
  }
  if (!lineItems.value.length) return 'Add at least one item (pick a package or add a custom item).'
  if (lineItems.value.some((line) => !line.name.trim())) return 'Every item needs a name.'
  return ''
}

async function submitQuotation(status: 'DRAFT' | 'SENT') {
  if (saving.value) return
  const validationError = validateForm()
  if (validationError) { formError.value = validationError; return }

  saving.value = true
  formError.value = ''
  try {
    const isEditing = Boolean(editingQuotationId.value)
    const payload = {
      client_id: form.value.client_id,
      package_id: form.value.package_id || null,
      event_type: form.value.event_type,
      event_date: form.value.event_date,
      event_start_time: form.value.event_start_time || null,
      event_end_time: form.value.event_end_time || null,
      event_location: form.value.event_location || null,
      subtotal: subtotal.value,
      discount: Number(form.value.discount || 0),
      total: total.value,
      deposit_amount: Number(form.value.deposit_amount || 0),
      balance_amount: balance.value,
      status,
      expiry_date: form.value.expiry_date || null,
      terms: form.value.terms || null,
    }

    let quotationId = editingQuotationId.value
    let quotationNumber = editingQuotationNumber.value

    if (isEditing) {
      const { error: updateError } = await supabase.from('quotations').update(payload).eq('id', quotationId)
      if (updateError) { formError.value = updateError.message; return }

      const { error: deleteItemsError } = await supabase.from('quotation_items').delete().eq('quotation_id', quotationId)
      if (deleteItemsError) { formError.value = deleteItemsError.message; return }
    } else {
      quotationNumber = generateQuotationNumber()
      const { data: inserted, error: insertError } = await supabase
        .from('quotations')
        .insert({ ...payload, quotation_number: quotationNumber, created_by: currentProfileId.value })
        .select('id, quotation_number')
        .single()

      if (insertError || !inserted) {
        formError.value = insertError?.message ?? 'Could not create quotation.'
        return
      }
      quotationId = inserted.id
      quotationNumber = inserted.quotation_number
    }

    const itemsPayload = lineItems.value.map((line) => ({
      quotation_id: quotationId,
      package_item_id: line.package_item_id,
      name: line.name.trim(),
      quantity: line.quantity,
      unit_price: line.unit_price,
    }))
    const { error: itemsError } = await supabase.from('quotation_items').insert(itemsPayload)
    if (itemsError) { formError.value = itemsError.message; return }

    showModal.value = false
    message.value = status === 'SENT' ? 'Quotation sent.' : 'Quotation saved as draft.'

    if (status === 'SENT') {
      const client = clients.value.find((c) => c.id === form.value.client_id)
      printQuotation(quotationNumber, client?.name ?? 'Client')
    }

    await load()
  } finally {
    saving.value = false
  }
}

function printQuotation(quotationNumber: string, clientName: string) {
  const win = window.open('', '_blank', 'width=800,height=900')
  if (!win) return

  const rows = lineItems.value.map((line) => `
    <tr>
      <td>${line.name}</td>
      <td style="text-align:center">${line.quantity}</td>
      <td style="text-align:right">${line.unit_price.toFixed(2)}</td>
      <td style="text-align:right">${(line.quantity * line.unit_price).toFixed(2)}</td>
    </tr>`).join('')

  win.document.write(`
    <html>
      <head>
        <title>${quotationNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #1a1a1a; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
          th { text-align: left; background: #f5f5f5; }
          .totals { margin-top: 16px; width: 260px; margin-left: auto; font-size: 13px; }
          .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
          .totals .grand { font-weight: bold; border-top: 1px solid #333; padding-top: 8px; }
        </style>
      </head>
      <body>
        <h1>Quotation ${quotationNumber}</h1>
        <p>Client: ${clientName}</p>
        <p>Event: ${form.value.event_type} · ${form.value.event_date}</p>
        <table>
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>${subtotal.value.toFixed(2)}</span></div>
          <div><span>Discount</span><span>${Number(form.value.discount || 0).toFixed(2)}</span></div>
          <div class="grand"><span>Total</span><span>${total.value.toFixed(2)}</span></div>
          <div><span>Deposit</span><span>${Number(form.value.deposit_amount || 0).toFixed(2)}</span></div>
          <div><span>Balance</span><span>${balance.value.toFixed(2)}</span></div>
        </div>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  win.onload = () => win.print()
}

function generateInvoiceNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.floor(Math.random() * 900 + 100)
  return `INV-${stamp}-${rand}`
}

async function acceptQuotation(quote: Quotation) {
  if (!window.confirm(`Mark ${quote.quotation_number} as accepted by client and create an invoice?`)) return

  const { error: invoiceError } = await supabase.from('invoices').insert({
    invoice_number: generateInvoiceNumber(),
    quotation_id: quote.id,
    client_id: quote.client_id,
    total_amount: quote.total,
    deposit_amount: quote.deposit_amount,
    balance_amount: quote.balance_amount,
    payment_status: quote.deposit_amount > 0 ? 'DEPOSIT_PENDING' : 'BALANCE_PENDING',
  })
  if (invoiceError) { error.value = invoiceError.message; return }

  const { error: statusError } = await supabase.from('quotations').update({ status: 'CONVERTED' }).eq('id', quote.id)
  if (statusError) { error.value = statusError.message; return }

  message.value = 'Invoice created.'
  await load()
}

async function load() {
  const [quoteResult, clientResult, packageResult] = await Promise.all([
    supabase.from('quotations').select('id, quotation_number, client_id, event_type, event_date, total, deposit_amount, balance_amount, status').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('packages').select('id, name, description, base_price, is_active, package_items(id, name, price)').eq('is_active', true).order('base_price'),
  ])
  if (quoteResult.error) error.value = quoteResult.error.message
  quotations.value = quoteResult.data ?? []
  clients.value = clientResult.data ?? []
  packages.value = (packageResult.data ?? []) as PackageRecord[]

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: myProfile } = await supabase.from('profiles').select('id').eq('auth_user_id', user.id).maybeSingle()
    currentProfileId.value = myProfile?.id ?? ''
  }
}
async function remove(quote: Quotation) { if (!window.confirm(`Delete ${quote.quotation_number}?`)) return; const { error: deleteError } = await supabase.from('quotations').delete().eq('id', quote.id); if (deleteError) error.value = deleteError.message; else { message.value = 'Quotation deleted.'; await load() } }
async function cancel(quote: Quotation) { if (!window.confirm(`Cancel ${quote.quotation_number}?`)) return; const { error: cancelError } = await supabase.rpc('manager_cancel_record', { record_type: 'QUOTATION', record_id: quote.id }); if (cancelError) error.value = cancelError.message; else { message.value = 'Quotation cancelled.'; await load() } }
onMounted(load)
</script>

<template>
  <div class="quotations-view">
    <div class="welcome-row">
      <div>
        <p class="eyebrow">Sales workflow</p>
        <h2>Quotations</h2>
        <p class="muted">Build a clear offer from a client and master package.</p>
      </div>
      <button class="primary-button" type="button" @click="openModal">
        <Plus :size="17" /> New quotation
      </button>
    </div>

    <section class="panel quotation-list-panel">
      <p v-if="error" class="form-message form-message--error">{{ error }}</p>
      <p v-if="message" class="form-message">{{ message }}</p>

      <div v-if="quotations.length" class="quotation-list">
        <article v-for="quote in quotations" :key="quote.id" class="quotation-row">
          <div class="quote-icon"><FileText :size="17" /></div>
          <div class="quote-info">
            <strong>{{ quote.quotation_number }}</strong>
            <span>{{ clients.find((client) => client.id === quote.client_id)?.name || 'Client' }} · {{ quote.event_type }}</span>
          </div>
          <span class="quote-date">{{ quote.event_date }}</span>
          <strong class="quote-total">{{ Number(quote.total).toFixed(2) }}</strong>
          <span class="status-badge">{{ quote.status }}</span>
          <div class="client-actions">
            <button v-if="quote.status === 'DRAFT'" class="icon-button" type="button" aria-label="Edit quotation" @click="openEdit(quote)"><Pencil :size="16" /></button>
            <button v-if="quote.status === 'DRAFT'" class="icon-button icon-button--danger" type="button" aria-label="Delete quotation" @click="remove(quote)"><Trash2 :size="16" /></button>
            <button v-if="quote.status === 'SENT'" class="text-button" type="button" @click="acceptQuotation(quote)">Client accepted</button>
            <button v-if="managerOnly && quote.status !== 'CANCELLED'" class="text-button danger-button" type="button" @click="cancel(quote)">Cancel</button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">
        <FileText :size="28" />
        <strong>No quotations yet</strong>
        <span>Create one from a client and package.</span>
      </div>
    </section>

    <!-- New quotation modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <section class="modal-panel">
        <header class="modal-header">
          <div>
            <p class="modal-eyebrow">Sales workflow · Draft or send in one step</p>
            <h3>{{ editingQuotationId ? `Edit ${editingQuotationNumber}` : 'New quotation' }}</h3>
          </div>
          <button class="icon-button" type="button" aria-label="Close" @click="closeModal"><X :size="18" /></button>
        </header>

        <form class="modal-form" @submit.prevent>
          <section class="modal-section">
            <p class="section-label">Client &amp; event</p>

            <label>
              <span>Client</span>
              <select v-model="form.client_id" required>
                <option value="" disabled>Select a client</option>
                <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.name }}</option>
              </select>
            </label>

            <label>
              <span>Event type</span>
              <input v-model="form.event_type" required placeholder="e.g. Wedding, Corporate" />
            </label>

            <div class="form-row form-row--3">
              <label>
                <span>Event date</span>
                <input v-model="form.event_date" required type="date" />
              </label>
              <label>
                <span>Start time</span>
                <input v-model="form.event_start_time" type="time" />
              </label>
              <label>
                <span>End time</span>
                <input v-model="form.event_end_time" type="time" />
              </label>
            </div>

            <label>
              <span>Location</span>
              <input v-model="form.event_location" placeholder="Venue / address" />
            </label>
          </section>

          <section class="modal-section">
            <p class="section-label">Package &amp; items</p>

            <label>
              <span>Package</span>
              <select v-model="form.package_id" @change="onPackageChange">
                <option value="">No package — custom quotation</option>
                <option v-for="pkg in packages" :key="pkg.id" :value="pkg.id">{{ pkg.name }} ({{ Number(pkg.base_price).toFixed(2) }})</option>
              </select>
            </label>

            <div class="item-editor">
              <div v-if="lineItems.length" class="line-item-list">
                <div class="line-item-row line-item-row--head">
                  <span>Item</span><span>Qty</span><span>Price</span><span>Total</span><span></span>
                </div>
                <div v-for="(line, index) in lineItems" :key="index" class="line-item-row">
                  <input v-model="line.name" placeholder="Item name" required />
                  <input v-model.number="line.quantity" type="number" min="1" />
                  <input v-model.number="line.unit_price" type="number" min="0" step="0.01" />
                  <span class="line-total">{{ (line.quantity * line.unit_price).toFixed(2) }}</span>
                  <button class="icon-button icon-button--ghost" type="button" aria-label="Remove item" @click="removeLineItem(index)"><X :size="14" /></button>
                </div>
              </div>
              <p v-else class="empty-hint">Pick a package above, or add a custom item below.</p>

              <div v-if="availableAddOns.length" class="addon-picker">
                <span class="addon-label">Add-ons from this package</span>
                <div class="addon-chips">
                  <button v-for="addOn in availableAddOns" :key="addOn.id" class="addon-chip" type="button" @click="addAddOn(addOn)">
                    <Plus :size="13" /> {{ addOn.name }} <em>+{{ Number(addOn.price).toFixed(2) }}</em>
                  </button>
                </div>
              </div>

              <button class="text-button add-custom-button" type="button" @click="addCustomItem"><Plus :size="15" /> Add custom item</button>
            </div>
          </section>

          <section class="modal-section">
            <p class="section-label">Pricing &amp; terms</p>

            <div class="form-row form-row--3">
              <label>
                <span>Discount (RM)</span>
                <input v-model.number="form.discount" type="number" min="0" step="0.01" />
              </label>
              <label>
                <span>Deposit (RM)</span>
                <input v-model.number="form.deposit_amount" type="number" min="0" step="0.01" />
              </label>
              <label>
                <span>Expiry date</span>
                <input v-model="form.expiry_date" type="date" />
              </label>
            </div>

            <label>
              <span>Terms</span>
              <textarea v-model="form.terms" rows="2" placeholder="Payment terms, notes..."></textarea>
            </label>
          </section>

          <div class="totals-card">
            <div class="totals-row"><span>Subtotal</span><strong>RM {{ subtotal.toFixed(2) }}</strong></div>
            <div class="totals-row"><span>Discount</span><strong>− RM {{ Number(form.discount || 0).toFixed(2) }}</strong></div>
            <div class="totals-row totals-row--grand"><span>Total</span><strong>RM {{ total.toFixed(2) }}</strong></div>
            <div class="totals-row"><span>Deposit</span><strong>RM {{ Number(form.deposit_amount || 0).toFixed(2) }}</strong></div>
            <div class="totals-row"><span>Balance due</span><strong>RM {{ balance.toFixed(2) }}</strong></div>
          </div>

          <p v-if="formError" class="form-message form-message--error">{{ formError }}</p>
        </form>

        <footer class="modal-footer">
          <button class="text-button" type="button" @click="closeModal">Cancel</button>
          <button class="secondary-button" type="button" :disabled="saving" @click="submitQuotation('DRAFT')">{{ saving ? 'Saving...' : 'Save as draft' }}</button>
          <button class="primary-button" type="button" :disabled="saving" @click="submitQuotation('SENT')">{{ saving ? 'Sending...' : 'Send quotation' }}</button>
        </footer>
      </section>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 15, 20, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1.25rem;
  animation: overlay-in 0.15s ease-out;
}

.modal-panel {
  width: 100%;
  max-width: 600px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--surface, #fff);
  border-radius: 14px;
  box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  animation: panel-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes panel-in {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  flex-shrink: 0;
}
.modal-header h3 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
}
.modal-eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted-color, #888);
}

.modal-form {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.section-label {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--muted-color, #999);
}

.modal-form label {
  display: flex;
  flex-direction: column;
  gap: 0.32rem;
  font-size: 0.85rem;
}
.modal-form input,
.modal-form select,
.modal-form textarea {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
  font-size: 0.88rem;
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}
.modal-form input:focus,
.modal-form select:focus,
.modal-form textarea:focus {
  outline: none;
  border-color: var(--accent-color, #6366f1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-color, #6366f1) 15%, transparent);
}

.form-row {
  display: grid;
  gap: 0.6rem;
}
.form-row--3 {
  grid-template-columns: repeat(3, 1fr);
}

.item-editor {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 0.85rem;
  background: rgba(0, 0, 0, 0.015);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.line-item-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.line-item-row {
  display: grid;
  grid-template-columns: 2fr 0.55fr 0.75fr 0.75fr auto;
  gap: 0.4rem;
  align-items: center;
}
.line-item-row--head {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted-color, #999);
  padding: 0 0.1rem;
}
.line-item-row--head span:nth-child(2),
.line-item-row--head span:nth-child(3),
.line-item-row--head span:nth-child(4) {
  text-align: right;
}
.line-item-row input {
  padding: 0.4rem 0.55rem;
  font-size: 0.85rem;
}
.line-total {
  text-align: right;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}
.icon-button--ghost {
  opacity: 0.55;
}
.icon-button--ghost:hover {
  opacity: 1;
}
.empty-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted-color, #999);
  padding: 0.35rem 0;
}

.addon-picker {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.35rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}
.addon-label {
  font-size: 0.72rem;
  color: var(--muted-color, #999);
}
.addon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.addon-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  padding: 0.3rem 0.7rem 0.3rem 0.55rem;
  background: #fff;
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}
.addon-chip:hover {
  border-color: var(--accent-color, #6366f1);
  background: color-mix(in srgb, var(--accent-color, #6366f1) 6%, white);
}
.addon-chip em {
  font-style: normal;
  color: var(--muted-color, #999);
}

.add-custom-button {
  align-self: flex-start;
}

.totals-card {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 10px;
  padding: 0.8rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.totals-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.83rem;
  color: var(--muted-color, #777);
}
.totals-row strong {
  font-variant-numeric: tabular-nums;
  color: inherit;
}
.totals-row--grand {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  margin-top: 0.15rem;
  padding-top: 0.4rem;
  font-size: 0.95rem;
  color: var(--text-color, #1a1a1a);
}
.totals-row--grand strong {
  color: var(--text-color, #1a1a1a);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.07);
  background: var(--surface, #fff);
  flex-shrink: 0;
}
.secondary-button {
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 0.5rem 1rem;
  background: transparent;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.12s ease;
}
.secondary-button:hover {
  background: rgba(0, 0, 0, 0.03);
}
.secondary-button:disabled,
.primary-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 560px) {
  .form-row--3 {
    grid-template-columns: 1fr;
  }
  .line-item-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    padding-bottom: 0.5rem;
  }
  .line-item-row--head {
    display: none;
  }
  .modal-footer {
    flex-wrap: wrap;
  }
  .modal-footer button {
    flex: 1;
  }
}
</style>