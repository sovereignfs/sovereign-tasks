# Sovereign Tasks

A minimal, privacy-first task manager for [Sovereign](https://github.com/sovereignfs/sovereign).

**Status:** v0.1 — active development  
**Plugin ID:** `fs.sovereign.tasks`  
**Route:** `/tasks`

---

## What it is

A clean, self-hosted alternative to Google Tasks. The UI is intentionally minimal and will support multiple layouts — starting with **Compact** (a focused list view), with Kanban and Visualizer views planned for later milestones. Tasks support subtasks (one level deep), optional notes, completion, and manual drag-reorder.

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

After changing the database schema, generate and apply a migration:

```bash
# Write a new migration file under migrations/sqlite/
# Then apply it without restarting the dev server:
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
