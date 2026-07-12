# UX improvement plan — bundled tasks

A bundled batch of UX tasks surfaced while dogfooding Sovereign Tasks. Most
target this plugin; some land in the platform monorepo (marked per task —
each repo gets its own branch/PR regardless). Each task is planned here first,
then implemented; one branch/PR may cover several tasks when they touch the
same surfaces in the same repo. Add new tasks as numbered sections; statuses:
**planned** · **in progress** · **shipped** · **dropped**.

| # | Task | Repo | Status |
| --- | --- | --- | --- |
| 1 | Long-press drag-reorder (lists page + task rows) | sovereign-tasks | in progress |
| 2 | Mark notifications read on click (bell panel) | **platform** (`sovereignfs/sovereign`) | planned |
| 3 | Virtual "Starred" list (all prioritized tasks in one view) | sovereign-tasks | planned |
| 4 | Per-plugin push notification icon | **platform** (`sovereignfs/sovereign`) | planned |
| 5 | JSON export/import (account-level data portability) | sovereign-tasks | planned |
| 6 | Sticky list header + add-task row while scrolling | sovereign-tasks | planned |

---

## Task 1 — Long-press drag-reorder (lists page + task rows)

**Status:** in progress — implemented on `feat/mobile-drag-reorder`, pending live verification and PR.

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

## Task 4 — Per-plugin push notification icon

**Status:** planned
**Repo:** platform monorepo (`sovereignfs/sovereign`) — this is runtime/SDK
shell chrome, not a tasks-plugin change. Surfaced by a tasks-plugin push
notification (due-reminder) showing the platform's generic icon instead of
the Tasks app icon. Branch type: `fix/` (patch bumps).

### Problem

Web Push notifications from every plugin show the platform's generic icon
(`/icons/icon-192x192.png`) instead of the sending plugin's own icon.

### Root cause (verified)

A semantic mismatch in the SDK, not a missing feature:

- `SendNotificationInput.icon` ([packages/sdk/src/types.ts:133](../../../packages/sdk/src/types.ts))
  is documented as *"an `<Icon>` name from `@sovereignfs/ui`"* — an SVG
  component name (e.g. `'calendar'`), intended for in-app rendering.
- **Nothing in-app actually reads it.** `NotificationBell.tsx`'s `CategoryIcon`
  switches on `category`, not `icon`; `Toast.tsx` does the same. The field is
  effectively vestigial for its documented purpose.
- The only real consumer is `runtime/worker/index.ts:26` —
  `self.registration.showNotification(data.title, { icon: data.icon ?? '/icons/icon-192x192.png', ... })`.
  The Push API's `icon` option is a **URL to an image**, not a component name.
  `sovereign-tasks`'s due-reminder handler passes `icon: 'calendar'`
  ([app/_jobs/due-reminders.ts:100,156](../app/_jobs/due-reminders.ts)) — the
  browser tries to fetch `'calendar'` as an image, fails, and silently falls
  back to the platform default. This is why the tasks push notification showed
  the "S" platform icon instead of the Tasks icon.

### What already exists (no new infra needed)

- Every installed plugin's icon is already served statically and stably at
  **`/plugin-icons/<pluginId>.svg`** — copied by `copyPluginIcons()` in
  `scripts/generate-registry.ts` (~line 443), the same source the launcher
  tiles use. No session gate.
- `sendNotification`'s fan-out already carries `source` (the sending plugin's
  id) all the way through to `fanOutPushToUser`
  (`runtime/src/sdk-host.ts` → `runtime/src/push.ts`), so a per-plugin default
  can be computed without any new data being threaded through.

### Platform constraint (does not block the fix, but sets expectations)

**iOS Safari ignores custom push-notification icons entirely.** Apple's Web
Push implementation always shows the installed PWA's own home-screen icon,
by design — there is no override, before or after this fix. Chrome and
Firefox (desktop + Android) *do* respect a custom icon. This fix has real
value on those platforms; iOS will keep showing the platform icon for every
plugin's push notifications regardless. State this plainly in the PR
description so it isn't mistaken for an incomplete fix later.

### Design

