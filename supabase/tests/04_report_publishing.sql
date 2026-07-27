begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;

select plan(35);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000031', 'publishing-owner-a@example.com'),
  ('00000000-0000-4000-8000-000000000032', 'publishing-owner-b@example.com');

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
    'publish_project',
    '00000000-0000-4000-8000-000000000031',
    'Publish project',
    'How should a report be published?',
    'en',
    'active',
    'private',
    'publish-project'
  ),
  (
    'publish_other_project',
    '00000000-0000-4000-8000-000000000032',
    'Other project',
    'Can another owner publish this report?',
    'en',
    'active',
    'private',
    'publish-other-project'
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
    'publish_run_v1',
    'publish_project',
    '00000000-0000-4000-8000-000000000031',
    'ready',
    'ready',
    12,
    5,
    200000,
    0,
    0,
    0
  ),
  (
    'publish_run_v2',
    'publish_project',
    '00000000-0000-4000-8000-000000000031',
    'ready',
    'ready',
    12,
    5,
    200000,
    0,
    0,
    0
  ),
  (
    'publish_run_invalid',
    'publish_project',
    '00000000-0000-4000-8000-000000000031',
    'ready',
    'ready',
    12,
    5,
    200000,
    0,
    0,
    0
  ),
  (
    'publish_other_run',
    'publish_other_project',
    '00000000-0000-4000-8000-000000000032',
    'ready',
    'ready',
    12,
    5,
    200000,
    0,
    0,
    0
  );

insert into public.reports (
  id,
  run_id,
  project_id,
  markdown,
  sections,
  citations,
  version,
  status,
  created_at
)
values
  (
    'publish_report_v1',
    'publish_run_v1',
    'publish_project',
    'Finding v1 [link_1]',
    '[{"id":"section_1","heading":"Finding v1","factual":true,"markdown":"Finding v1 [link_1]","citationIds":["link_1"]}]'::jsonb,
    '[{"evidenceLinkId":"link_1","claimId":"claim_1","chunkId":"chunk_1","sourceId":"source_1","quote":"Exact quote v1","sourceUrl":"https://example.com/source-v1","sourceTitle":"Source v1"}]'::jsonb,
    1,
    'draft',
    '2026-07-17T08:00:00Z'
  ),
  (
    'publish_report_v2',
    'publish_run_v2',
    'publish_project',
    'Finding v2 [link_2]',
    '[{"id":"section_2","heading":"Finding v2","factual":true,"markdown":"Finding v2 [link_2]","citationIds":["link_2"]}]'::jsonb,
    '[{"evidenceLinkId":"link_2","claimId":"claim_2","chunkId":"chunk_2","sourceId":"source_2","quote":"Exact quote v2","sourceUrl":"https://example.com/source-v2","sourceTitle":"Source v2"}]'::jsonb,
    2,
    'draft',
    '2026-07-17T09:00:00Z'
  ),
  (
    'publish_report_invalid',
    'publish_run_invalid',
    'publish_project',
    'Unsupported finding [missing_link]',
    '[{"id":"section_invalid","heading":"Unsupported","factual":true,"markdown":"Unsupported finding [missing_link]","citationIds":["missing_link"]}]'::jsonb,
    '[]'::jsonb,
    3,
    'draft',
    '2026-07-17T10:00:00Z'
  ),
  (
    'publish_other_report',
    'publish_other_run',
    'publish_other_project',
    'Other owner finding [other_link]',
    '[{"id":"section_other","heading":"Other finding","factual":true,"markdown":"Other owner finding [other_link]","citationIds":["other_link"]}]'::jsonb,
    '[{"evidenceLinkId":"other_link","claimId":"other_claim","chunkId":"other_chunk","sourceId":"other_source","quote":"Other exact quote","sourceUrl":"https://example.com/other","sourceTitle":"Other source"}]'::jsonb,
    1,
    'draft',
    '2026-07-17T08:00:00Z'
  );

select has_index(
  'public',
  'reports',
  'reports_one_published_per_project_idx',
  'reports enforce one published version per project'
);

select has_function(
  'public',
  'publish_report_version',
  array['text', 'text'],
  'report publishing function exists'
);

