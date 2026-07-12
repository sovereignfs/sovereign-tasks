# UX improvement plan — bundled tasks

A bundled batch of UX tasks surfaced while dogfooding Sovereign Tasks. Most
target this plugin; some land in the platform monorepo (marked per task —
each repo gets its own branch/PR regardless). Each task is planned here first,
then implemented; one branch/PR may cover several tasks when they touch the
same surfaces in the same repo. Add new tasks as numbered sections; statuses:
**planned** · **in progress** · **shipped** · **dropped**.

| # | Task | Repo | Status |
| --- | --- | --- | --- |
| 1 | Long-press drag-reorder (lists page + task rows) | sovereign-tasks | planned |
| 2 | Mark notifications read on click (bell panel) | **platform** (`sovereignfs/sovereign`) | planned |
| 3 | Virtual "Starred" list (all prioritized tasks in one view) | sovereign-tasks | planned |

---

## Task 1 — Long-press drag-reorder (lists page + task rows)

**Status:** planned

### Problem

On mobile there is no way to reorder lists or tasks. This is deliberate legacy:
both row types use dnd-kit with a hover-revealed grip handle, and under
`@media (hover: none)` the handle is `pointer-events: none`
(`ListSidebar.module.css`, `TaskItem.module.css`) so an invisible corner can't
capture scrolls. The fix is long-press-to-drag on both the Lists page rows and
task rows.

**Decision (confirmed):** on task rows — where long-press currently toggles
bulk-select (TSK-20/21) — the gesture becomes *lift on hold*: moving reorders;
releasing without moving toggles bulk-select (same outcome as today, confirmed
at release instead of mid-hold).

### Current state (verified)

- **Sensors** (identical in both panes): `PointerSensor { distance: 8 }` +
  `KeyboardSensor` — no delay/touch activation (`TasksPane.tsx` ~158,
  `ListSidebar.tsx` ~83).
- **Reorder plumbing already works end-to-end**: `handleDragEnd` → `arrayMove`
  → optimistic reducer + `reorderTasks(listId, ids)` / `reorderLists(ids)`
  server actions → `router.refresh()`. Nothing server-side changes.
- **Task drag gating**: `dragDisabled = sortBy !== 'manual'` (prop hides handle
  + disables `useSortable`; `handleDragEnd` also guards). The mobile ⋯ menu
  exposes Sort by, so this gating stays load-bearing on mobile. Lists are
  always manually ordered (no gating).
- **`useLongPress`** (`@sovereignfs/ui`): touch-only (`pointerType ===
  'touch'`), 500 ms delay, 10 px tolerance, time-boxed click suppression,
  `navigator.vibrate(10)`. Used ONLY on TaskItem's main `<Link>` for
  bulk-select. ListItem doesn't use it.
- **Competing touch gestures**: swipe-to-reveal edge zones
  (`touch-action: pan-y`, z-index 2, manual pointer handlers with 8 px
  direction lock) on both row types; the horizontal scroll-snap carousel;
  vertical list scrolling.
- **Scroll containers**: TasksPane's `.pane` is `overflow-y: auto` (dnd-kit
  auto-scroll will find it). **The mobile Lists slide has NO vertical scroll
  container** — `.nav` has no height/overflow and the carousel `.slide` is
  `overflow: hidden`, so a long list of lists clips today (latent bug, must be
  fixed for auto-scroll anyway).
- **DS note**: nothing drag-related exists in `packages/ui`, and dnd-kit is a
  plugin-local dependency (sanctioned in CLAUDE.md). The sensor work stays
  plugin-local; nothing to promote.

### Design

#### Sensor split: MouseSensor + TouchSensor (per-input activation)

Replace `PointerSensor` in both panes with (via a new shared helper
`app/_lib/dndSensors.ts`):

- **`MouseSensor { activationConstraint: { distance: 8 } }`** — desktop
  behavior unchanged (handle-initiated, hover-revealed).
- **`TouchSensor { activationConstraint: { delay: 300, tolerance: 8 } }`** —
  the long-press lift. A finger that moves >8 px within 300 ms (vertical
  scroll, carousel swipe, edge-zone reveal) cancels activation and the native
  gesture proceeds; a still hold for 300 ms lifts the row.
- `KeyboardSensor` unchanged.

Both sensor classes are **subclassed with a target-exclusion activator** (the
standard dnd-kit pattern): activation is refused when
`event.target.closest('[data-no-dnd]')` matches. Mark: both swipe edge zones,
the list ⋯ options button, the task checkbox, star, subtask ring button, and
the list rename input. This prevents "long-press on the star lifts the row"
while leaving quick taps (<300 ms) on those controls untouched.

