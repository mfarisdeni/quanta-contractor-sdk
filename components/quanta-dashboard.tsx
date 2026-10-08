'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, Bell, Bot, CheckSquare, ChevronDown, ClipboardList, FileText, History, LayoutDashboard, ListTodo, Menu, Moon, MoreHorizontal, Plus, Search, Settings, Sparkles, Sun, TrendingUp, X } from 'lucide-react'
import { AskAiPanel } from '@/components/ask-ai-panel'
import { CreateProjectDialog } from '@/components/create-project-dialog'
import { Badge } from '@/components/ui/badge'
import { buttonVariants, Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { navItems } from '@/lib/mock-data'

const iconMap = { LayoutDashboard, ClipboardList, CheckSquare, ListTodo, TrendingUp, AlertTriangle, FileText, Sparkles, Bell, History }

type Tone = 'default' | 'warning' | 'danger' | 'muted'

export type ProjectView = {
  id: string
  name: string
  code: string
  contractor: string
  progress: number
  health: string
  healthTone: Tone
  delay: string
}

export type FeaturedView = {
  name: string
  code: string
  progress: number
  health: string
  healthTone: Tone
  tasksLabel: string
  weeks: string
  daysLeft: string
  milestone: string
}

export type TaskView = {
  id: string
  title: string
  meta: string
  status: string
  tone: Tone
}

export type RiskView = {
  id: string
  title: string
  meta: string
  severity: 'Tinggi' | 'Sedang' | 'Rendah'
  projectCode: string
}

export type ContractorStats = {
  progress: string
  progressDetail: string
  checklist: string
  checklistDetail: string
  tasks: string
  tasksDetail: string
  issues: string
  issuesDetail: string
  attention: string
}

export type MonitoringStats = {
  active: string
  activeDetail: string
  progress: string
  progressDetail: string
  overdue: string
  overdueDetail: string
  alerts: string
  alertsDetail: string
}

export type QuantaDashboardProps = {
  greeting: string
  displayName: string
  dateLabel: string
  shortDateLabel: string
  email: string
  orgName: string
  organizationId: string
  breadcrumb: string
  dataError: boolean
  contractorStats: ContractorStats
  monitoringStats: MonitoringStats
  projects: ProjectView[]
  featured: FeaturedView | null
  todayTasks: TaskView[]
  risks: RiskView[]
}

function StatCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent?: string }) {
  return <Card className="border-border/70 shadow-none"><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p><div className="mt-3 flex items-end justify-between gap-3"><p className="text-3xl font-semibold tracking-tight">{value}</p>{accent && <span className="text-xs font-medium text-emerald-600">{accent}</span>}</div><p className="mt-2 text-xs text-muted-foreground">{detail}</p></CardContent></Card>
}

