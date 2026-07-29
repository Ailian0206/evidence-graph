# Type Safety

## TypeScript

- The project uses strict TypeScript and the `@/*` alias for `src/*`.
- Keep domain types close to their feature. Put cross-feature content types in an existing shared module only when they are genuinely shared.
- Prefer discriminated unions and literal unions for finite workflow states.
- Let function return types infer when clear; annotate exported contracts and boundary types when it improves correctness.

## Runtime Validation

- Use Zod at untrusted or weakly typed boundaries: form input, environment values, provider payloads, and Supabase response mapping.
- Parse before converting raw rows into domain objects. `src/features/reports/report-list-store.ts` is the established row-schema and mapping pattern.
- Return stable domain error codes from server boundaries; translate those codes in the UI.

## Forbidden Patterns

- Do not use `any` to bypass a contract.
- Do not cast an external payload directly to a domain type without validation.
- Keep unavoidable generated-client casts narrow and immediately validate the result.
- Do not use non-null assertions for user, environment, or database values that can fail at runtime.