Delay/tolerance live as named constants at the top of `dndSensors.ts` — the
tuning knobs for real-device feel.

#### Listener placement (whole-row activation on mobile)

`useSortable`'s `listeners` currently spread only onto the hidden handle
button. Change in both `TaskItem` and `ListItem`: additionally spread
`listeners` onto the row container **only when `isMobile`** (the plugin's own
640 px `_lib/useIsMobile` hook, same one gating the swipe handlers).
`attributes` stay on the handle (desktop a11y unchanged); the handle keeps its
listeners so desktop is untouched. TouchSensor is the only sensor that can
activate from the row (MouseSensor needs the handle, since desktop rows never
get listeners).

#### Task rows: lift-on-hold, release = select

- In TasksPane's `handleDragEnd`: if the drag was touch-activated
  (`event.activatorEvent.type === 'touchstart'`) AND ended in place
  (`oldIndex === newIndex` and `Math.hypot(delta.x, delta.y) < 12`), call the
  existing bulk-toggle function with `active.id` instead of reordering. The
  delta guard keeps a real drag that returns home from toggling selection; the
  touchstart guard keeps desktop handle micro-drags out of it.
- `useLongPress` on the main `<Link>` gets
  `disabled: !onBulkToggle || (isMobile && !dragDisabled)` — the drag path owns
  the hold gesture when drag is possible; when sort is derived
  (`dragDisabled`), the hook stays active so bulk-select still works in
  non-Manual sort.
- Haptic parity: call `navigator.vibrate?.(10)` in `onDragStart` (guarded,
  touch-activated only) — matches `useLongPress`'s existing cue.
- **Verify-point (not assumed)**: dnd-kit suppresses the trailing click after
  an activated touch drag; if a click leaks to the `<Link>` after the
  release-toggles-select path, navigation would follow selection. If observed,
  add the same time-boxed click-suppression pattern `useLongPress` uses (set a
  `suppressUntil` ref in the drag-end toggle path, checked in
  `handleMainClick`).

#### Lists page: plain long-press drag

Same sensors + row listeners in `ListSidebar`/`ListItem`; `handleDragEnd`
unchanged apart from ignoring in-place touch drops (no select semantics — a
lift released in place is simply a no-op, and must not navigate). The existing
post-drop `document.activeElement` blur stays.

#### Mobile Lists slide scroll fix (prerequisite)

Scope to `@media (max-width: 640px)`: give `.nav` (`ListSidebar.module.css`)
`height: 100%; overflow-y: auto` so slide 0 scrolls at all — fixes the latent
clipping bug and gives dnd-kit auto-scroll an ancestor to drive during list
drags. Desktop `.nav` untouched (its column scrolls via the parent layout).

#### Lift affordance

Extend the existing `.dragging` class in both modules (currently just
`opacity: 0.5`): add `box-shadow` (DS token) and a raised background so the
lifted row reads as picked up on touch. No transform — dnd-kit owns the inline
transform.

### Files

| File | Change |
| --- | --- |
| `app/_lib/dndSensors.ts` (new) | MouseSensor/TouchSensor subclasses with `[data-no-dnd]` exclusion, tuning constants, shared `useReorderSensors()` |
| `app/[listId]/TasksPane.tsx` | sensor swap; touch in-place drop → bulk toggle in `handleDragEnd`; vibrate on touch drag start |
| `app/_components/TaskItem.tsx` | row listeners when mobile; `useLongPress` disabled when `isMobile && !dragDisabled`; `data-no-dnd` on checkbox/star/ring/edge zone |
| `app/ListSidebar.tsx` | sensor swap; row listeners when mobile; `data-no-dnd` on edge zone/⋯ button/rename input; in-place touch drop = no-op |
| `app/_components/TaskItem.module.css` + `app/ListSidebar.module.css` | `.dragging` lift styles; ListSidebar mobile `.nav` scroll fix |
| `CLAUDE.md` (Drag reorder + Mobile shell sections), `roadmap.md` | document the new gesture + the select-on-release semantics |
| `package.json` | feat → minor bump (confirm current version at implementation) |

Unit test: the `[data-no-dnd]` exclusion predicate (pure function) in
`app/_lib/__tests__/dndSensors.test.ts`. The gesture itself is verified live —
jsdom can't express TouchSensor timing meaningfully.

### Verification

1. `pnpm dev`, mobile viewport (375 px), Chromium touch simulation: drive
   long-press-drag by dispatching `touchstart` → hold 350 ms → `touchmove`
   sequence → `touchend` on a task row; confirm the row lifts (`.dragging`
   styles), lands at the new index, and the order survives `router.refresh()`
   and a reload.
