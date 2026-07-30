# C4 Evidence Eval Technical Design

## Boundary

Add a framework-independent `src/features/evaluation/` module and a thin Node CLI. Evaluation consumes a sanitized observation document and does not query Supabase or invoke providers. The deterministic fixture uses the same observation contract as a later real evaluation.

## Contracts

### Manifest

Each fixed case has a stable ID, category, language, and question. Question IDs are the compatibility boundary for future real observations and manual labels.

### Observation

An evaluation case contains:

- case identity and question metadata
- run ID, status, and estimated cost
- source IDs and domains
- chunk IDs, source IDs, and the text needed for exact-substring checks
- evidence-link IDs, claim IDs, chunk IDs, extracted relation, and quote
- report IDs with factual paragraph IDs and citation IDs
- manual samples mapping an evidence-link ID to the expected relation

The observation deliberately excludes provider payloads and unrelated source text. Real files live only under ignored `output/evidence-eval/`.

### Summary

The evaluator returns six threshold results, per-case results, a flat failure list, and one top-level `passed` value. Missing references are explicit traceability failures and also prevent the affected metric from passing.

## Metric Rules

1. Quote precision compares every evidence-link quote to its referenced chunk with exact, case-sensitive substring matching. Missing chunks count as failures.
2. An uncited factual paragraph is a factual report paragraph with no recognized citation ID.
3. Relation accuracy compares each manual sample with its referenced evidence link. Missing links or zero samples fail the metric.
4. Source-domain coverage counts distinct domains reached through evidence links for each ready usable case. Every such case must have at least four.
5. Completion rate is ready runs divided by all ten cases and must be at least 90%.
6. Cost passes only when every run is at or below USD 1. The summary also records total and maximum observed cost.

## Fixture Strategy

Generate a compact synthetic observation for each fixed question with four domains and four labeled relations. The fixture validates the evaluator, not model quality. Real quality claims require the later ten-question live run and Agent sampling.

## Live Evaluation Gate

The first implementation slice does not make live calls. A later live collection step may proceed only when the user supplies a dedicated confirmation and a positive aggregate budget up to USD 0.50. Each workflow run continues to use the existing local USD 0.15 maximum. Collection stops when the aggregate cap is reached; no Provider response or full source body is committed.

## Compatibility

- No schema migration or persisted product contract changes.
- No Next.js route or UI changes.
- Existing fixture and live research paths remain unchanged.
- The CLI runs on the repository-pinned Node 22 runtime using built-in TypeScript stripping.

## Rollback

The evaluation feature is additive. Rollback removes the evaluation module, CLI, package script, tests, and task/status documentation without touching research data or application routes.