select has_function(
  'public',
  'revoke_published_report',
  array['text'],
  'report revocation function exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v1') $$,
  'owner can publish a complete report version'
);

select is(
  (
    select status || ':' || slug
    from public.reports
    where id = 'publish_report_v1'
  ),
  'published:publish-project',
  'published version receives the stable project slug'
);

select is(
  (select visibility from public.projects where id = 'publish_project'),
  'public',
  'publishing makes the project public'
);

select is(
  (
    select count(*)
    from public.reports
    where project_id = 'publish_project' and status = 'published'
  ),
  1::bigint,
  'a project has exactly one published report'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project' and action = 'report.published'
  ),
  1::bigint,
  'first publication writes one audit event'
);

select lives_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v1') $$,
  'publishing the current version is idempotent'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project'
  ),
  1::bigint,
  'idempotent publication does not duplicate audit events'
);

set local role postgres;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select lives_ok(
  $$ select language from public.get_public_report('publish-project') $$,
  'public report snapshot exposes its fixed language'
);

select is(
  (select count(*) from public.get_public_report('publish-project')),
  1::bigint,
  'anonymous users can read the current published version'
);

set local role postgres;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v2') $$,
  'owner can switch the stable link to another version'
);

select is(
  (select status from public.reports where id = 'publish_report_v1'),
  'revoked',
  'switching versions revokes the old report'
);

select ok(
  (select slug is null from public.reports where id = 'publish_report_v1'),
  'switching versions clears the old report slug'
);

select is(
  (
    select status || ':' || slug
    from public.reports
    where id = 'publish_report_v2'
  ),
  'published:publish-project',
  'the new version takes over the stable project slug'
);

select is(
  (
    select count(*)
    from public.reports
    where project_id = 'publish_project' and status = 'published'
  ),
  1::bigint,
  'version switching preserves the single published report invariant'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project' and action = 'report.published'
  ),
  2::bigint,
  'version switching writes one additional publication audit event'
);

select lives_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v2') $$,
  'publishing the switched version again is idempotent'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project'
  ),
  2::bigint,
  'repeated switched publication does not duplicate audit events'
);

select throws_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_invalid') $$,
  'P0001',
  'REPORT_NOT_PUBLISHABLE',
  'factual sections must reference a persisted citation snapshot'
);

select is(
  (select status from public.reports where id = 'publish_report_v2'),
  'published',
  'failed publication keeps the current version published'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project'
  ),
  2::bigint,
  'failed publication does not write an audit event'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000032","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v2') $$,
  'P0001',
  'REPORT_NOT_FOUND',
  'another owner cannot publish a report from the target project'
);

select throws_ok(
  $$ select * from public.revoke_published_report('publish_project') $$,
  'P0001',
  'REPORT_NOT_FOUND',
  'another owner cannot revoke the target project report'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select * from public.revoke_published_report('publish_project') $$,
  'owner can revoke the current public version'
);

select is(
  (select visibility from public.projects where id = 'publish_project'),
  'private',
  'revocation makes the project private'
);

select is(
  (select status from public.reports where id = 'publish_report_v2'),
  'revoked',
  'revocation marks the current version revoked'
);

select ok(
  (select slug is null from public.reports where id = 'publish_report_v2'),
  'revocation clears the report slug'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project' and action = 'report.revoked'
  ),
  1::bigint,
  'revocation writes one audit event'
);

select lives_ok(
  $$ select * from public.revoke_published_report('publish_project') $$,
  'revoking a project without a published version is idempotent'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project'
  ),
  3::bigint,
  'idempotent revocation does not duplicate audit events'
);

set local role postgres;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.get_public_report('publish-project')),
  0::bigint,
  'revoked reports are immediately unavailable to anonymous users'
);

select throws_ok(
  $$ select * from public.publish_report_version('publish_project', 'publish_report_v1') $$,
  '42501',
  'permission denied for function publish_report_version',
  'anonymous callers cannot publish reports'
);

select throws_ok(
  $$ select * from public.revoke_published_report('publish_project') $$,
  '42501',
  'permission denied for function revoke_published_report',
  'anonymous callers cannot revoke reports'
);

select * from finish();

rollback;
