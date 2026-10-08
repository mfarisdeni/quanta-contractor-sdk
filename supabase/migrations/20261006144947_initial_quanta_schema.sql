-- =============================================================================
-- Quanta Contractor PMO — initial database foundation
-- =============================================================================
-- Migration-first schema. No ORM, no Drizzle, no legacy Contractor schema.
-- Source of truth: Supabase Postgres.
--
-- Access model used by every policy below:
--   READ   = member of the project (project_members)
--            OR member of the owning organization (organization_members)
--   WRITE  = project member with role owner/manager/member
--            OR organization owner/admin
--   MANAGE = project member with role owner/manager
--            OR organization owner/admin
--   Viewers (project role 'viewer') are read-only.
--
-- Membership checks live in SECURITY DEFINER helper functions with a pinned
-- search_path so policies stay small, readable and free of recursive RLS.
--
-- Organizations are created through public.create_organization(name, slug),
-- which creates the workspace and its first owner in one step.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint organizations_name_not_empty check (char_length(btrim(name)) > 0),
  constraint organizations_slug_not_empty check (char_length(btrim(slug)) > 0)
);

comment on table public.organizations is
  'Company or workspace that owns projects and members.';

create table if not exists public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  role             text not null,
  created_at       timestamptz not null default now(),
  constraint organization_members_role_check
    check (role in ('owner', 'admin', 'pm', 'member', 'viewer')),
  constraint organization_members_org_user_key unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Membership of an authenticated user in an organization.';

create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  name              text not null,
  project_code      text,
  description       text,
  client_name       text,
  contractor_name   text,
  location          text,
  status            text not null default 'planning',
  start_date        date,
  end_date          date,
  budget            numeric,
  currency          text not null default 'IDR',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint projects_name_not_empty check (char_length(btrim(name)) > 0),
  constraint projects_status_check
    check (status in ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
  constraint projects_budget_check check (budget is null or budget >= 0),
  constraint projects_dates_check
    check (start_date is null or end_date is null or end_date >= start_date)
);

comment on table public.projects is
  'Core project facts. AI-derived health/scores are stored outside this table.';

create table if not exists public.project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null,
  created_at  timestamptz not null default now(),
  constraint project_members_role_check
    check (role in ('owner', 'manager', 'member', 'viewer')),
  constraint project_members_project_user_key unique (project_id, user_id)
);

comment on table public.project_members is
  'Project-level access control and role for a user.';

create table if not exists public.milestones (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  name                text not null,
  description         text,
  status              text not null default 'planned',
  planned_start_date  date,
  due_date            date,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint milestones_name_not_empty check (char_length(btrim(name)) > 0),
  constraint milestones_status_check
    check (status in ('planned', 'in_progress', 'completed', 'delayed', 'cancelled')),
  constraint milestones_dates_check
    check (planned_start_date is null or due_date is null or due_date >= planned_start_date)
);

comment on table public.milestones is
  'Major project checkpoints.';

create table if not exists public.tasks (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  milestone_id      uuid references public.milestones(id) on delete set null,
  title             text not null,
  description       text,
  status            text not null default 'todo',
  priority          text not null default 'medium',
  assignee_id       uuid references auth.users(id) on delete set null,
  start_date        date,
  due_date          date,
  completed_at      timestamptz,
  progress_percent  numeric not null default 0,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tasks_title_not_empty check (char_length(btrim(title)) > 0),
  constraint tasks_status_check
    check (status in ('todo', 'in_progress', 'blocked', 'completed', 'cancelled')),
  constraint tasks_priority_check check (priority in ('low', 'medium', 'high', 'critical')),
  constraint tasks_progress_percent_check
    check (progress_percent >= 0 and progress_percent <= 100),
  constraint tasks_dates_check
    check (start_date is null or due_date is null or due_date >= start_date)
);

comment on table public.tasks is
  'Operational project tasks.';

