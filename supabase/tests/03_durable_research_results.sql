begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000021', 'durable-owner-a@example.com'),
  ('00000000-0000-4000-8000-000000000022', 'durable-owner-b@example.com');

select col_type_is(
  'public',
  'research_runs',
  'manual_urls',
  'jsonb',
  'research runs persist manual URLs as JSON'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select * from public.create_managed_research(
      'durable_project_a_1',
      'durable_run_a_1',
      'Durable research',
      'How are workflow results persisted?',
      'en',
      'research-durable-project-a-1',
      '["https://example.com/source"]'::jsonb
    )
  $$,
  'authenticated owners create a project and run atomically'
);

reset role;

select is(
  (select owner_id from public.projects where id = 'durable_project_a_1'),
  '00000000-0000-4000-8000-000000000021'::uuid,
  'atomic creation derives the owner from auth uid'
);

select is(
  (select status from public.research_runs where id = 'durable_run_a_1'),
  'queued',
  'new research runs start queued'
);

select is(
  (select manual_urls from public.research_runs where id = 'durable_run_a_1'),
  '["https://example.com/source"]'::jsonb,
  'atomic creation preserves manual URLs'
);

select is(
  (
    select run_count
    from public.usage_monthly
    where owner_id = '00000000-0000-4000-8000-000000000021'
      and month = date_trunc('month', now())::date
  ),
  1,
  'atomic creation increments monthly run usage once'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select * from public.create_managed_research(
      'durable_project_active_conflict',
      'durable_run_active_conflict',
      'Concurrent research',
      'Can another run start while one is queued?',
      'en',
      'research-durable-active-conflict',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'ACTIVE_RESEARCH_RUN_EXISTS',
  'owners cannot create another research while a run is active'
);

reset role;

select is(
  (select count(*) from public.projects where id = 'durable_project_active_conflict'),
  0::bigint,
  'an active run conflict rolls back the new project'
);

select is(
  (
    select run_count
    from public.usage_monthly
    where owner_id = '00000000-0000-4000-8000-000000000021'
      and month = date_trunc('month', now())::date
  ),
  1,
  'an active run conflict does not consume monthly quota'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000022', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000022","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select public.fail_owned_research_dispatch(
      'durable_project_a_1',
      'durable_run_a_1'
    )
  $$,
  'P0001',
  'RUN_PROJECT_MISMATCH',
  'another owner cannot mark a run as dispatch failed'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.fail_owned_research_dispatch(
      'durable_project_a_1',
      'durable_run_a_1'
    )
  $$,
  'the owner can mark a queued event dispatch as failed'
);

reset role;

select is(
  (
    select status || ':' || step || ':' || error_message
    from public.research_runs
    where id = 'durable_run_a_1'
  ),
  'failed:failed:RESEARCH_DISPATCH_FAILED',
  'dispatch failure stores a stable run state and error code'
);

set local role service_role;

select lives_ok(
  $$
    select public.begin_research_run(
      '00000000-0000-4000-8000-000000000021',
      'durable_project_a_1',
      'durable_run_a_1'
    );
    select public.finalize_research_run(
      '00000000-0000-4000-8000-000000000021',
      'durable_project_a_1',
      'durable_run_a_1',
      2,
      200,
      0.01
    )
  $$,
  'service role retries and finalizes the same run'
);

reset role;

select is(
  (
    select status || ':' || step || ':' || search_count || ':' || token_count
    from public.research_runs
    where id = 'durable_run_a_1'
  ),
  'ready:ready:2:200',
  'finalization saves the ready state and deterministic usage'
);

select is(
  (
    select run_count || ':' || search_count || ':' || token_count || ':' || estimated_cost_usd
    from public.usage_monthly
    where owner_id = '00000000-0000-4000-8000-000000000021'
      and month = date_trunc('month', now())::date
  ),
  '1:2:200:0.010000',
  'finalization adds provider usage to the current month'
);

set local role service_role;

select lives_ok(
  $$
    select public.finalize_research_run(
      '00000000-0000-4000-8000-000000000021',
      'durable_project_a_1',
      'durable_run_a_1',
      2,
      200,
      0.01
    )
  $$,
  'repeated finalization is accepted'
);

reset role;

select is(
  (
    select run_count || ':' || search_count || ':' || token_count || ':' || estimated_cost_usd
    from public.usage_monthly
    where owner_id = '00000000-0000-4000-8000-000000000021'
      and month = date_trunc('month', now())::date
  ),
  '1:2:200:0.010000',
  'repeated finalization does not duplicate monthly usage'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

select * from public.create_managed_research(
  'durable_project_a_2',
  'durable_run_a_2',
  'Second research',
  'Second question?',
  'en',
  'research-durable-project-a-2',
  '[]'::jsonb
);

reset role;
set local role service_role;
select public.begin_research_run(
  '00000000-0000-4000-8000-000000000021',
  'durable_project_a_2',
  'durable_run_a_2'
);
select public.finalize_research_run(
  '00000000-0000-4000-8000-000000000021',
  'durable_project_a_2',
  'durable_run_a_2',
  0,
  0,
  0
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

select * from public.create_managed_research(
  'durable_project_a_3',
  'durable_run_a_3',
  'Third research',
  'Third question?',
  'en',
  'research-durable-project-a-3',
  '[]'::jsonb
);

reset role;
set local role service_role;
select public.begin_research_run(
  '00000000-0000-4000-8000-000000000021',
  'durable_project_a_3',
  'durable_run_a_3'
);
select public.finalize_research_run(
  '00000000-0000-4000-8000-000000000021',
  'durable_project_a_3',
  'durable_run_a_3',
  0,
  0,
  0
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000021', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000021","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    select * from public.create_managed_research(
      'durable_project_a_4',
      'durable_run_a_4',
      'Fourth research',
      'Fourth question?',
      'en',
      'research-durable-project-a-4',
      '[]'::jsonb
    )
  $$,
  'P0001',
  'MONTHLY_RUN_LIMIT_EXCEEDED',
  'the fourth monthly run is rejected inside the transaction'
);

select throws_ok(
  $$
    select * from public.create_managed_research(
      'durable_project_invalid',
      'durable_run_invalid',
      'Invalid research',
      'Invalid question?',
      'en',
      'research-durable-project-invalid',
      '["1", "2", "3", "4", "5", "6"]'::jsonb
    )
  $$,
  'P0001',
  'INVALID_RESEARCH_INPUT',
  'more than five manual URLs are rejected'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$
    select * from public.create_managed_research(
      'durable_project_anon',
      'durable_run_anon',
      'Anonymous research',
      'Anonymous question?',
      'en',
      'research-durable-project-anon',
      '[]'::jsonb
    )
  $$,
  '42501',
  'permission denied for function create_managed_research',
  'anonymous callers cannot create managed research'
);

reset role;

select is(
  (
    select run_count
    from public.usage_monthly
    where owner_id = '00000000-0000-4000-8000-000000000021'
      and month = date_trunc('month', now())::date
  ),
  3,
  'failed fourth and invalid requests do not consume monthly quota'
);

select * from finish();

rollback;
