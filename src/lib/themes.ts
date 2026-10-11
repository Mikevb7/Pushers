// Persoonlijke thema's. Vast gekoppeld aan een account (niet aan een naam), niet aanpasbaar in de app.
// Niek vroeg zelf om een eigen pride-thema: roze, extra, met de regenboogvlag.
const PRIDE_USERS = new Set<string>([
  "64df4fd0-c3d0-41f0-8f96-7132486627aa", // Niek
]);

export type Theme = "pride" | null;

export function themeFor(userId: string | null | undefined): Theme {
  return userId && PRIDE_USERS.has(userId) ? "pride" : null;
}
