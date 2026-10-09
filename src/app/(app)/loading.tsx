export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 pt-2" aria-busy="true" aria-label="Laden">
      <div className="h-4 w-24 rounded bg-steel" />
      <div className="h-28 w-3/4 rounded-lg bg-steel" />
      <div className="h-14 rounded-xl bg-steel" />
      <div className="h-32 rounded-xl bg-steel" />
      <div className="h-40 rounded-xl bg-steel" />
    </div>
  );
}
