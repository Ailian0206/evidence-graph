alter table public.source_chunks
  drop constraint source_chunks_embedding_model_check;

alter table public.source_chunks
  add constraint source_chunks_embedding_model_check
    check (
      embedding_model in (
        'text-embedding-3-small',
        'text-embedding-v4'
      )
    ),
  alter column embedding_model set default 'text-embedding-v4';
