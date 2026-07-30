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
8. At the paid execution boundary, require explicit approval and a positive aggregate cap before running the real ten-question evaluation.
9. Record the measured result without committing private output. If a threshold fails, return to fixture-first implementation and require a new paid authorization before another real run; do not begin C5.

## Live Evaluation Result (2026-07-30)

- The user approved a USD 0.50 aggregate cap. The budget ledger ended at USD 0.477799, including a USD 0.010 conservative reserve for earlier invalid structured responses.
- All ten runs reached `ready`; quote exactness, uncited factual paragraphs, manual relation accuracy, completion, and per-run cost passed.
- Source-domain coverage failed in eight cases because Evidence links reached only one to three domains even when collection retained four domains.
- The fixture remediation now prioritizes distinct search domains and performs at most one missing-domain Evidence repair with independent cost and idempotency tracking.
- No further paid call is authorized. The next step is a newly capped real rerun; do not reuse the exhausted approval.

## Live Evaluation Rerun (2026-07-30)

- The user approved a separate USD 0.25 aggregate cap with a USD 0.025 per-run allocation.
- `technical-vector-store` and `technical-durable-workflow` reached `ready`; each linked Evidence across four domains and cost USD 0.019397 and USD 0.020124 respectively.
- `technical-citation-verifiability` collected four source domains but failed during Evidence linking with `EVIDENCE_DOMAIN_COVERAGE_LOW`; its recorded cost was USD 0.020006.
- The collector stopped on the first failed run. The fixed-set completion result is therefore 2/10 and the batch cost is USD 0.059527. Quote, report-citation, and manual-relation metrics were not recomputed from this incomplete batch.
- No further paid call is authorized. Return to fixture-first remediation and require a new explicit aggregate cap before another live run.

## Post-rerun Fixture Remediation (2026-07-30)

- The failed run exposed a contract gap: Claim extraction did not know which sources had to remain linkable for a multi-domain quality gate.
- Quality-gated Claim extraction now receives required source URLs and a chunk-to-URL mapping. The model instruction requires at least one grounded claim per required source without permitting invented claims.
- Two new assertions were confirmed RED before implementation. Focused tests passed 111/111; Provider boundary, the ten-case fixture evaluation, lint, typecheck, and the full unit suite passed 426/426.
- This fixture result does not establish real model quality. A new explicit aggregate cap is still required before another live ten-case run.

## Second Live Evaluation Rerun (2026-07-30)

- The user approved another separate USD 0.25 aggregate cap with a USD 0.025 per-run allocation.
- The first five cases reached `ready` with four linked Evidence domains each, including the previously failing `technical-citation-verifiability` case.
- `competition-evidence-relations` collected four source domains but failed during Evidence linking with `EVIDENCE_DOMAIN_COVERAGE_LOW`; its recorded cost was USD 0.018599.
- The collector stopped after case six. The fixed-set completion result is 5/10 and the batch cost is USD 0.115499. Full quote, report-citation, and manual-relation metrics were not recomputed from the incomplete batch.
- No further paid call is authorized.

## Second Fixture Remediation (2026-07-30)

- Requiring links from all four collected domains made every source a single point of failure. Under the separate evaluation gate, the live collector now allocates six distinct-prioritized source slots within the same 12,000-character content cap while the quality threshold remains four domains; routine product limits remain unchanged.
- Claim extraction and Evidence linking now receive `minimumSourceDomains`. The one repair call receives all still-unlinked source URLs but only needs to fill the remaining domain deficit.
- Three new assertions were confirmed RED before implementation. Focused tests passed 117/117; Provider boundary, the ten-case fixture evaluation, lint, typecheck, and the full unit suite passed 427/427.
- A new explicit aggregate cap is required before another live ten-case run.

## Third Live Evaluation Rerun (2026-07-30)

- The user approved another separate USD 0.25 aggregate cap with a USD 0.025 per-run allocation.
- The first two cases reached `ready` with four linked Evidence domains selected from six collected domains.
- `technical-citation-verifiability` also collected six domains but failed during Evidence linking with `EVIDENCE_DOMAIN_COVERAGE_LOW`; its recorded cost was USD 0.019098.
- The collector stopped after case three. The fixed-set completion result is 2/10 and the batch cost is USD 0.058600. The three remediation reruns have recorded USD 0.233626 in total.
- No further paid call is authorized.

## Semantic Repair Remediation (2026-07-30)

- Six collected domains did not make linking reliable, so search capacity and content allocation are no longer treated as the root cause.
- The Evidence repair response schema now validates Claim candidate IDs, source URLs, exact quotes, and the remaining domain deficit. A semantic failure is passed to DeepSeek's existing one structured-response retry with concrete issue messages and accumulated usage.
- Two assertions were confirmed RED before implementation. Focused tests passed 111/111; Provider boundary, the ten-case fixture evaluation, lint, typecheck, and the full unit suite passed 427/427.
- A new explicit aggregate cap is required before another live ten-case run.

## Final Live Verification And Stop Decision (2026-07-30)

- The user approved one final separate USD 0.25 aggregate cap. The first case collected six source domains, but its repair response still failed the runtime-refined schema after DeepSeek's one structured retry.
- The collector stopped with `PROVIDER_RESPONSE_INVALID` after recording USD 0.019665. The four remediation reruns recorded USD 0.253291 in total; combined with the initial USD 0.477799 budget ledger, C4's live-evaluation ledger is USD 0.731090, including the earlier USD 0.010 conservative reserve.
- The historical complete batch covered four domains in 2/10 cases, at least three domains in 7/10, and at least two domains in 9/10. Prompt constraints, Claim coverage, six source slots, deficit repair, and semantic retry did not make the strict four-domain rule reliable.
- Stop further paid tuning. C4 remains in progress and PR #22 remains Draft/Open until a product decision either keeps the four-domain rule with a different linking model/architecture or changes the MVP acceptance metric.

## Approved MVP Metric Decision (2026-07-30)

- The user approved replacing the strict per-case four-domain rule with at least two Evidence-linked domains in at least 90% of usable completed cases. Four-domain coverage remains non-blocking.
- The evaluator reports the observed minimum, passing/total cases, ratio, ratio threshold, and per-case minimum. It keeps traceable low-coverage records even when the allowed one-case exception does not fail the aggregate gate.
- Live collection returns to the product's default source limit and a one-domain workflow minimum so the evaluator can observe all ten cases instead of aborting on an allowed low-coverage case.
- The existing complete real observation passes all six approved metrics without another Provider call: exact quotes 65/65, uncited factual paragraphs 0, relation accuracy 19/20, domain coverage 9/10, completion 10/10, and maximum per-run cost USD 0.02009.

## Risk Points

- Empty or broken observations must not pass through favorable denominators.
- Fixture success must not be described as real model-quality success.
- CLI output must stay in ignored paths and contain no provider response payloads.
- Threshold constants must have one source of truth shared by summary generation and tests.
