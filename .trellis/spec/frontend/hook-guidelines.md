# Hook Guidelines

## Current Pattern

The repository does not use a general client data-fetching library or a shared custom-hook layer. Do not introduce React Query, SWR, or a custom hook for a single component.

- Load initial server data in Server Components using async Next.js APIs.
- Use Server Actions for authenticated mutations.
- Keep tightly scoped interactive state in the owning client component.
- Extract a custom `use...` hook only when stateful logic is reused or its isolation materially simplifies a large component.

## Data Loading

- Server pages authenticate first, construct the appropriate store or repository, then render serializable data.
- Do not fetch authenticated application data from `useEffect` when it can be loaded on the server.
- Route refresh, redirect, and cache behavior must follow the installed Next.js 16 documentation.

## Effects

- Use effects only to synchronize with browser or external systems, not to derive render state.
- Clean up timers, subscriptions, and observers.
- Avoid effect chains that copy props into state; compute derived values during render where possible.
