# Pushers

Trainingsapp voor de crew: vast Push / Pull / Legs / Upper-schema met de apparaten van Sportcentrum Hierden, sets loggen met reps in reserve, progressive overload, progressie in %, crew-leaderboard, water- en creatine-streaks en een AI-coach.

Next.js 15 (App Router) + Supabase + Claude API. Installeerbaar als app op je telefoon (PWA).

## Opzetten

1. **Database**: open in Supabase de SQL Editor, plak `supabase/schema.sql`, verander `VERANDER-MIJ` in jullie eigen uitnodigingscode en klik Run.
2. **E-mailbevestiging uit**: Supabase → Authentication → Sign In / Providers → Email → zet *Confirm email* uit. Anders moet iedereen eerst een mail bevestigen (en de gratis mailer heeft een lage limiet).
3. **Vercel**: importeer deze repo en zet de environment variables uit `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API)
   - `ANTHROPIC_API_KEY` (console.anthropic.com), alleen in Vercel
4. **Op je telefoon**: open de site, dan *Deel → Zet op beginscherm* (iPhone) of *Installeren* (Android).

## Lokaal draaien

```bash
npm install
cp .env.example .env.local   # vul de waarden in
npm run dev
npm test                     # logica-tests
```

## Waar zit wat

- `src/lib/exercises.ts`: alle oefeningen met foto, opstelling en tips
- `src/lib/schedule.ts`: het basisschema (sets, rep-ranges, supersets)
- `src/lib/progression.ts`: regels voor progressive overload
- `src/lib/stats.ts`: % sterker (geschatte 1RM), records, volume
- `src/lib/rotation.ts`: volgende training, weekstatus, streaks
- `src/lib/coach.ts` + `src/app/api/coach/route.ts`: AI-coach
- `supabase/schema.sql`: tabellen en beveiliging (iedereen ziet elkaars data, past alleen zijn eigen data aan)
