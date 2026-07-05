# Roadmap — Sovereign Tasks

Requirement IDs (TSK-*) are stable — never renumbered or reused. Full requirement details live in the spec (`tasks.md`).

## v0.1 — Core private tasks (current)

Private lists and tasks for a single user. No sharing.

| ID | Requirement | Status |
| --- | --- | --- |
| TSK-01 | Create, rename, and delete lists | ✅ |
| TSK-02 | List color for visual distinction | ✅ |
| TSK-03 | Deleting a list deletes all tasks within it | ✅ |
| TSK-04 | Create, edit, and delete tasks | ✅ |
| TSK-05 | Tasks have title (required) and notes (optional) | ✅ |
| TSK-06 | Subtasks — one level deep | ✅ |
| TSK-07 | Mark task (and subtasks) complete / reopen | ✅ |
| TSK-08 | Manual drag-reorder within a list | ✅ |
| TSK-09 | Show/hide completed tasks toggle per user | ✅ |

## v0.2 — Collaboration

**Blocked on `sdk.directory` (sv-RFC 0041).** Do not start until the user-directory SDK surface is available.

TSK-10 through TSK-14: shared lists, membership roles, task assignment, member removal.

## v0.3 — Due dates and power-user features

Due dates, filters, and cross-list search landed early — alongside the
three-column web home — ahead of the original phasing. Keyboard shortcuts and
bulk actions shipped after recurrence (v0.4), which itself jumped the queue —
completing this milestone.

| ID | Requirement | Status |
| --- | --- | --- |
| TSK-15 | Due date (date, or date + time) | ✅ |
| TSK-16 | Overdue tasks visually distinguished | ✅ |
| TSK-17 | Filter: All / Active / Overdue, plus a Completed section | ✅ |
| TSK-18 | Cross-list search by task title | ✅ |
| TSK-19 | Keyboard shortcuts for common actions | ✅ |
| TSK-20 | Bulk select + delete | ✅ |
| TSK-21 | Bulk select + move to another list | ✅ |
| TSK-26 | Star/favourite a task (added ahead of phasing) | ✅ |
| TSK-27 | Move a single task to a different list from the detail pane (added ahead of phasing; distinct from TSK-21's bulk move) | ✅ |

Keyboard shortcuts (scoped to the task-list pane, skipped while typing in a
field): `n` focuses the add-task input, `j`/`k` (or Up/Down) move a keyboard
focus ring between rows, `e` completes the focused row, `Enter` opens its
detail pane, and `[`/`]` switch to the previous/next list. Bulk selection is
entered via ctrl/cmd-click (desktop) or long-press (touch) on a row — deliberately
not an explicit "Select" mode button, since the row checkbox already means
"mark complete" and this keeps that meaning unambiguous. A floating action bar
appears with the selection count plus Move to list / Delete / Cancel; `Escape`
also clears the selection.

## v0.4 — Recurrence

Landed out of the roadmap's own order — jumped ahead of v0.3's remaining
keyboard-shortcut/bulk-action items since recurring tasks were judged more
important. `recurrence_rule`/`series_id` columns already existed on
`tasks_items` since the very first migration, so no schema change was needed.

| ID | Requirement | Status |
| --- | --- | --- |
| TSK-22 | Set a recurrence rule (daily/weekly/monthly/yearly/every-N/specific weekdays) | ✅ (nth-day-of-month deferred) |
| TSK-23 | Completing a recurring task generates the next occurrence | ✅ (no subtasks copied) |
| TSK-24 | Edit-scope prompt: this / this and future / all | ✅ (title/notes/due-date/rule only) |
| TSK-25 | Human-readable recurrence pattern in the task UI | ✅ |

## Mobile UI — swipeable lists carousel + bottom sheets

Cross-cutting UI work, not tied to a specific TSK id (like "Layout" in the
spec, this is described in prose rather than a numbered requirement). Shipped
ahead of v1.0's "full keyboard navigation" polish pass, following the same
pattern as TSK-26/27 and v0.4 jumping the queue.

Below 640px the plugin now renders a genuinely different UI, not a squeeze of
the desktop three-column layout: a swipeable carousel (Lists index slide,
then one slide per list — landing on the user's first list, not the index)
and bottom sheets for task detail and list management (rename/colour/delete
entry point; delete's own confirmation stays a centered dialog). Desktop and
tablet (641–900px) are unchanged. See `CLAUDE.md`'s "Mobile shell" section for
the implementation model.

## v1.0 — Polish and reference implementation

Accessibility audit, full keyboard navigation, documentation, and publication to the Sovereign plugin registry as the canonical reference implementation.
