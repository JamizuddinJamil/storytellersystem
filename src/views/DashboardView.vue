<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  Film,
  HardDrive,
  RefreshCw,
  Server,
  ShieldCheck,
  WalletCards,
  XCircle
} from '@lucide/vue'
import { supabase } from '../lib/supabase'

const route = useRoute()
const router = useRouter()

/* ==================================================
 * COMMON
 * ================================================== */

const role = computed(() => String(route.meta.role ?? 'manager'))
const userName = ref('there')

const money = (value: number) =>
  `RM ${value.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`


/* ==================================================
 * DEVELOPER — SYSTEM MONITORING
 * ================================================== */

type SystemStatus =
  | 'operational'
  | 'warning'
  | 'error'
  | 'checking'

interface SystemCheck {
  name: string
  description: string
  status: SystemStatus
  detail: string
  icon: any
}

const systemChecks = ref<SystemCheck[]>([
  {
    name: 'Application',
    description: 'Storyteller frontend',
    status: 'checking',
    detail: 'Checking...',
    icon: Activity
  },
  {
    name: 'Supabase',
    description: 'Database connection',
    status: 'checking',
    detail: 'Checking...',
    icon: Database
  },
  {
    name: 'Authentication',
    description: 'Supabase Auth',
    status: 'checking',
    detail: 'Checking...',
    icon: ShieldCheck
  },
  {
    name: 'Database',
    description: 'Core database tables',
    status: 'checking',
    detail: 'Checking...',
    icon: Server
  },
  {
    name: 'Storage',
    description: 'Supabase Storage',
    status: 'checking',
    detail: 'Checking...',
    icon: HardDrive
  }
])

const databaseStats = ref({
  profiles: 0,
  jobs: 0,
  clients: 0,
  quotations: 0,
  invoices: 0,
  payments: 0
})

const databaseLoading = ref(false)
const databaseError = ref('')
const lastChecked = ref<Date | null>(null)
const systemRefreshing = ref(false)

const statusLabel = (status: SystemStatus) =>
  status === 'operational'
    ? 'Operational'
    : status === 'warning'
      ? 'Needs attention'
      : status === 'error'
        ? 'Error'
        : 'Checking...'

const statusClass = (status: SystemStatus) =>
  `system-status system-status--${status}`

const statusIcon = (status: SystemStatus) =>
  status === 'operational'
    ? CheckCircle2
    : status === 'warning'
      ? AlertTriangle
      : status === 'error'
        ? XCircle
        : RefreshCw

async function checkSupabaseConnection() {
  const start = performance.now()

  const { error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const responseTime = Math.round(performance.now() - start)

  const index = systemChecks.value.findIndex(
    (item) => item.name === 'Supabase'
  )

  if (index === -1) return

  systemChecks.value[index] = {
    ...systemChecks.value[index],
    status: error ? 'error' : 'operational',
    detail: error ? error.message : `${responseTime}ms response`
  }
}

async function checkAuthentication() {
  const index = systemChecks.value.findIndex(
    (item) => item.name === 'Authentication'
  )

  if (index === -1) return

  const {
    data: { user },
    error
  } = await supabase.auth.getUser()

  systemChecks.value[index] = {
    ...systemChecks.value[index],
    status: error ? 'error' : 'operational',
    detail: error
      ? error.message
      : user
        ? 'Authenticated session active'
        : 'Auth service online'
  }
}

async function checkDatabase() {
  const index = systemChecks.value.findIndex(
    (item) => item.name === 'Database'
  )

  if (index === -1) return

  const results = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('jobs').select('id', { count: 'exact', head: true }),
    supabase.from('clients').select('id', { count: 'exact', head: true }),
    supabase.from('quotations').select('id', { count: 'exact', head: true }),
    supabase.from('invoices').select('id', { count: 'exact', head: true }),
    supabase.from('payments').select('id', { count: 'exact', head: true })
  ])

  const firstError = results.find((result) => result.error)?.error

  if (firstError) {
    databaseError.value = firstError.message

    systemChecks.value[index] = {
      ...systemChecks.value[index],
      status: 'error',
      detail: firstError.message
    }

    return
  }

  databaseStats.value = {
    profiles: results[0].count ?? 0,
    jobs: results[1].count ?? 0,
    clients: results[2].count ?? 0,
    quotations: results[3].count ?? 0,
    invoices: results[4].count ?? 0,
    payments: results[5].count ?? 0
  }

  systemChecks.value[index] = {
    ...systemChecks.value[index],
    status: 'operational',
    detail: 'All core tables responding'
  }
}

