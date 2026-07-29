# Frontend Development Guidelines

> Actual conventions for the Evidence Graph Next.js application.

## Pre-Development Checklist

- Read `AGENT.md`, `PROJECT_STATUS.md`, and `.trellis/spec/project/index.md`.
- Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/` before using framework APIs.
- Identify the existing feature, component, and test that most closely match the change.
- Keep routine tests in fixture mode; do not call live providers.

## Guidelines Index

| Guide | Scope | Status |
| --- | --- | --- |
| [Directory Structure](./directory-structure.md) | Routes, features, components, and infrastructure | Ready |
| [Component Guidelines](./component-guidelines.md) | Server/client boundaries, props, styling, accessibility | Ready |
| [Hook Guidelines](./hook-guidelines.md) | Stateful logic and data loading | Ready |
| [State Management](./state-management.md) | Local, URL, server, and persisted state | Ready |
| [Quality Guidelines](./quality-guidelines.md) | TDD, checks, i18n, and visual QA | Ready |
| [Type Safety](./type-safety.md) | TypeScript and runtime validation | Ready |

## Quality Check

- Run the smallest relevant unit or E2E test after each behavior change.
- Run `npm run lint` and `npm run typecheck` for changed TypeScript code.
- Use the milestone gate from `AGENT.md` before a milestone PR.
- For UI changes, verify 390x844, 1024x768, and 1440x1000 without overflow, clipping, overlap, or a blank graph canvas.

All code comments and Trellis specs are written in English. User-facing copy must support Chinese and English.
