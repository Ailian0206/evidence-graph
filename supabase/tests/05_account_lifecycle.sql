begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000041', 'lifecycle-owner@example.com'),
  ('00000000-0000-4000-8000-000000000042', 'lifecycle-other@example.com'),
  ('00000000-0000-4000-8000-000000000043', 'lifecycle-account@example.com');

create function pg_temp.seed_lifecycle_project(
  fixture_project_id text,
  fixture_owner_id uuid,
  fixture_suffix text,
  fixture_report_slug text
)
returns void
language plpgsql
as $$
declare
  fixture_run_id text := 'life_run_' || fixture_suffix;
  fixture_source_id text := 'life_source_' || fixture_suffix;
  fixture_chunk_id text := 'life_chunk_' || fixture_suffix;
  fixture_claim_a_id text := 'life_claim_' || fixture_suffix || '_a';
  fixture_claim_b_id text := 'life_claim_' || fixture_suffix || '_b';
  fixture_body text := 'Evidence ' || fixture_suffix;
begin
  insert into public.projects (
    id, owner_id, title, question, language, status, visibility, slug
  ) values (
    fixture_project_id,
    fixture_owner_id,
    'Lifecycle ' || fixture_suffix,
    'Does deletion remove this lifecycle data?',
    'en',
    'active',
    'public',
    'life-project-' || fixture_suffix
  );

  insert into public.research_runs (
    id, project_id, owner_id, status, step, source_limit, manual_url_limit,
    max_content_chars
  ) values (
    fixture_run_id, fixture_project_id, fixture_owner_id, 'ready', 'ready',
    12, 5, 200000
  );

  insert into public.sources (
    id, project_id, canonical_url, title, domain, source_type, body,
    content_hash, retrieved_at
  ) values (
    fixture_source_id,
    fixture_project_id,
    'https://example.com/lifecycle-' || fixture_suffix,
    'Lifecycle source',
    'example.com',
    'documentation',
    fixture_body,
    'life_hash_' || fixture_suffix,
    '2026-07-29T00:00:00Z'
  );

  insert into public.source_chunks (
    id, source_id, project_id, chunk_index, body, start_char, end_char,
    embedding_dimensions
  ) values (
    fixture_chunk_id, fixture_source_id, fixture_project_id, 0, fixture_body,
    0, char_length(fixture_body), 1536
  );

  insert into public.claims (
    id, project_id, statement, normalized_key, claim_type, qualifiers,
    confidence, review_status
  ) values
    (
      fixture_claim_a_id, fixture_project_id, 'Deletion removes data.',
      'life ' || fixture_suffix || ' claim a', 'factual', '[]'::jsonb, 0.9,
      'accepted'
    ),
    (
      fixture_claim_b_id, fixture_project_id, 'Deletion revokes access.',
      'life ' || fixture_suffix || ' claim b', 'factual', '[]'::jsonb, 0.8,
      'accepted'
    );

  insert into public.evidence_links (
    id, claim_id, chunk_id, project_id, relation, strength, quote, rationale
  ) values (
    'life_link_' || fixture_suffix, fixture_claim_a_id, fixture_chunk_id,
    fixture_project_id, 'supports', 'strong', fixture_body,
    'Exact lifecycle evidence.'
  );

  insert into public.claim_relations (
    id, project_id, from_claim_id, to_claim_id, relation, rationale
  ) values (
    'life_relation_' || fixture_suffix, fixture_project_id, fixture_claim_a_id,
    fixture_claim_b_id, 'depends_on', 'Both claims describe deletion.'
  );

  insert into public.workflow_checkpoints (
    run_id, project_id, step, idempotency_key, output, completed_at
  ) values (
    fixture_run_id, fixture_project_id, 'planning',
    'life-checkpoint-' || fixture_suffix, '{}'::jsonb,
    '2026-07-29T00:00:00Z'
  );

  insert into public.run_logs (
    id, run_id, project_id, step, status, attempt, occurred_at
  ) values (
    'life_log_' || fixture_suffix, fixture_run_id, fixture_project_id,
    'planning', 'completed', 1, '2026-07-29T00:00:00Z'
  );

  insert into public.reports (
    id, run_id, project_id, slug, markdown, sections, citations, version,
    status, published_at
  ) values (
    'life_report_' || fixture_suffix, fixture_run_id, fixture_project_id,
    fixture_report_slug, 'Published lifecycle report.', '[]'::jsonb,
    '[]'::jsonb, 1, 'published', '2026-07-29T00:00:00Z'
  );

  insert into public.audit_events (owner_id, project_id, action)
  values (fixture_owner_id, fixture_project_id, 'lifecycle.created');
