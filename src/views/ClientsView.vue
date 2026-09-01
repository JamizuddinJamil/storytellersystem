<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Search, Trash2, Users, X } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

/* ==================================================
 * 1. ROUTE & ROLE
 * ================================================== */

const route = useRoute()

const role = computed(() => String(route.meta.role ?? 'manager'))

/*
 * Only these roles can manage client records.
 *
 * Developer → full access
 * Manager   → full access
 * Sales     → full access
 *
 * Freelancer roles are view-only.
 */
const canManageClients = computed(() =>
  ['developer', 'manager', 'sales'].includes(role.value)
)

const canDeleteClients = computed(() =>
  ['developer', 'manager', 'sales'].includes(role.value)
)


/* ==================================================
 * 2. CLIENT TYPE & STATE
 * ================================================== */

type Client = {
  id: string
  name: string
  company_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
}

const clients = ref<Client[]>([])

const search = ref('')

const showForm = ref(false)

const editing = ref<Client | null>(null)

const busy = ref(false)

const error = ref('')

const message = ref('')


/* ==================================================
 * 3. CLIENT FORM
 * ================================================== */

const emptyForm = () => ({
  name: '',
  company_name: '',
  phone: '',
  email: '',
  address: '',
  notes: ''
})

const form = ref(emptyForm())


/* ==================================================
 * 4. FILTERED CLIENTS
 * ================================================== */

const filteredClients = computed(() => {
  const query = search.value.toLowerCase().trim()

  if (!query) return clients.value

  return clients.value.filter((client) =>
    `${client.name} ${client.company_name ?? ''} ${client.email ?? ''}`
      .toLowerCase()
      .includes(query)
  )
})


/* ==================================================
 * 5. LOAD CLIENTS
 * ================================================== */

async function loadClients() {
  error.value = ''

  const { data, error: loadError } = await supabase
    .from('clients')
    .select(
      'id, name, company_name, phone, email, address, notes'
    )
    .order('created_at', { ascending: false })

  if (loadError) {
    error.value = loadError.message
    clients.value = []
    return
  }

  clients.value = data ?? []
}


/* ==================================================
 * 6. CREATE / EDIT MODAL
 * ================================================== */

function openCreate() {
  if (!canManageClients.value) return

  editing.value = null
  form.value = emptyForm()
  error.value = ''
  message.value = ''
  showForm.value = true
}

function openEdit(client: Client) {
  if (!canManageClients.value) return

  editing.value = client

  form.value = {
    name: client.name,
    company_name: client.company_name ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    address: client.address ?? '',
    notes: client.notes ?? ''
  }

  error.value = ''
  message.value = ''
  showForm.value = true
}

function closeForm() {
  if (busy.value) return

  showForm.value = false
  editing.value = null
  error.value = ''
}


/* ==================================================
 * 7. SAVE CLIENT
 * ================================================== */

