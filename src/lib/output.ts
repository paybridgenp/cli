import pc from "picocolors";

export function info(msg: string): void {
  console.log(pc.dim("  " + msg));
}

export function success(msg: string): void {
  console.log(pc.green("  ✓ ") + msg);
}

export function warn(msg: string): void {
  console.log(pc.yellow("  ⚠ ") + msg);
}

export function error(msg: string): void {
  console.error(pc.red("  ✗ ") + msg);
}

export function fatal(msg: string): never {
  error(msg);
  process.exit(1);
}

export function label(key: string, value: string, indent = "  "): void {
  console.log(indent + pc.dim(key.padEnd(14)) + value);
}

export function blank(): void {
  console.log("");
}

export function header(title: string): void {
  blank();
  console.log("  " + pc.bold(title));
  blank();
}

export function formatAmount(paisa: number): string {
  return "NPR " + (paisa / 100).toFixed(2);
}

export function formatDate(ts: number | string | null | undefined): string {
  if (ts == null) return "-";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-NP", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function timeAgo(ts: number | string | null | undefined): string {
  if (ts == null) return "-";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return "-";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