end;
$$;

select pg_temp.seed_lifecycle_project(
  'life_project_delete',
  '00000000-0000-4000-8000-000000000041',
  'delete',
  'life-report-delete'
);
select pg_temp.seed_lifecycle_project(
  'life_project_account',
  '00000000-0000-4000-8000-000000000043',
  'account',
  'life-report-account'
);

insert into public.projects (
  id, owner_id, title, question, language, status, visibility, slug
) values (
  'life_project_other',
  '00000000-0000-4000-8000-000000000042',
  'Other owner project',
  'Can another owner delete this project?',
  'en',
  'active',
  'private',
  'life-project-other'
);

insert into public.usage_monthly (owner_id, month, run_count)
values
  (
    '00000000-0000-4000-8000-000000000041',
    date_trunc('month', now())::date,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000043',
    date_trunc('month', now())::date,
    1
  );

create function pg_temp.delete_project(requested_project_id text)
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  delete from public.projects where id = requested_project_id;
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000041', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000041","role":"authenticated"}',
  true
);

select is(
  pg_temp.delete_project('life_project_other'),
  0::bigint,
  'owners cannot delete another account project'
);
select is(
  pg_temp.delete_project('life_project_delete'),
  1::bigint,
  'owners can delete their project'
);

set local role postgres;

select is(
  (select count(*) from public.projects where id = 'life_project_other'),
  1::bigint,
  'a cross-owner delete leaves the other project intact'
);
select is(
  (
    (select count(*) from public.research_runs where project_id = 'life_project_delete')
    + (select count(*) from public.sources where project_id = 'life_project_delete')
    + (select count(*) from public.source_chunks where project_id = 'life_project_delete')
    + (select count(*) from public.claims where project_id = 'life_project_delete')
    + (select count(*) from public.evidence_links where project_id = 'life_project_delete')
    + (select count(*) from public.claim_relations where project_id = 'life_project_delete')
    + (select count(*) from public.workflow_checkpoints where project_id = 'life_project_delete')
    + (select count(*) from public.run_logs where project_id = 'life_project_delete')
    + (select count(*) from public.reports where project_id = 'life_project_delete')
    + (select count(*) from public.audit_events where project_id = 'life_project_delete')
  ),
  0::bigint,
  'project deletion removes all dependent research data'
);
select is(
  (select count(*) from public.get_public_report('life-report-delete')),
  0::bigint,
  'project deletion makes the published report slug inaccessible'
);
select is(
  (
    (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000041')
    + (select count(*) from public.usage_monthly where owner_id = '00000000-0000-4000-8000-000000000041')
  ),
  2::bigint,
  'project deletion preserves the owner profile and monthly usage'
);

delete from auth.users
where id = '00000000-0000-4000-8000-000000000043';

select is(
  (
    (select count(*) from auth.users where id = '00000000-0000-4000-8000-000000000043')
    + (select count(*) from public.profiles where id = '00000000-0000-4000-8000-000000000043')
    + (select count(*) from public.usage_monthly where owner_id = '00000000-0000-4000-8000-000000000043')
    + (select count(*) from public.projects where owner_id = '00000000-0000-4000-8000-000000000043')
  ),
  0::bigint,
  'account deletion removes the auth user, profile, usage, and projects'
);
select is(
  (
    (select count(*) from public.research_runs where project_id = 'life_project_account')
    + (select count(*) from public.sources where project_id = 'life_project_account')
    + (select count(*) from public.source_chunks where project_id = 'life_project_account')
    + (select count(*) from public.claims where project_id = 'life_project_account')
    + (select count(*) from public.evidence_links where project_id = 'life_project_account')
    + (select count(*) from public.claim_relations where project_id = 'life_project_account')
    + (select count(*) from public.workflow_checkpoints where project_id = 'life_project_account')
    + (select count(*) from public.run_logs where project_id = 'life_project_account')
    + (select count(*) from public.reports where project_id = 'life_project_account')
    + (select count(*) from public.audit_events where project_id = 'life_project_account')
    + (select count(*) from public.get_public_report('life-report-account'))
  ),
  0::bigint,
  'account deletion removes project descendants and public report access'
);

select * from finish();
rollback;