async function saveClient() {
  if (!canManageClients.value) return

  busy.value = true
  error.value = ''
  message.value = ''

  const payload = {
    ...form.value,
    company_name: form.value.company_name || null,
    phone: form.value.phone || null,
    email: form.value.email || null,
    address: form.value.address || null,
    notes: form.value.notes || null
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  /*
   * Get Storyteller profile ID.
   * This is used when creating a new client.
   */
  const { data: profile } = user
    ? await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
    : { data: null }

  let result

  if (editing.value) {
    /*
     * UPDATE CLIENT
     */
    result = await supabase
      .from('clients')
      .update(payload)
      .eq('id', editing.value.id)
  } else {
    /*
     * CREATE CLIENT
     */
    result = await supabase
      .from('clients')
      .insert({
        ...payload,
        created_by: profile?.id
      })
  }

  busy.value = false

  if (result.error) {
    error.value = result.error.message
    return
  }

  message.value = editing.value
    ? 'Client updated.'
    : 'Client added.'

  editing.value = null
  showForm.value = false

  await loadClients()
}


/* ==================================================
 * 8. DELETE CLIENT
 * ================================================== */

async function deleteClient(client: Client) {
  if (!canDeleteClients.value) return

  const confirmed = window.confirm(
    `Delete ${client.name}?`
  )

  if (!confirmed) return

  error.value = ''
  message.value = ''

  const { error: deleteError } = await supabase
    .from('clients')
    .delete()
    .eq('id', client.id)

  if (deleteError) {
    error.value = deleteError.message
    return
  }

  message.value = 'Client deleted.'

  await loadClients()
}


/* ==================================================
 * 9. PAGE LIFECYCLE
 * ================================================== */

onMounted(loadClients)
</script>


<template>
  <div class="clients-view">

    <!-- ==================================================
         PAGE HEADER
         ================================================== -->

    <div class="welcome-row">

      <div>
        <p class="eyebrow">Client records</p>

        <h2>Clients</h2>

        <p class="muted">
          Keep every relationship and event detail in one place.
        </p>
      </div>

      <!--
        Add client is ONLY visible to:
        developer / manager / sales
      -->

      <button
        v-if="canManageClients"
        class="primary-button"
        type="button"
        @click="openCreate"
      >
        <Plus :size="17" />
        Add client
      </button>

    </div>


    <!-- ==================================================
         FREELANCER VIEW-ONLY NOTICE
         ================================================== -->

    <div
      v-if="!canManageClients"
      class="clients-view-only"
    >
      <Users :size="17" />

      <span>
        Client records are managed by the sales and management team.
      </span>
    </div>


    <!-- ==================================================
         CLIENT LIST
         ================================================== -->

    <section class="panel clients-panel">

      <!-- CLIENT TOOLBAR -->

      <div class="client-toolbar">

        <div class="search-wrap">
          <Search :size="17" />

          <input
            v-model="search"
            placeholder="Search clients"
            aria-label="Search clients"
          />
        </div>

        <span class="client-count">
          {{ filteredClients.length }} clients
        </span>

      </div>


      <!-- MESSAGES -->

      <p
        v-if="error"
        class="form-message form-message--error"
      >
        {{ error }}
      </p>

      <p
        v-if="message"
        class="form-message"
      >
        {{ message }}
      </p>


      <!-- ==================================================
           CLIENT ROWS
           ================================================== -->

      <div
        v-if="filteredClients.length"
        class="client-list"
      >

        <article
          v-for="client in filteredClients"
          :key="client.id"
          class="client-row"
        >

          <!-- CLIENT ICON -->

          <div class="client-avatar">
            <Users :size="17" />
          </div>


          <!-- CLIENT INFO -->

          <div class="client-info">

            <strong>
              {{ client.name }}
            </strong>

            <span>
              {{
                client.company_name ||
                client.email ||
                'No company details'
              }}
            </span>

          </div>


          <!-- CLIENT CONTACT -->

          <div class="client-contact">
            {{
              client.phone ||
              client.email ||
              'No contact details'
            }}
          </div>


          <!-- ==================================================
               CLIENT ACTIONS

               Only manager / sales / developer
               ================================================== -->

          <div
            v-if="canManageClients"
            class="client-actions"
          >

            <button
              class="icon-button"
              type="button"
              aria-label="Edit client"
              @click="openEdit(client)"
            >
              <Pencil :size="16" />
            </button>


            <button
              v-if="canDeleteClients"
              class="icon-button icon-button--danger"
              type="button"
              aria-label="Delete client"
              @click="deleteClient(client)"
            >
              <Trash2 :size="16" />
            </button>

          </div>

        </article>

      </div>


      <!-- ==================================================
           EMPTY STATE
           ================================================== -->

      <div
        v-else
        class="empty-state"
      >

        <Users :size="28" />

        <strong>
          No clients yet
        </strong>

        <span>
          {{
            canManageClients
              ? 'Add your first client to begin.'
              : 'No client records are available.'
          }}
        </span>

      </div>

    </section>


    <!-- ==================================================
         CLIENT CREATE / EDIT MODAL
         ================================================== -->

    <div
      v-if="showForm && canManageClients"
      class="modal-backdrop"
    >

      <form
        class="panel client-form"
        @submit.prevent="saveClient"
      >

        <!-- MODAL HEADER -->

        <div class="panel-heading">

          <div>

            <p class="eyebrow">
              Client record
            </p>

            <h3>
              {{ editing ? 'Edit client' : 'Add client' }}
            </h3>

          </div>

          <button
            class="icon-button"
            type="button"
            aria-label="Close"
            @click="closeForm"
          >
            <X :size="18" />
          </button>

        </div>


        <!-- CLIENT NAME -->

        <label>
          <span>Name</span>

          <input
            v-model="form.name"
            required
            placeholder="Client name"
          />
        </label>


        <!-- COMPANY -->

        <label>
          <span>Company</span>

          <input
            v-model="form.company_name"
            placeholder="Company name"
          />
        </label>


        <!-- EMAIL + PHONE -->

        <div class="form-two">

          <label>
            <span>Email</span>

            <input
              v-model="form.email"
              type="email"
              placeholder="client@email.com"
            />
          </label>


          <label>
            <span>Phone</span>

            <input
              v-model="form.phone"
              placeholder="Phone number"
            />
          </label>

        </div>


        <!-- ADDRESS -->

        <label>
          <span>Address</span>

          <input
            v-model="form.address"
            placeholder="Address"
          />
        </label>


        <!-- NOTES -->

        <label>
          <span>Notes</span>

          <textarea
            v-model="form.notes"
            rows="3"
            placeholder="Useful context"
          ></textarea>
        </label>


        <!-- FORM ERROR -->

        <p
          v-if="error"
          class="form-message form-message--error"
        >
          {{ error }}
        </p>


        <!-- FORM ACTIONS -->

        <div class="form-actions">

          <button
            class="text-button"
            type="button"
            :disabled="busy"
            @click="closeForm"
          >
            Cancel
          </button>

          <button
            class="primary-button"
            :disabled="busy"
            type="submit"
          >
            {{ busy ? 'Saving...' : 'Save client' }}
          </button>

        </div>

      </form>

    </div>

  </div>
</template>