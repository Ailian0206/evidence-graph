create extension if not exists vector with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  language text not null default 'zh' check (language in ('zh', 'en')),
  github_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) > 0),
  question text not null check (char_length(question) > 0),
  language text not null default 'zh' check (language in ('zh', 'en')),
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_id_owner_key unique (id, owner_id)
);

create index projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

create table public.research_runs (
  id text primary key,
  project_id text not null,
  owner_id uuid not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'ready', 'failed', 'cancelled')),
  step text not null default 'queued'
    check (
      step in (
        'queued',
        'planning',
        'searching',
        'collecting',
        'indexing',
        'extracting_claims',
        'linking_evidence',
        'detecting_conflicts',
        'drafting_report',
        'ready',
        'failed',
        'cancelled'
      )
    ),
  source_limit integer not null default 12 check (source_limit between 1 and 12),
  manual_url_limit integer not null default 5 check (manual_url_limit between 0 and 5),
  max_content_chars integer not null default 200000
    check (max_content_chars between 1 and 200000),
  estimated_cost_usd numeric(10, 6) not null default 0
    check (estimated_cost_usd between 0 and 1),
  search_count integer not null default 0 check (search_count >= 0),
  token_count integer not null default 0 check (token_count >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint research_runs_project_owner_fkey
    foreign key (project_id, owner_id)
    references public.projects(id, owner_id)
    on delete cascade,
  constraint research_runs_id_project_key unique (id, project_id)
);

create unique index research_runs_one_active_per_owner_key
  on public.research_runs (owner_id)
  where status in ('queued', 'running');

create index research_runs_project_created_idx
  on public.research_runs (project_id, created_at desc);

create table public.sources (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  canonical_url text not null,
  title text not null check (char_length(title) > 0),
  author text,
  published_at timestamptz,
  domain text not null check (char_length(domain) > 0),
  source_type text not null
    check (
      source_type in (
        'primary_interview',
        'official_document',
        'article',
        'documentation',
        'dataset',
        'other'
      )
    ),
  body text not null check (char_length(body) > 0),
  content_hash text not null check (char_length(content_hash) > 0),
  retrieved_at timestamptz not null,
  constraint sources_id_project_key unique (id, project_id),
  constraint sources_project_canonical_url_key unique (project_id, canonical_url),
  constraint sources_project_content_hash_key unique (project_id, content_hash)
);

create table public.source_chunks (
  id text primary key,
  source_id text not null,
  project_id text not null,
  chunk_index integer not null check (chunk_index >= 0),
  body text not null check (char_length(body) > 0),
  start_char integer not null check (start_char >= 0),
  end_char integer not null check (end_char > start_char),
  embedding_model text not null default 'text-embedding-3-small'
    check (embedding_model = 'text-embedding-3-small'),
  embedding_dimensions integer not null default 1536 check (embedding_dimensions = 1536),
  embedding extensions.vector(1536),
  constraint source_chunks_source_project_fkey
    foreign key (source_id, project_id)
    references public.sources(id, project_id)
    on delete cascade,
  constraint source_chunks_id_project_key unique (id, project_id),
  constraint source_chunks_source_index_key unique (source_id, chunk_index),
  constraint source_chunks_offset_length_check
    check (char_length(body) = end_char - start_char)
);

create index source_chunks_embedding_hnsw_idx
  on public.source_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create table public.claims (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  statement text not null check (char_length(statement) > 0),
  normalized_key text not null check (char_length(normalized_key) > 0),
  claim_type text not null check (claim_type in ('factual', 'causal', 'comparative', 'definition')),
  qualifiers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(qualifiers) = 'array'),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint claims_id_project_key unique (id, project_id),
  constraint claims_project_normalized_key_key unique (project_id, normalized_key)
);

