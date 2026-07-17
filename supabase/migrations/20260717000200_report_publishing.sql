create unique index reports_one_published_per_project_idx
  on public.reports (project_id)
  where status = 'published';

create function public.publish_report_version(
  requested_project_id text,
  requested_report_id text
)
returns table (
  report_id text,
  project_slug text,
  report_version integer,
  report_status text,
  report_published_at timestamptz
)
language plpgsql
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_project public.projects%rowtype;
  target_report public.reports%rowtype;
  published_timestamp timestamptz;
begin
  select project.*
  into current_project
  from public.projects as project
  where project.id = requested_project_id
    and project.owner_id = current_owner
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  if current_project.status <> 'active' then
    raise exception 'PROJECT_NOT_PUBLISHABLE';
  end if;

  select report.*
  into target_report
  from public.reports as report
  where report.id = requested_report_id
    and report.project_id = requested_project_id
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  if target_report.status = 'published'
    and target_report.slug = current_project.slug
    and current_project.visibility = 'public'
  then
    return query
    select
      target_report.id,
      current_project.slug,
      target_report.version,
      target_report.status,
      target_report.published_at;
    return;
  end if;

  -- Publishing validates the immutable snapshot before changing any public state.
  if jsonb_array_length(target_report.sections) = 0
    or exists (
      select 1
      from jsonb_array_elements(target_report.citations) as citation(value)
      where jsonb_typeof(citation.value) <> 'object'
        or jsonb_typeof(citation.value -> 'evidenceLinkId') <> 'string'
        or btrim(citation.value ->> 'evidenceLinkId') = ''
        or jsonb_typeof(citation.value -> 'claimId') <> 'string'
        or btrim(citation.value ->> 'claimId') = ''
        or jsonb_typeof(citation.value -> 'chunkId') <> 'string'
        or btrim(citation.value ->> 'chunkId') = ''
        or jsonb_typeof(citation.value -> 'sourceId') <> 'string'
        or btrim(citation.value ->> 'sourceId') = ''
        or jsonb_typeof(citation.value -> 'quote') <> 'string'
        or btrim(citation.value ->> 'quote') = ''
        or jsonb_typeof(citation.value -> 'sourceUrl') <> 'string'
        or btrim(citation.value ->> 'sourceUrl') = ''
        or jsonb_typeof(citation.value -> 'sourceTitle') <> 'string'
        or btrim(citation.value ->> 'sourceTitle') = ''
    )
    or exists (
      select 1
      from jsonb_array_elements(target_report.sections) as section(value)
      where jsonb_typeof(section.value) <> 'object'
        or jsonb_typeof(section.value -> 'id') <> 'string'
        or btrim(section.value ->> 'id') = ''
        or jsonb_typeof(section.value -> 'heading') <> 'string'
        or btrim(section.value ->> 'heading') = ''
        or jsonb_typeof(section.value -> 'factual') <> 'boolean'
        or jsonb_typeof(section.value -> 'markdown') <> 'string'
        or btrim(section.value ->> 'markdown') = ''
        or jsonb_typeof(section.value -> 'citationIds') <> 'array'
        or case
          when jsonb_typeof(section.value -> 'citationIds') = 'array'
          then (
            (
              section.value ->> 'factual' = 'true'
              and jsonb_array_length(section.value -> 'citationIds') = 0
            )
            or exists (
              select 1
              from jsonb_array_elements(section.value -> 'citationIds') as citation_id(value)
              where jsonb_typeof(citation_id.value) <> 'string'
                or btrim(citation_id.value #>> '{}') = ''
                or not exists (
                  select 1
                  from jsonb_array_elements(target_report.citations) as citation(value)
                  where citation.value ->> 'evidenceLinkId' = citation_id.value #>> '{}'
                )
            )
          )
          else false
        end
    )
  then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  update public.reports
  set
    status = 'revoked',
    slug = null
  where project_id = requested_project_id
    and status = 'published'
    and id <> requested_report_id;

  published_timestamp := now();

  update public.reports
  set
    status = 'published',
    slug = current_project.slug,
    published_at = published_timestamp
  where id = requested_report_id;

  update public.projects
  set
    visibility = 'public',
    updated_at = published_timestamp
  where id = requested_project_id;

  insert into public.audit_events (owner_id, project_id, action, metadata)
  values (
    current_owner,
    requested_project_id,
    'report.published',
    jsonb_build_object(
      'reportId', requested_report_id,
      'version', target_report.version
    )
  );

  return query
  select
    requested_report_id,
    current_project.slug,
    target_report.version,
    'published'::text,
    published_timestamp;
end;
$$;

create function public.revoke_published_report(requested_project_id text)
returns table (
  project_slug text,
  revoked_report_id text
)
language plpgsql
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_project public.projects%rowtype;
  current_report_id text;
begin
  select project.*
  into current_project
  from public.projects as project
  where project.id = requested_project_id
    and project.owner_id = current_owner
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;

  select report.id
  into current_report_id
  from public.reports as report
  where report.project_id = requested_project_id
    and report.status = 'published'
  for update;

  if not found then
    update public.projects
    set
      visibility = 'private',
      updated_at = now()
    where id = requested_project_id
      and visibility <> 'private';

    return query select current_project.slug, null::text;
    return;
  end if;

  update public.reports
  set
    status = 'revoked',
    slug = null
  where id = current_report_id;

  update public.projects
  set
    visibility = 'private',
    updated_at = now()
  where id = requested_project_id;

  insert into public.audit_events (owner_id, project_id, action, metadata)
  values (
    current_owner,
    requested_project_id,
    'report.revoked',
    jsonb_build_object('reportId', current_report_id)
  );

  return query select current_project.slug, current_report_id;
end;
$$;

drop function public.get_public_report(text);

create function public.get_public_report(requested_slug text)
returns table (
  report_id text,
  project_slug text,
  title text,
  question text,
  language text,
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
    project.language,
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

revoke all on function public.publish_report_version(text, text) from public;
revoke all on function public.revoke_published_report(text) from public;
revoke all on function public.get_public_report(text) from public;

grant execute
on function public.publish_report_version(text, text)
to authenticated, service_role;

grant execute
on function public.revoke_published_report(text)
to authenticated, service_role;

grant execute
on function public.get_public_report(text)
to anon, authenticated, service_role;
