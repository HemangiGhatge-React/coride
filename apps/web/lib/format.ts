/** "12 Oct 2026". Fixed locale so the output does not depend on the browser's language. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "1 user", "2 users". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now", "5 minutes ago", "yesterday", "2 days ago", "3 months ago". `now` is injectable for tests. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.round((then - now) / 1000); // negative = in the past
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return relativeTime.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeTime.format(Math.round(seconds / 3600), "hour");
  if (abs < 86400 * 30) return relativeTime.format(Math.round(seconds / 86400), "day");
  if (abs < 86400 * 365) return relativeTime.format(Math.round(seconds / (86400 * 30)), "month");
  return relativeTime.format(Math.round(seconds / (86400 * 365)), "year");
}

/** "12 Oct 2026, 14:03": the exact time, for tooltips next to a relative time. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
