# CLAUDE.md — sovereign-tasks

Guidance for Claude Code working in this plugin repository.

## What this is

**Sovereign Tasks** — a minimal, privacy-first task manager. A first-party
(`type: sovereign`) Sovereign plugin maintained in its own repository
(`sovereign-plugin-tasks`). The primary reference implementation for
externally-maintained Sovereign plugins.

Spec: `tasks.md` (kept alongside the plugin during development; lives in
`local/sovereign-plugin-proposals/tasks.md` in the platform repo).

## Identity

| Property      | Value                          |
| ------------- | ------------------------------ |
| Plugin ID     | `fs.sovereign.tasks`           |
| Route prefix  | `/tasks`                       |
| Permissions   | `auth:session`, `db:readWrite` |
| Min platform  | `0.10.0`                       |
| Table prefix  | `tasks_`                       |

## SDK-only rule

**Never import from `@sovereignfs/db` directly.** All database access goes
through `sdk.db`. This is enforced by the platform's ESLint SDK boundary rule
and is the defining constraint of an externally-maintained plugin.

```ts
// ✅ correct
import { getSdk } from '@sovereignfs/sdk';
const sdk = getSdk();
const db = await sdk.db();

// ❌ wrong — breaks the plugin/platform boundary
import { getPlatformDb } from '@sovereignfs/db';
```

## tenant_id scoping

Every query that touches user data **must** filter by both `tenant_id` and the
current user's `id`. There is no exception. Failing to scope by `tenant_id`
leaks data across tenants in multi-tenant deployments.

```ts
// Every list query looks like this
const lists = await db
  .select()
  .from(tasksLists)
  .where(and(eq(tasksLists.tenantId, tenantId), eq(tasksLists.ownerId, userId)));
```

## Table prefix

All plugin tables are prefixed `tasks_`:

- `tasks_lists`
- `tasks_items`
- `tasks_views`
- `tasks_user_list_prefs`
- `tasks_list_members` (v0.2)

## Milestone scope

Requirement IDs are stable — never renumber or reuse a TSK-* id.

| Milestone | TSK IDs  | Status  | Description                                          |
| --------- | -------- | ------- | ---------------------------------------------------- |
| v0.1      | 01–09    | current | Private lists, task/subtask CRUD, completion, sort   |
| v0.2      | 10–14    | future  | Collaboration — requires `sdk.directory` (RFC 0041)  |
| v0.3      | 15–21    | future  | Due dates, filters, cross-list search, bulk actions  |
| v0.4      | 22–25    | future  | Recurrence via `rrule` (RFC 5545)                    |
| v1.0      | —        | future  | Polish, docs, reference implementation               |

**Do not start v0.2 work until `sdk.directory` is available.** Do not call
Console admin user routes as a workaround.

## UI rules

- Consume `@sovereignfs/ui` components and `--sv-*` tokens exclusively.
- Never hardcode colours, spacing, or radii — always reference tokens.
- Two-panel layout on desktop (list sidebar left, task pane right).
- Stacked (list → task) on mobile.

## Drag reorder

Uses `dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`).
The drag handle UI is `DragHandleRow` from `@sovereignfs/ui`. Pass
`useSortable`'s `attributes` and `listeners` to `DragHandleRow`'s `handleProps`.

## Versioning

This plugin follows its own semver, independent of the platform version:
- `fix/` → patch (0.0.x)
- `feat/` → minor (0.x.0)
- Breaking change → major (x.0.0)

Current version: **0.1.0**

## Running locally

The plugin is mounted into the Sovereign platform during development. From the
platform monorepo root:

```bash
pnpm dev   # starts runtime on :3000; plugin routes are available at /tasks
```

When porting to the standalone `sovereign-plugin-tasks` repo, the plugin is
installed via `sv plugin add` and the platform hot-reloads it.

## Open questions (from spec)

1. **List color palette** — fixed set of `--sv-*` primitive token swatches
   recommended over arbitrary hex. Decided: fixed set when v0.2 ships.
2. **Assignment notifications** — out of scope v1; data model must not preclude it.
3. **Google Tasks import** — out of scope v1; v1.1 candidate.
