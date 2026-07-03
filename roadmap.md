# Roadmap — Sovereign Tasks

Requirement IDs (TSK-*) are stable — never renumbered or reused. Full requirement details live in the spec (`tasks.md`).

## v0.1 — Core private tasks (current)

Private lists and tasks for a single user. No sharing.

| ID | Requirement | Status |
| --- | --- | --- |
| TSK-01 | Create, rename, and delete lists | ✅ |
| TSK-02 | List color for visual distinction | 🔲 |
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

TSK-15 through TSK-21: due dates, overdue visual state, per-list filters, cross-list search, keyboard shortcuts, bulk select/delete/move.

## v0.4 — Recurrence

TSK-22 through TSK-25: recurring tasks via `rrule` (sv-RFC 5545), next-occurrence generation, per-instance editing.

## v1.0 — Polish and reference implementation

Accessibility audit, full keyboard navigation, documentation, and publication to the Sovereign plugin registry as the canonical reference implementation.
