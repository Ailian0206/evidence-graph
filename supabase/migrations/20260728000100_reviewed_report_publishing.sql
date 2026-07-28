drop function if exists public.publish_report_version(text, text);
drop function if exists public.publish_reviewed_report(text, text, text, jsonb, jsonb);

create function public.publish_reviewed_report(
  requested_project_id text,
  requested_base_report_id text,
  requested_markdown text,
  requested_sections jsonb,
  requested_citations jsonb
)
returns table (
  id text,
  run_id text,
  project_id text,
  slug text,
  markdown text,
  sections jsonb,
  citations jsonb,
  version integer,
  status text,
  published_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_owner uuid := auth.uid();
  current_project public.projects%rowtype;
  base_report public.reports%rowtype;
  new_report public.reports%rowtype;
  base_citation jsonb;
  requested_citation jsonb;
  base_section jsonb;
  base_paragraph text;
  section_citation_id text;
  section_citation jsonb;
  claim_status text;
  paragraph_has_citation boolean;
  paragraph_has_rejected_claim boolean;
  section_kept_paragraphs text[];
  paragraph_citation_ids text[];
  section_kept_citation_ids text[];
  expected_citation_ids text[] := array[]::text[];
  expected_sections jsonb := '[]'::jsonb;
  expected_citations jsonb;
  expected_markdown text;
  accepted_factual_paragraphs integer := 0;
  next_version integer;
  published_timestamp timestamptz := now();
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
  into base_report
  from public.reports as report
  where report.id = requested_base_report_id
    and report.project_id = requested_project_id
  for update;

  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;
  if base_report.status not in ('draft', 'revoked')
    or jsonb_typeof(base_report.sections) <> 'array'
    or jsonb_array_length(base_report.sections) = 0
    or jsonb_typeof(base_report.citations) <> 'array'
  then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  if requested_markdown is null
    or btrim(requested_markdown) = ''
    or jsonb_typeof(requested_sections) <> 'array'
    or jsonb_typeof(requested_citations) <> 'array'
  then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  if (
    select count(*) <> count(distinct citation.value ->> 'evidenceLinkId')
    from jsonb_array_elements(base_report.citations) as citation(value)
  ) then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  for base_citation in
    select citation.value
    from jsonb_array_elements(base_report.citations) with ordinality
      as citation(value, ordinality)
    order by citation.ordinality
  loop
    if jsonb_typeof(base_citation) <> 'object'
      or jsonb_typeof(base_citation -> 'evidenceLinkId') <> 'string'
      or jsonb_typeof(base_citation -> 'claimId') <> 'string'
      or jsonb_typeof(base_citation -> 'chunkId') <> 'string'
      or jsonb_typeof(base_citation -> 'sourceId') <> 'string'
      or jsonb_typeof(base_citation -> 'quote') <> 'string'
      or jsonb_typeof(base_citation -> 'sourceUrl') <> 'string'
      or jsonb_typeof(base_citation -> 'sourceTitle') <> 'string'
      or btrim(base_citation ->> 'evidenceLinkId') = ''
      or btrim(base_citation ->> 'claimId') = ''
      or btrim(base_citation ->> 'chunkId') = ''
      or btrim(base_citation ->> 'sourceId') = ''
      or btrim(base_citation ->> 'quote') = ''
      or btrim(base_citation ->> 'sourceUrl') = ''
      or btrim(base_citation ->> 'sourceTitle') = ''
    then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    select claim.review_status
    into claim_status
    from public.claims as claim
    where claim.id = base_citation ->> 'claimId'
      and claim.project_id = requested_project_id
    for share;

    if not found then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;
    if claim_status = 'pending' then
      raise exception 'REPORT_REVIEW_INCOMPLETE';
    end if;
  end loop;

  for requested_citation in
    select citation.value
    from jsonb_array_elements(requested_citations) as citation(value)
  loop
    if jsonb_typeof(requested_citation) <> 'object'
      or not base_report.citations @> jsonb_build_array(requested_citation)
    then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    select claim.review_status
    into claim_status
    from public.claims as claim
    where claim.id = requested_citation ->> 'claimId'
      and claim.project_id = requested_project_id
    for share;

    if not found or claim_status <> 'accepted' then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;
  end loop;

  if (
    select count(*) <> count(distinct section.value ->> 'id')
    from jsonb_array_elements(base_report.sections) as section(value)
  ) then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  for base_section in
    select section.value
    from jsonb_array_elements(base_report.sections) with ordinality
      as section(value, ordinality)
    order by section.ordinality
  loop
    if jsonb_typeof(base_section) <> 'object'
      or jsonb_typeof(base_section -> 'id') <> 'string'
      or jsonb_typeof(base_section -> 'heading') <> 'string'
      or jsonb_typeof(base_section -> 'factual') <> 'boolean'
      or jsonb_typeof(base_section -> 'markdown') <> 'string'
      or jsonb_typeof(base_section -> 'citationIds') <> 'array'
      or btrim(base_section ->> 'id') = ''
      or btrim(base_section ->> 'heading') = ''
      or btrim(base_section ->> 'markdown') = ''
    then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(base_section -> 'citationIds') as citation(value)
      where jsonb_typeof(citation.value) <> 'string'
        or btrim(citation.value #>> '{}') = ''
        or not exists (
          select 1
          from jsonb_array_elements(base_report.citations) as report_citation(value)
          where report_citation.value ->> 'evidenceLinkId' = citation.value #>> '{}'
        )
    ) or (
      select count(*) <> count(distinct citation.value #>> '{}')
      from jsonb_array_elements(base_section -> 'citationIds') as citation(value)
    ) then
      raise exception 'REPORT_NOT_PUBLISHABLE';
    end if;

    section_kept_paragraphs := array[]::text[];
    section_kept_citation_ids := array[]::text[];

    for base_paragraph in
      select btrim(paragraph.value)
      from regexp_split_to_table(base_section ->> 'markdown', E'\\n[[:space:]]*\\n')
        with ordinality as paragraph(value, ordinality)
      where btrim(paragraph.value) <> ''
      order by paragraph.ordinality
    loop
      paragraph_has_citation := false;
      paragraph_has_rejected_claim := false;
      paragraph_citation_ids := array[]::text[];

      for section_citation_id in
        select citation.value #>> '{}'
        from jsonb_array_elements(base_section -> 'citationIds') with ordinality
          as citation(value, ordinality)
        order by citation.ordinality
      loop
        if strpos(base_paragraph, '[' || section_citation_id || ']') > 0 then
          paragraph_has_citation := true;

          select citation.value
          into section_citation
          from jsonb_array_elements(base_report.citations) as citation(value)
          where citation.value ->> 'evidenceLinkId' = section_citation_id;

          select claim.review_status
          into claim_status
          from public.claims as claim
          where claim.id = section_citation ->> 'claimId'
            and claim.project_id = requested_project_id
          for share;

          if not found then
            raise exception 'REPORT_NOT_PUBLISHABLE';
          end if;
          if claim_status = 'pending' then
            raise exception 'REPORT_REVIEW_INCOMPLETE';
          end if;
          if claim_status = 'rejected' then
            paragraph_has_rejected_claim := true;
          elsif not section_citation_id = any(paragraph_citation_ids) then
            paragraph_citation_ids := array_append(
              paragraph_citation_ids,
              section_citation_id
            );
          end if;
        end if;
      end loop;

      if (base_section ->> 'factual')::boolean and not paragraph_has_citation then
        raise exception 'REPORT_NOT_PUBLISHABLE';
      end if;

      if not paragraph_has_rejected_claim then
        section_kept_paragraphs := array_append(
          section_kept_paragraphs,
          base_paragraph
        );

        if (base_section ->> 'factual')::boolean then
          accepted_factual_paragraphs := accepted_factual_paragraphs + 1;
        end if;

        if cardinality(paragraph_citation_ids) > 0 then
          for section_citation_id in
            select unnest(paragraph_citation_ids)
          loop
            if not section_citation_id = any(section_kept_citation_ids) then
              section_kept_citation_ids := array_append(
                section_kept_citation_ids,
                section_citation_id
              );
            end if;
            if not section_citation_id = any(expected_citation_ids) then
              expected_citation_ids := array_append(
                expected_citation_ids,
                section_citation_id
              );
            end if;
          end loop;
        end if;
      end if;
    end loop;

    if cardinality(section_kept_paragraphs) > 0 then
      expected_sections := expected_sections || jsonb_build_array(
        jsonb_build_object(
          'id', base_section ->> 'id',
          'heading', base_section ->> 'heading',
          'factual', (base_section ->> 'factual')::boolean,
          'markdown', array_to_string(section_kept_paragraphs, E'\n\n'),
          'citationIds', to_jsonb(section_kept_citation_ids)
        )
      );
    end if;
  end loop;

  if accepted_factual_paragraphs = 0 then
    raise exception 'REPORT_NO_ACCEPTED_CONTENT';
  end if;

  select string_agg(
    '## ' || (section.value ->> 'heading') || E'\n\n' ||
      (section.value ->> 'markdown'),
    E'\n\n' order by section.ordinality
  )
  into expected_markdown
  from jsonb_array_elements(expected_sections) with ordinality
    as section(value, ordinality);

  select coalesce(jsonb_agg(citation.value order by citation.ordinality), '[]'::jsonb)
  into expected_citations
  from jsonb_array_elements(base_report.citations) with ordinality
    as citation(value, ordinality)
  where citation.value ->> 'evidenceLinkId' = any(expected_citation_ids);

  if requested_markdown is distinct from expected_markdown
    or requested_sections is distinct from expected_sections
    or requested_citations is distinct from expected_citations
  then
    raise exception 'REPORT_NOT_PUBLISHABLE';
  end if;

  select coalesce(max(report.version), 0) + 1
  into next_version
  from public.reports as report
  where report.project_id = requested_project_id;

  update public.reports
  set status = 'revoked', slug = null
  where reports.project_id = requested_project_id
    and reports.status = 'published';

  insert into public.reports (
    id,
    run_id,
    project_id,
    slug,
    markdown,
    sections,
    citations,
    version,
    status,
    published_at,
    created_at
  )
  values (
    'report_' || replace(gen_random_uuid()::text, '-', ''),
    base_report.run_id,
    requested_project_id,
    current_project.slug,
    expected_markdown,
    expected_sections,
    expected_citations,
    next_version,
    'published',
    published_timestamp,
    published_timestamp
  )
  returning * into new_report;

  update public.projects
  set visibility = 'public', updated_at = published_timestamp
  where projects.id = requested_project_id;

  insert into public.audit_events (owner_id, project_id, action, metadata)
  values (
    current_owner,
    requested_project_id,
    'report.published',
    jsonb_build_object(
      'baseReportId', requested_base_report_id,
      'reportId', new_report.id,
      'version', new_report.version
    )
  );

  return query
  select
    new_report.id,
    new_report.run_id,
    new_report.project_id,
    new_report.slug,
    new_report.markdown,
    new_report.sections,
    new_report.citations,
    new_report.version,
    new_report.status,
    new_report.published_at,
    new_report.created_at;
end;
$$;

revoke all
on function public.publish_reviewed_report(text, text, text, jsonb, jsonb)
from public;

grant execute
on function public.publish_reviewed_report(text, text, text, jsonb, jsonb)
to authenticated, service_role;

alter function public.revoke_published_report(text) security definer;

revoke insert, update, delete
on table public.reports
from authenticated;

grant select
on table public.reports
to authenticated;
