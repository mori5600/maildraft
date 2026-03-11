export function formatStoredTime(value: string): string {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "サンプル";
  }

  return new Date(seconds * 1000).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