async function checkStorage() {
  const index = systemChecks.value.findIndex(
    (item) => item.name === 'Storage'
  )

  if (index === -1) return

  const { data, error } = await supabase.storage.listBuckets()

  systemChecks.value[index] = {
    ...systemChecks.value[index],
    status: error ? 'warning' : 'operational',
    detail: error
      ? 'Storage API unavailable or restricted'
      : `${data?.length ?? 0} storage bucket(s) detected`
  }
}

async function runSystemCheck() {
  if (role.value !== 'developer') return

  systemRefreshing.value = true
  databaseLoading.value = true
  databaseError.value = ''

  systemChecks.value = systemChecks.value.map((item) => ({
    ...item,
    status: 'checking',
    detail: 'Checking...'
  }))

  try {
    await Promise.all([
      checkSupabaseConnection(),
      checkAuthentication(),
      checkDatabase(),
      checkStorage()
    ])

    const appIndex = systemChecks.value.findIndex(
      (item) => item.name === 'Application'
    )

    if (appIndex !== -1) {
      systemChecks.value[appIndex] = {
        ...systemChecks.value[appIndex],
        status: 'operational',
        detail: 'Frontend loaded successfully'
      }
    }

    lastChecked.value = new Date()
  } finally {
    databaseLoading.value = false
    systemRefreshing.value = false
  }
}

const operationalCount = computed(
  () =>
    systemChecks.value.filter(
      (item) => item.status === 'operational'
    ).length
)

const warningCount = computed(
  () =>
    systemChecks.value.filter(
      (item) => item.status === 'warning'
    ).length
)

const errorCount = computed(
  () =>
    systemChecks.value.filter(
      (item) => item.status === 'error'
    ).length
)

const overallSystemStatus = computed<SystemStatus>(() => {
  if (systemChecks.value.some((item) => item.status === 'error')) {
    return 'error'
  }

  if (systemChecks.value.some((item) => item.status === 'warning')) {
    return 'warning'
  }

  if (systemChecks.value.some((item) => item.status === 'checking')) {
    return 'checking'
  }

  return 'operational'
})

const overallStatusText = computed(() => {
  if (overallSystemStatus.value === 'error') {
    return 'System has errors requiring attention'
  }

  if (overallSystemStatus.value === 'warning') {
    return 'System operational with warnings'
  }

  if (overallSystemStatus.value === 'checking') {
    return 'Checking system health...'
  }

  return 'All monitored systems operational'
})

const formattedLastChecked = computed(() =>
  lastChecked.value
    ? lastChecked.value.toLocaleTimeString('en-MY', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : 'Never'
)


/* ==================================================
 * MANAGER
 * ================================================== */

const managerSummary = ref({
  jobsToRelease: 0,
  quotationsToFollowUp: 0,
  invoicesToReview: 0,
  paymentsToRelease: 0,
  cashIn: 0,
  cashOut: 0,
  freelancerPayouts: 0,
  commissions: 0
})

const summaryLoading = ref(false)
const summaryError = ref('')

async function loadManagerSummary() {
  summaryLoading.value = true
  summaryError.value = ''

  const [
    jobsResult,
    quotationsResult,
    invoicesResult,
    paymentsResult,
    payoutsResult,
    commissionsResult
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'POST_PRODUCTION_SETUP'),

    supabase
      .from('quotations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'SENT'),

    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'DEPOSIT_PENDING'),

    supabase
      .from('payments')
      .select('amount')
      .eq('status', 'VERIFIED'),

    supabase
      .from('freelancer_payouts')
      .select('amount, status'),

    supabase
      .from('salesman_commissions')
      .select('amount, status')
  ])

  const firstError = [
    jobsResult,
    quotationsResult,
    invoicesResult,
    paymentsResult,
    payoutsResult,
    commissionsResult
  ].find((result) => result.error)?.error

  if (firstError) {
    summaryError.value = firstError.message
  }

  const sum = (
    items: Array<{ amount: number }> | null | undefined
  ) =>
    (items ?? []).reduce(
      (total, item) => total + Number(item.amount),
      0
    )

  const releasedPayouts = (payoutsResult.data ?? []).filter(
    (item) => item.status === 'PAID'
  )

  const paidCommissions = (commissionsResult.data ?? []).filter(
    (item) => item.status === 'PAID'
  )

  managerSummary.value = {
    jobsToRelease: jobsResult.count ?? 0,
    quotationsToFollowUp: quotationsResult.count ?? 0,
    invoicesToReview: invoicesResult.count ?? 0,
    paymentsToRelease: (payoutsResult.data ?? []).filter(
      (item) => item.status === 'PENDING'
    ).length,
    cashIn: sum(paymentsResult.data),
    cashOut:
      sum(releasedPayouts) +
      sum(paidCommissions),
    freelancerPayouts: sum(releasedPayouts),
    commissions: sum(paidCommissions)
  }

  summaryLoading.value = false
}


