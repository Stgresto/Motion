# Motion UF – plattformens arkitektur

**We Think. You Move.**

Plattformen har tre delar som hänger ihop: **Planeraren**, **Motion AI** och **Scan & Play**. Allt kretsar kring ett flöde:

```
PLANERA → PÅMINNELSE → DRA ETT FYSISKT KORT → SKANNA → RÖR DIG → KLART → SE FRAMSTEG
```

## Filer

| Fil | Vad den gör |
|---|---|
| `app.html` | Hela appen (Idag, Planerare, Motion AI, Skanna, Kortvy, Träningsläge, Framsteg). Ingen byggprocess. |
| `cards.js` | Kortdatabasen. Lägg till nya kort här. |
| `api/chat.js` | Serverfunktion på Vercel som skickar Motion AI:s frågor till Anthropic. Nyckeln ligger i `ANTHROPIC_API_KEY`. |
| `vercel.json` | Gör att `motionplanner.se/play/MOT-IND-018` öppnar appen direkt på rätt kort. |

## Sidor – en fråga var

| Sida | Fråga |
|---|---|
| Idag | Vad gör jag idag? |
| Planerare | När ska jag röra mig? |
| Motion AI | Hjälp mig bestämma. |
| Skanna | Vilket kort drog jag? |
| Träningsläge | Vad gör jag just nu? |
| Framsteg | Hur mycket har jag faktiskt rört mig? |

## QR-systemet

Varje fysiskt kort har ett unikt id: `MOT-IND-018` (individuell lek) eller `MOT-FAM-023` (familj och vänner).

QR-koden på kortet pekar på `https://motionplanner.se/play/MOT-IND-018`.

- Skannas koden med mobilens vanliga kamera öppnas webben, och `vercel.json` skickar vidare till `app.html#play/MOT-IND-018`.
- Skannas koden inne i appen läser den id:t direkt, visar "Skannar…" → "Kort hittat" och öppnar övningen.
- `FAM`-kort känns igen automatiskt och öppnar familjeläget med spelare, gemensam klocka och vinnare.

## Datamodell

I prototypen sparas allt i webbläsaren (`localStorage`, nyckel `muf.v1`) med exakt samma struktur som tabellerna nedan. Vid flytt till en riktig databas (t.ex. Supabase/Postgres) byts bara lagringslagret ut.

```sql
create table users (
  id uuid primary key,
  name text not null,
  email text unique,
  preferences jsonb default '{}'::jsonb,   -- t.ex. {"session_minutes":10,"types":["reset","strength"]}
  created_at timestamptz default now()
);

create table schedule_events (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  title text not null,
  category text check (category in ('school','work','training','meal','personal')),
  date date not null,
  start_time time not null,
  end_time time not null,
  repeat text default 'none' check (repeat in ('none','daily','weekdays','weekly')),
  exdates date[] default '{}'              -- enstaka tillfällen som tagits bort
);

create table motion_sessions (
  id uuid primary key,
  user_id uuid references users(id) on delete cascade,
  date date not null,
  start_time time not null,
  duration int not null,                    -- minuter: 5, 10, 15, 20
  type text,                                -- energy | strength | mobility | reset | surprise
  card_count int not null,
  status text default 'planned' check (status in ('planned','completed','skipped'))
);

create table session_cards (
  session_id uuid references motion_sessions(id) on delete cascade,
  card_id text references cards(id),
  "order" int not null,
  completed boolean default false,
  seconds int,
  primary key (session_id, "order")
);

create table cards (
  id text primary key,                      -- MOT-IND-018
  deck text check (deck in ('individual','family')),
  category text,                            -- strength | energy | mobility | reset | challenge | together
  name text not null,
  description text,
  difficulty text check (difficulty in ('easy','medium','hard')),
  duration int,                             -- sekunder per set
  instructions text[],
  video_url text,
  muscle_group text,
  players_min int default 1,
  players_max int default 1,
  mode text                                 -- familjekort: longest | race | together
);
```

Korten i ett pass bestäms inte i förväg. Användaren drar dem ur den fysiska leken, och varje skannat kort läggs till i `session_cards`. Ett pass på 10 minuter med 4 kort ger cirka 2,5 minuter per kort. Träningsläget räknar själv ut antal set och vila utifrån kortets längd.

## Motion AI

Motion AI är ingen chatbot som bara skickar text. Den har verktyg och får ett strukturerat sammanhang i stället för hela databasen.

**Sammanhang som skickas med varje fråga:** aktuell tid, användarens inställningar, dagens schema, morgondagens schema, dagens lediga luckor, veckans Motion-pass och de senast klara korten.

**Verktyg för att läsa** (körs direkt):

- `get_schedule(from, to)`
- `find_free_windows(date)`
- `get_recent_sessions()`

**Verktyg för att föreslå** (ändrar ingenting själva):

- `propose_motion_session(date, start, duration, need)`
- `propose_move_session(session_id, new_date, new_start)`
- `propose_delete_session(session_id)`
- `propose_event(title, category, date, start, end, repeat)`
- `propose_week_plan(sessions[])`

Alla `propose_*` visas som ett kort i chatten, till exempel *Flytta pass 16:30 → 17:30* med knappen **Bekräfta ändringen**. Kalendern ändras först när användaren trycker. Veckoplanen går att redigera, ändra tider och ta bort pass, innan den läggs in.

**Utan API-nyckel**, eller om servern inte svarar, används en inbyggd lokal motor. Den förstår de vanligaste önskemålen: planera dagen eller veckan, "jag har 10 minuter", "jag orkar inte", flytta, korta eller ta bort ett pass och "när ska jag träna imorgon". Appen fungerar alltså även offline.

**Ton:** lugn, kort, praktisk. Inga utropstecken, inga emojis, ingen influencer-ton.

## Smarta planeraren

- Lediga luckor räknas mellan 07:00 och 21:00 (09:00 på helger).
- Det läggs 20 minuters buffert efter skola, jobb och träning, och 30 minuter före måltider.
- Bara **ett** förslag per dag visas, och bara om dagen saknar Motion-pass. Eftermiddagsluckor prioriteras.
- Veckoplanen föreslår cirka tre pass med minst en vilodag emellan. Planeraren fyller aldrig varje lucka.

## Lägga till kort

Lägg till ett objekt i `cards.js` med nästa lediga id, till exempel `MOT-IND-019`. Skapa sedan QR-koden för `https://motionplanner.se/play/MOT-IND-019`. När ni har instruktionsvideor fyller ni i `video_url`, så visas videon i stället för kortbilden.
