# Evidence Graph

Evidence Graph is a traceable AI research workspace and Ailian's personal portfolio. It converts a research question into persisted Sources, Claims, Evidence Links, conflicts, and a cited report that readers can inspect down to the source excerpt.

The foundation portfolio is locally runnable. Routine local tests use deterministic provider fixtures and do not call paid APIs.

## Documents

- `docs/product-plan.md`: complete product, architecture, deployment, cost, and delivery decisions.
- `docs/development-plan.md`: module and PR sequence.
- `PROJECT_STATUS.md`: current execution status.
- `AGENT.md`: engineering, GitHub, cost, and verification workflow.

## Local commands

```bash
npm install
npm run dev
npm run test:ci
```

Use Node 22 before running the gate:

```bash
nvm use
```

Playwright defaults to port `3217` to avoid sibling-project collisions. Override it when needed:

```bash
PLAYWRIGHT_PORT=3220 npm run test:e2e
```
