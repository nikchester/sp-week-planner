# Changelog

The project is in early development (0.x). Data formats and UI may still change.

## 0.5.0 — 2026-11-08

- **Task menu:** right-click any task card (or press "⋯" on it) to open a menu like the native task menu of
  Super Productivity. The plugin API cannot open the native menu, so the plugin draws its own:
  due date (Today, Tomorrow, Next Monday, Date), mark done, start time tracking, estimate, toggle tags,
  move to another project, priority, week, category, open task details, delete task (with a second click).
- Priority (P1–P3) is shown on cards. It is set through `updateTask` with the `priority` field, which is not part
  of the public `types.ts`; it works only if the host accepts this field.
- The `priority` task field is labelled "Priority" in the pool filter and sort.

## 0.4.0 — 2026-11-08

The planner is split into three pages: Planning, Week and Kanban.

- **Planning:** unplanned pool on the left, six upcoming weeks on the right with load per category and week total.
  Click a week to make it the target of the pool buttons; drop tasks onto any week.
- **Week:** categories as columns (Unsorted, University, Career, Personal by default). New tasks of the week go to
  Unsorted; drag a card to sort it. Edit the estimate in hours right on the card.
- **Categories and limits are global:** rename, add, delete and reorder categories once for all weeks.
  Each category has its own hour limit, and the week has a total limit.
- **Kanban:** current week with To do / In progress / Done columns and a category filter.
  Moving a card to Done marks the task done in Super Productivity.
- New header button and shortcut "Week kanban"; the existing button opens Planning.
- Filtered lists from 0.2–0.3 are replaced by manual categories. Old lists become categories,
  the weekly limit of "All tasks of the week" becomes the week limit.
- Task entries now store week, category and kanban status as JSON. Entries of 0.1–0.3 are still read.

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
