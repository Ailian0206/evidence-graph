# State Management

## State Categories

- **Server state:** Supabase-backed projects, runs, claims, evidence, reports, and settings are loaded through feature stores or repositories.
- **Mutation state:** Server Actions own validation, authorization, persistence, and stable error mapping.
- **URL state:** Locale, resource identifiers, and shareable view selection belong in route params or search params.
- **Local UI state:** Selection, pending controls, temporary undo state, and presentation modes stay in the smallest client component that owns them.
- **Workflow state:** Research state transitions remain in `src/features/research/`, not in visual components.

Examples include `src/components/evidence-workspace/workspace-state.tsx` for deterministic local workspace behavior and `src/features/research/managed-workspace-store.ts` for persisted workspace reads.

## Rules

- There is no application-wide client store. Do not add one unless several unrelated routes demonstrably need the same live client state.
- Derive display state from canonical domain data instead of persisting duplicate flags.
- Preserve authorization and owner scoping on every server read or mutation.
- Keep optimistic state reversible and reconcile it with the Server Action result.