/* ==================================================
 * SALES
 *
 * Live "what needs to be looked after" numbers,
 * scoped to quotations this salesman created.
 * ================================================== */

const salesSummary = ref({
  quotationsAwaitingDecision: 0,
  depositsToFollowUp: 0,
  jobsAwaitingReview: 0,
  commissionPending: 0
})

const salesSummaryLoading = ref(false)
const salesSummaryError = ref('')

async function loadSalesSummary() {
  salesSummaryLoading.value = true
  salesSummaryError.value = ''

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    salesSummaryLoading.value = false
    return
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!profile) {
    salesSummaryLoading.value = false
    return
  }

  const { data: ownQuotations, error: ownQuotationsError } = await supabase
    .from('quotations')
    .select('id')
    .eq('created_by', profile.id)

  if (ownQuotationsError) {
    salesSummaryError.value = ownQuotationsError.message
    salesSummaryLoading.value = false
    return
  }

  const ownQuotationIds = (ownQuotations ?? []).map((item) => item.id)

  const [sentResult, depositResult, reviewResult, commissionResult] = await Promise.all([
    supabase
      .from('quotations')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', profile.id)
      .eq('status', 'SENT'),

    ownQuotationIds.length
      ? supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .in('quotation_id', ownQuotationIds)
          .eq('payment_status', 'DEPOSIT_PENDING')
      : Promise.resolve({ count: 0, error: null } as any),

    ownQuotationIds.length
      ? supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .in('quotation_id', ownQuotationIds)
          .eq('status', 'REVIEW')
      : Promise.resolve({ count: 0, error: null } as any),

    supabase
      .from('salesman_commissions')
      .select('amount')
      .eq('salesman_id', profile.id)
      .eq('status', 'PENDING')
  ])

  const firstError = [sentResult, depositResult, reviewResult, commissionResult].find(
    (result: any) => result.error
  )?.error

  if (firstError) {
    salesSummaryError.value = firstError.message
  }

  salesSummary.value = {
    quotationsAwaitingDecision: sentResult.count ?? 0,
    depositsToFollowUp: depositResult.count ?? 0,
    jobsAwaitingReview: reviewResult.count ?? 0,
    commissionPending: (commissionResult.data ?? []).reduce(
      (total: number, item: { amount: number }) => total + Number(item.amount),
      0
    )
  }

  salesSummaryLoading.value = false
}


/* ==================================================
 * FREELANCER
 *
 * Roles:
 * - videographer
 * - photographer
 * - editor
 *
 * IMPORTANT:
 * All freelancer-specific dashboard logic lives here.
 * ================================================== */

interface FreelancerJob {
  id: string
  title: string | null
  job_date: string | null
  start_time: string | null
  location: string | null
  status: string | null
  assignment_status?: string | null
  is_available?: boolean
}

const freelancerSummary = ref({
  availableJobs: 0,
  upcomingJobs: 0,
  completedJobs: 0,
  actionRequired: 0
})

const freelancerJobs = ref<FreelancerJob[]>([])
const freelancerLoading = ref(false)
const freelancerError = ref('')

const isFreelancer = computed(() =>
  [
    'videographer',
    'photographer',
    'editor'
  ].includes(role.value)
)

/*
 * The next upcoming job assigned to the freelancer.
 */
const nextFreelancerJob = computed(() => {
  return freelancerJobs.value
    .filter(
      (job) =>
        !job.is_available &&
        job.job_date
    )
    .sort(
      (a, b) =>
        new Date(a.job_date!).getTime() -
        new Date(b.job_date!).getTime()
    )[0] ?? null
})

/*
 * ==================================================
 * FREELANCER DATABASE LOADER
 * ==================================================
 *
 * This is the main function to edit later if the
 * jobs / assignments schema changes.
 *
 * Current version reads from "jobs".
 *
 * When the actual freelancer assignment table is
 * confirmed, only this section should need updating.
 */