create table if not exists public.risks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  title         text not null,
  description   text,
  category      text,
  probability   numeric,
  impact        numeric,
  risk_score    numeric,
  severity      text not null default 'medium',
  status        text not null default 'open',
  owner_id      uuid references auth.users(id) on delete set null,
  due_date      date,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint risks_title_not_empty check (char_length(btrim(title)) > 0),
  constraint risks_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint risks_status_check check (status in ('open', 'monitoring', 'mitigated', 'closed')),
  constraint risks_probability_check check (probability is null or (probability >= 0 and probability <= 1)),
  constraint risks_impact_check check (impact is null or (impact >= 0 and impact <= 1)),
  constraint risks_risk_score_check check (risk_score is null or (risk_score >= 0 and risk_score <= 1))
);

comment on table public.risks is
  'Project risk register. risk_score is usable by deterministic and AI-assisted logic.';

create table if not exists public.signals (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  signal_type      text not null,
  severity         text not null,
  status           text not null default 'open',
  title            text not null,
  description      text,
  confidence       numeric,
  source_type      text,
  source_ref       text,
  related_task_id  uuid references public.tasks(id) on delete set null,
  related_risk_id  uuid references public.risks(id) on delete set null,
  detected_at      timestamptz not null default now(),
  resolved_at      timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint signals_title_not_empty check (char_length(btrim(title)) > 0),
  constraint signals_type_check
    check (signal_type in ('schedule', 'cost', 'resource', 'quality', 'safety',
                           'contract', 'procurement', 'milestone', 'general')),
  constraint signals_severity_check
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  constraint signals_status_check
    check (status in ('open', 'acknowledged', 'resolved', 'dismissed')),
  constraint signals_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1))
);

comment on table public.signals is
  'AI-generated or rule-generated signals, separated from core project facts, and linked back to the operational rows that caused them.';

create table if not exists public.daily_reports (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  report_date       date not null,
  summary           text,
  progress_summary  text,
  blockers          text,
  next_actions      text,
  submitted_by      uuid references auth.users(id) on delete set null,
  ai_summary        text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint daily_reports_project_date_key unique (project_id, report_date)
);

comment on table public.daily_reports is
  'Daily project reports written by users, plus separate AI-generated summary fields.';

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  name           text not null,
  document_type  text,
  storage_path   text,
  mime_type      text,
  file_size      bigint,
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint documents_name_not_empty check (char_length(btrim(name)) > 0),
  constraint documents_file_size_check check (file_size is null or file_size >= 0)
);

comment on table public.documents is
  'Document metadata only. Binary files live in Supabase Storage, never in Postgres.';

-- -----------------------------------------------------------------------------
-- 2. Helper functions (SECURITY DEFINER, pinned search_path, auth-scoped)
-- -----------------------------------------------------------------------------

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

create or replace function public.organization_has_members(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_organization_id
  );
$$;

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  );
$$;

create or replace function public.has_project_access(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and public.is_org_member(p.organization_id)
  );
$$;

create or replace function public.can_write_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'manager', 'member')
  )
  or exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and public.is_org_admin(p.organization_id)
  );
$$;

create or replace function public.can_manage_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id = auth.uid()
      and pm.role in ('owner', 'manager')
  )
  or exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and public.is_org_admin(p.organization_id)
  );
$$;

create or replace function public.is_project_creator(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.created_by = auth.uid()
  );
$$;

-- Helper functions are for RLS policies only: never exposed to anon.
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_admin(uuid) from public, anon;
revoke all on function public.is_org_owner(uuid) from public, anon;
revoke all on function public.organization_has_members(uuid) from public, anon;
revoke all on function public.has_project_access(uuid) from public, anon;
revoke all on function public.can_write_project(uuid) from public, anon;
revoke all on function public.can_manage_project(uuid) from public, anon;
revoke all on function public.is_project_creator(uuid) from public, anon;
revoke all on function public.is_project_member(uuid) from public, anon;

grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_admin(uuid) to authenticated, service_role;
grant execute on function public.is_org_owner(uuid) to authenticated, service_role;
grant execute on function public.organization_has_members(uuid) to authenticated, service_role;
grant execute on function public.has_project_access(uuid) to authenticated, service_role;
grant execute on function public.can_write_project(uuid) to authenticated, service_role;
grant execute on function public.can_manage_project(uuid) to authenticated, service_role;
grant execute on function public.is_project_creator(uuid) to authenticated, service_role;
grant execute on function public.is_project_member(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Creation flows
-- -----------------------------------------------------------------------------
-- Organizations are created through one narrow SECURITY DEFINER function
-- instead of a direct INSERT policy: the creator must become the first owner
-- atomically, and a plain INSERT ... RETURNING would be rejected because the
-- membership row (which the SELECT policy depends on) cannot exist yet.

create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'organization name is required';
  end if;
  if p_slug is null or char_length(btrim(p_slug)) = 0 then
    raise exception 'organization slug is required';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(p_name), btrim(p_slug))
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, auth.uid(), 'owner');

  return v_organization_id;
end;
$$;

revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. updated_at maintenance
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.risks
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.signals
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.daily_reports
  for each row execute function public.set_updated_at();

create trigger set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 5. Indexes
-- -----------------------------------------------------------------------------

create index if not exists organization_members_organization_id_idx
  on public.organization_members (organization_id);
create index if not exists organization_members_user_id_idx
  on public.organization_members (user_id);

create index if not exists projects_organization_id_idx
  on public.projects (organization_id);

create index if not exists project_members_project_id_idx
  on public.project_members (project_id);
create index if not exists project_members_user_id_idx
  on public.project_members (user_id);

create index if not exists milestones_project_id_idx
  on public.milestones (project_id);

create index if not exists tasks_project_id_idx
  on public.tasks (project_id);
create index if not exists tasks_milestone_id_idx
  on public.tasks (milestone_id);
create index if not exists tasks_assignee_id_idx
  on public.tasks (assignee_id);
create index if not exists tasks_status_idx
  on public.tasks (status);
create index if not exists tasks_due_date_idx
  on public.tasks (due_date);

create index if not exists risks_project_id_idx
  on public.risks (project_id);
create index if not exists risks_status_idx
  on public.risks (status);

create index if not exists signals_project_id_idx
  on public.signals (project_id);
create index if not exists signals_status_idx
  on public.signals (status);
create index if not exists signals_severity_idx
  on public.signals (severity);
create index if not exists signals_detected_at_idx
  on public.signals (detected_at);

create index if not exists daily_reports_project_id_idx
  on public.daily_reports (project_id);
create index if not exists daily_reports_report_date_idx
  on public.daily_reports (report_date);

create index if not exists documents_project_id_idx
  on public.documents (project_id);

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.risks enable row level security;
alter table public.signals enable row level security;
alter table public.daily_reports enable row level security;
alter table public.documents enable row level security;

-- -----------------------------------------------------------------------------
-- 7. Policies
-- -----------------------------------------------------------------------------

-- organizations ---------------------------------------------------------------
-- No direct INSERT policy: use public.create_organization() instead.

create policy "organizations_select_members"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "organizations_update_admins"
  on public.organizations for update
  to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

create policy "organizations_delete_owners"
  on public.organizations for delete
  to authenticated
  using (public.is_org_owner(id));

-- organization_members --------------------------------------------------------

-- user_id = auth.uid() keeps an "empty organization" claim usable with
-- INSERT ... RETURNING (the new membership row is not visible to the statement
-- snapshot yet). It only lets a user claim a membership row for themselves.
create policy "organization_members_select_org_members"
  on public.organization_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_org_member(organization_id));

create policy "organization_members_insert_admin_or_owner_bootstrap"
  on public.organization_members for insert
  to authenticated
  with check (
    public.is_org_admin(organization_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and not public.organization_has_members(organization_id)
    )
  );

create policy "organization_members_update_admins"
  on public.organization_members for update
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "organization_members_delete_admins_or_self"
  on public.organization_members for delete
  to authenticated
  using (user_id = auth.uid() or public.is_org_admin(organization_id));

-- projects --------------------------------------------------------------------

-- Note: PostgreSQL also applies the SELECT policy to rows produced by
-- INSERT ... RETURNING. The new project row is not visible to the statement
-- snapshot yet, so this policy must not depend on a self-lookup of that row.
create policy "projects_select_access"
  on public.projects for select
  to authenticated
  using (public.is_org_member(organization_id) or public.is_project_member(id));

