<script setup lang="ts">

/* ==================================================
 * 1. IMPORTS & BASIC SETUP
 * ================================================== */

import { computed, onMounted, ref } from 'vue'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  MapPin,
  RefreshCw,
  UploadCloud
} from '@lucide/vue'
import { useRoute } from 'vue-router'
import { supabase } from '../lib/supabase'

const route = useRoute()

const role = computed(() => ({
  videographer: 'VIDEOGRAPHER',
  photographer: 'PHOTOGRAPHER',
  editor: 'VIDEO_EDITOR'
}[String(route.meta.role)] ?? 'VIDEOGRAPHER'))

const roleLabel = computed(() => ({
  VIDEOGRAPHER: 'Videographer',
  PHOTOGRAPHER: 'Photographer',
  VIDEO_EDITOR: 'Video editor'
}[role.value]))

/* ==================================================
 * 2. DATA & STATE
 * ================================================== */

type Job = {
  id: string
  job_number: string
  event_type: string
  event_date: string
  event_start_time: string | null
  event_end_time: string | null
  event_location: string | null
  status: string
  production_brief: string | null
  gdrive_url: string | null
  raw_files_url: string | null
  preview_url: string | null
  final_file_url: string | null
}

type Assignment = {
  id: string
  job_id: string
  role: string
  status: string
  claimed_at: string
  confirmed_at: string | null
  completed_at: string | null
  compensation_type: 'FIXED' | 'PERCENT' | null
  compensation_value: number | null
  compensation_amount: number | null
}

const jobs = ref<Job[]>([])
const assignments = ref<Assignment[]>([])

const loading = ref(false)
const submittingJob = ref('')
const error = ref('')
const message = ref('')

/* ==================================================
 * 3. DATABASE / RPC FUNCTIONS
 * ================================================== */

async function loadPipeline() {
  loading.value = true
  error.value = ''

  try {
    /*
     * Get current freelancer profile.
     *
     * profiles.id is used by job_assignments.user_id.
     */
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      error.value = 'Not signed in.'
      return
    }

    const {
      data: profile,
      error: profileError
    } = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (profileError) {
      error.value = profileError.message
      return
    }

    if (!profile) {
      error.value = 'Freelancer profile could not be found.'
      return
    }

    /*
     * Get assignments belonging to this freelancer.
     *
     * CANCELLED assignments are excluded.
     */
    const {
      data: assignmentData,
      error: assignmentError
    } = await supabase
      .from('job_assignments')
      .select(`
        id,
        job_id,
        role,
        status,
        claimed_at,
        confirmed_at,
        completed_at,
        compensation_type,
        compensation_value,
        compensation_amount
      `)
      .eq('user_id', profile.id)
      .eq('role', role.value)
      .neq('status', 'CANCELLED')
      .order('event_date', { ascending: true })

    if (assignmentError) {
      error.value = assignmentError.message
      return
    }

    assignments.value = assignmentData ?? []

    /*
     * No assignment = no pipeline.
     */
    if (!assignments.value.length) {
      jobs.value = []
      return
    }

    /*
     * Get the actual jobs.
     */
    const jobIds = assignments.value.map((item) => item.job_id)

    const {
      data: jobData,
      error: jobError
    } = await supabase
      .from('jobs')
      .select(`
        id,
        job_number,
        event_type,
        event_date,
        event_start_time,
        event_end_time,
        event_location,
        status,
        production_brief,
        gdrive_url,
        raw_files_url,
        preview_url,
        final_file_url
      `)
      .in('id', jobIds)
      .order('event_date', { ascending: true })

    if (jobError) {
      error.value = jobError.message
      return
    }

    jobs.value = jobData ?? []

  } finally {
    loading.value = false
  }
}


/*
 * Get assignment belonging to a specific job.
 */
function assignmentFor(jobId: string) {
  return assignments.value.find(
    (assignment) => assignment.job_id === jobId
  )
}


/*
 * Submit freelancer work.
 *
 * IMPORTANT:
 * We are NOT updating job_assignments directly here.
 *
 * The RPC handles the database-side submission so that
 * the workflow remains controlled by Supabase.
 */
