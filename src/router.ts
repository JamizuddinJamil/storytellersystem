import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from './views/DashboardView.vue'
import AuthView from './views/AuthView.vue'
import TeamView from './views/TeamView.vue'
import SetPasswordView from './views/SetPasswordView.vue'
import ClientsView from './views/ClientsView.vue'
import PackagesView from './views/PackagesView.vue'
import QuotationsView from './views/QuotationsView.vue'
import InvoicesView from './views/InvoicesView.vue'
import PipelineView from './views/PipelineView.vue'
import JobsView from './views/JobsView.vue'
import FreelancerJobsView from './views/FreelancerJobsView.vue'
import FreelancerPipelineView from './views/FreelancerPipelineView.vue'
import ProductionWorkflowView from './views/ProductionWorkflowView.vue'
import PaymentsView from './views/PaymentsView.vue'
import SettingsView from './views/SettingsView.vue'
import AffiliateWalletView from './views/AffiliateWalletView.vue'
import { supabase } from './lib/supabase'

type AppRole =
  | 'developer'
  | 'manager'
  | 'sales'
  | 'videographer'
  | 'photographer'
  | 'editor'

const routes = [
  {
    path: '/',
    redirect: '/auth',
  },

  {
    path: '/auth',
    component: AuthView,
    meta: {
      public: true,
      title: 'Sign in',
    },
  },

  {
    path: '/set-password',
    component: SetPasswordView,
    meta: {
      public: true,
      title: 'Set password',
    },
  },

  // --------------------------------------------------
  // MANAGER
  // --------------------------------------------------

  {
    path: '/manager/team',
    component: TeamView,
    meta: {
      title: 'Team',
      role: 'manager',
      managerOnly: true,
    },
  },

  {
    path: '/manager/clients',
    component: ClientsView,
    meta: {
      title: 'Clients',
      role: 'manager',
      clientAccess: true,
    },
  },

  {
    path: '/manager/packages',
    component: PackagesView,
    meta: {
      title: 'Packages',
      role: 'manager',
      packageAccess: true,
    },
  },

  {
    path: '/manager/quotations',
    component: QuotationsView,
    meta: {
      title: 'Quotations',
      role: 'manager',
      clientAccess: true,
    },
  },

  {
    path: '/manager/invoices',
    component: InvoicesView,
    meta: {
      title: 'Invoices',
      role: 'manager',
      clientAccess: true,
    },
  },

  {
    path: '/manager/pipeline',
    component: PipelineView,
    meta: {
      title: 'Pipeline',
      role: 'manager',
      clientAccess: true,
    },
  },

  {
    path: '/manager/jobs',
    component: JobsView,
    meta: {
      title: 'Job setup',
      role: 'manager',
      managerOnly: true,
    },
  },

  {
    path: '/manager/payments',
    component: PaymentsView,
    meta: {
      title: 'Affiliate payments',
      role: 'manager',
      managerOnly: true,
    },
  },

  {
    path: '/manager/settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      role: 'manager',
    },
  },

  {
    path: '/manager',
    redirect: '/manager/dashboard',
  },

  {
    path: '/manager/dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      role: 'manager',
    },
  },

  // --------------------------------------------------
  // SALESMAN
  // --------------------------------------------------

  {
    path: '/sales/clients',
    component: ClientsView,
    meta: {
      title: 'Clients',
      role: 'sales',
      clientAccess: true,
    },
  },

  {
    path: '/sales/packages',
    component: PackagesView,
    meta: {
      title: 'Packages',
      role: 'sales',
      packageAccess: true,
    },
  },

  {
    path: '/sales/quotations',
    component: QuotationsView,
    meta: {
      title: 'Quotations',
      role: 'sales',
      clientAccess: true,
    },
  },

  {
    path: '/sales/invoices',
    component: InvoicesView,
    meta: {
      title: 'Invoices',
      role: 'sales',
      clientAccess: true,
    },
  },

  {
    path: '/sales/pipeline',
    component: PipelineView,
    meta: {
      title: 'Pipeline',
      role: 'sales',
      clientAccess: true,
    },
  },

  {
    path: '/sales/affiliate-wallet',
    component: AffiliateWalletView,
    meta: {
      title: 'Affiliate wallet',
      role: 'sales',
    },
  },

  {
    path: '/sales/settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      role: 'sales',
    },
  },

  {
    path: '/sales',
    redirect: '/sales/dashboard',
  },

  {
    path: '/sales/dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      role: 'sales',
    },
  },


  // --------------------------------------------------
  // DEVELOPER
  // --------------------------------------------------

  {
    path: '/developer',
    redirect: '/developer/dashboard',
  },

  {
    path: '/developer/dashboard',
    component: DashboardView,
    meta: {
      title: 'Developer dashboard',
      role: 'developer',
      developerOnly: true,
    },
  },

  {
    path: '/developer/settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      role: 'developer',
      developerOnly: true,
    },
  },

  // --------------------------------------------------
  // VIDEOGRAPHER
  // --------------------------------------------------

  {
    path: '/videographer/jobs',
    component: FreelancerJobsView,
    meta: {
      title: 'Available jobs',
      role: 'videographer',
    },
  },

  {
    path: '/videographer/pipeline',
    component: FreelancerPipelineView,
    meta: {
      title: 'My pipeline',
      role: 'videographer',
    },
  },

  {
    path: '/videographer/production',
    component: ProductionWorkflowView,
    meta: {
      title: 'Production',
      role: 'videographer',
    },
  },

  {
    path: '/videographer/affiliate-wallet',
    component: AffiliateWalletView,
    meta: {
      title: 'Affiliate wallet',
      role: 'videographer',
    },
  },

  {
    path: '/videographer/settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      role: 'videographer',
    },
  },

  {
    path: '/videographer/dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      role: 'videographer',
    },
  },

  // --------------------------------------------------
  // PHOTOGRAPHER
  // --------------------------------------------------

  {
    path: '/photographer/jobs',
    component: FreelancerJobsView,
    meta: {
      title: 'Available jobs',
      role: 'photographer',
    },
  },

  {
    path: '/photographer/pipeline',
    component: FreelancerPipelineView,
    meta: {
      title: 'My pipeline',
      role: 'photographer',
    },
  },

  {
    path: '/photographer/production',
    component: ProductionWorkflowView,
    meta: {
      title: 'Production',
      role: 'photographer',
    },
  },

  {
    path: '/photographer/affiliate-wallet',
    component: AffiliateWalletView,
    meta: {
      title: 'Affiliate wallet',
      role: 'photographer',
    },
  },

  {
    path: '/photographer/settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      role: 'photographer',
    },
  },

  {
    path: '/photographer/dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      role: 'photographer',
    },
  },

  // --------------------------------------------------
  // VIDEO EDITOR
  // --------------------------------------------------

  {
    path: '/editor/jobs',
    component: FreelancerJobsView,
    meta: {
      title: 'Available jobs',
      role: 'editor',
    },
  },

  {
    path: '/editor/pipeline',
    component: FreelancerPipelineView,
    meta: {
      title: 'My pipeline',
      role: 'editor',
    },
  },

  {
    path: '/editor/production',
    component: ProductionWorkflowView,
    meta: {
      title: 'Production',
      role: 'editor',
    },
  },

  {
    path: '/editor/affiliate-wallet',
    component: AffiliateWalletView,
    meta: {
      title: 'Affiliate wallet',
      role: 'editor',
    },
  },

  {
    path: '/editor/settings',
    component: SettingsView,
    meta: {
      title: 'Settings',
      role: 'editor',
    },
  },

  {
    path: '/editor/dashboard',
    component: DashboardView,
    meta: {
      title: 'Dashboard',
      role: 'editor',
    },
  },

  // Fallback
  {
    path: '/:pathMatch(.*)*',
    redirect: '/auth',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  // Public pages
  if (to.meta.public) {
    return true
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return '/auth'
  }

  // --------------------------------------------------
  // Get current profile
  // --------------------------------------------------

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role_id, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!profile || profile.is_active === false) {
    return '/auth'
  }

  // --------------------------------------------------
  // Get primary role
  // --------------------------------------------------

  const { data: primaryRole } = profile.role_id
    ? await supabase
        .from('roles')
        .select('name')
        .eq('id', profile.role_id)
        .maybeSingle()
    : { data: null }

  // --------------------------------------------------
  // Get additional roles
  // --------------------------------------------------

  const { data: assignments } = await supabase
    .from('profile_roles')
    .select('role_id')
    .eq('profile_id', profile.id)

  const assignedRoleIds = (assignments ?? []).map(
    (assignment) => assignment.role_id,
  )

  const allRoleIds = [
    ...new Set(
      [profile.role_id, ...assignedRoleIds].filter(Boolean),
    ),
  ]

  const { data: roleRows } = allRoleIds.length
    ? await supabase
        .from('roles')
        .select('id, name')
        .in('id', allRoleIds)
    : { data: [] }

  const availableRoles = new Set(
    (roleRows ?? []).map((role) => role.name),
  )

  if (primaryRole?.name) {
    availableRoles.add(primaryRole.name)
  }

  // --------------------------------------------------
  // DEVELOPER = elevated access
  // --------------------------------------------------

  const isDeveloper =
    primaryRole?.name === 'DEVELOPER' ||
    availableRoles.has('DEVELOPER')

  const isManager =
    primaryRole?.name === 'MANAGER' ||
    availableRoles.has('MANAGER')

  const isSalesman =
    primaryRole?.name === 'SALESMAN' ||
    availableRoles.has('SALESMAN')

  /*
   * IMPORTANT:
   *
   * Developer is allowed to VIEW every workspace.
   *
   * This does NOT change profiles.role_id.
   * The dashboard switcher in App.vue only changes
   * the frontend route being viewed.
   */
  if (isDeveloper) {
    return true
  }

  // --------------------------------------------------
  // Manager-only routes
  // --------------------------------------------------

  if (to.meta.managerOnly) {
    return isManager ? true : '/auth'
  }

  // --------------------------------------------------
  // Client access routes
  // --------------------------------------------------

  if (to.meta.clientAccess) {
    return isManager || isSalesman ? true : '/auth'
  }

  // --------------------------------------------------
  // Package access routes
  // --------------------------------------------------

  if (to.meta.packageAccess) {
    return isManager || isSalesman ? true : '/auth'
  }

  // --------------------------------------------------
  // Normal dashboard routes
  // --------------------------------------------------

  const requestedRole = String(to.meta.role ?? '')

  if (!requestedRole) {
    return true
  }

  const roleMap: Record<AppRole, string> = {
    developer: 'DEVELOPER',
    manager: 'MANAGER',
    sales: 'SALESMAN',
    videographer: 'VIDEOGRAPHER',
    photographer: 'PHOTOGRAPHER',
    editor: 'VIDEO_EDITOR',
  }

  const requiredRole = roleMap[requestedRole as AppRole]

  if (!requiredRole) {
    return true
  }

  return availableRoles.has(requiredRole)
    ? true
    : '/auth'
})

export default router