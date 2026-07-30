# Component Guidelines

## Server And Client Boundaries

- Default to Server Components. Route pages load authenticated server data and pass serializable props to UI components.
- Add `"use client"` only when browser state, effects, event handlers, or client APIs are required.
- Keep database clients, secrets, and privileged operations out of client components. Mutations cross a Server Action or route-handler boundary.

Examples: `src/app/[locale]/(product)/app/reports/page.tsx` loads report data on the server; `src/components/evidence-workspace/evidence-workspace.tsx` owns interactive workspace behavior.

## Props And Composition

- Declare a named `type ...Props` near the component when props are non-trivial.
- Pass only the data required by the child. Prefer domain-shaped props over raw Supabase response objects.
- Reuse the established shell and domain components instead of duplicating navigation or page framing.
- Keep compact operational screens scan-friendly; do not nest cards inside cards.

## Styling

- Use colocated CSS modules for domain components and `src/app/globals.css` for shared tokens and site-wide primitives.
- Preserve established spacing, color, focus, and responsive patterns.
- Use the installed `lucide-react` icons for familiar actions and give icon-only controls accessible names or tooltips.

## Accessibility And Copy

- Use semantic controls, visible keyboard focus, accurate labels, and appropriate live/busy states.
- Support reduced motion for loading or transition animation.
- Add every user-facing string to both Chinese and English message sets; do not hardcode single-language UI copy.
- Verify long Chinese and English text without clipping or horizontal overflow.
