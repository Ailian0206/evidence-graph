# Quality Guidelines

## Required Practice

- Follow RED-GREEN-REFACTOR for behavior changes: run a focused failing test, implement the minimum fix, then refactor only while green.
- Keep changes scoped to the active task and remove only unused code introduced by that change.
- Use deterministic provider fixtures in routine tests. Live OpenAI, Tavily, DeepSeek, or Bailian calls require the explicit cost gate in `AGENT.md`.
- Keep code comments in English and explain constraints or rationale rather than restating code.
- Support Chinese and English for all user-facing behavior.

## Verification

Use the smallest relevant command during development:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
npm run test:managed
```

Unit tests live in `tests/unit/`; Playwright workflows live in `tests/e2e/`; database and RLS checks live in `supabase/tests/`. A milestone uses the complete gate defined in `AGENT.md`.

## Review Checklist

- Ownership and RLS boundaries remain intact.
- Evidence, citations, and report state remain traceable and internally consistent.
- Error, loading, empty, retry, and disabled states remain operable.
- UI changes pass 390x844, 1024x768, and 1440x1000 visual checks.
- No secret, private source text, paid-provider response, or `.env` content enters Git.
- Production and `release` remain untouched unless the explicit release gate is satisfied.