create policy "projects_insert_org_members"
  on public.projects for insert
  to authenticated
  with check (public.is_org_member(organization_id));

create policy "projects_update_managers"
  on public.projects for update
  to authenticated
  using (public.can_manage_project(id))
  with check (public.can_manage_project(id));

create policy "projects_delete_managers"
  on public.projects for delete
  to authenticated
  using (public.can_manage_project(id));

-- project_members -------------------------------------------------------------

create policy "project_members_select_access"
  on public.project_members for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "project_members_insert_managers_or_creator"
  on public.project_members for insert
  to authenticated
  with check (
    public.can_manage_project(project_id)
    or (
      user_id = auth.uid()
      and role = 'owner'
      and public.is_project_creator(project_id)
    )
  );

create policy "project_members_update_managers"
  on public.project_members for update
  to authenticated
  using (public.can_manage_project(project_id))
  with check (public.can_manage_project(project_id));

create policy "project_members_delete_managers_or_self"
  on public.project_members for delete
  to authenticated
  using (user_id = auth.uid() or public.can_manage_project(project_id));

-- milestones ------------------------------------------------------------------

create policy "milestones_select_access"
  on public.milestones for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "milestones_insert_writers"
  on public.milestones for insert
  to authenticated
  with check (public.can_write_project(project_id));

create policy "milestones_update_writers"
  on public.milestones for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

create policy "milestones_delete_managers"
  on public.milestones for delete
  to authenticated
  using (public.can_manage_project(project_id));

-- tasks -----------------------------------------------------------------------

create policy "tasks_select_access"
  on public.tasks for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "tasks_insert_writers"
  on public.tasks for insert
  to authenticated
  with check (public.can_write_project(project_id));

create policy "tasks_update_writers"
  on public.tasks for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

create policy "tasks_delete_writers"
  on public.tasks for delete
  to authenticated
  using (public.can_write_project(project_id));

-- risks -----------------------------------------------------------------------

create policy "risks_select_access"
  on public.risks for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "risks_insert_writers"
  on public.risks for insert
  to authenticated
  with check (public.can_write_project(project_id));

create policy "risks_update_writers"
  on public.risks for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

create policy "risks_delete_writers"
  on public.risks for delete
  to authenticated
  using (public.can_write_project(project_id));

-- signals ---------------------------------------------------------------------

create policy "signals_select_access"
  on public.signals for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "signals_insert_writers"
  on public.signals for insert
  to authenticated
  with check (public.can_write_project(project_id));

create policy "signals_update_writers"
  on public.signals for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

create policy "signals_delete_managers"
  on public.signals for delete
  to authenticated
  using (public.can_manage_project(project_id));

-- daily_reports ---------------------------------------------------------------

create policy "daily_reports_select_access"
  on public.daily_reports for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "daily_reports_insert_own"
  on public.daily_reports for insert
  to authenticated
  with check (
    public.can_write_project(project_id)
    and submitted_by = auth.uid()
  );

-- project_id is re-checked on update so a row cannot be moved into a project
-- the caller has no access to.
create policy "daily_reports_update_own_or_managers"
  on public.daily_reports for update
  to authenticated
  using (submitted_by = auth.uid() or public.can_manage_project(project_id))
  with check (
    (submitted_by = auth.uid() and public.has_project_access(project_id))
    or public.can_manage_project(project_id)
  );

create policy "daily_reports_delete_own_or_managers"
  on public.daily_reports for delete
  to authenticated
  using (submitted_by = auth.uid() or public.can_manage_project(project_id));

-- documents -------------------------------------------------------------------

create policy "documents_select_access"
  on public.documents for select
  to authenticated
  using (public.has_project_access(project_id));

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (
    public.can_write_project(project_id)
    and uploaded_by = auth.uid()
  );

create policy "documents_update_writers"
  on public.documents for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

create policy "documents_delete_writers"
  on public.documents for delete
  to authenticated
  using (public.can_write_project(project_id));
