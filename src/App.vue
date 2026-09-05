<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { supabase } from './lib/supabase'
import {
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Film,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Package,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  WalletCards,
} from '@lucide/vue'

type Role =
  | 'developer'
  | 'manager'
  | 'sales'
  | 'videographer'
  | 'photographer'
  | 'editor'

const roleMap: Record<string, Role> = {
  DEVELOPER: 'developer',
  MANAGER: 'manager',
  SALESMAN: 'sales',
  VIDEOGRAPHER: 'videographer',
  PHOTOGRAPHER: 'photographer',
  VIDEO_EDITOR: 'editor',
}

const route = useRoute()
const router = useRouter()

const mobileMenuOpen = ref(false)
const role = ref<Role>('manager')
const actualRole = ref('')
const userName = ref('')
const userRoles = ref<string[]>([])
const hasManagerAccess = ref(false)
const signingOut = ref(false)

const roleLabels: Record<Role, string> = {
  developer: 'Developer',
  manager: 'Manager',
  sales: 'Salesman',
  videographer: 'Videographer',
  photographer: 'Photographer',
  editor: 'Video Editor',
}

const roleCodes: Record<string, string> = {
  DEVELOPER: 'DEV',
  MANAGER: 'M',
  SALESMAN: 'S',
  VIDEOGRAPHER: 'VG',
  PHOTOGRAPHER: 'PG',
  VIDEO_EDITOR: 'VE',
}

const getInitials = (name: string): string => {
  if (!name) return 'U'

  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const currentRole = computed(() => {
  const name = userName.value || 'Pengguna'

  return {
    name,
    label: userRoles.value.length
      ? userRoles.value.map((item) => roleCodes[item] ?? item).join(', ')
      : roleLabels[role.value],
    initials: getInitials(name),
  }
})

const roleBase = computed(() => `/${role.value}`)
const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'))
const isPublicRoute = computed(() => route.meta.public === true)

const isDeveloper = computed(() => actualRole.value === 'DEVELOPER')
const viewingLabel = computed(() => roleLabels[role.value])


// Roles this specific user actually holds (not the full 6 — that's developer-only)
const availableRoleOptions = computed<Role[]>(() => {
  const options = userRoles.value
    .map((name) => roleMap[name])
    .filter((value): value is Role => Boolean(value))
  return [...new Set(options)]
})

function switchDashboard(nextRole: Role) {
  if (!isDeveloper.value) return

  role.value = nextRole
  mobileMenuOpen.value = false

  router.push(`/${nextRole}/dashboard`)
}

/*
 * "My freelance work" — for a non-developer with more than one role
 * (e.g. Manager + Videographer + Video editor). Lets them step into a
 * freelance workspace without losing their way back, instead of the
 * developer-only "View as" switcher below.
 */
const FREELANCE_ROLES: Role[] = ['videographer', 'photographer', 'editor']
const freelanceOrigin = ref<Role | null>(null)
const showFreelancePicker = ref(false)

const freelanceRoleOptions = computed<Role[]>(() =>
  availableRoleOptions.value.filter(
    (option) => FREELANCE_ROLES.includes(option) && option !== role.value,
  ),
)

function enterFreelanceRole(target: Role) {
  if (!freelanceOrigin.value) {
    freelanceOrigin.value = role.value
  }
  role.value = target
  showFreelancePicker.value = false
  mobileMenuOpen.value = false
  router.push(`/${target}/dashboard`)
}

function openFreelanceWork() {
  if (freelanceRoleOptions.value.length === 1) {
    enterFreelanceRole(freelanceRoleOptions.value[0])
    return
  }
  showFreelancePicker.value = !showFreelancePicker.value
}

function exitFreelanceWork() {
  if (!freelanceOrigin.value) return
  const target = freelanceOrigin.value
  freelanceOrigin.value = null
  showFreelancePicker.value = false
  role.value = target
  mobileMenuOpen.value = false
  router.push(`/${target}/dashboard`)
}

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  await supabase.auth.signOut()
  signingOut.value = false
  router.push('/auth')
}

