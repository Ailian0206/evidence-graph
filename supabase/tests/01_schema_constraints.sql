begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_extension('vector', 'pgvector extension is enabled');
select has_table('public', 'projects', 'projects table exists');
select has_table('public', 'research_runs', 'research_runs table exists');
select has_table('public', 'sources', 'sources table exists');
select has_table('public', 'source_chunks', 'source_chunks table exists');
select has_table('public', 'claims', 'claims table exists');
select has_table('public', 'evidence_links', 'evidence_links table exists');
select has_table('public', 'claim_relations', 'claim_relations table exists');
select has_table('public', 'reports', 'reports table exists');
select col_type_is(
  'public',
  'source_chunks',
  'embedding',
  'vector(1536)',
  'source chunk embeddings use 1536 dimensions'
);

insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000001', 'owner-a@example.com'),
  ('00000000-0000-4000-8000-000000000002', 'owner-b@example.com');

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
    'project_a',
    '00000000-0000-4000-8000-000000000001',
    'Project A',
    'Question A',
    'en',
    'active',
    'private',
    'project-a'
  ),
  (
    'project_b',
    '00000000-0000-4000-8000-000000000002',
    'Project B',
    'Question B',
    'en',
    'active',
    'private',
    'project-b'
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
values (
  'source_a',
  'project_a',
  'https://example.com/source',
  'Source A',
  'example.com',
  'documentation',
  'Evidence text for project A.',
  'sha256_shared',
  '2026-07-16T00:00:00Z'
);

select lives_ok(
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
      'source_b',
      'project_b',
      'https://example.org/source',
      'Source B',
      'example.org',
      'documentation',
      'Evidence text for project B.',
      'sha256_shared',
      '2026-07-16T00:00:00Z'
    )
  $$,
  'different projects may save the same content hash'
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
      'source_duplicate_url',
      'project_a',
      'https://example.com/source',
      'Duplicate URL',
      'example.com',
      'documentation',
      'Different body.',
      'sha256_different',
      '2026-07-16T00:00:00Z'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "sources_project_canonical_url_key"',
  'canonical URLs are unique within a project'
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
      'source_duplicate_hash',
      'project_a',
      'https://example.com/other',
      'Duplicate hash',
      'example.com',
      'documentation',
      'Evidence text for project A.',
      'sha256_shared',
      '2026-07-16T00:00:00Z'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "sources_project_content_hash_key"',
  'content hashes are unique within a project'
);

insert into public.source_chunks (
  id,
  source_id,
  project_id,
  chunk_index,
  body,
  start_char,
  end_char,
  embedding_model,
  embedding_dimensions
)
values
  (
    'chunk_a',
    'source_a',
    'project_a',
    0,
    'Evidence text for project A.',
    0,
    28,
    'text-embedding-3-small',
    1536
  ),
  (
    'chunk_b',
    'source_b',
    'project_b',
    0,
    'Evidence text for project B.',
    0,
    28,
    'text-embedding-3-small',
    1536
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
    'claim_a',
    'project_a',
    'Claim A',
    'claim-a',
    'factual',
    '[]'::jsonb,
    0.8,
    'pending'
  ),
  (
    'claim_b',
    'project_b',
    'Claim B',
    'claim-b',
    'factual',
    '[]'::jsonb,
    0.8,
    'pending'
  );

select throws_ok(
  $$
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
    values (
      'claim_duplicate',
      'project_a',
      'Duplicate Claim A',
      'claim-a',
      'factual',
      '[]'::jsonb,
      0.7,
      'pending'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "claims_project_normalized_key_key"',
  'normalized claim keys are unique within a project'
);

select throws_ok(
  $$
    insert into public.evidence_links (
      id,
      claim_id,
      chunk_id,
      project_id,
      relation,
      strength,
      quote,
      rationale
    )
    values (
      'evidence_cross_project',
      'claim_a',
      'chunk_b',
      'project_a',
      'supports',
      'strong',
      'Evidence',
      'Invalid cross-project link'
    )
  $$,
  '23503',
  'insert or update on table "evidence_links" violates foreign key constraint "evidence_links_chunk_project_fkey"',
  'evidence chunks must belong to the same project as the claim'
);

select throws_ok(
  $$
    insert into public.evidence_links (
      id,
      claim_id,
      chunk_id,
      project_id,
      relation,
      strength,
      quote,
      rationale
    )
    values (
      'evidence_invalid_quote',
      'claim_a',
      'chunk_a',
      'project_a',
      'supports',
      'strong',
      'Missing exact quote',
      'Invalid quote'
    )
  $$,
  '23514',
  'EVIDENCE_QUOTE_NOT_EXACT',
  'evidence quotes must be exact chunk substrings'
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
values (
  'run_a',
  'project_a',
  '00000000-0000-4000-8000-000000000001',
  'running',
  'planning',
  12,
  5,
  200000,
  0,
  0,
  0
);

select throws_ok(
  $$
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
    values (
      'run_a_duplicate',
      'project_a',
      '00000000-0000-4000-8000-000000000001',
      'queued',
      'queued',
      12,
      5,
      200000,
      0,
      0,
      0
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "research_runs_one_active_per_owner_key"',
  'an owner may only have one active research run'
);

delete from public.projects where id = 'project_a';

select is(
  (
    select
      (select count(*) from public.research_runs where project_id = 'project_a') +
      (select count(*) from public.sources where project_id = 'project_a') +
      (select count(*) from public.source_chunks where project_id = 'project_a') +
      (select count(*) from public.claims where project_id = 'project_a') +
      (select count(*) from public.evidence_links where project_id = 'project_a')
  ),
  0::bigint,
  'deleting a project cascades through research data'
);

select * from finish();

rollback;
