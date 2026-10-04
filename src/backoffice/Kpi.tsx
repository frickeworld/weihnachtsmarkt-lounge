/** Kennzahl-Kachel für Admin und Händler. */
export function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-sm text-ink-soft">{label}</div>
      <div className="mt-1 font-display text-2xl font-medium tabular-nums sm:text-3xl">
        {typeof value === 'number' ? value.toLocaleString('de-DE') : value}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-soft">{sub}</div>}
    </div>
  );
}