const navigation = computed(() => {
  /*
   * Developer mode:
   * The actual database role remains DEVELOPER.
   * This only changes the dashboard/workspace being viewed.
   * "View as" is handled by the topbar switcher, not a nav item.
   * User management is not yet available (needs a secure Edge Function).
   */
  if (role.value === 'developer') {
    return [
      {
        label: 'Developer dashboard',
        icon: ShieldCheck,
        to: '/developer/dashboard',
      },
      {
        label: 'Settings',
        icon: Settings,
        to: '/developer/settings',
      },
    ]
  }

  if (role.value === 'manager') {
    return [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/manager/dashboard' },
      { label: 'Pipeline', icon: ClipboardList, to: '/manager/pipeline' },
      { label: 'Packages', icon: Package, to: '/manager/packages' },
      { label: 'Clients', icon: Users, to: '/manager/clients' },
      { label: 'Quotations', icon: ClipboardList, to: '/manager/quotations' },
      { label: 'Invoices', icon: FileCheck2, to: '/manager/invoices' },
      { label: 'Jobs', icon: BriefcaseBusiness, to: '/manager/jobs' },
      { label: 'Add users', icon: UserPlus, to: '/manager/team' },
      { label: 'Payouts & Revenue', icon: WalletCards, to: '/manager/payouts' },
      { label: 'Settings', icon: Settings, to: '/manager/settings' },
    ]
  }

  if (role.value === 'sales') {
    return [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/sales/dashboard' },
      { label: 'Pipeline', icon: ClipboardList, to: '/sales/pipeline' },
      { label: 'Clients', icon: Users, to: '/sales/clients' },
      { label: 'Quotations', icon: ClipboardList, to: '/sales/quotations' },
      { label: 'Invoices', icon: FileCheck2, to: '/sales/invoices' },
      { label: 'Affiliate wallet', icon: WalletCards, to: '/sales/affiliate-wallet' },
      { label: 'Settings', icon: Settings, to: '/sales/settings' },
    ]
  }

  // Videographer / Photographer / Video editor share the same menu shape.
  return [
    { label: 'Dashboard', icon: LayoutDashboard, to: `${roleBase.value}/dashboard` },
    { label: 'Pipeline', icon: ClipboardList, to: `${roleBase.value}/pipeline` },
    { label: 'Jobs', icon: BriefcaseBusiness, to: `${roleBase.value}/jobs` },
    { label: 'Production', icon: Film, to: `${roleBase.value}/production` },
    { label: 'Affiliate wallet', icon: WalletCards, to: `${roleBase.value}/affiliate-wallet` },
    { label: 'Settings', icon: Settings, to: `${roleBase.value}/settings` },
  ]
})

onMounted(async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  const metaName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0]

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role_id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  userName.value = profile?.full_name || metaName || ''

  const { data: primaryRole } = profile?.role_id
    ? await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .maybeSingle()
    : { data: null }

  const { data: assignments } = profile?.id
    ? await supabase
        .from('profile_roles')
        .select('role_id')
        .eq('profile_id', profile.id)
    : { data: [] }

  const roleIds = [
    ...new Set(
      [profile?.role_id, ...(assignments ?? []).map((assignment) => assignment.role_id)].filter(
        Boolean,
      ),
    ),
  ]

  const { data: assignedRoleRows } = roleIds.length
    ? await supabase.from('roles').select('name').in('id', roleIds)
    : { data: [] }

  userRoles.value = (assignedRoleRows ?? []).map((item) => item.name)

  if (userRoles.value.length === 0 && primaryRole?.name) {
    userRoles.value = [primaryRole.name]
  }

  actualRole.value = primaryRole?.name ?? userRoles.value[0] ?? ''

  hasManagerAccess.value =
    isDeveloper.value ||
    userRoles.value.includes('MANAGER') ||
    primaryRole?.name === 'MANAGER'

  /*
   * Developer always starts in Developer Dashboard.
   * We never change profiles.role_id when switching dashboards.
   */
  if (isDeveloper.value) {
    role.value = 'developer'
    return
  }

  const activeRole =
    userRoles.value.find((item) => item === 'MANAGER') ??
    userRoles.value[0]

  if (activeRole && roleMap[activeRole]) {
    role.value = roleMap[activeRole]
  }
})
</script>

