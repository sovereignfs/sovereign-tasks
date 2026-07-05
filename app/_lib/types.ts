/** Shared client-facing row shapes. Server actions return wider Drizzle rows;
 *  these are the fields the UI consumes (excess props on the source are fine). */

export interface ListRow {
  id: string;
  title: string;
  color: string | null;
  openCount: number;
}

export interface TaskRow {
  id: string;
  listId: string;
  title: string;
  notes: string | null;
  completedAt: number | null;
  parentId: string | null;
  favorite: boolean;
  dueDate: string | null;
  dueTime: string | null;
  recurrenceRule: string | null;
  subtaskCount: number;
  subtaskDoneCount: number;
  /** Unix epoch seconds. Only read by the client for the "Date" sort option. */
  createdAt: number;
}