2. Release-in-place on a task row → bulk action bar appears (selection
   toggled), and **no navigation** to the task detail.
3. Repeat the drag on the Lists slide; confirm reorder persists; confirm a
   long list of lists now scrolls vertically (the `.nav` fix).
4. Regression sweep: swipe-to-reveal still works from the edge zones on both
   row types; carousel swipe between slides still works from row surfaces; tap
   still navigates; checkbox/star quick taps unaffected; Sort by ≠ Manual → no
   lift on task rows but long-press still bulk-selects; desktop hover-handle
   drag, ctrl/cmd-click select, and keyboard drag unchanged.
5. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` from the
   platform root; version bump; draft PR.
6. Real-device pass (iOS): the delay/tolerance constants are the tuning knobs
   if the hold feels too eager/laggy — the one thing Chromium simulation can't
   prove.

---

## Task 2 — Mark notifications read on click (bell panel)

**Status:** planned
**Repo:** platform monorepo (`sovereignfs/sovereign`) — this is runtime shell
chrome, not a tasks-plugin change. It lives in this document because the tasks
notification feature is what surfaced it. Branch type: `fix/` (runtime patch
bump).

### Problem

Clicking a notification in the bell panel navigates to its URL but **never
marks it read** — the unread dot and the bell badge persist until the user
explicitly hits "Mark all read", or dismisses the item. Reading a notification
and still seeing it counted as unread is misleading. Desired behavior: clicking
a notification marks it read (dot + badge clear); the item stays in the list
and can still be dismissed individually or via "Clear all" exactly as today.

### Current state (verified — the backend is 100 % ready)

- **Schema**: `notifications.read_at` / `dismissed_at` already exist with the
  right semantics (`packages/db/src/schema/*/platform.ts`; unread =
  `read_at IS NULL AND dismissed_at IS NULL`).
- **DB helpers**: `markNotificationRead`, `markAllNotificationsRead`,
  `dismissNotification` (dismiss also back-fills `read_at` via `COALESCE`) —
  `packages/db/src/platform-db.ts` ~1533.
- **API**: `POST /api/account/notifications` already supports
  `{ action: 'read', id }` (`runtime/app/api/account/notifications/route.ts:47-50`)
  — **implemented but unused by any UI today**. No schema, DB, or API changes
  are needed; this is purely a client-component gap.
- **The gap**: `runtime/app/(platform)/_components/NotificationBell.tsx` —
  the item title link (lines ~421-427) does only
  `<a href={item.url} onClick={() => setOpen(false)}>`. Items **without** a
  `url` render a plain `<span>` and can never be individually marked read at
  all. Existing panel actions: `markAllRead()`, `dismiss(id)`, `clearAll()` —
  all with optimistic local-state updates to copy the pattern from.
- **Styling**: the only read/unread visual is `.unreadDot`
  (`NotificationBell.module.css:309`); no differential item styling exists.

### Design (all in `NotificationBell.tsx` + its module CSS)

1. **New `markRead(id)` helper** modeled on the existing `dismiss(id)`:
   `POST { action: 'read', id }` with **`keepalive: true`** — the title link is
   a plain `<a href>` (full navigation, not a client-side route push), so a
   normal fetch would be aborted by the unload; `keepalive` lets the request
   survive it. Optimistic local update: set the item's `readAt`, decrement
   `unreadCount` (floor 0), skip entirely if already read.
2. **URL items**: in the anchor's `onClick`, call `void markRead(item.id)`
   before the existing `setOpen(false)`. Navigation proceeds normally.
3. **No-URL items**: replace the bare `<span className={styles.itemTitle}>`
   with a button-styled-as-text (`type="button"`, reuse `.itemTitle` styling,
   `aria-label` "Mark as read: <title>") whose click calls `markRead` and does
   NOT close the panel — there is nowhere to navigate, and closing would hide
   the feedback (dot disappearing) the click just produced. Already-read
   no-URL items render the plain span as today (nothing actionable).
4. **Read-state affordance (small CSS polish)**: unread items keep the dot;
   additionally render read items' title in `--sv-color-text-subtle` so the
   read/unread split is visible even mid-list. One new rule on `.itemTitle`
   gated by a `.itemRead` class on the `<li>`. No layout changes.
5. **Toasts, SSE, polling paths unchanged** — they already carry/refresh
   `readAt` on the next fetch; the optimistic update just makes it instant.
   `seenIds`/toast logic is untouched.

Deliberately NOT changing: auto-mark-read on opening the panel (the user
should be able to glance at the list without losing the unread markers), and
dismiss/Clear all semantics (explicit removal stays exactly as it is — that
was the user's stated requirement).

### Files

| File | Change |
| --- | --- |
| `runtime/app/(platform)/_components/NotificationBell.tsx` | `markRead(id)` helper (keepalive + optimistic update); wire into URL-item anchor click; button-ify unread no-URL titles; `.itemRead` class |
| `runtime/app/(platform)/_components/NotificationBell.module.css` | read-item title colour rule (reuse `.itemTitle`, add `.itemRead` modifier) |
| `runtime/package.json` + root `package.json` | patch bumps (fix) |

No docs-parity impact (no manifest/SDK/env changes). No DB/API changes.

### Verification

1. `pnpm dev`, log in, generate notifications (e.g. via the tasks
   due-reminder flow or a test send), open the bell panel.
2. Click a notification **with** a URL → navigates; reopen the panel → that
   item's dot is gone, title is subtle-coloured, badge count decremented, item
   still present in the list. Confirm the `action: 'read'` POST fired
   (network tab / route logs) despite the navigation (keepalive).
3. Click an unread notification **without** a URL → dot clears in place, badge
   decrements, panel stays open, no navigation.
4. Regression: "Mark all read", per-item dismiss, and "Clear all" behave as
   before; toast-on-new-notification unchanged; badge count matches
   `countUnreadNotifications` after a hard reload (server truth agrees with
   the optimistic updates); SSE mode (set `NOTIFICATION_TRANSPORT=sse`) still
   inserts new items as unread.
5. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; version
   bumps; draft PR against the platform repo.

---

## Task 3 — Virtual "Starred" list (all prioritized tasks in one view)

**Status:** planned
**Repo:** sovereign-tasks. Branch type: `feat/` (minor bump). Proposed
requirement id: **TSK-28** (next free; builds on TSK-26 star/favourite —
add to `roadmap.md` when implemented).

### Problem

Starred/prioritized tasks (TSK-26) are scattered across lists — there is no
single view of everything the user has prioritized. Add a **virtual "Starred"
list** pinned as the first entry on the lists surface: it aggregates every
starred task across all the user's lists, but is *not* a real list — no row in
`tasks_lists`, it owns no tasks, and tasks in it always remain in (and display)
their source list.

### Current state (verified)

- `tasks_items.favorite` boolean exists ([app/_db/schema.ts:87](../app/_db/schema.ts));
  `toggleFavorite(taskId, listId, favorite)` server action exists; `StarButton`
  renders in rows and the detail pane. All row interactions already operate on
  `task.listId` (not the pane's list), so cross-list rows work in an
  aggregated view without touching mutation plumbing.
- **Routing**: `/tasks/[listId]/page.tsx` 404s on unknown ids via
  `getTasks(listId)` + `lists.find(...)`. List ids are UUIDs, so a reserved
  slug can't collide. A **static segment beats the dynamic one** in Next.js —
  a dedicated `app/starred/page.tsx` needs no special-casing inside
  `[listId]`.
- **Mobile carousel** ([MobileTasksCarousel.tsx](../app/_components/MobileTasksCarousel.tsx)):
  slide 0 = Lists index, slide *n* = `lists[n-1]`; per-list task cache keyed by
  `listId` via `loadList` → `getTasks`/`getOrCreatePrefs`; bare `/tasks` lands
  on the first real list.
- **TasksPane** takes `tasks` + `listId` + callbacks; add-row, ⋯ menu
  (rename/colour/delete/sort/delete-completed), filter, bulk-select, and
  drag-reorder all live there. `TaskItem` builds its detail href from
  `task.listId`.

### Design

**Reserved pseudo-id**: `app/_lib/virtualLists.ts` (new) exports
`STARRED_LIST_ID = 'starred'` + `isVirtualListId()`. UUID list ids guarantee
no collision.

**Data**: new server action `getStarredTasks()` in `_lib/actions.ts` —
tenant+owner scoped (hard rule), `favorite = 1`, top-level tasks joined with
`tasks_lists` for `listTitle`/`listColor` decoration on each row. Ordered by
due date (nulls last), then created. Subtask counts via the same aggregation
`getTasks` uses.

**Desktop route**: new `app/starred/page.tsx` mirroring `[listId]/page.tsx` —
sidebar + `TasksPane` in virtual mode + `TaskDetailPane` driven by `?task=`
(closing returns to `/tasks/starred`; the detail pane's List picker (TSK-27)
keeps working and moving a task does not remove its star).

**TasksPane virtual mode** (new optional prop `virtualList?: 'starred'`):

- Header: star icon + "Starred" title (not editable), count; ⋯ menu reduced to
  Sort by only — no rename/colour/delete-list/delete-completed. Filter control
  stays.
- **No add-task row** (a new task needs an owning list).
- **Drag-reorder always disabled** (no manual order exists across lists); Sort
  options exclude Manual, default **Due date**.
- Rows show a small source-list badge (colour dot + list name) — new optional
  `showListBadge` prop on `TaskItem`; row density otherwise unchanged.
- `TaskItem` gets an optional `detailBasePath` so detail links stay in the
  starred context (`/tasks/starred?task=<id>`) instead of jumping to
  `/tasks/<task.listId>`.
- Un-starring a row (or via its detail pane) removes it from the view on the
  existing `onMutated` → refresh cycle. Complete/reopen, bulk delete, and bulk
  move (targets are real lists) all work unchanged.

**Sidebar row** (`ListSidebar.tsx`): a pinned "Starred" row rendered above the
`DndContext` (not sortable, not swipeable, no ⋯/rename/colour) with a star
icon in place of the colour dot, the count of active starred tasks, and
active-state when `pathname === '/tasks/starred'`. Count comes threaded from
the page's `getStarredTasks()` (desktop) / the carousel cache (mobile) — or a
lightweight `countStarredTasks()` action if threading proves awkward; decide
at implementation.

**Mobile carousel**: insert a synthetic slide at index 1 (right after the
Lists index, before the first real list) — the "first list" position the user
asked for. `loadList` forks on `STARRED_LIST_ID` → `getStarredTasks()` (no
`getOrCreatePrefs` — virtual view has no per-list prefs row; `showCompleted`
defaults false, session-local toggle only). Bare `/tasks` still lands on the
first **real** list (unchanged landing behaviour); the starred slide is
reached by swiping right once, same as the Lists index. Slide-change
detail-close logic treats the starred slide like any other.

**Explicitly out**: no `tasks_lists` row, no migration, no persistence of the
virtual list's sort/filter (session-local, same as real lists' Sort control),
no changes to notifications/recurrence (both operate on real rows and are
unaffected).

### Files

| File | Change |
| --- | --- |
| `app/_lib/virtualLists.ts` (new) | `STARRED_LIST_ID`, `isVirtualListId()` |
| `app/_lib/actions.ts` | `getStarredTasks()` (+ optional `countStarredTasks()`) |
| `app/starred/page.tsx` (new) | desktop route: sidebar + virtual TasksPane + detail pane |
| `app/[listId]/TasksPane.tsx` | `virtualList` prop: header/menu/add-row/sort gating |
| `app/_components/TaskItem.tsx` | `showListBadge` + `detailBasePath` props |
| `app/ListSidebar.tsx` + `.module.css` | pinned Starred row above the sortable list |
| `app/_components/MobileTasksCarousel.tsx` | synthetic slide at index 1; `loadList` fork on the pseudo-id |
| `SPEC.md`, `roadmap.md`, `CLAUDE.md` | TSK-28 requirement + UI-rules note ("Starred is virtual — never a `tasks_lists` row") |
| `package.json` | feat → minor bump |

Unit tests: `getStarredTasks` scoping (tenant/owner, favorite-only, list
decoration) alongside existing action tests; `isVirtualListId` trivially.

### Verification

1. `pnpm dev`: star tasks in two different lists → Starred row appears first
   in the sidebar with the right count; opening it shows both tasks with
   source-list badges, sorted by due date.
2. In the starred view: complete a task (row moves to COMPLETED section),
   un-star one (disappears on refresh), open detail via row (URL is
   `/tasks/starred?task=…`, close returns to `/tasks/starred`), move a task to
   another list from the detail pane (stays starred, badge updates), bulk
   select + move/delete.
3. Confirm absent affordances: no add-task row, no drag handles, no
   rename/colour/delete in the ⋯ menu, Sort by has no Manual option.
4. Mobile viewport: swipe right from the first list → Starred slide (between
   Lists index and first list); cache/prefetch works (no spinner on
   revisit); bare `/tasks` still lands on the first real list; swipe-to-reveal
   and carousel navigation unaffected on starred rows.
5. Regression: real lists unchanged (reorder, rename, delete, add); deep link
   `/tasks/starred` works logged-in; unknown slugs other than `starred` still
   404.
6. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; version
   bump; draft PR.

---

<!-- Add Task 4, 5, … above this line as new numbered sections, and keep the
     index table at the top in sync. -->
