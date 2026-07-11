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
| v0.3      | 15–21    | shipped | Due dates, overdue, filters, search, keyboard shortcuts, bulk delete/move |
| v0.4      | 22–25    | shipped | Recurrence via `rrule` (sv-RFC 5545) — nth-day-of-month deferred |
| v1.0      | —        | future  | Polish, docs, reference implementation               |

**TSK-26 (star/favourite)** and **TSK-27 (move a task to a different list, from
the detail pane)** shipped ahead of phasing alongside the three-column web home.
**v0.4 (recurrence)** shipped out of order too, ahead of v0.3's remaining
keyboard-shortcut/bulk-action items, which followed in their own branch — see
`roadmap.md` for per-requirement status.

**Do not start v0.2 work until `sdk.directory` is available (sv-RFC 0041).** Do not call
Console admin user routes as a workaround.

## UI rules

- Consume `@sovereignfs/ui` components and `--sv-*` tokens exclusively.
- Never hardcode colours, spacing, or radii — always reference tokens.
- **DS-first: this plugin is a consumer.** Never hand-roll reusable UI
  primitives here (interaction hooks, overlays, secondary headers, pickers) —
  they are added to `@sovereignfs/ui` in the platform repo and consumed from
  there. `MobileFullPageOverlay.tsx` and `_lib/doubleTap.ts` (hand-rolled
  local primitives that predated this rule) are gone, replaced by
  `@sovereignfs/ui`'s `Sheet`/`ConfirmDialog`/`Menu` and interaction hooks —
  see the platform repo's `docs/adhoc/mobile-design-system-improvement-plan.md`
  Phase C1. `_lib/useIsMobile.ts` is the one sanctioned exception: a thin
  wrapper binding this plugin's documented 640px threshold to the DS hook, not
  a reimplementation of it. Don't add new local overlay/menu/confirm-dialog
  siblings.
- **Three-column layout on web:** list sidebar (col 1) · task list (col 2) ·
  task detail (col 3). The detail pane is driven by the `?task=<id>` search
  param on `/tasks/[listId]`; it collapses below ~900px (tablet — no detail
  sheet substitute at this width; unchanged, low priority). Select a task via
  `<Link href="?task=id">`; close with `<Link replace href="/tasks/[listId]">`.
- **List management is split across double-click/double-tap and a col-2
  header menu, shared by desktop and mobile** (col 2's `⋯` menu is no longer
  desktop-only — see "Mobile shell"): double-clicking/double-tapping a list's
  title (col 1 sidebar row or col 2 header) renames it; double-clicking the
  colour dot opens just the swatch picker (desktop only — mobile's dot is a
  plain indicator, colour lives in the sidebar's own combined rename+colour
  drawer instead). "Sort by" (Manual/Date created/Due date/Title A-Z,
  client-side only — not persisted, resets on navigation like the `filter`
  control), "Delete completed tasks" (bulk-deletes every completed task in
  the list via `bulkDeleteTasks`, shown only when the list has at least one;
  confirms via the same native `<dialog>` pattern as Delete list), and
  Delete list live in a `⋯` menu at the end of col 2's header, after the
  Filter control (folded into the same menu when Filter itself doesn't fit
  inline next to the title). Colour is the one sanctioned splash in the
  monochrome UI — the fixed swatch set is in `app/_lib/colors.ts`; it renders
  only as the small list dot.
- **Drag-reorder is disabled whenever Sort by isn't Manual.** Dragging while
  the list displays a derived order would compute the wrong move — dnd-kit
  only sees the sorted view's index positions, not the underlying manual
  `sortOrder` — so `TaskItem`'s drag handle is hidden (`dragDisabled` prop)
  and `TasksPane`'s `handleDragEnd` no-ops in that state.
- **Mobile (≤640px) is a different UI, not a squeeze of the desktop one** —
  see "Mobile shell" below.

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
**Not** `packages/ui`'s `DragHandleRow` — that component reserves a fixed-width
gutter before the row's content, which couldn't be made to align with the
header/add-row indent above it. Both list rows (`ListSidebar.tsx`) and task
rows (`TaskItem.tsx`) instead use a shared `GripIcon` as a custom, absolutely-
positioned floating handle that occupies no layout space until hovered.
`useSortable`'s `attributes`/`listeners` spread directly onto that button.
Every `DndContext` on the page needs an explicit `id` prop — without one,
dnd-kit's auto-incrementing `aria-describedby` IDs aren't guaranteed to match
between SSR and hydration when multiple `DndContext`s are mounted (which this
plugin always has: one for lists, one for tasks).

## Recurrence

Uses `rrule` (sv-RFC 5545) — see `app/_lib/recurrence.ts`. **`rrule` operates
on UTC internally.** Constructing its `dtstart` (or any date passed to
`.after()`) from a *local* `new Date(y, m, d)` silently shifts which weekday
matches a `byweekday` rule by one day on servers with a positive UTC offset —
verified empirically (a Tuesday `dtstart` built with `new Date(2026, 6, 7)`
produced a Tue/Thu/Sat sequence for a Mon/Wed/Fri rule instead of Mon/Wed/Fri).
Every date crossing the rrule boundary in `recurrence.ts` goes through its own
`parseUTC`/`toISODateUTC` helpers — never this plugin's own local-date helpers
in `date.ts`, which are correct for UI display but wrong for rrule interop.
Stored `recurrence_rule` strings never embed `DTSTART` — a task's own
`due_date` is always the anchor, supplied at computation time.

## Keyboard shortcuts and bulk select

