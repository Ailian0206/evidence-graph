begin;

create extension if not exists pgtap with schema extensions;
set local role postgres;
set local search_path = public, extensions;

select plan(40);

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
    'How should a reviewed report be published?',
    'en',
    'active',
    'public',
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
    'publish_run_current',
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
    'publish_run_accepted',
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
    'publish_run_pending',
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
    'publish_run_rejected',
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

insert into public.claims (
  id,
  project_id,
  statement,
  normalized_key,
  claim_type,
  qualifiers,
  confidence,
  review_status
)
values
  (
    'claim_accepted',
    'publish_project',
    'Accepted finding',
    'accepted finding',
    'factual',
    '[]'::jsonb,
    0.900,
    'accepted'
  ),
  (
    'claim_pending',
    'publish_project',
    'Pending finding',
    'pending finding',
    'factual',
    '[]'::jsonb,
    0.800,
    'pending'
  ),
  (
    'claim_rejected',
    'publish_project',
    'Rejected finding',
    'rejected finding',
    'factual',
    '[]'::jsonb,
    0.700,
    'rejected'
  ),
  (
    'other_claim',
    'publish_other_project',
    'Other finding',
    'other finding',
    'factual',
    '[]'::jsonb,
    0.900,
    'accepted'
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
  published_at,
  created_at
)
values
  (
    'publish_report_current',
    'publish_run_current',
    'publish_project',
    'publish-project',
    E'## Previous\n\nPrevious finding [link_accepted]',
    '[{"id":"section_previous","heading":"Previous","factual":true,"markdown":"Previous finding [link_accepted]","citationIds":["link_accepted"]}]'::jsonb,
    '[{"evidenceLinkId":"link_accepted","claimId":"claim_accepted","chunkId":"chunk_accepted","sourceId":"source_accepted","quote":"Accepted exact quote","sourceUrl":"https://example.com/accepted","sourceTitle":"Accepted source"}]'::jsonb,
    1,
    'published',
    '2026-07-17T07:00:00Z',
    '2026-07-17T07:00:00Z'
  ),
  (
    'publish_report_accepted',
    'publish_run_accepted',
    'publish_project',
    null,
    'Original accepted draft',
    '[{"id":"section_finding","heading":"Finding","factual":true,"markdown":"Accepted finding [link_accepted]","citationIds":["link_accepted"]},{"id":"section_context","heading":"Context","factual":false,"markdown":"Method note without a citation.","citationIds":[]}]'::jsonb,
    '[{"evidenceLinkId":"link_accepted","claimId":"claim_accepted","chunkId":"chunk_accepted","sourceId":"source_accepted","quote":"Accepted exact quote","sourceUrl":"https://example.com/accepted","sourceTitle":"Accepted source"}]'::jsonb,
    2,
    'draft',
    null,
    '2026-07-17T08:00:00Z'
  ),
  (
    'publish_report_pending',
    'publish_run_pending',
    'publish_project',
    null,
    'Pending draft',
    '[{"id":"section_pending","heading":"Pending","factual":true,"markdown":"Pending finding [link_pending]","citationIds":["link_pending"]}]'::jsonb,
    '[{"evidenceLinkId":"link_pending","claimId":"claim_pending","chunkId":"chunk_pending","sourceId":"source_pending","quote":"Pending exact quote","sourceUrl":"https://example.com/pending","sourceTitle":"Pending source"}]'::jsonb,
    3,
    'draft',
    null,
    '2026-07-17T09:00:00Z'
  ),
  (
    'publish_report_rejected',
    'publish_run_rejected',
    'publish_project',
    null,
    'Rejected draft',
    '[{"id":"section_rejected","heading":"Rejected","factual":true,"markdown":"Rejected finding [link_rejected]","citationIds":["link_rejected"]},{"id":"section_context_rejected","heading":"Context","factual":false,"markdown":"Method note without a citation.","citationIds":[]}]'::jsonb,
    '[{"evidenceLinkId":"link_rejected","claimId":"claim_rejected","chunkId":"chunk_rejected","sourceId":"source_rejected","quote":"Rejected exact quote","sourceUrl":"https://example.com/rejected","sourceTitle":"Rejected source"}]'::jsonb,
    4,
    'draft',
    null,
    '2026-07-17T10:00:00Z'
  ),
  (
    'publish_other_report',
    'publish_other_run',
    'publish_other_project',
    null,
    'Other draft',
    '[{"id":"section_other","heading":"Other","factual":true,"markdown":"Other finding [other_link]","citationIds":["other_link"]}]'::jsonb,
    '[{"evidenceLinkId":"other_link","claimId":"other_claim","chunkId":"other_chunk","sourceId":"other_source","quote":"Other exact quote","sourceUrl":"https://example.com/other","sourceTitle":"Other source"}]'::jsonb,
    1,
    'draft',
    null,
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
  'publish_reviewed_report',
  array['text', 'text', 'text', 'jsonb', 'jsonb'],
  'reviewed report publishing function exists'
);

