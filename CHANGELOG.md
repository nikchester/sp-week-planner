# Changelog

The project is in early development (0.x). Data formats and UI may still change.

## 0.3.0 — 2026-11-08

UX fixes after an expert review of the planner.

- Layout no longer overflows on narrow screens (phones, narrow windows).
- Unplanned pool: rows are selected by clicking the row; the checkbox now only means "done".
- Filter editor: tags and projects are toggle chips instead of a Ctrl+click multi-select; the Today tag is hidden.
- Filter editor: fields are grouped (main, time, dates, issue tracker, other fields).
- Lists are shown first; "All tasks of the week" is collapsed while lists exist.
- Buttons have text labels: "→ week 45", "← W44", "W46 →", "Unplan".
- Pool badges say "over limit" with a tooltip that shows the numbers.
- Task meta shows "estimate 3h" and "spent 1h" instead of "0m / 3h".
- List hours are labelled "planned", with "done X of Y" below.
- Week chips show planned hours against the weekly limit.
- Toast with Undo after adding, moving and removing tasks; over-limit warnings appear in the same toast.
- Drag handle on draggable rows; hint above the pool.
- Esc or Cancel with unsaved editor changes asks for confirmation.
- "Add selected" button is hidden until something is selected.

## 0.2.0 — 2026-11-08

Distributed as 1.1.0 before the version reset.

- Unplanned pool with configurable filter and multi-key sort over all task fields.
- Custom lists with filter, sort and an hour limit per week; inline limit editing.
- Over-limit banner, red cards and a warning when a list exceeds its limit.
- List of all tasks of the week with its own sort and limit.
- Drag and drop between pool, week and week chips.

## 0.1.0 — 2026-11-08

Distributed as 1.0.0 before the version reset.

- Attach tasks to ISO weeks from the task context menu.
- Week planner view: navigation, progress, overdue tasks, quick add.
- Startup and new-week notifications.
