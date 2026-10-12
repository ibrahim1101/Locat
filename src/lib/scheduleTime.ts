export function localScheduleValue(date: Date): string {
  const n = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${n(date.getMonth() + 1)}-${n(date.getDate())}T${n(date.getHours())}:${n(date.getMinutes())}`;
}
export function parseScheduleTime(value: string, now = Date.now()): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Choose a valid local date and time.");
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localScheduleValue(date) !== value) throw new Error("That local time does not exist. Choose another time.");
  if (date.getTime() < now + 60_000 || date.getTime() > now + 30 * 86400000) throw new Error("Choose a time from one minute to 30 days ahead.");
  return date;
}
export function scheduleFailureLabel(code: string | null) {
  return ({ account_disabled: "Your account was disabled.", membership_changed: "You no longer belong to this chat.",
    destination_unavailable: "The contact or chat is no longer available.", key_epoch_changed: "Group encryption changed. Create a new schedule.",
    direct_key_changed: "Direct encryption keys changed or the legacy key context is unavailable. Create a new schedule.", retry_conflict: "A message retry conflict prevented delivery." } as Record<string, string>)[code ?? ""] ?? "The scheduled message could not be delivered.";
}