async function loadFreelancerDashboard() {
  if (!isFreelancer.value) return

  freelancerLoading.value = true
  freelancerError.value = ''

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not signed in.')

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (!profile) throw new Error('Profile not found.')

    /*
     * 1. AVAILABLE JOBS
     *
     * Jobs released for freelancer/team selection.
     */
    const { data: availableJobsRaw, error: availableError } =
      await supabase
        .from('jobs')
        .select(`
          id,
          job_number,
          event_type,
          event_date,
          event_start_time,
          event_location,
          status
        `)
        .eq('status', 'POST_PRODUCTION_SETUP')
        .order('event_date', { ascending: true })

    if (availableError) {
      throw availableError
    }

    const availableJobs: FreelancerJob[] = (availableJobsRaw ?? []).map((job) => ({
      id: job.id,
      title: job.event_type,
      job_date: job.event_date,
      start_time: job.event_start_time,
      location: job.event_location,
      status: job.status,
    }))

    /*
     * 2. CURRENTLY ASSIGNED JOBS
     */
    const {
      data: assignments,
      error: assignmentError
    } = await supabase
      .from('job_assignments')
      .select(`
        id,
        job_id,
        user_id,
        status,
        jobs (
          id,
          job_number,
          event_type,
          event_date,
          event_start_time,
          event_location,
          status
        )
      `)
      .eq('user_id', profile.id)
      .neq('status', 'CANCELLED')

    const myAssignments =
      assignmentError
        ? []
        : assignments ?? []

    const myJobs: FreelancerJob[] =
      myAssignments
        .map((assignment: any) => ({
          id: assignment.jobs?.id,
          title: assignment.jobs?.event_type,
          job_date: assignment.jobs?.event_date,
          start_time: assignment.jobs?.event_start_time,
          location: assignment.jobs?.event_location,
          status: assignment.jobs?.status,
          assignment_status: assignment.status,
          is_available: false
        }))
        .filter((job: FreelancerJob) => job.id)

    /*
     * 3. UPCOMING
     */
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcomingJobs = myJobs.filter((job) => {
      if (!job.job_date) return false

      return (
        new Date(job.job_date).getTime() >=
        today.getTime()
      )
    })

    /*
     * 4. COMPLETED
     */
    const completedJobs = myJobs.filter(
      (job) =>
        job.status === 'DELIVERED' ||
        job.assignment_status === 'COMPLETED'
    )

    /*
     * 5. ACTION REQUIRED
     */
    const actionRequired = myJobs.filter((job) =>
      job.assignment_status === 'CLAIMED'
    )

    /*
     * 6. SUMMARY
     */
    freelancerSummary.value = {
      availableJobs:
        availableJobs.length,

      upcomingJobs:
        upcomingJobs.length,

      completedJobs:
        completedJobs.length,

      actionRequired:
        actionRequired.length
    }

    /*
     * 7. JOB LIST
     *
     * Available + assigned jobs.
     * Duplicate jobs are removed.
     */
    const combinedJobs: FreelancerJob[] = [
      ...availableJobs.map((job) => ({
        ...job,
        is_available: true
      })),

      ...myJobs
    ]

    freelancerJobs.value =
      combinedJobs
        .filter(
          (job, index, self) =>
            index ===
            self.findIndex(
              (item) => item.id === job.id
            )
        )
        .sort((a, b) => {
          if (!a.job_date) return 1
          if (!b.job_date) return -1

          return (
            new Date(a.job_date).getTime() -
            new Date(b.job_date).getTime()
          )
        })
        .slice(0, 6)

  } catch (error: any) {
    freelancerError.value =
      error?.message ??
      'Unable to load freelancer dashboard.'
  } finally {
    freelancerLoading.value = false
  }
}


/* ==================================================
 * DASHBOARD DATA
 * ================================================== */

