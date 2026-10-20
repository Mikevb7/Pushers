/** Ringetje met het percentage van het schema dat is afgemaakt. */
export function CompletionRing({ pct, size = 34, stroke = 4, label = true }: { pct: number; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const color = p >= 100 ? "var(--color-go)" : p >= 75 ? "var(--color-pin)" : "var(--color-warn)";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }} title={`${p}% van het schema afgemaakt`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} />
      </svg>
      {label && (
        <span className="absolute font-semibold tabular-nums" style={{ fontSize: Math.max(9, size * 0.28) }}>
          {p >= 100 ? "✓" : `${p}%`}
        </span>
      )}
      <span className="sr-only">{p}% afgemaakt</span>
    </span>
  );
}
