# C4 Evidence Eval Implementation Plan

1. Establish contracts and RED coverage
   - Add tests for the ten-question manifest, the passing fixture, each threshold failure, broken references, deterministic output, and CLI exit behavior.
   - Verify the focused suite fails because the evaluator does not exist.
2. Implement the minimum evaluator
   - Add schemas/types, fixed questions, metric calculation, per-case summaries, and traceable failures.
   - Add the compact ten-case deterministic fixture.
   - Run the focused unit suite until GREEN.
3. Add the fixture command
   - Add a thin Node CLI and package script.
   - Write the JSON summary only under ignored `output/evidence-eval/`.
   - Verify pass and fail exit codes without provider access.
4. Review three representative traces
   - Inspect one technical, one competition, and one market case from source through citation.
5. Run milestone gates
   - `npm run check:provider-boundary`
   - focused unit tests
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test:unit`
   - `npm run build`
   - `npm run test:e2e`
6. Update project state, commit in logical Chinese Conventional Commits, push the module branch, and create one Draft PR.
7. Run independent Claude review and CI. Fix verified findings on the same branch and repeat gates as needed.
8. Stop at the paid execution boundary. Request explicit approval before any real ten-question provider run; do not begin C5.

## Risk Points

- Empty or broken observations must not pass through favorable denominators.
- Fixture success must not be described as real model-quality success.
- CLI output must stay in ignored paths and contain no provider response payloads.
- Threshold constants must have one source of truth shared by summary generation and tests.
