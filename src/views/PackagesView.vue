<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Check, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { supabase } from '../lib/supabase'

type PackageItem = { id?: string; name: string; price: number }
type PackageRecord = { id: string; name: string; description: string | null; base_price: number; is_active: boolean; package_items: PackageItem[] }
const packages = ref<PackageRecord[]>([])
const canManage = ref(false)
const showForm = ref(false)
const editing = ref<PackageRecord | null>(null)
const form = ref({ name: '', description: '', base_price: 0, is_active: true })
const items = ref<PackageItem[]>([])
const error = ref('')
const message = ref('')
const busy = ref(false)

async function load() {
  const { data, error: loadError } = await supabase.from('packages').select('id, name, description, base_price, is_active, package_items(id, name, price)').order('base_price')
  if (loadError) error.value = loadError.message
  packages.value = (data ?? []) as PackageRecord[]
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('id, role_id').eq('auth_user_id', user.id).maybeSingle()
    const { data: manager } = await supabase.from('roles').select('id').eq('name', 'MANAGER').maybeSingle()
    const { data: assignment } = profile?.id ? await supabase.from('profile_roles').select('role_id').eq('profile_id', profile.id).eq('role_id', manager?.id).maybeSingle() : { data: null }
    canManage.value = profile?.role_id === manager?.id || Boolean(assignment)
  }
}
function openCreate() { editing.value = null; form.value = { name: '', description: '', base_price: 0, is_active: true }; items.value = []; error.value = ''; showForm.value = true }
function openEdit(pkg: PackageRecord) { editing.value = pkg; form.value = { name: pkg.name, description: pkg.description ?? '', base_price: Number(pkg.base_price), is_active: pkg.is_active }; items.value = pkg.package_items.map((item) => ({ ...item, price: Number(item.price) })); error.value = ''; showForm.value = true }
function addItem() { items.value.push({ name: '', price: 0 }) }
async function save() {
  busy.value = true; error.value = ''; message.value = ''
  const packageResult = editing.value ? await supabase.from('packages').update(form.value).eq('id', editing.value.id).select('id').single() : await supabase.from('packages').insert(form.value).select('id').single()
  if (packageResult.error || !packageResult.data) { error.value = packageResult.error?.message ?? 'Could not save package'; busy.value = false; return }
  const packageId = packageResult.data.id
  if (editing.value) await supabase.from('package_items').delete().eq('package_id', packageId)
  const validItems = items.value.filter((item) => item.name.trim()).map((item) => ({ package_id: packageId, name: item.name.trim(), price: Number(item.price) || 0 }))
  if (validItems.length) { const itemResult = await supabase.from('package_items').insert(validItems); if (itemResult.error) { error.value = itemResult.error.message; busy.value = false; return } }
  busy.value = false; showForm.value = false; message.value = editing.value ? 'Package updated.' : 'Package added.'; await load()
}
async function remove(pkg: PackageRecord) { if (!window.confirm(`Delete ${pkg.name}?`)) return; const { error: deleteError } = await supabase.from('packages').delete().eq('id', pkg.id); if (deleteError) error.value = deleteError.message; else { message.value = 'Package deleted.'; await load() } }
onMounted(load)
</script>

<template>
  <div class="packages-view"><div class="welcome-row"><div><p class="eyebrow">Sales catalogue</p><h2>Master packages</h2><p class="muted">Set the packages your team can offer clients.</p></div><button v-if="canManage" class="primary-button" type="button" @click="openCreate"><Plus :size="17" /> Add package</button></div><section class="panel package-list-panel"><p v-if="error" class="form-message form-message--error">{{ error }}</p><p v-if="message" class="form-message">{{ message }}</p><div v-if="packages.length" class="package-grid"><article v-for="pkg in packages" :key="pkg.id" class="package-card"><div class="package-card-top"><div><span class="package-kicker">MASTER PACKAGE</span><h3>{{ pkg.name }}</h3></div><span class="package-price">{{ Number(pkg.base_price).toFixed(2) }}</span></div><p class="muted">{{ pkg.description || 'No description added.' }}</p><div class="package-items"><span v-for="item in pkg.package_items" :key="item.id"><Check :size="14" />{{ item.name }} <small v-if="Number(item.price) > 0">+{{ Number(item.price).toFixed(2) }}</small></span><span v-if="!pkg.package_items.length" class="muted">No add-ons yet</span></div><div v-if="canManage" class="package-actions"><button class="text-button" type="button" @click="openEdit(pkg)"><Pencil :size="15" /> Edit</button><button class="text-button danger-button" type="button" @click="remove(pkg)"><Trash2 :size="15" /> Delete</button></div></article></div><div v-else class="empty-state"><strong>No packages found</strong><span>Managers can add the first master package.</span></div></section><div v-if="showForm" class="modal-backdrop"><form class="panel client-form" @submit.prevent="save"><div class="panel-heading"><div><p class="eyebrow">Catalogue setup</p><h3>{{ editing ? 'Edit package' : 'Add package' }}</h3></div><button class="icon-button" type="button" aria-label="Close" @click="showForm = false"><X :size="18" /></button></div><label><span>Package name</span><input v-model="form.name" required placeholder="Premium" /></label><label><span>Description</span><textarea v-model="form.description" rows="2" placeholder="What this package includes"></textarea></label><label><span>Base price</span><input v-model.number="form.base_price" required min="0" step="0.01" type="number" /></label><label class="active-toggle"><input v-model="form.is_active" type="checkbox" /> <span>Available to Salesman</span></label><fieldset class="item-editor"><legend>Add-ons</legend><div v-for="(item, index) in items" :key="index" class="item-row"><input v-model="item.name" placeholder="Extra service" /><input v-model.number="item.price" min="0" step="0.01" type="number" placeholder="Price" /><button class="icon-button" type="button" aria-label="Remove add-on" @click="items.splice(index, 1)"><X :size="15" /></button></div><button class="text-button" type="button" @click="addItem"><Plus :size="15" /> Add add-on</button></fieldset><p v-if="error" class="form-message form-message--error">{{ error }}</p><div class="form-actions"><button class="text-button" type="button" @click="showForm = false">Cancel</button><button class="primary-button" :disabled="busy" type="submit">{{ busy ? 'Saving...' : 'Save package' }}</button></div></form></div></div>
</template>
