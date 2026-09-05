<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileText, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

type Quotation = { id: string; quotation_number: string; client_id: string; event_type: string; event_date: string; total: number; deposit_amount: number; balance_amount: number; status: string }
type Client = { id: string; name: string }
type PackageItem = { id: string; name: string; price: number; freelancer_role: string | null; freelancer_compensation_type: string | null; freelancer_compensation_value: number | null }
type PackageRecord = { id: string; name: string; description: string | null; base_price: number; is_active: boolean; package_items: PackageItem[] }
type LineItem = { package_item_id: string | null; name: string; quantity: number; unit_price: number }

const route = useRoute()
const managerOnly = computed(() => route.meta.role === 'manager')
const quotations = ref<Quotation[]>([])
const clients = ref<Client[]>([])
const packages = ref<PackageRecord[]>([])
const alaCarteItems = ref<PackageItem[]>([])
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

// A-La-Carte picker (standalone services, independent of any package)
const showAlaCarteBrowser = ref(false)
const alaCarteSearch = ref('')
const filteredAlaCarteItems = computed(() => {
  const usedIds = new Set(lineItems.value.map((line) => line.package_item_id).filter(Boolean))
  const query = alaCarteSearch.value.toLowerCase().trim()
  return alaCarteItems.value
    .filter((item) => !usedIds.has(item.id))
    .filter((item) => !query || item.name.toLowerCase().includes(query))
})
function addAlaCarteItem(item: PackageItem) {
  lineItems.value.push({ package_item_id: item.id, name: item.name, quantity: 1, unit_price: Number(item.price) })
}

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
  showAlaCarteBrowser.value = false
  alaCarteSearch.value = ''
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
  const win = window.open('', '_blank', 'width=900,height=1100')
  if (!win) return

  const escapeHtml = (value: unknown) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

  const formatCurrency = (value: number) =>
    `RM ${Number(value || 0).toLocaleString('en-MY', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const formatDate = (value: string) => {
    if (!value) return '-'

    const date = new Date(`${value}T00:00:00`)

    return date.toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatTime = (value: string) => {
    if (!value) return ''

    const [hours, minutes] = value.split(':').map(Number)

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)

    return date.toLocaleTimeString('en-MY', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const eventTime =
    form.value.event_start_time || form.value.event_end_time
      ? `${formatTime(form.value.event_start_time)}${
          form.value.event_end_time
            ? ` – ${formatTime(form.value.event_end_time)}`
            : ''
        }`
      : ''

  const rows = lineItems.value
    .map(
      (line) => `
        <tr>
          <td>
            <div class="item-name">${escapeHtml(line.name)}</div>
          </td>
          <td class="center">${line.quantity}</td>
          <td class="right">${formatCurrency(line.unit_price)}</td>
          <td class="right strong">${formatCurrency(
            line.quantity * line.unit_price
          )}</td>
        </tr>
      `
    )
    .join('')

  const termsText =
    form.value.terms?.trim() ||
    `50% deposit is required to confirm the booking. The remaining balance is payable before final delivery. Additional services, overtime or revisions outside the agreed scope may be charged separately.`

  const expiryText = form.value.expiry_date
    ? formatDate(form.value.expiry_date)
    : '14 days from quotation date'

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(quotationNumber)} · Storyteller Studio</title>

        <style>
          @page {
            size: A4;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #e9e9e9;
            color: #171717;
            font-family:
              Inter,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              Arial,
              sans-serif;
          }

          body {
            font-size: 12px;
            line-height: 1.55;
          }

          .page {
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            background: #ffffff;
            position: relative;
            padding: 17mm 17mm 18mm;
            page-break-after: always;
          }

          .page:last-child {
            page-break-after: auto;
          }

          /* --------------------------------
             BRAND
          -------------------------------- */

          .brand {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 30px;
          }

          .brand-name {
            font-size: 22px;
            font-weight: 800;
            letter-spacing: 0.16em;
            line-height: 1;
          }

          .brand-studio {
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.34em;
            margin-top: 6px;
            color: #777;
          }

          .brand-tagline {
            margin-top: 9px;
            color: #777;
            font-size: 10px;
          }

          .quote-label {
            text-align: right;
          }

          .quote-label h1 {
            margin: 0;
            font-size: 29px;
            font-weight: 800;
            letter-spacing: 0.06em;
          }

          .quote-label p {
            margin: 6px 0 0;
            color: #777;
            font-size: 10px;
          }

          .divider {
            height: 1px;
            background: #171717;
            margin: 28px 0;
          }

          /* --------------------------------
             META
          -------------------------------- */

          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 45px;
            margin-bottom: 28px;
          }

          .meta-block {
            min-width: 0;
          }

          .meta-label {
            font-size: 8px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.13em;
            color: #8a8a8a;
            margin-bottom: 7px;
          }

          .meta-value {
            font-size: 13px;
            font-weight: 700;
          }

          .meta-sub {
            color: #666;
            font-size: 10px;
            margin-top: 3px;
          }

          /* --------------------------------
             PROJECT
          -------------------------------- */

          .section-title {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            font-weight: 800;
            color: #777;
            margin: 0 0 10px;
          }

          .project-card {
            border: 1px solid #dedede;
            padding: 18px;
            margin-bottom: 28px;
          }

          .project-title {
            font-size: 17px;
            font-weight: 800;
            margin-bottom: 13px;
          }

          .project-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 13px 30px;
          }

          .project-field-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #999;
            margin-bottom: 2px;
          }

          .project-field-value {
            font-size: 10px;
            font-weight: 600;
          }

          /* --------------------------------
             INTRO
          -------------------------------- */

          .intro {
            margin-bottom: 28px;
          }

          .intro p {
            margin: 0;
            max-width: 690px;
            color: #555;
            font-size: 11px;
          }

          /* --------------------------------
             ITEMS
          -------------------------------- */

          table {
            width: 100%;
            border-collapse: collapse;
          }

          thead th {
            padding: 9px 10px;
            background: #171717;
            color: #ffffff;
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-weight: 700;
          }

          thead th:first-child {
            text-align: left;
          }

          thead th:not(:first-child) {
            text-align: right;
          }

          tbody td {
            padding: 12px 10px;
            border-bottom: 1px solid #e7e7e7;
            vertical-align: middle;
            font-size: 10px;
          }

          .item-name {
            font-weight: 650;
          }

          .center {
            text-align: center;
          }

          .right {
            text-align: right;
            font-variant-numeric: tabular-nums;
          }

          .strong {
            font-weight: 700;
          }

          /* --------------------------------
             TOTALS
          -------------------------------- */

          .summary {
            width: 270px;
            margin-left: auto;
            margin-top: 18px;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 5px 0;
            color: #666;
            font-size: 10px;
          }

          .summary-row strong {
            color: #222;
            font-weight: 650;
            font-variant-numeric: tabular-nums;
          }

          .summary-total {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding: 12px 0;
            margin: 7px 0;
            border-top: 1px solid #171717;
            border-bottom: 1px solid #171717;
            font-size: 13px;
            font-weight: 800;
          }

          .summary-balance {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding-top: 7px;
            font-size: 10px;
          }

          .summary-balance strong {
            font-size: 12px;
          }

          /* --------------------------------
             VALUE SECTION
          -------------------------------- */

          .value-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 15px;
          }

          .value-card {
            border: 1px solid #e1e1e1;
            padding: 15px;
          }

          .value-number {
            font-size: 9px;
            font-weight: 800;
            color: #999;
            letter-spacing: 0.1em;
            margin-bottom: 7px;
          }

          .value-card h3 {
            font-size: 11px;
            margin: 0 0 5px;
          }

          .value-card p {
            font-size: 9.5px;
            color: #666;
            margin: 0;
            line-height: 1.5;
          }

          /* --------------------------------
             BRAND MESSAGE
          -------------------------------- */

          .brand-message {
            margin-top: 28px;
            padding: 22px;
            background: #171717;
            color: #ffffff;
          }

          .brand-message-label {
            font-size: 8px;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            opacity: 0.55;
            margin-bottom: 8px;
          }

          .brand-message h2 {
            margin: 0 0 8px;
            font-size: 18px;
            line-height: 1.25;
          }

          .brand-message p {
            margin: 0;
            color: #d2d2d2;
            font-size: 10px;
            max-width: 610px;
          }

          /* --------------------------------
             TERMS
          -------------------------------- */

          .terms {
            margin-top: 30px;
          }

          .terms-box {
            border: 1px solid #e0e0e0;
            padding: 15px;
            color: #666;
            font-size: 9.5px;
            white-space: pre-line;
          }

          .validity {
            margin-top: 10px;
            font-size: 9px;
            color: #777;
          }

          .validity strong {
            color: #222;
          }

          /* --------------------------------
             ACCEPTANCE
          -------------------------------- */

          .acceptance {
            margin-top: 30px;
          }

          .acceptance-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 35px;
            margin-top: 20px;
          }

          .signature-line {
            border-bottom: 1px solid #999;
            height: 35px;
            margin-bottom: 6px;
          }

          .signature-label {
            font-size: 8px;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          /* --------------------------------
             FOOTER
          -------------------------------- */

          .footer {
            position: absolute;
            left: 17mm;
            right: 17mm;
            bottom: 9mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 8px;
            border-top: 1px solid #e5e5e5;
            color: #999;
            font-size: 8px;
          }

          .footer-brand {
            font-weight: 700;
            color: #555;
            letter-spacing: 0.08em;
          }

          /* --------------------------------
             PRINT
          -------------------------------- */

          @media print {
            html,
            body {
              background: #ffffff;
            }

            .page {
              margin: 0;
              box-shadow: none;
            }
          }

          @media screen {
            .page {
              box-shadow: 0 10px 35px rgba(0, 0, 0, 0.12);
            }
          }
        </style>
      </head>

      <body>

        <!-- PAGE 1 : QUOTATION -->
        <section class="page">

          <header class="brand">
            <div>
              <div class="brand-name">STORYTELLER</div>
              <div class="brand-studio">STUDIO</div>
              <div class="brand-tagline">
                Visual Stories. Professionally Told.
              </div>
            </div>

            <div class="quote-label">
              <h1>QUOTATION</h1>
              <p>${escapeHtml(quotationNumber)}</p>
            </div>
          </header>

          <div class="divider"></div>

          <div class="meta-grid">

            <div class="meta-block">
              <div class="meta-label">Prepared For</div>
              <div class="meta-value">${escapeHtml(clientName)}</div>
              <div class="meta-sub">
                Client / Organisation
              </div>
            </div>

            <div class="meta-block">
              <div class="meta-label">Quotation Details</div>
              <div class="meta-value">
                ${formatDate(new Date().toISOString().slice(0, 10))}
              </div>
              <div class="meta-sub">
                Valid until ${escapeHtml(expiryText)}
              </div>
            </div>

          </div>

          <div class="section-title">Project Overview</div>

          <div class="project-card">

            <div class="project-title">
              ${escapeHtml(form.value.event_type)}
            </div>

            <div class="project-grid">

              <div>
                <div class="project-field-label">Event Date</div>
                <div class="project-field-value">
                  ${formatDate(form.value.event_date)}
                </div>
              </div>

              <div>
                <div class="project-field-label">Coverage Time</div>
                <div class="project-field-value">
                  ${escapeHtml(eventTime || 'To be confirmed')}
                </div>
              </div>

              <div>
                <div class="project-field-label">Location</div>
                <div class="project-field-value">
                  ${escapeHtml(
                    form.value.event_location || 'To be confirmed'
                  )}
                </div>
              </div>

              <div>
                <div class="project-field-label">Service</div>
                <div class="project-field-value">
                  ${escapeHtml(
                    packages.value.find(
                      (pkg) => pkg.id === form.value.package_id
                    )?.name || 'Custom Production'
                  )}
                </div>
              </div>

            </div>
          </div>

          <div class="intro">

            <div class="section-title">
              Our Approach
            </div>

            <p>
              Storyteller Studio will provide professional visual production
              services designed to capture the people, atmosphere and key
              moments of your event. Our focus is not only on recording the
              event, but creating footage that can continue to represent your
              brand beyond the day itself.
            </p>

          </div>

          <div class="section-title">
            Services &amp; Investment
          </div>

          <table>

            <thead>
              <tr>
                <th style="width: 48%">Service</th>
                <th style="width: 12%">Qty</th>
                <th style="width: 20%">Unit Price</th>
                <th style="width: 20%">Amount</th>
              </tr>
            </thead>

            <tbody>
              ${rows}
            </tbody>

          </table>

          <div class="summary">

            <div class="summary-row">
              <span>Subtotal</span>
              <strong>${formatCurrency(subtotal.value)}</strong>
            </div>

            ${
              Number(form.value.discount || 0) > 0
                ? `
                  <div class="summary-row">
                    <span>Discount</span>
                    <strong>
                      − ${formatCurrency(Number(form.value.discount || 0))}
                    </strong>
                  </div>
                `
                : ''
            }

            <div class="summary-total">
              <span>Total Payment</span>
              <strong>${formatCurrency(total.value)}</strong>
            </div>

            <div class="summary-row">
              <span>Deposit</span>
              <strong>
                ${formatCurrency(Number(form.value.deposit_amount || 0))}
              </strong>
            </div>

            <div class="summary-balance">
              <span>Balance Due</span>
              <strong>${formatCurrency(balance.value)}</strong>
            </div>

          </div>

          <footer class="footer">
            <span class="footer-brand">STORYTELLER STUDIO</span>
            <span>${escapeHtml(quotationNumber)}</span>
          </footer>

        </section>


        <!-- PAGE 2 : DELIVERABLES -->
        <section class="page">

          <header class="brand">

            <div>
              <div class="brand-name">STORYTELLER</div>
              <div class="brand-studio">STUDIO</div>
            </div>

            <div class="quote-label">
              <h1>DELIVERABLES</h1>
              <p>${escapeHtml(quotationNumber)}</p>
            </div>

          </header>

          <div class="divider"></div>

          <div class="section-title">
            What You'll Receive
          </div>

          <div class="value-grid">

            <div class="value-card">
              <div class="value-number">01</div>
              <h3>Raw Event Footage</h3>
              <p>
                Original footage captured throughout the agreed event
                coverage period.
              </p>
            </div>

            <div class="value-card">
              <div class="value-number">02</div>
              <h3>Key Moments</h3>
              <p>
                Important activities, interactions and highlights captured
                with storytelling in mind.
              </p>
            </div>

            <div class="value-card">
              <div class="value-number">03</div>
              <h3>Interview Coverage</h3>
              <p>
                Selected interview segments recorded as part of the agreed
                production scope.
              </p>
            </div>

            <div class="value-card">
              <div class="value-number">04</div>
              <h3>Professional Editing</h3>
              <p>
                Edited footage with structured storytelling, music,
                colour correction and basic sound enhancement.
              </p>
            </div>

          </div>


          <div class="brand-message">

            <div class="brand-message-label">
              The Storyteller Difference
            </div>

            <h2>
              More Than Just Footage.
            </h2>

            <p>
              We don't simply record an event. We capture the moments,
              people and stories that make it worth remembering — then
              shape them into visual content your brand can continue to use.
            </p>

          </div>


          <div class="terms">

            <div class="section-title">
              Terms &amp; Conditions
            </div>

            <div class="terms-box">
              ${escapeHtml(termsText)}
            </div>

            <div class="validity">
              <strong>Quotation validity:</strong>
              This quotation is valid until ${escapeHtml(expiryText)}.
            </div>

          </div>


          <div class="acceptance">

            <div class="section-title">
              Client Acceptance
            </div>

            <p style="font-size: 9.5px; color: #666; margin: 0;">
              By signing below, the client confirms acceptance of the
              services, pricing and terms stated in this quotation.
            </p>

            <div class="acceptance-grid">

              <div>
                <div class="signature-line"></div>
                <div class="signature-label">
                  Client Name / Signature
                </div>
              </div>

              <div>
                <div class="signature-line"></div>
                <div class="signature-label">
                  Date
                </div>
              </div>

            </div>

          </div>


          <footer class="footer">
            <span class="footer-brand">STORYTELLER STUDIO</span>
            <span>Visual Stories. Professionally Told.</span>
          </footer>

        </section>0

      </body>
    </html>
  `)

  win.document.close()
  win.focus()

  win.onload = () => {
    setTimeout(() => {
      win.print()
    }, 250)
  }
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
  const [quoteResult, clientResult, packageResult, alaCarteResult] = await Promise.all([
    supabase.from('quotations').select('id, quotation_number, client_id, event_type, event_date, total, deposit_amount, balance_amount, status').order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
    supabase.from('packages').select('id, name, description, base_price, is_active, package_items(id, name, price, freelancer_role, freelancer_compensation_type, freelancer_compensation_value)').eq('is_active', true).order('base_price'),
    supabase.from('package_items').select('id, name, price, freelancer_role, freelancer_compensation_type, freelancer_compensation_value').is('package_id', null).eq('item_type', 'ALA_CARTE').order('name'),
  ])
  if (quoteResult.error) error.value = quoteResult.error.message
  if (alaCarteResult.error) error.value = alaCarteResult.error.message
  quotations.value = quoteResult.data ?? []
  clients.value = clientResult.data ?? []
  packages.value = (packageResult.data ?? []) as PackageRecord[]
  alaCarteItems.value = (alaCarteResult.data ?? []) as PackageItem[]

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
              <p v-else class="empty-hint">Pick a package above, add an a-la-carte service, or add a custom item below.</p>

              <div v-if="availableAddOns.length" class="addon-picker">
                <span class="addon-label">Add-ons from this package</span>
                <div class="addon-chips">
                  <button v-for="addOn in availableAddOns" :key="addOn.id" class="addon-chip" type="button" @click="addAddOn(addOn)">
                    <Plus :size="13" /> {{ addOn.name }} <em>+{{ Number(addOn.price).toFixed(2) }}</em>
                  </button>
                </div>
              </div>

              <div class="ala-carte-block">
                <button class="text-button" type="button" @click="showAlaCarteBrowser = !showAlaCarteBrowser">
                  <Plus :size="15" /> {{ showAlaCarteBrowser ? 'Hide a-la-carte services' : 'Add a-la-carte service' }}
                </button>

                <div v-if="showAlaCarteBrowser" class="ala-carte-browser">
                  <input v-model="alaCarteSearch" class="ala-carte-search" type="text" placeholder="Search services (e.g. subtitle, colour grading, event coverage)" />
                  <div v-if="filteredAlaCarteItems.length" class="addon-chips">
                    <button v-for="item in filteredAlaCarteItems" :key="item.id" class="addon-chip" type="button" @click="addAlaCarteItem(item)">
                      <Plus :size="13" /> {{ item.name }} <em>RM{{ Number(item.price).toFixed(2) }}</em>
                    </button>
                  </div>
                  <p v-else class="empty-hint">No matching service.</p>
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
.ala-carte-block {
  padding-top: 0.35rem;
  border-top: 1px dashed rgba(0, 0, 0, 0.1);
}
.ala-carte-browser {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  max-height: 220px;
  overflow-y: auto;
  padding: 0.6rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.015);
}
.ala-carte-search {
  padding: 0.4rem 0.6rem;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  font-size: 0.82rem;
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