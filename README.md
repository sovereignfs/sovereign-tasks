# Sovereign Tasks

A minimal, privacy-first task manager for [Sovereign](https://github.com/sovereignfs/sovereign).

**Status:** v0.2 — active development  
**Plugin ID:** `fs.sovereign.tasks`  
**Route:** `/tasks`

---

## What it is

A clean, self-hosted alternative to Google Tasks. The UI is intentionally minimal and will support multiple layouts — starting with **Compact** (a focused list view), with Kanban and Visualizer views planned for later milestones.

On the web it's a **three-column home**: list sidebar · task list · task detail. Tasks support subtasks (one level deep), optional notes, completion, manual drag-reorder, **due dates** (with overdue styling), a **star/favourite** toggle, per-list **filters** (All / Active / Overdue) with a collapsible Completed section, **cross-list search**, and per-list **colour**. The detail pane (opened by selecting a task) is where notes, due date, and subtasks are edited.

Sovereign Tasks runs on your own Sovereign instance. Users sign in with their Sovereign account; data is stored on and synced through your instance server.

See [CONCEPT.md](CONCEPT.md) for design philosophy and [roadmap.md](roadmap.md) for the milestone plan.

## Installing on a Sovereign instance

```bash
sv plugin add https://github.com/sovereignfs/sovereign-tasks
```

Then restart the runtime. Tasks will appear in the launcher as **Tasks**.

## Local development

The plugin is developed as a `.local` workspace member inside the platform monorepo.

```bash
# From the platform monorepo root
pnpm dev   # runtime on :3000; plugin routes live at /tasks
```

After changing the database schema (`app/_db/schema.ts`), hand-author a matching
migration — there is no generate step. Add a numbered SQL file under
`migrations/sqlite/` following the existing files (e.g. `0001_add_favorite.sql`),
append an entry to `migrations/sqlite/meta/_journal.json`, then apply it without
restarting the dev server:

```bash
sv plugin migrate fs.sovereign.tasks
```

See the [plugin development guide](../../docs/plugin-development.md) for the full workflow.

## Stack

- **Language:** TypeScript, React (Next.js App Router)
- **Database:** isolated SQLite via `sdk.db` — no direct `@sovereignfs/db` imports
- **UI:** `@sovereignfs/ui` components and `--sv-*` tokens exclusively
- **Drag reorder:** `@dnd-kit/core` + `@dnd-kit/sortable`

## Requirements

- Sovereign platform ≥ `0.10.0`
- Node ≥ 20
- pnpm 11.5.x (platform monorepo convention)

## Spec

Full functional requirements, data model, and milestone definitions: [SPEC.md](SPEC.md)
