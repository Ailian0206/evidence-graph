# Provider Cost Gates

## 1. Scope / Trigger

Use this contract for any routine-excluded command that calls live search, language-model, or embedding Providers. It prevents retries and resumed runs from silently resetting the approved budget, and it keeps response-validation failures in the cost ledger.

## 2. Signatures

```ts
new ProviderCallError(errorCode: string, usage: ProviderUsage)

runResearchWorkflow({
  maxCostUsd?: number;
  maxEmbeddingBatches?: number;
  maxSearchQueries?: number; // integer from 1 through 5
  minimumEvidenceDomains?: number; // integer from 1 through sourceLimit
})

createLiveEvidenceEvalBudget({
  runCount: number;
  totalCostLimitUsd: number;
  previousEstimatedCostUsd?: number;
})
```

The live Evidence Eval command is `npm run eval:evidence:live`.

## 3. Contracts

- `RESEARCH_PROVIDER_MODE` must equal `live`.
- `ALLOW_PAID_EVIDENCE_EVAL` must equal the repository-defined exact confirmation value.
- `EVIDENCE_EVAL_TOTAL_COST_LIMIT_USD` must be positive and no greater than `0.50`.
- `EVIDENCE_EVAL_PREVIOUS_COST_USD` defaults to `0` and must be nonnegative and lower than the total limit. Every resumed attempt includes all prior estimated spend plus a conservative reserve for usage that could not be recovered.
- The allocated per-run limit is floored to six decimals and cannot exceed `0.15`.
- A structured model retry is limited to one repair attempt. A successful retry returns combined usage for both responses. A final validation failure throws `ProviderCallError` with the accumulated usage so the workflow records it before failing the step.
- A quality-gated run may require multiple Evidence-link domains. Search candidates prioritize distinct domains, and linking makes at most one repair call restricted to missing domains. The repair uses its own idempotency key and usage record; insufficient coverage fails instead of producing a low-quality ready result.
- Under its separate paid gate, live Evidence Eval allocates six distinct-prioritized source slots instead of the local product workflow's default four. It keeps the existing evaluation content and cost caps and requires Evidence links from any four domains, avoiding a single point of failure without changing routine product limits or weakening the metric.
- Before a multi-domain link gate, Claim extraction receives candidate source URLs, chunk-to-URL mappings, and `minimumSourceDomains`. Initial linking uses the same minimum; the single repair receives all missing source URLs and the remaining domain deficit.
- Live observations, source excerpts, manual labels, summaries, and Provider responses remain under ignored `output/evidence-eval/`. Files containing source excerpts use mode `0600`.

## 4. Validation & Error Matrix

| Condition | Error |
| --- | --- |
| Provider mode is not live | `EVIDENCE_EVAL_LIVE_MODE_REQUIRED` |
| Dedicated confirmation differs | `EVIDENCE_EVAL_NOT_CONFIRMED` |
| Total or previous spend is outside the contract | `EVIDENCE_EVAL_COST_LIMIT_INVALID` |
| A recorded run would exceed the aggregate limit | `EVIDENCE_EVAL_COST_LIMIT_EXCEEDED` |
| `maxSearchQueries` is outside 1-5 | `SEARCH_QUERY_LIMIT_INVALID` |
| `minimumEvidenceDomains` is outside 1-`sourceLimit` | `EVIDENCE_DOMAIN_LIMIT_INVALID` |
| Collection or the single repair cannot reach the required Evidence domains | `EVIDENCE_DOMAIN_COVERAGE_LOW` |
| Both structured responses fail JSON or schema validation | `ProviderCallError("PROVIDER_RESPONSE_INVALID", accumulatedUsage)` |

## 5. Good / Base / Bad Cases

- Good: a resumed ten-case evaluation passes `previousEstimatedCostUsd`; the remaining budget is divided across all ten cases, and every completed or failed response is counted.
- Base: fixture evaluation uses `RESEARCH_PROVIDER_MODE=fixture`, makes zero external calls, and does not require live confirmation values.
- Bad: restarting a live command with previous spend set to zero, retrying invalid model responses without adding their usage, or writing source excerpts outside ignored private output.

## 6. Tests Required

- Unit-test rejection of wrong mode, wrong confirmation, invalid caps, invalid previous spend, and aggregate overflow.
- Assert that previous spend reduces the per-run allocation and initializes total estimated spend.
- Assert one invalid structured response can be repaired and that both token/cost usages are returned.
- Assert a final invalid structured response carries accumulated usage and that `runResearchWorkflow` persists it.
- Assert bounded evaluation runs honor `maxSearchQueries` without changing the default workflow query count.
- Assert search candidates fill distinct domains first and a quality-gated run repairs only missing Evidence domains once.
- Assert live evaluation allocates six distinct-prioritized source slots for a four-domain threshold while routine product limits remain unchanged.
- Assert quality-gated Claim extraction and linking receive candidate URLs, URL-bearing chunks, and the correct `minimumSourceDomains`; repair receives the remaining deficit.
- Keep Provider boundary, lint, typecheck, fixture evaluation, unit, build, and E2E gates free of live calls.

## 7. Wrong vs Correct

### Wrong

```ts
// A retry happened, but only the successful response is billed in the run.
const retry = await callModel();
return retry;
```

### Correct

```ts
// Accumulate every parsed response usage, including the final failed response.
throw new ProviderCallError("PROVIDER_RESPONSE_INVALID", accumulatedUsage);
```