1. **Fix the field's semantics.** Repurpose `SendNotificationInput.icon` (and
   `PushPayload.icon` in `runtime/src/push.ts` /
   `runtime/worker/index.ts`) to mean *"URL to an image, shown in the OS push
   notification"* — update the doc comment accordingly. Since nothing in-app
   consumes it today, this is a safe redefinition, not a breaking change to
   any real caller (`sovereign-tasks` is currently the only plugin passing an
   `icon` value, and it's already effectively broken).
2. **Default to the plugin's own icon.** In `fanOutPushToUser`
   (`runtime/src/push.ts`), when a notification's `icon` is unset, default it
   to `/plugin-icons/<source>.svg` using the `source` (plugin id) already
   available at that point — no new plumbing. An explicit `icon` value passed
   by a plugin still wins (e.g. a plugin wanting to send a notification-specific
   image rather than its own logo).
3. **`sovereign-tasks`'s `icon: 'calendar'`** ([app/_jobs/due-reminders.ts](../app/_jobs/due-reminders.ts)):
   remove it — the new per-plugin default (the Tasks app icon) is more
   correct than an arbitrary SVG-name string ever was. (Small follow-up
   commit in the sovereign-tasks repo, once the platform fix ships.)
4. **SVG reliability check** (verify at implementation, not assumed): Chrome's
   Push API `icon` option generally rasterizes SVG correctly on modern
   versions, but this should be confirmed live rather than assumed — if
   inconsistent, generate a PNG alongside each plugin's `icon.svg` in
   `copyPluginIcons()` (a raster fallback) rather than degrading silently.

### Files

| File | Change |
| --- | --- |
| `packages/sdk/src/types.ts` | `SendNotificationInput.icon` doc comment corrected (URL, not component name) |
| `runtime/src/push.ts` | `PushPayload.icon` doc comment corrected; `fanOutPushToUser`/`fanOutPushToUsers` default `icon` to `/plugin-icons/<source>.svg` when unset |
| `runtime/worker/index.ts` | no logic change expected (already passes `data.icon` through) — confirm during implementation |
| `runtime/package.json` + root `package.json` | patch bumps (fix) |
| *(sovereign-tasks repo, follow-up)* `app/_jobs/due-reminders.ts` | remove `icon: 'calendar'` |

### Verification

1. Unit test in `runtime/src/__tests__/push.test.ts`: notification with no
   `icon` → `sendNotification` called with a payload whose `icon` is
   `/plugin-icons/<source>.svg`; notification with an explicit `icon` →
   that value passed through unchanged.
2. `pnpm dev`, production build (push only runs in a built SW), trigger a
   tasks due-reminder or any `sdk.notifications.send()` call → inspect the
   real OS notification on **desktop Chrome/Firefox**: shows the Tasks app
   icon, not the platform icon.
3. Confirm on iOS (if available) that the platform icon still shows —
   expected per the Apple constraint above, not a regression to chase.
4. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; version
   bumps; draft PR against the platform repo, with the iOS caveat stated in
   the description.

---

## Task 5 — JSON export/import (account-level data portability)

**Status:** planned
**Repo:** sovereign-tasks. Branch type: `feat/` (minor bump).

### Decisions made (no strong preference given; picked the lower-risk default)

1. **Wire into the existing account-level export/import flow (RFC 0007)**,
   not a standalone in-plugin "export as JSON" button. Every other plugin's
   data leaves/enters an instance this way (Account → Export my data → one
   ZIP with one `data.json` per plugin; Import restores from that ZIP); this
   plugin becomes a section in that flow the same way. Zero new UI needed in
   the Tasks plugin itself. A standalone tasks-only button is a plausible
   future add-on, not built here.
2. **Include a deletion handler (RFC 0033)** alongside export/import — once a
   plugin is wired into the portability system at all, leaving account
   deletion unhandled means tasks data survives as an orphaned row
   (`ownerId` pointing at a deleted user). Low incremental cost: reuses the
   existing `deleteList()` cascade logic (see below).

### Problem

There is currently no way to get tasks data out of (or back into) an
instance — no backup, no instance-to-instance move, no participation in
account-level export/deletion.

### Current state (verified — the platform side needs zero changes)

- **SDK contract** (`packages/sdk/src/portability.ts`): `ExportContext { userId, tenantId }`;
  `ImportContext { userId, tenantId, remapId(originalId): string }` — a
  stable per-import id remapper; `PluginExportSection { pluginId, schemaVersion, data, blobs? }`
  is the required return envelope (`data` itself is plugin-defined JSON);
  `sdk.portability.provideExport(resolver)` / `provideImport(handler)` /
  `provideDelete(handler)` register the plugin's functions — must be called
  from request-scoped plugin code (reads `x-sovereign-plugin-id` from
  headers), so registration happens once from `app/layout.tsx`, same as every
  other request-scoped setup.
- **Reference implementation to mirror**: `plugins/sovereign-plainwrite.local/app/_lib/portability.ts`,
  registered from that plugin's `layout.tsx`. Pattern: direct Drizzle queries
  scoped by `tenantId`+ownership (not the UI-shaped action functions, which
  add derived fields); a type-guard validating the imported shape before
  touching the DB; **additive import — never wipes existing data**; id
  collisions handled via `ctx.remapId()` + a local id map translating every
  cross-reference; secrets/credentials excluded from export (metadata only)
  and never restored on import. Its `__tests__/portability.test.ts` is the
  test-pattern reference: mocks `@sovereignfs/sdk` to capture the registered
  functions, mocks `drizzle-orm`'s `eq`/`and` into an interpretable condition
  tree against an in-memory fake table-keyed db — runs real insert/select/
  delete logic with no real database.
- **Runtime orchestration** (`runtime/src/portability/`): `registry.ts` is
  the in-process registration store; `platform.ts`'s `eligiblePluginIds(permission)`
  gates participation on the plugin being installed, enabled, and declaring
  `data:export`/`data:import` in its manifest; `bundle.ts` defines the ZIP
  layout (`plugins/<pluginId>/data.json` + optional `blobs/`) and per-section
  checksums; `assemble.ts`/`restore.ts` drive the actual export/import walk —
  **none of this needs to change**, it already generically supports any
  plugin that registers.
- **API routes** (already generic, no change needed): `GET /api/account/export/route.ts`
  streams the ZIP; `POST /api/account/import/route.ts` accepts a multipart
  `bundle` file (50 MB cap) and returns an `ImportSummary`.
- **Manifest gap**: `manifest.json` permissions are currently
  `["auth:session", "db:readWrite", "notifications:send"]` — missing
  `data:export` and `data:import` (RFC 0007; distinct from `data:provide`/
  `data:consume`, which is RFC 0002 cross-plugin sharing, not this).
- **Schema to serialize** (`app/_db/schema.ts`, all tables carry `tenantId`):
  `tasksLists` (id, ownerId, title, color, sortOrder, timestamps),
  `tasksUserListPrefs` (composite PK tenantId+userId+listId; showCompleted,
  defaultViewId), `tasksViews` (id, listId, ownerId, name, kind, config JSON
  string, isDefault, sortOrder), `tasksItems` (id, listId, parentId,
  assigneeId, title, notes, favorite, dueDate, dueTime, reminderSentAt,
  completedAt, sortOrder, recurrenceRule, seriesId), and
  `tasksNotificationPrefs` (composite PK tenantId+userId; enabled,
  morningTime, timezone, lastDigestDate) — user settings data, include it.
- **Existing cascade logic to reuse for the deletion handler**:
  `deleteList()` in `app/_lib/actions.ts` (~line 149) already does the
  ownership-verified app-layer cascade (SQLite has no enforced FK here) —
  deletes `tasksItems` → `tasksUserListPrefs` → `tasksViews` → `tasksLists`
  for one list. The deletion handler is "run that per owned list, plus
  delete the user's own `tasksNotificationPrefs` row."

### Design

**`app/_lib/portability.ts`** (new), registered from `app/layout.tsx`:

- **Export** (`exportTasksData`): direct-query all lists where
  `ownerId = ctx.userId AND tenantId = ctx.tenantId`; then items/views/prefs
  scoped to those list ids; plus the user's own `tasksUserListPrefs` and
  `tasksNotificationPrefs` rows. Return
  `{ pluginId: 'fs.sovereign.tasks', schemaVersion: 1, data: {...} }` — no
  `blobs` (tasks has no file attachments).
- **Import** (`importTasksData`): validate incoming shape with a type guard
  (reject unrecognized `schemaVersion` or structure, mirroring plainwrite's
  `isPlainwriteExportData`); **additive only** — no wipe. Remap every
  plugin-owned id via `ctx.remapId()`: `tasksLists.id`, `tasksViews.id`,
  `tasksItems.id` (and its self-referencing `parentId` for subtasks), and
  `seriesId` (recurrence grouping — remap consistently so an imported
  recurring series stays linked to itself, even though it's not a literal FK
  to another table). Rewrite every cross-reference through a local id map
  built during the pass (list→view/item, item→parent, prefs→list/view) the
  same way plainwrite's `projectIdMap` does, skipping rows whose referenced
  id isn't in the map instead of hard-failing. `assigneeId` passes through
  unchanged (nullable, unused — collaboration/TSK-10-14 is still blocked on
  `sdk.directory`, so this field is always null in practice today; revisit
  when that ships).
- **Delete** (`deleteAllTasksData`): for each list owned by the user, run the
  same steps `deleteList()` already does; separately delete the user's
  `tasksNotificationPrefs` row (not list-scoped). Return
  `{ deleted: <total rows>, errors: [] }`.

### Files

| File | Change |
| --- | --- |
| `app/_lib/portability.ts` (new) | `exportTasksData`, `importTasksData`, `deleteAllTasksData`, `registerPortabilityHandlers()` |
| `app/layout.tsx` | call `registerPortabilityHandlers()` (best-effort, matching plainwrite's `layout.tsx` wrapping) |
| `app/_lib/__tests__/portability.test.ts` (new) | same fake-db/drizzle-mock harness as plainwrite's test; cover: export shape + tenant/owner scoping, import shape rejection, remap + cross-reference rebuild (list/view/item/parentId/seriesId), orphan-reference skip behavior, delete cascade totals |
| `manifest.json` | add `data:export`, `data:import` permissions |
| `CLAUDE.md`, `SPEC.md`, `roadmap.md` | note portability participation (proposed TSK-29) |
| `package.json` | feat → minor bump |

### Verification

1. `pnpm dev`, log in, create lists/tasks/subtasks/a recurring series/starred
   items, set tasks notification prefs. Account → Export my data → download
   the ZIP, confirm `plugins/fs.sovereign.tasks/data.json` is present and
   contains everything.
2. Delete all tasks data locally (or use a second test account), Account →
   Import my data → upload the same ZIP → confirm lists/tasks/subtasks/
   recurring series/stars/prefs are all restored, with new ids (not
   colliding with anything pre-existing) and correct cross-references (a
   subtask still points at its parent, a recurring task's series is still
   linked, `tasksUserListPrefs.defaultViewId` still resolves).
3. Re-import the same ZIP a second time without deleting anything first →
   confirm it's additive (existing data untouched, a second copy of
   everything appears with fresh remapped ids) — matches the documented
   "additive, no wipe" contract.
4. Trigger account deletion (or call the deletion handler directly in a
   test) → confirm all of the user's lists/items/views/prefs are gone.
5. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; version
   bump; draft PR.

---

## Task 6 — Sticky list header + add-task row while scrolling

**Status:** planned
**Repo:** sovereign-tasks. Branch type: `feat/`(minor bump — user-visible
behavior change) or `fix/` if judged a pure polish item at implementation
time.

### Problem

On the task-list pane, the list title/⋯-menu header and the "Add a task…"
input scroll away with the rest of the list. On a long list, both the list's
identity (which list am I looking at) and the primary "add a task" action
require scrolling back to the top to reach.

### Current state (verified)

- `.pane` (`app/[listId]/TasksPane.module.css`) is `overflow-y: auto` — the
  scroll container. `.header` (title row + menu) and `.addRow` (the add-task
  input) are plain flex children at the top of it, with no sticky
  positioning — everything scrolls together as one block. Both have their own
  `border-bottom` already.
- **A directly relevant precedent + a lesson already learned in this exact
  plugin**: `TaskDetailPane`'s `.top` uses `position: sticky; top: 0` for
  the same reason, and it broke once because `background-color: inherit`
  silently resolved to transparent — an intermediate wrapper (`Sheet`'s
  `.content`) never set its own `background-color`, so scrolled content
  showed through the "sticky" header on mobile. Fixed via a
  `--tasks-detail-bg` custom property (cascades through any depth of
  nesting) instead of `inherit`. **Reuse that exact technique here** — do not
  reintroduce `inherit`.
- `TasksPane` is used for both real lists (`app/[listId]/page.tsx`,
  `MobileTasksCarousel.tsx`) and — once Task 3 (virtual "Starred" list) ships
  — the virtual list. Since Task 3 reuses `TasksPane` itself (not a fork),
  this sticky-header change automatically covers the Starred view too with no
  extra work, as long as the CSS isn't scoped to anything list-specific.
- The header's `⋯` button (`.menuBtn`) opens `@sovereignfs/ui`'s `Menu`
  (`TasksPane.tsx:511`), which forks Popover(desktop)/Drawer(mobile)
  internally. Popover positioning is normally computed from the trigger's
  live bounding rect at open time, so a sticky trigger should be unaffected —
  **verify this live, don't assume** (noted as a regression check below).

### Design

- Wrap `.header` and `.addRow` in a shared sticky container (or make both
  independently `position: sticky; top: 0`, stacked — `.header` needs
  `top: 0` and `.addRow` needs `top: <.header's rendered height>` if kept as
  two separate sticky elements; simpler to wrap both in one
  `.stickyHeader` block with a single `position: sticky; top: 0` so there's
  only one offset to maintain).
- Opaque background via a custom property (matching `TaskDetailPane`'s
  `--tasks-detail-bg` pattern) — `.pane`'s own background already differs by
  context (desktop three-column vs. mobile carousel slide), so this needs
  the same non-`inherit` approach, not a copy-paste of a hardcoded color.
- Keep the existing `border-bottom` on `.addRow` (or move it to the sticky
  wrapper's bottom edge) as the visual separator between pinned chrome and
  scrolling content — same purpose `TaskDetailPane`'s sticky header border
  already serves.
- No change to the filter-folds-into-menu measurement logic
  (`TasksPane.tsx`'s hidden shadow-row technique) — sticky positioning
  doesn't affect layout measurement, just paint; call out as a regression
  check rather than assuming zero interaction.
- Desktop: apply the same sticky treatment for consistency (no
  mobile-only gate) — in the three-column layout the effect is subtler
  (the column is usually tall enough that the header rarely scrolls out
  of view already) but there's no reason to special-case it away.

### Files

| File | Change |
| --- | --- |
| `app/[listId]/TasksPane.module.css` | `.header`/`.addRow` → sticky wrapper; opaque background custom property (mirroring `TaskDetailPane.module.css`'s `--tasks-detail-bg`) |
| `app/[listId]/TasksPane.tsx` | wrap `.header`/`.addRow` JSX in the new sticky container if a wrapper element is needed |
| `app/[listId]/page.module.css` (desktop three-column layout) | supply the sticky header's background override the same way `.detailCol` does for `TaskDetailPane`, if the token needs a desktop-specific value |

### Verification

1. `pnpm dev`, mobile viewport, a list with enough tasks to scroll: confirm
   the title/menu row and the add-task input stay pinned at the top while
   the task rows scroll underneath, with no scrolled content visible through
   either (the exact bug class fixed for `TaskDetailPane` — check carefully).
2. Tap the `⋯` menu while scrolled — confirm it opens anchored to the
   (still-visible, pinned) trigger correctly on both mobile (Drawer) and
   desktop (Popover).
3. Confirm the add-task input still works normally while scrolled (type,
   press Enter, new task appears in the (still-scrolled) list below).
4. Repeat on desktop three-column layout — no visual regression to the
   column's existing look when the list is short enough not to scroll.
5. Once Task 3 ships: confirm the virtual Starred list's header (star icon +
   "Starred" title, no add-row per that task's spec) also sticks correctly
   with no extra code — it inherits this from shared `TasksPane` usage.
6. `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; version
   bump; draft PR.

---

<!-- Add Task 7, 8, … above this line as new numbered sections, and keep the
     index table at the top in sync. -->
