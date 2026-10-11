import { themeFor } from "@/lib/themes";

/** Naam van een crewlid, met het persoonlijke thema als die er een heeft. */
export function CrewName({ userId, name, className = "" }: { userId: string; name: string; className?: string }) {
  if (themeFor(userId) === "pride") {
    return (
      <span className={`whitespace-nowrap font-bold ${className}`}>
        <span aria-hidden>🏳️‍🌈 </span>
        <span className="pride-name">{name}</span>
      </span>
    );
  }
  return <span className={className}>{name}</span>;
}