const dashboardData = computed(() => {

  /* -----------------------------
   * SALES
   * ----------------------------- */
  if (role.value === 'sales') {
    const focusItems = [
      salesSummary.value.jobsAwaitingReview > 0
        ? `${salesSummary.value.jobsAwaitingReview} job(s) are waiting for you to log the client's decision.`
        : null,
      salesSummary.value.quotationsAwaitingDecision > 0
        ? `${salesSummary.value.quotationsAwaitingDecision} quotation(s) are waiting on the client.`
        : null,
      salesSummary.value.depositsToFollowUp > 0
        ? `${salesSummary.value.depositsToFollowUp} deposit(s) still need following up.`
        : null
    ].filter(Boolean)

    return {
      greeting: `Hello, ${userName.value}`,
      intro:
        'Keep your client conversations moving.',

      stats: [
        [
          String(salesSummary.value.quotationsAwaitingDecision).padStart(2, '0'),
          'Awaiting client decision',
          WalletCards
        ],
        [
          String(salesSummary.value.depositsToFollowUp).padStart(2, '0'),
          'Deposits to follow up',
          Clock3
        ],
        [
          String(salesSummary.value.jobsAwaitingReview).padStart(2, '0'),
          'Awaiting client review',
          Film
        ],
        [
          money(salesSummary.value.commissionPending),
          'Commission pending',
          CheckCircle2
        ]
      ],

      focus: 'Needs attention',
      focusText:
        salesSummaryLoading.value
          ? 'Loading your latest pipeline...'
          : salesSummaryError.value
            ? salesSummaryError.value
            : focusItems[0] ?? 'Nothing urgent right now — nice work staying on top of it.'
    }
  }


  /* -----------------------------
   * VIDEOGRAPHER / PHOTOGRAPHER
   * ----------------------------- */
  if (
    role.value === 'videographer' ||
    role.value === 'photographer'
  ) {
    const isVideo =
      role.value === 'videographer'

    return {
      greeting:
        `Good morning, ${userName.value}`,

      intro:
        'Stay on top of your jobs and upcoming schedule.',

      stats: [
        [
          String(
            freelancerSummary.value.availableJobs
          ).padStart(2, '0'),
          'Jobs available',
          Film
        ],

        [
          String(
            freelancerSummary.value.upcomingJobs
          ).padStart(2, '0'),
          'Upcoming jobs',
          Clock3
        ],

        [
          String(
            freelancerSummary.value.completedJobs
          ).padStart(2, '0'),
          'Completed jobs',
          CheckCircle2
        ],

        [
          String(
            freelancerSummary.value.actionRequired
          ).padStart(2, '0'),
          'Action required',
          AlertCircle
        ]
      ],

      focus:
        isVideo
          ? 'Next shoot'
          : 'Next photography job',

      focusText:
        nextFreelancerJob.value
          ? `${nextFreelancerJob.value.title ?? 'Untitled job'} · ${nextFreelancerJob.value.location ?? 'Location TBA'}`
          : freelancerLoading.value
            ? 'Loading your upcoming jobs...'
            : 'No upcoming jobs. Check available jobs to claim a new assignment.'
    }
  }


  /* -----------------------------
   * VIDEO EDITOR
   * ----------------------------- */
  if (role.value === 'editor') {
    return {
      greeting:
        `Good morning, ${userName.value}`,

      intro:
        'Keep your editing queue moving.',

      stats: [
        [
          String(
            freelancerSummary.value.availableJobs
          ).padStart(2, '0'),
          'Available edits',
          Film
        ],

        [
          String(
            freelancerSummary.value.upcomingJobs
          ).padStart(2, '0'),
          'Active edits',
          Clock3
        ],

        [
          String(
            freelancerSummary.value.completedJobs
          ).padStart(2, '0'),
          'Completed edits',
          CheckCircle2
        ],

        [
          String(
            freelancerSummary.value.actionRequired
          ).padStart(2, '0'),
          'Action required',
          AlertCircle
        ]
      ],

      focus: 'Editing queue',

      focusText:
        nextFreelancerJob.value
          ? `${nextFreelancerJob.value.title ?? 'Untitled job'} · Editing`
          : freelancerLoading.value
            ? 'Loading your editing queue...'
            : 'No active editing jobs right now.'
    }
  }


  /* -----------------------------
   * MANAGER / DEVELOPER FALLBACK
   * ----------------------------- */
  return {
    greeting:
      `Good morning, ${userName.value}`,

    intro:
      role.value === 'developer'
        ? 'Developer access — full operational overview.'
        : 'Here is the production picture for today.',

    stats: [
      [
        String(
          managerSummary.value.jobsToRelease
        ).padStart(2, '0'),
        'Jobs to release',
        BriefcaseBusiness
      ],

      [
        String(
          managerSummary.value.quotationsToFollowUp
        ).padStart(2, '0'),
        'Quotations to follow up',
        WalletCards
      ],

      [
        String(
          managerSummary.value.invoicesToReview
        ).padStart(2, '0'),
        'Invoices to review',
        FileCheck2
      ],

      [
        String(
          managerSummary.value.paymentsToRelease
        ).padStart(2, '0'),
        'Payments to release',
        CheckCircle2
      ]
    ],

    focus: 'Needs attention',

    focusText:
      summaryLoading.value
        ? 'Loading the latest workflow summary...'
        : summaryError.value
          ? summaryError.value
          : `${managerSummary.value.jobsToRelease} job(s) are ready for team release.`
  }
})


/* ==================================================
 * USER & LIFECYCLE
 * ================================================== */

onMounted(async () => {
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return

  const { data: profile } =
    await supabase
      .from('profiles')
      .select('full_name')
      .eq('auth_user_id', user.id)
      .maybeSingle()

  userName.value =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split('@')[0] ||
    'there'

  /*
   * MANAGER
   */
  if (
    role.value === 'manager' ||
    role.value === 'developer'
  ) {
    await loadManagerSummary()
  }

  /*
   * SALES
   */
  if (role.value === 'sales') {
    await loadSalesSummary()
  }

  /*
   * FREELANCER
   */
  if (isFreelancer.value) {
    await loadFreelancerDashboard()
  }

  /*
   * DEVELOPER
   */
  if (role.value === 'developer') {
    await runSystemCheck()
  }
})
</script>