select is(
  to_regprocedure('public.publish_report_version(text,text)'),
  null::regprocedure,
  'legacy direct publishing function is removed'
);

select has_function(
  'public',
  'revoke_published_report',
  array['text'],
  'report revocation function remains available'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    update public.reports
    set status = 'revoked'
    where id = 'publish_report_current'
  $$,
  '42501',
  'permission denied for table reports',
  'authenticated users cannot bypass publication by updating report rows'
);

select throws_ok(
  $$
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
    values (
      'publish_report_bypass',
      'publish_run_accepted',
      'publish_project',
      'publish-project-bypass',
      'Bypass report',
      '[]'::jsonb,
      '[]'::jsonb,
      99,
      'published',
      now()
    )
  $$,
  '42501',
  'permission denied for table reports',
  'authenticated users cannot bypass publication by inserting report rows'
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_pending',
      E'## Pending\n\nPending finding [link_pending]',
      '[{"id":"section_pending","heading":"Pending","factual":true,"markdown":"Pending finding [link_pending]","citationIds":["link_pending"]}]'::jsonb,
      '[{"evidenceLinkId":"link_pending","claimId":"claim_pending","chunkId":"chunk_pending","sourceId":"source_pending","quote":"Pending exact quote","sourceUrl":"https://example.com/pending","sourceTitle":"Pending source"}]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_REVIEW_INCOMPLETE',
  'pending referenced claims block publication'
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_rejected',
      E'## Context\n\nMethod note without a citation.',
      '[{"id":"section_context_rejected","heading":"Context","factual":false,"markdown":"Method note without a citation.","citationIds":[]}]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_NO_ACCEPTED_CONTENT',
  'a rejected-only factual report has no publishable content'
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_rejected',
      E'## Rejected\n\nRejected finding [link_rejected]',
      '[{"id":"section_rejected","heading":"Rejected","factual":true,"markdown":"Rejected finding [link_rejected]","citationIds":["link_rejected"]}]'::jsonb,
      '[{"evidenceLinkId":"link_rejected","claimId":"claim_rejected","chunkId":"chunk_rejected","sourceId":"source_rejected","quote":"Rejected exact quote","sourceUrl":"https://example.com/rejected","sourceTitle":"Rejected source"}]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_NOT_PUBLISHABLE',
  'submitted citations must reference accepted claims'
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_accepted',
      E'## Finding\n\nAccepted finding [link_fake]',
      '[{"id":"section_finding","heading":"Finding","factual":true,"markdown":"Accepted finding [link_fake]","citationIds":["link_fake"]}]'::jsonb,
      '[{"evidenceLinkId":"link_fake","claimId":"claim_accepted","chunkId":"chunk_accepted","sourceId":"source_accepted","quote":"Accepted exact quote","sourceUrl":"https://example.com/accepted","sourceTitle":"Accepted source"}]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_NOT_PUBLISHABLE',
  'submitted citations must exist unchanged in the base report'
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_accepted',
      E'## Finding\n\nAccepted finding [link_accepted]',
      '[{"id":"section_finding","heading":"Finding","factual":true,"markdown":"Accepted finding [link_accepted]","citationIds":["link_accepted"]}]'::jsonb,
      '[]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_NOT_PUBLISHABLE',
  'every submitted section citation has a submitted citation snapshot'
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_accepted',
      E'## Finding\n\nChanged accepted finding [link_accepted]',
      '[{"id":"section_finding","heading":"Finding","factual":true,"markdown":"Changed accepted finding [link_accepted]","citationIds":["link_accepted"]}]'::jsonb,
      '[{"evidenceLinkId":"link_accepted","claimId":"claim_accepted","chunkId":"chunk_accepted","sourceId":"source_accepted","quote":"Accepted exact quote","sourceUrl":"https://example.com/accepted","sourceTitle":"Accepted source"}]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_NOT_PUBLISHABLE',
  'submitted paragraphs cannot change base report text'
);

