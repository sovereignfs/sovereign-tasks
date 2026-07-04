# CLAUDE.md — sovereign-tasks

Guidance for Claude Code working in this plugin repository.

## What this is

**Sovereign Tasks** — a minimal, privacy-first task manager. A first-party
(`type: sovereign`) Sovereign plugin maintained in its own repository
(`sovereign-tasks`). The primary reference implementation for
externally-maintained Sovereign plugins.

Spec: [SPEC.md](SPEC.md)

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
| v0.1      | 01–09    | shipped | Private lists, task/subtask CRUD, completion, sort   |
| v0.2      | 10–14    | blocked | Collaboration — requires `sdk.directory` (sv-RFC 0041)  |
| v0.3      | 15–21    | partial | Due dates ✅, overdue ✅, filters ✅, search ✅; keyboard shortcuts + bulk actions pending |
| v0.4      | 22–25    | future  | Recurrence via `rrule` (sv-RFC 5545)                    |
| v1.0      | —        | future  | Polish, docs, reference implementation               |

**TSK-26 (star/favourite)** and **TSK-27 (move a task to a different list, from
the detail pane)** shipped ahead of phasing alongside the three-column web home.
The three-column layout, due dates, filters, and cross-list search all landed
early — see `roadmap.md` for per-requirement status.

**Do not start v0.2 work until `sdk.directory` is available (sv-RFC 0041).** Do not call
Console admin user routes as a workaround.

## UI rules

- Consume `@sovereignfs/ui` components and `--sv-*` tokens exclusively.
- Never hardcode colours, spacing, or radii — always reference tokens.
- **Three-column layout on web:** list sidebar (col 1) · task list (col 2) ·
  task detail (col 3). The detail pane is driven by the `?task=<id>` search
  param on `/tasks/[listId]`; it collapses below ~900px. Select a task via
  `<Link href="?task=id">`; close with `<Link replace href="/tasks/[listId]">`.
- List management (rename, colour, delete) lives in the col-1 row `⋯` menu.
  Colour is the one sanctioned splash in the monochrome UI — the fixed swatch
  set is in `app/_lib/colors.ts`; it renders only as the small list dot.
- Stacked (list → task) on mobile; the mobile detail sheet is a later,
  separately-specced direction.

### Views

One data model, multiple presentations. Views are a lens — never a fork of the
task/completion model.

| View | `kind` | Status |
| --- | --- | --- |
| Compact | `compact` | v0.1 |
| Kanban Compact | `kanban_compact` | future |
| Kanban | `kanban` | future |
| Visualizer | `visualizer` | future |

v0.1 renders the Compact view only. Future views are additive and must not
require changes to `tasks_items` ownership or completion columns.

## Drag reorder

Uses `dnd-kit` (`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`).
The drag handle UI is `DragHandleRow` from `@sovereignfs/ui`. Pass
`useSortable`'s `attributes` and `listeners` to `DragHandleRow`'s `handleProps`.

## Versioning

This plugin follows its own semver, independent of the platform version:
- `fix/` → patch (0.0.x)
- `feat/` → minor (0.x.0)
- Breaking change → major (x.0.0)

Current version: **0.3.0**

## Running locally

The plugin is mounted into the Sovereign platform during development. From the
platform monorepo root:

```bash
pnpm dev   # starts runtime on :3000; plugin routes are available at /tasks
```

When porting to the standalone `sovereign-tasks` repo, the plugin is
installed via `sv plugin add` and the platform hot-reloads it.

## Open questions (from spec)

1. **List color palette** — ✅ Resolved & shipped. Fixed set of `--sv-*` swatches
   (`LIST_SWATCHES` in `app/_lib/colors.ts`), not arbitrary hex.
2. **Assignment notifications** — out of scope v1; data model must not preclude it.
3. **Google Tasks import** — out of scope v1; v1.1 candidate.