<template>
  <RouterView v-if="isPublicRoute" />

  <div v-else class="app-shell">
    <aside class="sidebar" :class="{ 'sidebar--open': mobileMenuOpen }">
      <div class="brand">
        <span class="brand-mark">S</span>
        <span>Storyteller</span>
      </div>

      <div class="workspace-label">WORKSPACE</div>

      <nav class="nav-list" aria-label="Primary navigation">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="nav-item--active"
          @click="mobileMenuOpen = false"
        >
          <component :is="item.icon" :size="18" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div v-if="!isDeveloper && freelanceRoleOptions.length" class="nav-freelance-block">
        <button type="button" class="nav-freelance-toggle" @click="openFreelanceWork">
          <Film :size="18" :stroke-width="1.8" />
          <span>My freelance work</span>
        </button>

        <div v-if="showFreelancePicker && freelanceRoleOptions.length > 1" class="nav-freelance-picker">
          <button
            v-for="option in freelanceRoleOptions"
            :key="option"
            type="button"
            @click="enterFreelanceRole(option)"
          >
            {{ roleLabels[option] }}
          </button>
        </div>
      </div>

      <div class="sidebar-bottom">
        <div class="sidebar-note">
          <CheckCircle2 :size="17" />
          <span>All systems operational</span>
        </div>

        <button class="logout-button" type="button" :disabled="signingOut" @click="signOut">
          <LogOut :size="17" />
          {{ signingOut ? 'Signing out...' : 'Sign out' }}
        </button>
      </div>
    </aside>

    <div
      v-if="mobileMenuOpen"
      class="scrim"
      @click="mobileMenuOpen = false"
    />

    <main class="main-content">
      <header class="topbar">
        <button
          class="icon-button menu-button"
          type="button"
          aria-label="Open navigation"
          @click="mobileMenuOpen = true"
        >
          <Menu :size="21" />
        </button>

        <div>
          <p class="eyebrow">
            <button
              v-if="freelanceOrigin"
              type="button"
              class="breadcrumb-back"
              @click="exitFreelanceWork"
            >
              {{ roleLabels[freelanceOrigin] }} workspace
            </button>
            <template v-if="freelanceOrigin"> › {{ viewingLabel }}</template>
            <template v-else-if="isDeveloper">Developer Mode — Viewing as {{ viewingLabel }}</template>
            <template v-else>{{ currentRole.label }} workspace</template>
          </p>

          <h1>{{ pageTitle }}</h1>
        </div>

        <div class="topbar-actions">
          <label
            v-if="isDeveloper"
            class="dashboard-switcher"
          >
            <span>View as</span>

            <select
              :value="role"
              aria-label="Switch dashboard view"
              @change="
                switchDashboard(
                  ($event.target as HTMLSelectElement).value as Role,
                )
              "
            >
              <option value="developer">Developer</option>
              <option value="manager">Manager</option>
              <option value="sales">Salesman</option>
              <option value="videographer">Videographer</option>
              <option value="photographer">Photographer</option>
              <option value="editor">Video Editor</option>
            </select>
          </label>

          <div class="profile-chip">
            <span class="avatar">{{ currentRole.initials }}</span>

            <span class="profile-copy">
              <strong>{{ currentRole.name }}</strong>
              <small>{{ currentRole.label }}</small>
            </span>
          </div>
        </div>
      </header>

      <section class="page-content">
        <RouterView />
      </section>

      <nav class="bottom-nav" aria-label="Mobile navigation">
        <RouterLink
          v-for="item in navigation.slice(0, 4)"
          :key="item.to"
          :to="item.to"
          class="bottom-nav-item"
          active-class="bottom-nav-item--active"
        >
          <component :is="item.icon" :size="19" />
          <span>{{ item.label }}</span>
        </RouterLink>

        <button
          class="bottom-nav-item"
          type="button"
          @click="mobileMenuOpen = true"
        >
          <MoreHorizontal :size="19" />
          <span>More</span>
        </button>
      </nav>
    </main>
  </div>
</template>

<style scoped>
.nav-freelance-block {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 0.5px solid rgba(255, 255, 255, 0.1);
}
.nav-freelance-toggle {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  text-align: left;
}
.nav-freelance-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}
.nav-freelance-picker {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.25rem 0 0.25rem 2.1rem;
}
.nav-freelance-picker button {
  padding: 0.4rem 0.6rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  opacity: 0.85;
}
.nav-freelance-picker button:hover {
  background: rgba(255, 255, 255, 0.06);
  opacity: 1;
}
.breadcrumb-back {
  background: transparent;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>