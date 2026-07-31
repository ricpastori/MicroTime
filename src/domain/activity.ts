import type { DayActivity, Session } from "../types";

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function toLocalDateKey(isoTimestamp: string, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  let formatter = dateFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatterCache.set(timeZone, formatter);
  }

  const parts = formatter.formatToParts(new Date(isoTimestamp));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error("Could not calculate the local date");
  }
  return `${year}-${month}-${day}`;
}

export function groupFocusCompletionsByLocalDay(sessions: Session[], timeZone?: string): DayActivity[] {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    if (session.type !== "focus" || session.status !== "completed" || !session.completedAt) {
      continue;
    }
    const key = toLocalDateKey(session.completedAt, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, count]) => ({ date, count }));
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