function StatusBadge({ children, tone = 'default' }: { children: React.ReactNode; tone?: Tone }) {
  return <Badge variant={tone === 'default' ? 'secondary' : 'outline'} className={tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700' : tone === 'danger' ? 'border-red-200 bg-red-50 text-red-700' : tone === 'muted' ? 'text-muted-foreground' : ''}>{children}</Badge>
}

function Sidebar({ mode, setMode, active, setActive, collapsed, setCollapsed, email, orgName, initials }: { mode: string; setMode: (value: string) => void; active: string; setActive: (value: string) => void; collapsed: boolean; setCollapsed: (value: boolean) => void; email: string; orgName: string; initials: string }) {
  return <aside className={`${collapsed ? 'w-[76px]' : 'w-[252px]'} hidden shrink-0 border-r bg-card transition-all lg:flex lg:flex-col`}>
    <div className="flex h-16 items-center gap-3 border-b px-5"><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4" /></div>{!collapsed && <div><p className="text-sm font-semibold">Quanta AI</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Project assistant</p></div>}<button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Toggle sidebar"><Menu className="size-4" /></button></div>
    <div className="p-3"><label className="sr-only" htmlFor="role">Pilih peran</label><select id="role" value={mode} onChange={(e) => setMode(e.target.value)} className={`w-full rounded-md border bg-background px-2 py-2 text-xs ${collapsed ? 'hidden' : ''}`}><option>Kontraktor</option><option>PMO</option><option>Director</option></select></div>
    <nav className="flex flex-1 flex-col gap-1 px-3">{navItems.map(([label, icon]) => { const Icon = iconMap[icon as keyof typeof iconMap]; return <button key={label} onClick={() => setActive(label)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${active === label ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4 shrink-0" />{!collapsed && <span>{label}</span>}{label === 'Notifikasi' && !collapsed && <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] text-white">3</span>}</button> })}</nav>
    <div className="border-t p-3"><button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"><Settings className="size-4" />{!collapsed && 'Pengaturan'}</button><div className="mt-3 flex items-center gap-3 px-3"><div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">{initials}</div>{!collapsed && <div className="min-w-0"><p className="truncate text-xs font-medium">{email}</p><p className="truncate text-[10px] text-muted-foreground">{orgName}</p></div>}</div></div>
  </aside>
}

function ContractorDashboard({ greeting, displayName, dateLabel, stats, featured, tasks, risks }: { greeting: string; displayName: string; dateLabel: string; stats: ContractorStats; featured: FeaturedView | null; tasks: TaskView[]; risks: RiskView[] }) {
  return <><div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm text-muted-foreground">{dateLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting}, {displayName}</h1><p className="mt-1 text-sm text-muted-foreground">Berikut ringkasan operasional proyek hari ini.</p></div><Button><Plus data-icon="inline-start" />Tambah aktivitas</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Progress proyek" value={stats.progress} detail={stats.progressDetail} /><StatCard label="Checklist hari ini" value={stats.checklist} detail={stats.checklistDetail} /><StatCard label="Tugas aktif" value={stats.tasks} detail={stats.tasksDetail} /><StatCard label="Issues terbuka" value={stats.issues} detail={stats.issuesDetail} /></div>
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">{featured && <Card className="shadow-none"><CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle className="text-base">Progress proyek</CardTitle><p className="mt-1 text-xs text-muted-foreground">{featured.name} · {featured.code}</p></div><Button variant="ghost" size="sm">Detail <ChevronDown data-icon="inline-end" /></Button></CardHeader><CardContent><div className="flex items-end justify-between"><div><p className="text-4xl font-semibold">{featured.progress}%</p><p className="mt-1 text-sm text-muted-foreground">{featured.tasksLabel}</p></div><StatusBadge tone={featured.healthTone}>{featured.health}</StatusBadge></div><Progress value={featured.progress} className="mt-5 h-2" /><div className="mt-5 grid grid-cols-3 gap-4 border-t pt-4 text-xs"><div><p className="text-muted-foreground">Minggu berjalan</p><p className="mt-1 font-medium">{featured.weeks}</p></div><div><p className="text-muted-foreground">Hari tersisa</p><p className="mt-1 font-medium">{featured.daysLeft}</p></div><div><p className="text-muted-foreground">Milestone berikutnya</p><p className="mt-1 font-medium">{featured.milestone}</p></div></div></CardContent></Card>}
      <Card className="shadow-none"><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Quanta AI</CardTitle><Sparkles className="size-4 text-amber-500" /></CardHeader><CardContent><div className="rounded-lg bg-muted/60 p-4"><p className="text-sm leading-6">Ada {stats.attention} hal yang perlu perhatian Anda hari ini. Saya bisa membantu merangkum atau membuat rencana tindak lanjut.</p><Button className="mt-4" variant="outline" size="sm">Buka assistant <Bot data-icon="inline-end" /></Button></div><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><div className="size-2 rounded-full bg-emerald-500" />Siap membantu</div></CardContent></Card></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><Card className="shadow-none"><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Tugas hari ini</CardTitle><Button variant="ghost" size="sm">Lihat semua</Button></CardHeader><CardContent className="flex flex-col gap-3">{tasks.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada tugas yang ditugaskan kepada Anda.</p>}{tasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted"><CheckSquare className="size-4 text-muted-foreground" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.title}</p><p className="mt-1 text-xs text-muted-foreground">{task.meta}</p></div><StatusBadge tone={task.tone}>{task.status}</StatusBadge></div>)}</CardContent></Card>
      <Card className="shadow-none"><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Issues & blockers</CardTitle><Button variant="ghost" size="sm">Kelola</Button></CardHeader><CardContent className="flex flex-col gap-3">{risks.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada isu terbuka.</p>}{risks.map((issue) => <div key={issue.id} className="flex items-start gap-3 rounded-lg border p-3"><AlertTriangle className={`mt-0.5 size-4 ${issue.severity === 'Tinggi' ? 'text-red-500' : 'text-amber-500'}`} /><div className="min-w-0 flex-1"><p className="text-sm font-medium">{issue.title}</p><p className="mt-1 text-xs text-muted-foreground">{issue.meta}</p></div><StatusBadge tone={issue.severity === 'Tinggi' ? 'danger' : issue.severity === 'Sedang' ? 'warning' : 'muted'}>{issue.severity}</StatusBadge></div>)}</CardContent></Card></div>
  </>
}

function MonitoringDashboard({ director, dateLabel, stats, projects, risks }: { director: boolean; dateLabel: string; stats: MonitoringStats; projects: ProjectView[]; risks: RiskView[] }) {
  return <><div className="mb-6"><p className="text-sm text-muted-foreground">Monitoring portofolio · {dateLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{director ? 'Portfolio overview' : 'Monitoring proyek'}</h1><p className="mt-1 text-sm text-muted-foreground">{director ? 'Ringkasan kesehatan seluruh proyek aktif.' : 'Pantau performa kontraktor dan risiko proyek aktif.'}</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Proyek aktif" value={stats.active} detail={stats.activeDetail} /><StatCard label="Progress rata-rata" value={stats.progress} detail={stats.progressDetail} /><StatCard label="Task terlambat" value={stats.overdue} detail={stats.overdueDetail} /><StatCard label="Critical alerts" value={stats.alerts} detail={stats.alertsDetail} /></div><Card className="mt-6 shadow-none"><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-base">{director ? 'Project health' : 'Daftar proyek aktif'}</CardTitle><Button variant="outline" size="sm"><Search data-icon="inline-start" />Cari proyek</Button></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Proyek</th><th className="px-6 py-3 font-medium">Kontraktor</th><th className="px-6 py-3 font-medium">Progress</th><th className="px-6 py-3 font-medium">Health</th><th className="px-6 py-3 font-medium">Keterlambatan</th><th className="px-6 py-3" /></tr></thead><tbody>{projects.map((project) => <tr key={project.id} className="border-b last:border-0"><td className="px-6 py-4"><p className="font-medium">{project.name}</p><p className="mt-1 text-xs text-muted-foreground">{project.code}</p></td><td className="px-6 py-4 text-muted-foreground">{project.contractor}</td><td className="px-6 py-4"><div className="flex items-center gap-3"><Progress value={project.progress} className="h-1.5 w-20" /><span className="text-xs font-medium">{project.progress}%</span></div></td><td className="px-6 py-4"><StatusBadge tone={project.healthTone}>{project.health}</StatusBadge></td><td className="px-6 py-4 text-muted-foreground">{project.delay}</td><td className="px-6 py-4"><MoreHorizontal className="size-4 text-muted-foreground" /></td></tr>)}</tbody></table></div></CardContent></Card><div className="mt-6 grid gap-6 lg:grid-cols-2"><Card className="shadow-none"><CardHeader><CardTitle className="text-base">Alert & risiko utama</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{risks.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada risiko terbuka.</p>}{risks.slice(0, 2).map((issue) => <div key={issue.id} className="flex gap-3 rounded-lg border p-4"><AlertTriangle className="mt-0.5 size-4 text-amber-500" /><div><p className="text-sm font-medium">{issue.title}</p><p className="mt-1 text-xs text-muted-foreground">{issue.projectCode} · {issue.meta}</p></div></div>)}</CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-base">Aktivitas kontraktor</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">{['Update progress mingguan dikirim', 'Checklist lapangan diperbarui', 'Issue baru ditambahkan'].map((item, i) => <div className="flex items-center gap-3" key={item}><div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs">{i + 1}</div><p className="text-sm">{item}</p><span className="ml-auto text-xs text-muted-foreground">{i + 1}j lalu</span></div>)}</CardContent></Card></div></>
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return <Card className="shadow-none"><CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center"><div className="flex size-10 items-center justify-center rounded-full bg-muted"><ClipboardList className="size-5 text-muted-foreground" /></div><div><p className="text-sm font-semibold">Belum ada proyek</p><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Anda belum memiliki akses ke proyek mana pun. Minta admin workspace Anda menambahkan Anda ke sebuah proyek.</p></div><Button onClick={onCreate}><Plus data-icon="inline-start" />Buat proyek pertama</Button></CardContent></Card>
}

export function QuantaDashboard(props: QuantaDashboardProps) {
  const router = useRouter()
  const [active, setActive] = useState('Ringkasan')
  const [mode, setMode] = useState('Kontraktor')
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createdName, setCreatedName] = useState<string | null>(null)
  const initials = (props.email || 'Q').slice(0, 2).toUpperCase()
  function openCreateProject() {
    setCreatedName(null)
    setCreateOpen(true)
  }
  function handleProjectCreated(projectName: string) {
    setCreateOpen(false)
    setCreatedName(projectName)
    router.refresh()
  }
  return <div className={dark ? 'dark' : ''}><div className="flex min-h-screen bg-muted/30 text-foreground"><Sidebar {...{ mode, setMode, active, setActive, collapsed, setCollapsed }} email={props.email} orgName={props.orgName} initials={initials} /><div className="flex min-w-0 flex-1 flex-col"><header className="flex h-16 items-center justify-between border-b bg-card px-4 sm:px-8"><div className="flex items-center gap-3 lg:hidden"><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-4" /></div><span className="text-sm font-semibold">Quanta AI</span></div><div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><span>Projects</span><span>/</span><span className="text-foreground">{props.breadcrumb}</span><ChevronDown className="size-3" /></div><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={openCreateProject} aria-label="Buat proyek"><Plus /><span className="hidden sm:inline">Buat proyek</span></Button><Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label="Toggle theme">{dark ? <Sun /> : <Moon />}</Button><Button variant="ghost" size="icon" aria-label="Notifications"><Bell /><span className="absolute ml-4 mt-[-14px] size-2 rounded-full bg-red-500" /></Button><Separator orientation="vertical" className="mx-2 hidden h-6 sm:block" /><div className="hidden items-center gap-2 sm:flex"><div className="flex size-8 items-center justify-center rounded-full bg-amber-100 text-xs font-semibold text-amber-800">{initials}</div><span className="max-w-[200px] truncate text-xs font-medium">{props.email}</span><Link href="/auth/signout" className={buttonVariants({ variant: 'ghost', size: 'xs' })}>Keluar</Link></div></div></header><main className="flex-1 overflow-auto p-4 sm:p-8">{props.dataError && <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Sebagian data gagal dimuat. Muat ulang halaman untuk mencoba lagi.</div>}{createdName && <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><p>Proyek <span className="font-semibold">{createdName}</span> berhasil dibuat dan Anda menjadi pemiliknya.</p><button type="button" onClick={() => setCreatedName(null)} aria-label="Tutup notifikasi" className="text-emerald-700 hover:text-emerald-900"><X className="size-4" /></button></div>}{props.projects.length === 0 ? <><div className="mb-6"><p className="text-sm text-muted-foreground">{props.dateLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{props.greeting}, {props.displayName}</h1><p className="mt-1 text-sm text-muted-foreground">Berikut ringkasan operasional proyek hari ini.</p></div><EmptyProjects onCreate={openCreateProject} /></> : mode === 'Kontraktor' ? <ContractorDashboard greeting={props.greeting} displayName={props.displayName} dateLabel={props.dateLabel} stats={props.contractorStats} featured={props.featured} tasks={props.todayTasks} risks={props.risks} /> : <MonitoringDashboard director={mode === 'Director'} dateLabel={props.shortDateLabel} stats={props.monitoringStats} projects={props.projects} risks={props.risks} />}{props.projects.length > 0 && <AskAiPanel key={props.projects[0].id} projectId={props.projects[0].id} projectName={props.projects[0].name} projectCode={props.projects[0].code} />}</main><CreateProjectDialog open={createOpen} organizationId={props.organizationId} onClose={() => setCreateOpen(false)} onCreated={handleProjectCreated} /></div></div></div>
}
