# Concept — Sovereign Tasks

## One sentence

A clean, self-hosted alternative to Google Tasks. — not a Todoist clone.

## Design principles

**Simplicity is the feature.** Every addition is measured against one question: does it reduce friction without adding cognitive load? If the answer isn't clearly yes, it doesn't ship.

**Privacy by default.** Tasks are private to the user who created them. Sharing is opt-in and scoped to explicit list membership (v0.2+). Data lives on your own Sovereign instance — no telemetry, no third-party services, no data leaving infrastructure you control.

**Earn your complexity.** Due dates, filters, cross-list search, and favourites each solve a real problem for a real user — they landed only once the core (private lists, tasks, subtasks, completion, sort) was solid, and only in a way that stays out of the way until you reach for them. Recurrence and bulk actions remain later milestones, and collaboration waits on the platform's user-directory SDK.

**Own your data.** The plugin stores everything in an isolated SQLite database on the user's instance. It participates in Sovereign's data export/deletion hooks (via sv-RFC 0052 when available) so users can leave without leaving their data behind.

## What it is not

- A project management tool
- A Kanban board (Kanban is a *view* on the same data, not a different product)
- A team inbox or assignment system in v0.1
- A recurring-tasks engine in v0.1

The collaboration and power-user milestones expand the surface area deliberately, one problem at a time.

## Views

The UI is built around the idea that **one data model supports multiple presentations**. The list, task, and subtask rows are the same regardless of which view is active. Views are a lens, not a fork.

| View | Kind | Status |
| --- | --- | --- |
| Compact | `compact` | v0.1 |
| Kanban Compact | `kanban_compact` | future |
| Kanban | `kanban` | future |
| Visualizer | `visualizer` | future |

The Compact view is the default and the baseline. Every future view is additive — it must not require changes to the task ownership or completion model.

## Relation to the Sovereign SDK

Sovereign Tasks is the primary reference implementation for how an externally-maintained plugin integrates with Sovereign. It uses only `@sovereignfs/sdk` — never `@sovereignfs/db` directly. This constraint is intentional and enforced by ESLint: it proves the SDK surface is sufficient and keeps the plugin portable across platform versions.

Plugin developers building their own tasks-like plugins should read this code as a worked example.