create table public.evidence_links (
  id text primary key,
  claim_id text not null,
  chunk_id text not null,
  project_id text not null,
  relation text not null check (relation in ('supports', 'rebuts', 'qualifies', 'context')),
  strength text not null check (strength in ('weak', 'moderate', 'strong')),
  quote text not null check (char_length(quote) > 0),
  rationale text not null check (char_length(rationale) > 0),
  created_at timestamptz not null default now(),
  constraint evidence_links_claim_project_fkey
    foreign key (claim_id, project_id)
    references public.claims(id, project_id)
    on delete cascade,
  constraint evidence_links_chunk_project_fkey
    foreign key (chunk_id, project_id)
    references public.source_chunks(id, project_id)
    on delete cascade,
  constraint evidence_links_claim_chunk_relation_key
    unique (claim_id, chunk_id, relation)
);

create function public.enforce_exact_evidence_quote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  chunk_body text;
begin
  select body
  into chunk_body
  from public.source_chunks
  where id = new.chunk_id and project_id = new.project_id;

  if chunk_body is not null and strpos(chunk_body, new.quote) = 0 then
    raise exception using
      errcode = '23514',
      message = 'EVIDENCE_QUOTE_NOT_EXACT';
  end if;

  return new;
end;
$$;

create trigger evidence_links_exact_quote
before insert or update of chunk_id, project_id, quote
on public.evidence_links
for each row execute function public.enforce_exact_evidence_quote();

create table public.claim_relations (
  id text primary key,
  project_id text not null,
  from_claim_id text not null,
  to_claim_id text not null,
  relation text not null check (relation in ('contradicts', 'duplicates', 'depends_on')),
  rationale text not null check (char_length(rationale) > 0),
  created_at timestamptz not null default now(),
  constraint claim_relations_from_project_fkey
    foreign key (from_claim_id, project_id)
    references public.claims(id, project_id)
    on delete cascade,
  constraint claim_relations_to_project_fkey
    foreign key (to_claim_id, project_id)
    references public.claims(id, project_id)
    on delete cascade,
  constraint claim_relations_distinct_claims_check check (from_claim_id <> to_claim_id),
  constraint claim_relations_claim_pair_key
    unique (from_claim_id, to_claim_id, relation)
);

create table public.workflow_checkpoints (
  run_id text not null,
  project_id text not null,
  step text not null
    check (
      step in (
        'planning',
        'searching',
        'collecting',
        'indexing',
        'extracting_claims',
        'linking_evidence',
        'detecting_conflicts',
        'drafting_report'
      )
    ),
  idempotency_key text not null unique,
  output jsonb not null,
  completed_at timestamptz not null,
  primary key (run_id, step),
  constraint workflow_checkpoints_run_project_fkey
    foreign key (run_id, project_id)
    references public.research_runs(id, project_id)
    on delete cascade
);

create table public.run_logs (
  id text primary key,
  run_id text not null,
  project_id text not null,
  step text not null
    check (
      step in (
        'planning',
        'searching',
        'collecting',
        'indexing',
        'extracting_claims',
        'linking_evidence',
        'detecting_conflicts',
        'drafting_report'
      )
    ),
  status text not null check (status in ('started', 'completed', 'failed', 'skipped')),
  attempt integer not null check (attempt > 0),
  occurred_at timestamptz not null,
  error_code text,
  constraint run_logs_run_project_fkey
    foreign key (run_id, project_id)
    references public.research_runs(id, project_id)
    on delete cascade
);

create index run_logs_run_occurred_idx
  on public.run_logs (run_id, occurred_at);

create table public.reports (
  id text primary key,
  run_id text not null,
  project_id text not null,
  slug text unique,
  markdown text not null check (char_length(markdown) > 0),
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  citations jsonb not null default '[]'::jsonb check (jsonb_typeof(citations) = 'array'),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'revoked')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_run_project_fkey
    foreign key (run_id, project_id)
    references public.research_runs(id, project_id)
    on delete cascade,
  constraint reports_project_version_key unique (project_id, version),
  constraint reports_published_state_check
    check (
      (status = 'published' and slug is not null and published_at is not null)
      or (status <> 'published')
    )
);