TSK-19–21, in `TasksPane.tsx`/`TaskItem.tsx`/`BulkActionBar.tsx`. Shortcuts
(`n` new task, `j`/`k`/Up/Down row focus, `e` complete, `Enter` open detail,
`[`/`]` previous/next list, `Escape` clears bulk selection) attach via a
`window` `keydown` listener in `TasksPane` and bail out whenever
`document.activeElement` is an `INPUT`/`TEXTAREA`/`SELECT` or
`isContentEditable`, or a modifier key is held — they must never fire while
the user is typing. Bulk select is entered via **ctrl/cmd-click or long-press
on a row**, not an explicit "Select" mode button — the row checkbox already
means "mark complete", so a mode toggle would either shadow that or require
two different checkbox meanings on the same element. Bulk delete/move go
through dedicated server actions (`bulkDeleteTasks`, `bulkMoveTasks` in
`actions.ts`) that operate on the whole id array in one query per table,
rather than looping the existing single-task `deleteTask`/`moveTask` — avoids
N round trips for an N-task selection.

## Mobile shell

Below 640px the plugin renders a **completely different component tree**, not
a CSS squeeze of the desktop one — `app/_lib/useIsMobile.ts`
(`matchMedia('(max-width: 640px)')`) is the only place in this codebase that
forks JS behavior on viewport, since nothing else needed to. `layout.tsx`
delegates to `app/_components/MobileAwareShell.tsx`, which on mobile mounts
`MobileTasksCarousel.tsx` instead of rendering `children` (page.tsx's
server-rendered output) at all.

- **Carousel model**: slide 0 is `ListSidebar` full-page (mobile equivalent of
  the sidebar); slide *n* is `TasksPane` for `lists[n-1]`. A native
  `scroll-snap-type: x` container gives swipe physics for free — no hand-
  rolled pointer dragging. Swiping right (finger left→right) reveals the
  previous slide (toward the Lists index); swiping left advances toward the
  next list — standard carousel convention. Landing at the bare `/tasks`
  route puts you on your **first list**, not the Lists index (matches the
  desktop sidebar+first-list both being visible at once); the index slide is
  reached only by swiping.
- **Fully decoupled data, on purpose**: `MobileTasksCarousel` fetches every
  list's tasks itself via the existing `getTasks`/`getTask`/`getOrCreatePrefs`
  server actions (already callable straight from client code elsewhere in
  this plugin), caches them per `listId`, and eagerly prefetches the
  immediate left/right neighbors on every index change — so a single swipe
  never shows a loading spinner. This means `page.tsx`'s own server fetch for
  the routed list runs and is simply unused on mobile (its JSX is never
  rendered) — a deliberate, accepted redundancy that keeps `TasksPane`/
  `TaskDetailPane` completely unmodified and lets the carousel's cache survive
  route changes (a real prop-threaded alternative would force a remount on
  every swipe-triggered navigation, defeating the "no loading flash" point).
- **`router.refresh()` still works**: `MobileAwareShell` passes `children`
  through to the carousel as `refreshSignal` — not to render, purely as a
  signal. Every `router.refresh()` call already scattered through
  `TasksPane`/`TaskDetailPane`/etc. gives `children` a new identity, and the
  carousel's effect keyed on that reference re-fetches the active slide. This
  is *why* none of those existing mutation handlers needed touching.
- **Settled-slide detection is a debounced `scroll` listener**, not the
  `scrollend` event — iOS Safari/WKWebView only gained `scrollend` in 17.4,
  and older versions are still a live concern per this plugin's iOS PWA
  history.
- **Task detail is `@sovereignfs/ui`'s `Sheet`** (no `title` — a task's own
  composite header, the checkbox + editable title + star + close row, is
  richer than `Sheet`'s built-in `OverlayHeader` can express, so the content
  supplies its own, same as it did under the plugin's own predecessor
  `MobileFullPageOverlay`) wrapping the unmodified `TaskDetailPane`,
  opened/closed by the same `?task=` param convention as desktop. `Sheet` has
  no scrim of its own — `TaskDetailPane` supplies its own close button, which
  must call `router.replace(closeHref, { scroll: false })` directly (not a
  `next/link` `<Link replace>`, which silently no-ops when only the search
  param changes on an already-mounted client route — this is what broke the
  mobile close button before it was fixed to call `router.replace`
  imperatively). Swiping to a different list slide also closes it, since a
  task's detail only makes sense tied to the slide it came from.
- **List management** (`ListSidebar.tsx`'s `ListItem`): mobile keeps a single
  combined "Edit list" `Sheet` (rename + colour; `Sheet`'s own `title` header
  this time, since the content here has no header of its own), reached via an
  explicit `⋯` button in the row's trailing region (decision D1 — this used
  to be a double-tap gesture on the title, which meant every single tap
  deferred navigation behind a double-tap detection window; single tap now
  navigates immediately). Desktop keeps its own split (double-click
  title/dot + a separate col-2 header menu, see "UI rules" above) —
  `useIsMobile()` gates which renders; both call the same handlers
  (`updateList`, `updateListColor`, etc.). **Delete confirmation is
  `@sovereignfs/ui`'s `ConfirmDialog`** at every breakpoint — replacing the
  native `<dialog>` this plugin's pattern was later promoted into the design
  system from (see that component's own doc comment).

## Versioning

This plugin follows its own semver, independent of the platform version:
- `fix/` → patch (0.0.x)
- `feat/` → minor (0.x.0)
- Breaking change → major (x.0.0)

Current version: **0.10.0**

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
