import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type Check = {
  name: string
  pass: boolean | null
  detail: string
}

function createAnonClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}

function code(error: { code?: string | null } | null) {
  return error?.code ?? 'unknown'
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }

  const checks: Check[] = []

  const anon = createAnonClient()
  const anonProjects = await anon.from('projects').select('id, organization_id', { count: 'exact' })
  checks.push({
    name: '1. unauthenticated request cannot read projects',
    pass: (anonProjects.count ?? 0) === 0 && !anonProjects.error,
    detail: `visible rows: ${anonProjects.count ?? 0} (role: anon, no policies for anon)`,
  })

  const anonOrg = await anon.rpc('create_organization', { p_name: 'anon probe', p_slug: 'anon-probe' })
  checks.push({
    name: '1b. unauthenticated request cannot create organizations',
    pass: Boolean(anonOrg.error),
    detail: anonOrg.error ? `rpc denied (${code(anonOrg.error)})` : 'rpc unexpectedly allowed',
  })

  const supabase = await createClient()
  const { data: session } = await supabase.auth.getClaims()
  const claims = session?.claims

  if (!claims?.sub) {
    return NextResponse.json({ dev: true, authenticated: false, checks, ok: checks.every((check) => check.pass !== false) })
  }

  const [organizationsResult, projectsResult, membershipsResult, projectMembersResult] = await Promise.all([
    supabase.from('organizations').select('id, name'),
    supabase.from('projects').select('id, organization_id, name'),
    supabase.from('organization_members').select('organization_id, role').eq('user_id', claims.sub),
    supabase.from('project_members').select('project_id, role').eq('user_id', claims.sub),
  ])

  const organizations = organizationsResult.data ?? []
  const projects = projectsResult.data ?? []
  const memberships = membershipsResult.data ?? []
  const projectMemberships = projectMembersResult.data ?? []
  const memberOrgIds = new Set(memberships.map((membership) => membership.organization_id))

  const foreignProjects = projects.filter((project) => !memberOrgIds.has(project.organization_id))
  checks.push({
    name: '2. authenticated user without membership cannot read other data',
    pass: memberships.length === 0 ? projects.length === 0 : foreignProjects.length === 0,
    detail:
      memberships.length === 0
        ? `no organization membership, visible projects: ${projects.length}`
        : `${projects.length} visible projects, all inside own organizations: ${foreignProjects.length === 0}`,
  })

  const foreignOrganizations = organizations.filter((organization) => !memberOrgIds.has(organization.id))
  checks.push({
    name: '5. user from organization A cannot access organization B',
    pass: foreignOrganizations.length === 0 && organizations.length === memberships.length,
    detail: `${organizations.length} visible organizations, ${memberships.length} memberships, foreign: ${foreignOrganizations.length}`,
  })

  const readableProjectIds = new Set(projects.map((project) => project.id))
  const memberProjects = projectMemberships.map((membership) => membership.project_id)
  const unreadableMemberProjects = memberProjects.filter((projectId) => !readableProjectIds.has(projectId))
  checks.push({
    name: '3. authenticated project member can read their project',
    pass: unreadableMemberProjects.length === 0,
    detail: `${projectMemberships.length} project memberships, unreadable: ${unreadableMemberProjects.length}`,
  })

  const viewerMembership = projectMemberships.find((membership) => membership.role === 'viewer')
  if (viewerMembership) {
    const insertResult = await supabase.from('tasks').insert({
      project_id: viewerMembership.project_id,
      title: 'rls viewer write probe',
      created_by: claims.sub,
    })
    let cleaned = true
    if (!insertResult.error) {
      const cleanup = await supabase
        .from('tasks')
        .delete()
        .eq('project_id', viewerMembership.project_id)
        .eq('title', 'rls viewer write probe')
      cleaned = !cleanup.error
    }
    checks.push({
      name: '4. viewer can read but cannot perform protected writes',
      pass: Boolean(insertResult.error) && cleaned,
      detail: insertResult.error
        ? `insert denied (${code(insertResult.error)}), read access still works`
        : `insert allowed, probe removed: ${cleaned}`,
    })
  } else {
    checks.push({
      name: '4. viewer can read but cannot perform protected writes',
      pass: null,
      detail: 'not exercised: this account has no viewer project membership',
    })
  }

  const ok = checks.every((check) => check.pass !== false)

  return NextResponse.json(
    { dev: true, authenticated: true, checks, ok },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
