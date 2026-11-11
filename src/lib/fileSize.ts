// Rough file sizes for labels (Settings › Back up now, 9.1): decimal units, like the iPhone's Files app.

const MB = 1_000_000;
const GB = 1_000_000_000;

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "<1 MB", "~1.4 MB", "~36 MB", "~2.4 GB": one decimal under 10, whole numbers above. */
export function approxSize(bytes: number): string {
  if (bytes < MB) return '<1 MB';
  const [v, unit] = bytes < GB ? [bytes / MB, 'MB'] : [bytes / GB, 'GB'];
  const shown = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return `~${trim(shown)} ${unit}`;
}