async function submitJob(job: Job) {
  const assignment = assignmentFor(job.id)

  if (!assignment) {
    error.value = 'Assignment for this job could not be found.'
    return
  }

  const confirmed = window.confirm(
    `Submit ${job.job_number} as completed?\n\n` +
    `Make sure you have uploaded the required files to Google Drive first.`
  )

  if (!confirmed) return

  submittingJob.value = job.id
  error.value = ''
  message.value = ''

  try {
    /*
     * RPC:
     * submit_freelancer_job()
     *
     * IMPORTANT:
     * Use UUID directly.
     *
     * DO NOT use:
     * "PASTE-JOB-UUID-HERE"
     */
    const { error: rpcError } = await supabase.rpc(
      'submit_freelancer_job',
      {
        target_job_id: job.id
      }
    )

    if (rpcError) {
      error.value = rpcError.message
      return
    }

    message.value =
      `${job.job_number} submitted successfully.`

    /*
     * Reload pipeline so the new assignment/job status
     * immediately appears on screen.
     */
    await loadPipeline()

  } finally {
    submittingJob.value = ''
  }
}


/*
 * Refresh manually.
 */
async function refreshPipeline() {
  await loadPipeline()
}


/* ==================================================
 * 4. COMPUTED HELPERS & LIFECYCLE
 * ================================================== */

const pipelineJobs = computed(() => {
  return jobs.value.map((job) => ({
    job,
    assignment: assignmentFor(job.id)
  }))
})

function formatStatus(status: string) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(date: string) {
  if (!date) return '-'

  return new Date(`${date}T00:00:00`)
    .toLocaleDateString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
}

function formatTime(time: string | null) {
  if (!time) return ''

  return time.slice(0, 5)
}

function compensationText(assignment: Assignment | undefined) {
  if (!assignment) return ''

  if (assignment.compensation_type === 'PERCENT') {
    return `${assignment.compensation_value ?? 0}%`
  }

  if (assignment.compensation_amount !== null) {
    return `RM ${Number(assignment.compensation_amount).toFixed(2)}`
  }

  return '-'
}

function isCompleted(assignment: Assignment | undefined) {
  return Boolean(assignment?.completed_at)
}

onMounted(loadPipeline)

</script>


