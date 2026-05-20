export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "?";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const future = diff > 0;
  const units: [number, string][] = [
    [60_000, "s"],
    [3_600_000, "m"],
    [86_400_000, "h"],
    [604_800_000, "d"],
    [Infinity, "w"],
  ];
  const ms = abs;
  let value = ms / 1000;
  let unit = "s";
  if (ms < 60_000) {
    value = ms / 1000;
    unit = "s";
  } else if (ms < 3_600_000) {
    value = ms / 60_000;
    unit = "m";
  } else if (ms < 86_400_000) {
    value = ms / 3_600_000;
    unit = "h";
  } else if (ms < 604_800_000) {
    value = ms / 86_400_000;
    unit = "d";
  } else {
    value = ms / 604_800_000;
    unit = "w";
  }
  const v = Math.round(value);
  return future ? `in ${v}${unit}` : `${v}${unit} ago`;
  void units;
}

export function formatAbsoluteShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatStamp(
  iso: string | null | undefined,
  timeZone?: string,
): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "?";
  const absolute = d.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
  return `${absolute} (${relativeTime(iso)})`;
}