select is(
  (select status from public.reports where id = 'publish_report_current'),
  'published',
  'failed publication keeps the current report published'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project'
  ),
  0::bigint,
  'failed publication writes no audit events'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000032","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_accepted',
      E'## Finding\n\nAccepted finding [link_accepted]\n\n## Context\n\nMethod note without a citation.',
      '[{"id":"section_finding","heading":"Finding","factual":true,"markdown":"Accepted finding [link_accepted]","citationIds":["link_accepted"]},{"id":"section_context","heading":"Context","factual":false,"markdown":"Method note without a citation.","citationIds":[]}]'::jsonb,
      '[{"evidenceLinkId":"link_accepted","claimId":"claim_accepted","chunkId":"chunk_accepted","sourceId":"source_accepted","quote":"Accepted exact quote","sourceUrl":"https://example.com/accepted","sourceTitle":"Accepted source"}]'::jsonb
    )
  $$,
  'P0001',
  'REPORT_NOT_FOUND',
  'another owner cannot publish the target project report'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    create temp table reviewed_publish_result as
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_accepted',
      E'## Finding\n\nAccepted finding [link_accepted]\n\n## Context\n\nMethod note without a citation.',
      '[{"id":"section_finding","heading":"Finding","factual":true,"markdown":"Accepted finding [link_accepted]","citationIds":["link_accepted"]},{"id":"section_context","heading":"Context","factual":false,"markdown":"Method note without a citation.","citationIds":[]}]'::jsonb,
      '[{"evidenceLinkId":"link_accepted","claimId":"claim_accepted","chunkId":"chunk_accepted","sourceId":"source_accepted","quote":"Accepted exact quote","sourceUrl":"https://example.com/accepted","sourceTitle":"Accepted source"}]'::jsonb
    )
  $$,
  'owner can publish a deterministic reviewed report snapshot'
);

select isnt(
  (select id from reviewed_publish_result),
  'publish_report_accepted',
  'reviewed publication creates a new immutable report row'
);

select is(
  (
    select status || ':' || slug || ':' || version::text
    from reviewed_publish_result
  ),
  'published:publish-project:5',
  'the new version receives the stable slug and next version number'
);

select ok(
  (
    select published_at is not null and published_at = created_at
    from reviewed_publish_result
  ),
  'the new version uses one publication timestamp'
);

select is(
  (select run_id from reviewed_publish_result),
  'publish_run_accepted',
  'the new version keeps the base report run id'
);

select is(
  (
    select markdown || ':' || jsonb_array_length(sections)::text || ':' ||
      jsonb_array_length(citations)::text
    from reviewed_publish_result
  ),
  E'## Finding\n\nAccepted finding [link_accepted]\n\n## Context\n\nMethod note without a citation.:2:1',
  'the new version stores the exact reviewed snapshot'
);

select is(
  (
    select status || ':' || markdown
    from public.reports
    where id = 'publish_report_accepted'
  ),
  'draft:Original accepted draft',
  'the base report remains unchanged'
);

select is(
  (select status from public.reports where id = 'publish_report_current'),
  'revoked',
  'publishing revokes the previous public report'
);

select ok(
  (select slug is null from public.reports where id = 'publish_report_current'),
  'publishing clears the previous public slug'
);

select is(
  (
    select count(*)
    from public.reports
    where project_id = 'publish_project' and status = 'published'
  ),
  1::bigint,
  'the project has exactly one published report'
);

select is(
  (select visibility from public.projects where id = 'publish_project'),
  'public',
  'publishing makes the project public'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project' and action = 'report.published'
  ),
  1::bigint,
  'publication writes one audit event'
);

select is(
  (
    select metadata ->> 'baseReportId'
    from public.audit_events
    where project_id = 'publish_project' and action = 'report.published'
  ),
  'publish_report_accepted',
  'publication audit metadata records the base report'
);

set local role postgres;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*) from public.get_public_report('publish-project')),
  1::bigint,
  'anonymous users can read the reviewed public version'
);

select is(
  (select markdown from public.get_public_report('publish-project')),
  E'## Finding\n\nAccepted finding [link_accepted]\n\n## Context\n\nMethod note without a citation.',
  'public reads expose the reviewed snapshot only'
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
  $$ select * from public.revoke_published_report('publish_project') $$,
  'owner can revoke the reviewed public version'
);

select is(
  (select visibility from public.projects where id = 'publish_project'),
  'private',
  'revocation makes the project private'
);

select is(
  (
    select status
    from public.reports
    where id = (select id from reviewed_publish_result)
  ),
  'revoked',
  'revocation marks the reviewed version revoked'
);

select ok(
  (
    select slug is null
    from public.reports
    where id = (select id from reviewed_publish_result)
  ),
  'revocation clears the reviewed version slug'
);

select is(
  (select count(*) from public.get_public_report('publish-project')),
  0::bigint,
  'revoked reports are unavailable to anonymous users'
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
  'revoking without a published version is idempotent'
);

select is(
  (
    select count(*)
    from public.audit_events
    where project_id = 'publish_project'
  ),
  2::bigint,
  'idempotent revocation does not duplicate audit events'
);

set local role postgres;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$
    select * from public.publish_reviewed_report(
      'publish_project',
      'publish_report_accepted',
      'x',
      '[]'::jsonb,
      '[]'::jsonb
    )
  $$,
  '42501',
  'permission denied for function publish_reviewed_report',
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
