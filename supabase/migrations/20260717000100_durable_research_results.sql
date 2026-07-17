alter table public.research_runs
add column manual_urls jsonb not null default '[]'::jsonb,
add constraint research_runs_manual_urls_check
check (
  jsonb_typeof(manual_urls) = 'array'
  and jsonb_array_length(manual_urls) <= 5
);

create function public.create_managed_research(
  requested_project_id text,
  requested_run_id text,
  requested_title text,
  requested_question text,
  requested_language text,
  requested_slug text,
  requested_manual_urls jsonb
)
returns table (
  project_id text,
  run_id text,
  project_slug text
)
language plpgsql
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_month date := date_trunc('month', now())::date;
begin
  if current_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if requested_project_id is null
    or btrim(requested_project_id) = ''
    or requested_run_id is null
    or btrim(requested_run_id) = ''
    or requested_title is null
    or char_length(btrim(requested_title)) not between 1 and 120
    or requested_question is null
    or char_length(btrim(requested_question)) not between 1 and 2000
    or requested_language not in ('zh', 'en')
    or requested_slug is null
    or btrim(requested_slug) = ''
    or requested_manual_urls is null
    or jsonb_typeof(requested_manual_urls) <> 'array'
  then
    raise exception 'INVALID_RESEARCH_INPUT';
  end if;

  if jsonb_array_length(requested_manual_urls) > 5
    or exists (
      select 1
      from jsonb_array_elements(requested_manual_urls) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or char_length(btrim(item.value #>> '{}')) not between 1 and 2048
    )
  then
    raise exception 'INVALID_RESEARCH_INPUT';
  end if;

  insert into public.usage_monthly (owner_id, month)
  values (current_owner, current_month)
  on conflict (owner_id, month) do nothing;

  update public.usage_monthly
  set run_count = run_count + 1
  where owner_id = current_owner
    and month = current_month
    and run_count < 3;

  if not found then
    raise exception 'MONTHLY_RUN_LIMIT_EXCEEDED';
  end if;

  insert into public.projects (
    id,
    owner_id,
    title,
    question,
    language,
    status,
    visibility,
    slug
  )
  values (
    requested_project_id,
    current_owner,
    btrim(requested_title),
    btrim(requested_question),
    requested_language,
    'active',
    'private',
    requested_slug
  );

  insert into public.research_runs (
    id,
    project_id,
    owner_id,
    status,
    step,
    source_limit,
    manual_url_limit,
    manual_urls,
    max_content_chars,
    estimated_cost_usd,
    search_count,
    token_count
  )
  values (
    requested_run_id,
    requested_project_id,
    current_owner,
    'queued',
    'queued',
    12,
    5,
    requested_manual_urls,
    200000,
    0,
    0,
    0
  );

  return query
  select requested_project_id, requested_run_id, requested_slug;
end;
$$;

create function public.begin_research_run(
  requested_owner_id uuid,
  requested_project_id text,
  requested_run_id text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_status text;
begin
  select research_run.status
  into current_status
  from public.research_runs as research_run
  where research_run.id = requested_run_id
    and research_run.project_id = requested_project_id
    and research_run.owner_id = requested_owner_id
  for update;

  if not found then
    raise exception 'RUN_PROJECT_MISMATCH';
  end if;

  if current_status not in ('queued', 'running', 'failed') then
    raise exception 'RUN_NOT_RETRYABLE';
  end if;

  update public.research_runs
  set
    status = 'running',
    step = 'planning',
    error_message = null,
    updated_at = now()
  where id = requested_run_id;
end;
$$;

create function public.fail_research_run(
  requested_owner_id uuid,
  requested_project_id text,
  requested_run_id text,
  requested_error_code text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if requested_error_code is null or btrim(requested_error_code) = '' then
    raise exception 'INVALID_RUN_ERROR';
  end if;

  update public.research_runs
  set
    status = 'failed',
    step = 'failed',
    error_message = btrim(requested_error_code),
    updated_at = now()
  where id = requested_run_id
    and project_id = requested_project_id
    and owner_id = requested_owner_id
    and status <> 'ready';

  if not found then
    raise exception 'RUN_PROJECT_MISMATCH';
  end if;
end;
$$;

create function public.fail_owned_research_dispatch(
  requested_project_id text,
  requested_run_id text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
begin
  if current_owner is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  update public.research_runs
  set
    status = 'failed',
    step = 'failed',
    error_message = 'RESEARCH_DISPATCH_FAILED',
    updated_at = now()
  where id = requested_run_id
    and project_id = requested_project_id
    and owner_id = current_owner
    and status = 'queued';

  if not found then
    raise exception 'RUN_PROJECT_MISMATCH';
  end if;
end;
$$;

create function public.finalize_research_run(
  requested_owner_id uuid,
  requested_project_id text,
  requested_run_id text,
  requested_search_count integer,
  requested_token_count integer,
  requested_estimated_cost_usd numeric
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  current_run public.research_runs%rowtype;
  run_month date;
begin
  if requested_search_count < 0
    or requested_token_count < 0
    or requested_estimated_cost_usd < 0
    or requested_estimated_cost_usd > 1
  then
    raise exception 'INVALID_RUN_USAGE';
  end if;

  select research_run.*
  into current_run
  from public.research_runs as research_run
  where research_run.id = requested_run_id
    and research_run.project_id = requested_project_id
    and research_run.owner_id = requested_owner_id
  for update;

  if not found then
    raise exception 'RUN_PROJECT_MISMATCH';
  end if;

  if current_run.status = 'ready' then
    if current_run.search_count = requested_search_count
      and current_run.token_count = requested_token_count
      and current_run.estimated_cost_usd = requested_estimated_cost_usd
    then
      return;
    end if;

    raise exception 'RUN_IMMUTABLE';
  end if;

  if current_run.status <> 'running' then
    raise exception 'RUN_NOT_RUNNING';
  end if;

  if requested_search_count < current_run.search_count
    or requested_token_count < current_run.token_count
    or requested_estimated_cost_usd < current_run.estimated_cost_usd
  then
    raise exception 'RUN_USAGE_DECREASED';
  end if;

  run_month := date_trunc('month', current_run.created_at)::date;

  update public.usage_monthly
  set
    search_count = search_count + requested_search_count - current_run.search_count,
    token_count = token_count + requested_token_count - current_run.token_count,
    estimated_cost_usd =
      estimated_cost_usd + requested_estimated_cost_usd - current_run.estimated_cost_usd
  where owner_id = requested_owner_id
    and month = run_month;

  if not found then
    raise exception 'USAGE_MONTH_NOT_FOUND';
  end if;

  update public.research_runs
  set
    status = 'ready',
    step = 'ready',
    search_count = requested_search_count,
    token_count = requested_token_count,
    estimated_cost_usd = requested_estimated_cost_usd,
    error_message = null,
    updated_at = now()
  where id = requested_run_id;
end;
$$;

revoke all on function public.create_managed_research(text, text, text, text, text, text, jsonb) from public;
revoke all on function public.begin_research_run(uuid, text, text) from public;
revoke all on function public.fail_research_run(uuid, text, text, text) from public;
revoke all on function public.fail_owned_research_dispatch(text, text) from public;
revoke all on function public.finalize_research_run(uuid, text, text, integer, integer, numeric) from public;

grant execute
on function public.create_managed_research(text, text, text, text, text, text, jsonb)
to authenticated;

grant execute
on function public.fail_owned_research_dispatch(text, text)
to authenticated;

grant execute
on function public.begin_research_run(uuid, text, text)
to service_role;

grant execute
on function public.fail_research_run(uuid, text, text, text)
to service_role;

grant execute
on function public.finalize_research_run(uuid, text, text, integer, integer, numeric)
to service_role;