create table public.usage_monthly (
  owner_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (date_trunc('month', month)::date = month),
  run_count integer not null default 0 check (run_count >= 0),
  search_count integer not null default 0 check (search_count >= 0),
  token_count integer not null default 0 check (token_count >= 0),
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  primary key (owner_id, month)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  project_id text not null,
  action text not null check (char_length(action) > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint audit_events_project_owner_fkey
    foreign key (project_id, owner_id)
    references public.projects(id, owner_id)
    on delete cascade
);

create index audit_events_project_created_idx
  on public.audit_events (project_id, created_at desc);

create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, github_username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'user_name'),
    new.raw_user_meta_data ->> 'user_name'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger auth_user_profile_created
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create function public.owns_project(requested_project_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects
    where id = requested_project_id
      and owner_id = auth.uid()
      and status <> 'deleted'
  );
$$;

create function public.get_public_report(requested_slug text)
returns table (
  report_id text,
  project_slug text,
  title text,
  question text,
  markdown text,
  sections jsonb,
  citations jsonb,
  version integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    report.id,
    project.slug,
    project.title,
    project.question,
    report.markdown,
    report.sections,
    report.citations,
    report.version,
    report.published_at
  from public.reports as report
  join public.projects as project on project.id = report.project_id
  where report.slug = requested_slug
    and report.status = 'published'
    and report.published_at is not null
    and project.visibility = 'public'
    and project.status = 'active';
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.research_runs enable row level security;
alter table public.research_runs force row level security;
alter table public.sources enable row level security;
alter table public.sources force row level security;
alter table public.source_chunks enable row level security;
alter table public.source_chunks force row level security;
alter table public.claims enable row level security;
alter table public.claims force row level security;
alter table public.evidence_links enable row level security;
alter table public.evidence_links force row level security;
alter table public.claim_relations enable row level security;
alter table public.claim_relations force row level security;
alter table public.workflow_checkpoints enable row level security;
alter table public.workflow_checkpoints force row level security;
alter table public.run_logs enable row level security;
alter table public.run_logs force row level security;
alter table public.reports enable row level security;
alter table public.reports force row level security;
alter table public.usage_monthly enable row level security;
alter table public.usage_monthly force row level security;
alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete
on table
  public.profiles,
  public.projects,
  public.research_runs,
  public.sources,
  public.source_chunks,
  public.claims,
  public.evidence_links,
  public.claim_relations,
  public.workflow_checkpoints,
  public.run_logs,
  public.reports,
  public.usage_monthly,
  public.audit_events
to authenticated, service_role;

revoke all
on table
  public.profiles,
  public.projects,
  public.research_runs,
  public.sources,
  public.source_chunks,
  public.claims,
  public.evidence_links,
  public.claim_relations,
  public.workflow_checkpoints,
  public.run_logs,
  public.reports,
  public.usage_monthly,
  public.audit_events
from anon;

create policy profiles_owner_all
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy projects_owner_all
on public.projects
for all
to authenticated
using (owner_id = auth.uid() and status <> 'deleted')
with check (owner_id = auth.uid());

create policy research_runs_owner_all
on public.research_runs
for all
to authenticated
using (owner_id = auth.uid() and public.owns_project(project_id))
with check (owner_id = auth.uid() and public.owns_project(project_id));

create policy sources_owner_all
on public.sources
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy source_chunks_owner_all
on public.source_chunks
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy claims_owner_all
on public.claims
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy evidence_links_owner_all
on public.evidence_links
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy claim_relations_owner_all
on public.claim_relations
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy workflow_checkpoints_owner_all
on public.workflow_checkpoints
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy run_logs_owner_all
on public.run_logs
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy reports_owner_all
on public.reports
for all
to authenticated
using (public.owns_project(project_id))
with check (public.owns_project(project_id));

create policy usage_monthly_owner_all
on public.usage_monthly
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy audit_events_owner_all
on public.audit_events
for all
to authenticated
using (owner_id = auth.uid() and public.owns_project(project_id))
with check (owner_id = auth.uid() and public.owns_project(project_id));

revoke all on function public.enforce_exact_evidence_quote() from public;
revoke all on function public.handle_new_user_profile() from public;
revoke all on function public.owns_project(text) from public;
revoke all on function public.get_public_report(text) from public;

grant execute on function public.owns_project(text) to authenticated, service_role;
grant execute on function public.get_public_report(text) to anon, authenticated, service_role;