<template>

  <div class="freelancer-pipeline-view">

    <!-- ==================================================
         HEADER
         ================================================== -->

    <div class="welcome-row">

      <div>
        <p class="eyebrow">
          Assigned production work
        </p>

        <h2>
          My pipeline
        </h2>

        <p class="muted">
          Track your assigned jobs, access Google Drive files
          and submit completed production work.
        </p>
      </div>

      <button
        class="text-button"
        type="button"
        :disabled="loading"
        @click="refreshPipeline"
      >
        <RefreshCw
          :size="16"
          :class="{ spinning: loading }"
        />

        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>

    </div>


    <!-- ==================================================
         ROLE
         ================================================== -->

    <div class="role-summary">
      <BriefcaseBusiness :size="17" />

      <span>
        {{ roleLabel }}
      </span>
    </div>


    <!-- ==================================================
         MESSAGES
         ================================================== -->

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
         PIPELINE LIST
         ================================================== -->

    <section
      v-if="pipelineJobs.length"
      class="freelancer-pipeline-list"
    >

      <article
        v-for="item in pipelineJobs"
        :key="item.job.id"
        class="panel freelancer-pipeline-card"
      >

        <!-- JOB HEADER -->

        <div class="freelancer-pipeline-card__header">

          <div class="pipeline-job-icon">
            <BriefcaseBusiness :size="19" />
          </div>

          <div class="pipeline-job-info">

            <p class="eyebrow">
              {{ item.job.job_number }}
            </p>

            <h3>
              {{ item.job.event_type }}
            </h3>

          </div>

          <span
            class="status-badge"
            :class="{
              'status-badge--success': isCompleted(item.assignment)
            }"
          >
            {{ formatStatus(item.assignment?.status ?? item.job.status) }}
          </span>

        </div>


        <!-- JOB DETAILS -->

        <div class="freelancer-pipeline-meta">

          <div>
            <Clock3 :size="15" />

            <span>
              {{ formatDate(item.job.event_date) }}

              <template
                v-if="item.job.event_start_time"
              >
                · {{ formatTime(item.job.event_start_time) }}
              </template>

              <template
                v-if="item.job.event_end_time"
              >
                – {{ formatTime(item.job.event_end_time) }}
              </template>
            </span>
          </div>


          <div>
            <MapPin :size="15" />

            <span>
              {{ item.job.event_location || 'Location pending' }}
            </span>
          </div>

        </div>


        <!-- PRODUCTION BRIEF -->

        <div
          v-if="item.job.production_brief"
          class="freelancer-pipeline-brief"
        >

          <p class="eyebrow">
            Production brief
          </p>

          <p>
            {{ item.job.production_brief }}
          </p>

        </div>


        <!-- ==================================================
             GOOGLE DRIVE
             ================================================== -->

        <div class="freelancer-drive-card">

          <div class="freelancer-drive-card__icon">
            <UploadCloud :size="20" />
          </div>

          <div class="freelancer-drive-card__content">

            <strong>
              Google Drive
            </strong>

            <span>
              Upload your
              {{ role === 'VIDEO_EDITOR'
                ? 'edited/output files'
                : 'raw footage'
              }}
              to the assigned job folder.
            </span>

          </div>


          <a
            v-if="item.job.gdrive_url"
            class="secondary-button"
            :href="item.job.gdrive_url"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Drive
            <ExternalLink :size="15" />
          </a>

          <span
            v-else
            class="drive-missing"
          >
            Drive folder not available yet
          </span>

        </div>


        <!-- ==================================================
             FILE STATUS
             ================================================== -->

        <div class="freelancer-file-status">

          <div>

            <FileCheck2 :size="17" />

            <span>
              Raw files
            </span>

            <strong
              v-if="item.job.raw_files_url"
            >
              Uploaded
            </strong>

            <small v-else>
              Pending
            </small>

          </div>


          <div
            v-if="role === 'VIDEO_EDITOR'"
          >

            <FileCheck2 :size="17" />

            <span>
              Final output
            </span>

            <strong
              v-if="item.job.final_file_url"
            >
              Uploaded
            </strong>

            <small v-else>
              Pending
            </small>

          </div>

        </div>


        <!-- ==================================================
             COMPENSATION
             ================================================== -->

        <div
          v-if="item.assignment"
          class="freelancer-compensation"
        >

          <span>
            Your compensation
          </span>

          <strong>
            {{ compensationText(item.assignment) }}
          </strong>

        </div>


        <!-- ==================================================
             ACTIONS
             ================================================== -->

        <div class="freelancer-pipeline-actions">

          <!-- OPEN DRIVE -->

          <a
            v-if="item.job.gdrive_url"
            class="text-button"
            :href="item.job.gdrive_url"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Google Drive
            <ArrowUpRight :size="15" />
          </a>


          <!-- COMPLETED -->

          <div
            v-if="isCompleted(item.assignment)"
            class="claimed-state"
          >

            <CheckCircle2 :size="17" />

            <span>
              Submitted
              <template
                v-if="item.assignment?.completed_at"
              >
                · {{ formatDate(item.assignment.completed_at.slice(0, 10)) }}
              </template>
            </span>

          </div>


          <!-- SUBMIT -->

          <button
            v-else
            class="primary-button"
            type="button"
            :disabled="submittingJob === item.job.id"
            @click="submitJob(item.job)"
          >

            <CheckCircle2 :size="16" />

            {{
              submittingJob === item.job.id
                ? 'Submitting...'
                : 'Done & Submit'
            }}

          </button>

        </div>

      </article>

    </section>


    <!-- ==================================================
         EMPTY STATE
         ================================================== -->

    <div
      v-else-if="!loading"
      class="panel empty-state"
    >

      <BriefcaseBusiness :size="30" />

      <strong>
        No assigned jobs
      </strong>

      <span>
        Jobs you claim will appear here.
      </span>

    </div>


    <!-- ==================================================
         LOADING STATE
         ================================================== -->

    <div
      v-if="loading && !pipelineJobs.length"
      class="panel empty-state"
    >

      <RefreshCw
        :size="28"
        class="spinning"
      />

      <strong>
        Loading pipeline...
      </strong>

      <span>
        Checking your assigned production jobs.
      </span>

    </div>

  </div>

</template>