TypeScript conventions:
- Strict mode, ES modules, `moduleResolution: Bundler`, isolated modules, and no emit.
- Use relative imports; the old `@/*` alias and Vite alias were removed because they were unused.
- Use `import type` for type-only imports.
- Never use `any`; narrow `unknown` at external JSON/request boundaries.
- Prefer plain shared types/constants only when declarations are genuinely duplicated. Do not add DTO/schema/service/repository/DI layers for this small app.
- Fixed runtime strings use const objects plus derived types (for example seasons in `src/shared/season.ts`).

Client conventions:
- Functional React components, local `type Props` aliases, async/await, explicit loading/error states, and cancellation/generation guards for request effects.
- Keep state local to the page/dialog that owns it; no global state library is currently justified.
- Use semantic native controls and visible safe error feedback.
- UI styling uses Tailwind v4 utilities plus semantic theme variables from `src/client/index.css`; that file is the token source of truth.
- The interface is anonymous-first: no signup/login/password/profile UI. Preserve the server guest-session cookie because it owns each browser's lists.
- Keep the seasonal catalog's dark editorial direction: warm coral actions, serif display headings, compact sans metadata, restrained borders, and image-led cards.
- Support 320 CSS pixels without horizontal overflow; narrow page grids containing long URLs need `grid-cols-[minmax(0,1fr)]`.
- Required actions stay visible for keyboard, touch, and pointer input. Native dialogs must trap focus, close with Escape, and restore focus to the invoker.

Server conventions:
- Keep small Hono route modules and the current `routes/lib/db` boundaries.
- Use the canonical `AppEnv`/`AppBindings` from `src/server/env.ts`; do not redeclare route-specific Env shapes.
- Validate malformed JSON, body fields, seasons, and positive integer query values at route boundaries.
- Unexpected errors return a stable generic message; do not leak upstream/database exception text.
- Database writes and authorization predicates must encode ownership invariants directly.

Naming:
- camelCase for variables/functions.
- PascalCase for components/types.
- Uppercase constant objects/season values where they are runtime constants.
- Double quotes are the established TypeScript string style.

Database conventions:
- `src/server/db/schema.ts` is authored source.
- Root `drizzle/` contains generated SQL, snapshots, and journal.
- Never modify an applied migration or historical snapshot; generate a new migration and commit SQL + snapshot + journal together.
- Add indexes based on observed query predicates/order, not speculative abstraction.