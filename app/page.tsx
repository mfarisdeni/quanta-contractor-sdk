import { redirect } from 'next/navigation'
import {
  QuantaDashboard,
  type ContractorStats,
  type FeaturedView,
  type MonitoringStats,
  type ProjectView,
  type RiskView,
  type TaskView,
} from '@/components/quanta-dashboard'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type ProjectRow = Database['public']['Tables']['projects']['Row']

const CLOSED_TASK_STATUSES = ['completed', 'cancelled']

const TASK_STATUS: Record<string, { label: string; tone: 'default' | 'warning' | 'danger' | 'muted' }> = {
  todo: { label: 'Belum mulai', tone: 'muted' },
  in_progress: { label: 'Berjalan', tone: 'warning' },
  blocked: { label: 'Terblokir', tone: 'danger' },
  completed: { label: 'Selesai', tone: 'default' },
  cancelled: { label: 'Dibatalkan', tone: 'muted' },
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000)
}

function formatDate(value: string) {
  return parseDate(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function healthOf(project: ProjectRow, today: string) {
  if (project.status === 'completed') return { label: 'Selesai', tone: 'muted' as const }
  if (project.status === 'cancelled') return { label: 'Dibatalkan', tone: 'muted' as const }
  if (project.status === 'on_hold') return { label: 'Ditunda', tone: 'warning' as const }
  if (project.end_date && project.end_date < today) return { label: 'Terlambat', tone: 'danger' as const }
  if (project.status === 'planning') return { label: 'Perencanaan', tone: 'muted' as const }
  return { label: 'On track', tone: 'default' as const }
}

function delayOf(project: ProjectRow, today: string) {
  if (project.status === 'completed' || project.status === 'cancelled') return 'Tidak ada'
  if (project.end_date && project.end_date < today) return `${-daysBetween(today, project.end_date)} hari`
  return 'Tidak ada'
}

function severityOf(value: string): RiskView['severity'] {
  if (value === 'critical' || value === 'high') return 'Tinggi'
  if (value === 'medium') return 'Sedang'
  return 'Rendah'
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: session } = await supabase.auth.getClaims()
  if (!session?.claims?.sub) redirect('/login')

  const email = session.claims.email ?? ''

  const [organizationsResult, projectsResult, tasksResult, risksResult, signalsResult, milestonesResult] = await Promise.all([
    supabase.from('organizations').select('id, name'),
    supabase.from('projects').select('*').order('created_at', { ascending: false }),
    supabase.from('tasks').select('id, project_id, title, status, due_date, progress_percent').order('due_date', { ascending: true, nullsFirst: false }).limit(200),
    supabase.from('risks').select('id, project_id, title, severity, status, category, due_date').order('due_date', { ascending: true, nullsFirst: false }).limit(100),
    supabase.from('signals').select('id, severity, status').eq('status', 'open').limit(100),
    supabase.from('milestones').select('id, project_id, name, status, due_date').order('due_date', { ascending: true, nullsFirst: false }).limit(100),
  ])

  const dataError = Boolean(
    organizationsResult.error ||
      projectsResult.error ||
      tasksResult.error ||
      risksResult.error ||
      signalsResult.error ||
      milestonesResult.error
  )

  const organizations = organizationsResult.data ?? []
  if (!organizationsResult.error && organizations.length === 0) redirect('/onboarding')

  const projects = projectsResult.data ?? []
  const tasks = tasksResult.data ?? []
  const risks = risksResult.data ?? []
  const signals = signalsResult.data ?? []
  const milestones = milestonesResult.data ?? []

  const now = new Date()
  const today = dateKey(now)
  const dateLabel = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const shortDateLabel = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const hour = now.getHours()
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam'
  const localName = email.split('@')[0] || 'Pengguna'
  const displayName = localName.charAt(0).toUpperCase() + localName.slice(1)

  const projectNameById = new Map(projects.map((project) => [project.id, project.name]))
  const projectCodeById = new Map(projects.map((project) => [project.id, project.project_code ?? 'Tanpa kode']))

  const progressByProject = new Map<string, { total: number; count: number }>()
  for (const task of tasks) {
    const entry = progressByProject.get(task.project_id) ?? { total: 0, count: 0 }
    entry.total += Number(task.progress_percent)
    entry.count += 1
    progressByProject.set(task.project_id, entry)
  }

  const progressOf = (projectId: string) => {
    const entry = progressByProject.get(projectId)
    if (!entry || entry.count === 0) return 0
    return Math.round(entry.total / entry.count)
  }

  const projectViews: ProjectView[] = projects.map((project) => {
    const health = healthOf(project, today)
    return {
      id: project.id,
      name: project.name,
      code: project.project_code ?? 'Tanpa kode',
      contractor: project.contractor_name || project.client_name || '—',
      progress: progressOf(project.id),
      health: health.label,
      healthTone: health.tone,
      delay: delayOf(project, today),
    }
  })

  const openTasks = tasks.filter((task) => !CLOSED_TASK_STATUSES.includes(task.status))
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date < today)
  const dueTodayTasks = openTasks.filter((task) => task.due_date === today)
  const allDueToday = tasks.filter((task) => task.due_date === today)
  const doneToday = allDueToday.filter((task) => task.status === 'completed').length

  const openRisks = risks.filter((risk) => risk.status === 'open' || risk.status === 'monitoring')
  const highRisks = openRisks.filter((risk) => risk.severity === 'critical' || risk.severity === 'high')
  const criticalSignals = signals.filter((signal) => signal.severity === 'critical' || signal.severity === 'high')

  const taskViews: TaskView[] = openTasks.slice(0, 4).map((task) => ({
    id: task.id,
    title: task.title,
    meta: `${projectNameById.get(task.project_id) ?? 'Proyek'}${task.due_date ? ` · Jatuh tempo ${formatDate(task.due_date)}` : ' · Tanpa tenggat'}`,
    status: TASK_STATUS[task.status]?.label ?? 'Terbuka',
    tone: TASK_STATUS[task.status]?.tone ?? 'muted',
  }))

  const riskViews: RiskView[] = openRisks.slice(0, 4).map((risk) => ({
    id: risk.id,
    title: risk.title,
    meta: risk.due_date ? `Jatuh tempo ${formatDate(risk.due_date)}` : risk.category || 'Risiko proyek',
    severity: severityOf(risk.severity),
    projectCode: projectCodeById.get(risk.project_id) ?? '—',
  }))

  let featured: FeaturedView | null = null
  const firstProject = projects[0]
  if (firstProject) {
    const health = healthOf(firstProject, today)
    const projectTasks = tasks.filter((task) => task.project_id === firstProject.id)
    const nextMilestone = milestones.find(
      (milestone) => milestone.project_id === firstProject.id && milestone.status !== 'completed' && milestone.status !== 'cancelled'
    )
    const daysLeft = firstProject.end_date ? daysBetween(today, firstProject.end_date) : null
    featured = {
      name: firstProject.name,
      code: firstProject.project_code ?? 'Tanpa kode',
      progress: progressOf(firstProject.id),
      health: health.label,
      healthTone: health.tone,
      tasksLabel: projectTasks.length ? `${projectTasks.length} tugas terhubung` : 'Belum ada tugas pada proyek ini',
      weeks: firstProject.start_date ? `Minggu ke-${Math.max(1, Math.floor(daysBetween(firstProject.start_date, today) / 7) + 1)}` : '—',
      daysLeft: daysLeft === null ? '—' : daysLeft >= 0 ? `${daysLeft} hari` : 'Lewat tenggat',
      milestone: nextMilestone?.name ?? '—',
    }
  }

  const activeProjects = projects.filter((project) => project.status === 'active')
  const lateActiveProjects = activeProjects.filter((project) => project.end_date && project.end_date < today)
  const avgProgress = projectViews.length
    ? Math.round(projectViews.reduce((sum, project) => sum + project.progress, 0) / projectViews.length)
    : 0

  const monitoringStats: MonitoringStats = {
    active: String(activeProjects.length),
    activeDetail: activeProjects.length
      ? `${activeProjects.length - lateActiveProjects.length} on track · ${lateActiveProjects.length} perlu perhatian`
      : 'Belum ada proyek berjalan',
    progress: `${avgProgress}%`,
    progressDetail: `${tasks.length} tugas terhubung`,
    overdue: String(overdueTasks.length),
    overdueDetail: overdueTasks.length ? 'Melewati jadwal' : 'Semua tugas sesuai jadwal',
    alerts: String(criticalSignals.length),
    alertsDetail: criticalSignals.length ? 'Perlu eskalasi hari ini' : 'Tidak ada eskalasi',
  }

  const contractorStats: ContractorStats = {
    progress: `${featured?.progress ?? 0}%`,
    progressDetail: featured?.tasksLabel ?? 'Belum ada proyek',
    checklist: `${doneToday}/${allDueToday.length}`,
    checklistDetail: allDueToday.length
      ? `${allDueToday.length - doneToday} item belum selesai`
      : 'Belum ada tugas jatuh tempo hari ini',
    tasks: String(openTasks.length),
    tasksDetail: dueTodayTasks.length
      ? `${dueTodayTasks.length} tugas jatuh tempo hari ini`
      : 'Tidak ada tugas jatuh tempo hari ini',
    issues: String(openRisks.length),
    issuesDetail: openRisks.length ? `${highRisks.length} berprioritas tinggi` : 'Tidak ada isu terbuka',
    attention: String(overdueTasks.length + openRisks.length),
  }

  return (
    <QuantaDashboard
      greeting={greeting}
      displayName={displayName}
      dateLabel={dateLabel}
      shortDateLabel={shortDateLabel}
      email={email}
      orgName={organizations[0]?.name ?? ''}
      organizationId={organizations[0]?.id ?? ''}
      breadcrumb={projects[0]?.name ?? 'Belum ada proyek'}
      dataError={dataError}
      contractorStats={contractorStats}
      monitoringStats={monitoringStats}
      projects={projectViews}
      featured={featured}
      todayTasks={taskViews}
      risks={riskViews}
    />
  )
}
