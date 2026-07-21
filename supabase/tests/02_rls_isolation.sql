begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000011', 'rls-owner-a@example.com'),
  ('00000000-0000-4000-8000-000000000012', 'rls-owner-b@example.com');

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
values
  (
    'rls_project_a',
    '00000000-0000-4000-8000-000000000011',
    'Owner A project',
    'Owner A question',
    'en',
    'active',
    'private',
    'rls-project-a'
  ),
  (
    'rls_project_b',
    '00000000-0000-4000-8000-000000000012',
    'Owner B project',
    'Owner B question',
    'en',
    'active',
    'private',
    'rls-project-b'
  ),
  (
    'rls_project_public',
    '00000000-0000-4000-8000-000000000012',
    'Public project',
    'Public question',
    'en',
    'active',
    'public',
    'rls-project-public'
  );

insert into public.sources (
  id,
  project_id,
  canonical_url,
  title,
  domain,
  source_type,
  body,
  content_hash,
  retrieved_at
)
values
  (
    'rls_source_a',
    'rls_project_a',
    'https://owner-a.example/source',
    'Owner A source',
    'owner-a.example',
    'documentation',
    'Owner A evidence.',
    'sha256_rls_a',
    '2026-07-16T00:00:00Z'
  ),
  (
    'rls_source_b',
    'rls_project_b',
    'https://owner-b.example/source',
    'Owner B source',
    'owner-b.example',
    'documentation',
    'Owner B evidence.',
    'sha256_rls_b',
    '2026-07-16T00:00:00Z'
  );

insert into public.research_runs (
  id,
  project_id,
  owner_id,
  status,
  step,
  source_limit,
  manual_url_limit,
  max_content_chars,
  estimated_cost_usd,
  search_count,
  token_count
)
values
  (
    'rls_run_a',
    'rls_project_a',
    '00000000-0000-4000-8000-000000000011',
    'ready',
    'ready',
    12,
    5,
    200000,
    0.01,
    1,
    100
  ),
  (
    'rls_run_b',
    'rls_project_b',
    '00000000-0000-4000-8000-000000000012',
    'ready',
    'ready',
    12,
    5,
    200000,
    0.99,
    10,
    10000
  ),
  (
    'rls_run_public',
    'rls_project_public',
    '00000000-0000-4000-8000-000000000012',
    'ready',
    'ready',
    12,
    5,
    200000,
    0.75,
    8,
    8000
  );

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
  published_at
)
values
  (
    'rls_report_private',
    'rls_run_b',
    'rls_project_b',
    'rls-private-report',
    'Private report',
    '[]'::jsonb,
    '[]'::jsonb,
    1,
    'published',
    '2026-07-16T00:00:00Z'
  ),
  (
    'rls_report_public',
    'rls_run_public',
    'rls_project_public',
    'rls-public-report',
    'Public report',
    '[{"heading":"Public"}]'::jsonb,
    '[{"sourceTitle":"Public source"}]'::jsonb,
    1,
    'published',
    '2026-07-16T00:00:00Z'
  );

select ok(
  (
    select bool_and(relrowsecurity and relforcerowsecurity)
    from pg_class
    where oid in (
      'public.profiles'::regclass,
      'public.projects'::regclass,
      'public.research_runs'::regclass,
      'public.sources'::regclass,
      'public.source_chunks'::regclass,
      'public.claims'::regclass,
      'public.evidence_links'::regclass,
      'public.claim_relations'::regclass,
      'public.workflow_checkpoints'::regclass,
      'public.run_logs'::regclass,
      'public.reports'::regclass,
      'public.usage_monthly'::regclass,
      'public.audit_events'::regclass
    )
  ),
  'all user data tables force row level security'
);

create function pg_temp.update_owner_b_project()
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  update public.projects
  set title = 'Tampered'
  where id = 'rls_project_b';
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create function pg_temp.delete_owner_b_project()
returns bigint
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  delete from public.projects
  where id = 'rls_project_b';
  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.projects),
  1::bigint,
  'owner A only reads their project'
);

select is(
  (select id from public.projects limit 1),
  'rls_project_a',
  'owner A cannot read owner B project rows'
);

select is(
  (select count(*) from public.sources),
  1::bigint,
  'owner A only reads sources in their project'
);

select is(
  (select count(*) from public.research_runs),
  1::bigint,
  'owner A cannot read owner B run cost data'
);

select throws_ok(
  $$
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
      'rls_forged_project',
      '00000000-0000-4000-8000-000000000012',
      'Forged project',
      'Forged question',
      'en',
      'active',
      'private',
      'rls-forged-project'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "projects"',
  'owner A cannot create a project for owner B'
);

select throws_ok(
  $$
    insert into public.sources (
      id,
      project_id,
      canonical_url,
      title,
      domain,
      source_type,
      body,
      content_hash,
      retrieved_at
    )
    values (
      'rls_forged_source',
      'rls_project_b',
      'https://forged.example/source',
      'Forged source',
      'forged.example',
      'documentation',
      'Forged body.',
      'sha256_forged',
      '2026-07-16T00:00:00Z'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "sources"',
  'owner A cannot add a source to owner B project'
);

select is(
  pg_temp.update_owner_b_project(),
  0::bigint,
  'owner A cannot update owner B project'
);

select is(
  pg_temp.delete_owner_b_project(),
  0::bigint,
  'owner A cannot delete owner B project'
);

reset role;
set local role anon;

select throws_ok(
  $$ select * from public.projects $$,
  '42501',
  'permission denied for table projects',
  'anonymous users cannot query project rows directly'
);

select throws_ok(
  $$ select * from public.sources $$,
  '42501',
  'permission denied for table sources',
  'anonymous users cannot query source bodies directly'
);

select is(
  (select count(*) from public.get_public_report('rls-public-report')),
  1::bigint,
  'anonymous users can read a published public report snapshot'
);

select is(
  (select count(*) from public.get_public_report('rls-private-report')),
  0::bigint,
  'anonymous users cannot read a report from a private project'
);

select is(
  (select markdown from public.get_public_report('rls-public-report')),
  'Public report',
  'the public function returns the immutable report snapshot'
);

reset role;
update public.reports
set status = 'revoked'
where id = 'rls_report_public';
set local role anon;

select is(
  (select count(*) from public.get_public_report('rls-public-report')),
  0::bigint,
  'revoked reports are no longer publicly readable'
);

select * from finish();

rollback;