<template>
  <div class="dashboard-view">

    <!-- ==================================================
         DEVELOPER DASHBOARD
         ================================================== -->

    <template v-if="role === 'developer'">

      <section class="developer-header panel">
        <div>
          <p class="eyebrow">
            Developer Console
          </p>

          <h2>
            System Health
          </h2>

          <p class="muted">
            Monitor Storyteller application,
            Supabase connection and database health.
          </p>
        </div>

        <button
          class="text-button"
          type="button"
          :disabled="systemRefreshing"
          @click="runSystemCheck"
        >
          <RefreshCw
            :size="16"
            :class="{ spinning: systemRefreshing }"
          />

          {{
            systemRefreshing
              ? 'Checking...'
              : 'Run check'
          }}
        </button>
      </section>


      <section class="developer-status panel">

        <div class="developer-status-main">

          <div
            class="developer-status-icon"
            :class="`developer-status-icon--${overallSystemStatus}`"
          >
            <component
              :is="statusIcon(overallSystemStatus)"
              :size="25"
            />
          </div>

          <div>
            <p class="eyebrow">
              Overall system status
            </p>

            <h3>
              {{ overallStatusText }}
            </h3>

            <p class="muted">
              Last checked:
              {{ formattedLastChecked }}
            </p>
          </div>

        </div>

        <div class="developer-status-counts">
          <div>
            <strong>{{ operationalCount }}</strong>
            <span>Operational</span>
          </div>

          <div>
            <strong>{{ warningCount }}</strong>
            <span>Warnings</span>
          </div>

          <div>
            <strong>{{ errorCount }}</strong>
            <span>Errors</span>
          </div>
        </div>

      </section>


      <section class="panel">

        <div class="panel-heading">

          <div>
            <p class="eyebrow">
              System checks
            </p>

            <h3>
              Service health
            </h3>
          </div>

          <Activity
            :size="21"
            class="panel-icon"
          />

        </div>

        <div class="system-check-list">

          <article
            v-for="check in systemChecks"
            :key="check.name"
            class="system-check"
          >

            <div class="system-check-icon">
              <component
                :is="check.icon"
                :size="19"
              />
            </div>

            <div class="system-check-copy">
              <strong>
                {{ check.name }}
              </strong>

              <span>
                {{ check.description }}
              </span>
            </div>

            <div
              :class="statusClass(check.status)"
            >
              <component
                :is="statusIcon(check.status)"
                :size="15"
              />

              <span>
                {{ statusLabel(check.status) }}
              </span>
            </div>

            <small>
              {{ check.detail }}
            </small>

          </article>

        </div>

      </section>


      <section class="panel">

        <div class="panel-heading">

          <div>
            <p class="eyebrow">
              Database
            </p>

            <h3>
              Supabase database overview
            </h3>

            <p class="muted">
              Live row counts from core Storyteller tables.
            </p>
          </div>

          <Database
            :size="22"
            class="panel-icon"
          />

        </div>

        <div class="database-grid">

          <div
            v-for="(val, label) in databaseStats"
            :key="label"
            class="database-card"
          >
            <span class="capitalize">
              {{ label }}
            </span>

            <strong>
              {{ val }}
            </strong>
          </div>

        </div>

        <p
          v-if="databaseError"
          class="developer-error"
        >
          {{ databaseError }}
        </p>

      </section>


      <section class="panel">

        <div class="panel-heading">

          <div>
            <p class="eyebrow">
              Supabase Free Tier
            </p>

            <h3>
              Usage monitoring
            </h3>

            <p class="muted">
              Quota monitoring is prepared for secure backend integration.
            </p>
          </div>

          <WalletCards
            :size="22"
            class="panel-icon"
          />

        </div>

        <div class="usage-grid">

          <div
            v-for="item in [
              'Database size',
              'Storage',
              'Bandwidth',
              'API requests'
            ]"
            :key="item"
            class="usage-card"
          >
            <span>
              {{ item }}
            </span>

            <strong>
              —
            </strong>

            <small>
              Requires secure usage API
            </small>
          </div>

        </div>

        <div class="developer-note">

          <AlertTriangle :size="17" />

          <p>
            Exact Supabase quota usage should not
            be fetched directly from the browser using
            a service-role key. Add a secure Edge
            Function/backend endpoint when quota
            monitoring is needed.
          </p>

        </div>

      </section>


      <section class="panel">

        <div class="panel-heading">
          <div>
            <p class="eyebrow">
              Developer
            </p>

            <h3>
              Things to monitor
            </h3>
          </div>
        </div>

        <div class="developer-tasks">

          <div>
            <span class="task-dot task-dot--ok"></span>

            <div>
              <strong>
                Authentication
              </strong>

              <small>
                Supabase Auth connection checked above.
              </small>
            </div>
          </div>

          <div>
            <span class="task-dot task-dot--ok"></span>

            <div>
              <strong>
                Role system
              </strong>

              <small>
                Developer elevated access and dashboard
                switching enabled.
              </small>
            </div>
          </div>

          <div>
            <span class="task-dot task-dot--warning"></span>

            <div>
              <strong>
                Supabase quota monitoring
              </strong>

              <small>
                Secure backend integration still required
                for exact usage.
              </small>
            </div>
          </div>

        </div>

      </section>

    </template>


    <!-- ==================================================
         FREELANCER DASHBOARD
         videographer / photographer / editor
         ================================================== -->

    <template
      v-else-if="
        role === 'videographer' ||
        role === 'photographer' ||
        role === 'editor'
      "
    >

      <!-- FREELANCER HEADER -->

      <section class="freelancer-header">

        <div>
          <p class="eyebrow">
            Freelancer Workspace
          </p>

          <h2>
            {{ dashboardData.greeting }}
          </h2>

          <p class="muted">
            {{ dashboardData.intro }}
          </p>
        </div>

      </section>


      <!-- FREELANCER STATS -->

      <section class="stats-grid freelancer-stats">

        <article
          v-for="stat in dashboardData.stats"
          :key="String(stat[1])"
          class="stat-card"
        >

          <div class="stat-icon">
            <component
              :is="stat[2]"
              :size="19"
            />
          </div>

          <strong>
            {{ stat[0] }}
          </strong>

          <span>
            {{ stat[1] }}
          </span>

        </article>

      </section>


      <!-- NEXT JOB -->

      <section class="panel panel--focus">

        <div class="panel-heading">

          <div>
            <p class="eyebrow">
              Upcoming
            </p>

            <h3>
              {{ dashboardData.focus }}
            </h3>
          </div>

          <button
            class="text-button"
            type="button"
            @click="router.push(`/${role}/jobs`)"
          >
            View jobs
            <ArrowUpRight :size="15" />
          </button>

        </div>


        <div
          v-if="nextFreelancerJob"
          class="focus-line"
        >

          <span class="focus-dot"></span>

          <div class="freelancer-next-job">

            <strong>
              {{ nextFreelancerJob.title ?? 'Untitled job' }}
            </strong>

            <span>
              {{ nextFreelancerJob.job_date }}

              <template
                v-if="nextFreelancerJob.start_time"
              >
                ·
                {{ nextFreelancerJob.start_time }}
              </template>
            </span>

            <span
              v-if="nextFreelancerJob.location"
            >
              {{ nextFreelancerJob.location }}
            </span>

          </div>

          <span class="status-badge">
            Upcoming
          </span>

        </div>


        <div
          v-else
          class="empty-state"
        >

          <CalendarDays :size="20" />

          <p>
            {{ dashboardData.focusText }}
          </p>

        </div>

      </section>


      <!-- AVAILABLE JOBS -->

      <section class="panel">

        <div class="panel-heading">

          <div>
            <p class="eyebrow">
              Opportunities
            </p>

            <h3>
              {{
                role === 'editor'
                  ? 'Available editing jobs'
                  : 'Available jobs'
              }}
            </h3>

            <p class="muted">
              {{
                role === 'editor'
                  ? 'Editing jobs currently available for you.'
                  : 'Jobs currently open for you to claim.'
              }}
            </p>
          </div>

          <BriefcaseBusiness
            :size="22"
            class="panel-icon"
          />

        </div>


        <!-- LOADING -->

        <div
          v-if="freelancerLoading"
          class="empty-state"
        >

          <RefreshCw
            :size="18"
            class="spinning"
          />

          <p>
            Loading your jobs...
          </p>

        </div>


        <!-- ERROR -->

        <div
          v-else-if="freelancerError"
          class="developer-error"
        >
          {{ freelancerError }}
        </div>


        <!-- JOBS -->

        <div
          v-else-if="freelancerJobs.length"
          class="freelancer-job-list"
        >

          <article
            v-for="job in freelancerJobs"
            :key="job.id"
            class="freelancer-job-card"
          >

            <div class="freelancer-job-main">

              <div class="freelancer-job-icon">

                <Film :size="18" />

              </div>


              <div>

                <strong>
                  {{ job.title ?? 'Untitled job' }}
                </strong>

                <span>

                  {{
                    job.job_date
                      ? new Date(job.job_date).toLocaleDateString(
                          'en-MY',
                          {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          }
                        )
                      : 'Date TBA'
                  }}

                  <template
                    v-if="job.start_time"
                  >
                    · {{ job.start_time }}
                  </template>

                </span>

                <small
                  v-if="job.location"
                >
                  {{ job.location }}
                </small>

              </div>

            </div>


            <div class="freelancer-job-action">

              <span
                v-if="job.is_available"
                class="status-badge"
              >
                Available
              </span>

              <span
                v-else
                class="status-badge"
              >
                Assigned
              </span>

              <button
                class="text-button"
                type="button"
                @click="router.push(`/${role}/jobs/${job.id}`)"
              >
                View
                <ArrowUpRight :size="15" />
              </button>

            </div>

          </article>

        </div>


        <!-- EMPTY -->

        <div
          v-else
          class="empty-state"
        >

          <BriefcaseBusiness :size="20" />

          <p>
            No jobs are currently available.
          </p>

        </div>

      </section>


      <!-- ACTION REQUIRED -->

      <section
        v-if="freelancerSummary.actionRequired > 0"
        class="panel freelancer-action-panel"
      >

        <div class="panel-heading">

          <div>
            <p class="eyebrow">
              Attention
            </p>

            <h3>
              Action required
            </h3>

            <p class="muted">
              You have
              {{ freelancerSummary.actionRequired }}
              job(s) that need your attention.
            </p>
          </div>

          <AlertCircle
            :size="22"
            class="panel-icon"
          />

        </div>

        <button
          class="text-button"
          type="button"
          @click="router.push(`/${role}/jobs`)"
        >
          Review jobs
          <ArrowUpRight :size="15" />
        </button>

      </section>

    </template>


    <!-- ==================================================
         MANAGER / SALES DASHBOARD
         ================================================== -->

    <template v-else>

      <!-- STATS -->

      <div class="stats-grid">

        <article
          v-for="stat in dashboardData.stats"
          :key="String(stat[1])"
          class="stat-card"
        >

          <div class="stat-icon">

            <component
              :is="stat[2]"
              :size="19"
            />

          </div>

          <strong>
            {{ stat[0] }}
          </strong>

          <span>
            {{ stat[1] }}
          </span>

        </article>

      </div>


      <!-- FOCUS + WORKFLOW -->

      <div class="dashboard-grid">

        <section class="panel panel--focus">

          <div class="panel-heading">

            <div>

              <p class="eyebrow">
                Today
              </p>

              <h3>
                {{ dashboardData.focus }}
              </h3>

            </div>

            <button
              class="text-button"
              type="button"
              @click="
                router.push(
                  role === 'sales'
                    ? '/sales/pipeline'
                    : '/manager/jobs'
                )
              "
            >
              View all
              <ArrowUpRight :size="15" />
            </button>

          </div>


          <div class="focus-line">

            <span class="focus-dot"></span>

            <p>
              {{ dashboardData.focusText }}
            </p>

            <span class="status-badge">
              In progress
            </span>

          </div>

        </section>


        <section class="panel">

          <div class="panel-heading">

            <div>

              <p class="eyebrow">
                Workflow
              </p>

              <h3>
                Production flow
              </h3>

            </div>

          </div>


          <div class="workflow-list">

            <div>
              <span>
                Client review
              </span>

              <strong>
                {{ managerSummary.invoicesToReview }}
              </strong>
            </div>

            <div>
              <span>
                Balance pending
              </span>

              <strong>
                {{ managerSummary.quotationsToFollowUp }}
              </strong>
            </div>

            <div>
              <span>
                Ready to deliver
              </span>

              <strong>
                {{ managerSummary.jobsToRelease }}
              </strong>
            </div>

          </div>

        </section>

      </div>


      <!-- MANAGER FINANCE -->

      <section
        v-if="role === 'manager'"
        class="panel finance-panel"
      >

        <div class="panel-heading">

          <div>

            <p class="eyebrow">
              Financial overview
            </p>

            <h3>
              Cash flow and profitability
            </h3>

            <p class="muted">
              Based on verified customer payments
              and recorded releases.
            </p>

          </div>

          <WalletCards
            :size="22"
            class="panel-icon"
          />

        </div>


        <div class="finance-grid">

          <div
            class="finance-metric finance-metric--in"
          >

            <span>
              Cash in
            </span>

            <strong>
              {{ money(managerSummary.cashIn) }}
            </strong>

            <small>
              Verified customer payments
            </small>

          </div>


          <div
            class="finance-metric finance-metric--out"
          >

            <span>
              Cash out
            </span>

            <strong>
              {{ money(managerSummary.cashOut) }}
            </strong>

            <small>
              Released payouts and commissions
            </small>

          </div>


          <div class="finance-metric">

            <span>
              Gross profit
            </span>

            <strong>
              {{
                money(
                  managerSummary.cashIn -
                  managerSummary.freelancerPayouts
                )
              }}
            </strong>

            <small>
              Cash in minus freelancer payouts
            </small>

          </div>


          <div class="finance-metric">

            <span>
              Net profit
            </span>

            <strong>
              {{
                money(
                  managerSummary.cashIn -
                  managerSummary.cashOut
                )
              }}
            </strong>

            <small>
              After payouts and commissions
            </small>

          </div>

        </div>

      </section>

    </template>

  </div>
</template>