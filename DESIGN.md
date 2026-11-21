# Workout Tracker — Full Body A/B (v1.1 Revised)

PWA for Android (no store). Free, offline-first, data stored locally on-device (IndexedDB).

## Program & Schedule
- Schedule: Train Mon / Wed / Fri (user can also log on any day).
- Rotation: Day type alternates `A ↔ B` after every completed session (`A, B, A` / `B, A, B` across weeks). A missed day does not break the rotation order.
- User can manually switch today's day type (`A` or `B`) via a clear touch-friendly control without breaking the underlying rotation rule unless confirmed.
- Sets & Reps:
  - Main compound/heavy lifts: `2×5-9` (2 sets, target 5–9 reps)
  - Isolation / accessory lifts: `2×8-10` (2 sets, target 8–10 reps)

## Default Exercises
### Day A (Main)
- Bench Press / Machine Flat Press (`2×5-9`, default increment: barbell/dumbbell 2.5 kg, machine 5 kg)
- Pull up / Lat Pulldown (`2×5-9`)
- Barbell row / Machine row (`2×5-9`)
- Squat / Leg Press (`2×5-9`)
- Lateral raise (`2×8-10`)
- Hamstring curls (`2×8-10`)

### Day B (Main)
- Overhead press / Machine Shoulder Press (`2×5-9`)
- Chin up / Supinated pulldown (`2×5-9`)
- Deadlift / Smith SLDL (`2×5-9`)
- Pec deck (`2×8-10`)
- Leg extensions (`2×8-10`)

### Optional Accessories (`2×8-10`, disabled by default, assignable to `A` | `B` | `both`, can also be added ad-hoc to an active session)
- Biceps: Dumbbell curl
- Triceps: Tricep pushdown
- Glutes: Hip thrust
- Adductors: Hip adductor
- Calves: Calf raise
- Abs: Rope crunch

## Progression (Double Progression)
History and progression are tracked per `(exerciseId, variant)` based on the most recent completed session for that exercise + variant:
- No prior history → prompt/allow user to set a starting weight (or bodyweight mode); pre-fill subsequent sets in the session with the entered weight for fast logging.
- Every set in the last session hit `reps >= repMax` → suggest increasing weight by `+increment` (`⬆`) for today's target weight.
- Any set in the last 2 sessions had `reps < repMin` → suggest deloading by `-10%` (`⬇`), rounded down to the nearest `increment` (e.g., 2.5 kg or 5 kg), with a floor of `0` (or minimum safe weight).
- Otherwise → keep the same weight and aim for more reps within `[repMin, repMax]` (`●`).
- Working weight display: lowest weight across completed sets in that exercise (or primary working weight used).
- Bodyweight / Weighted / Assisted support: allow logging `0` (bodyweight), positive added weight (e.g., `+5 kg`), or negative assistance where applicable without breaking progression calculations.

## Rest Timer & Nutrition
- Rest interval: `90–180` seconds (default `120` s), adjustable with quick-step controls (e.g., `-15s`, `+15s`, skip/restart).
- Auto-start option when a set is checked off (`✓`), collapsible/non-blocking bar during active logging.
- Stores `endTime` timestamp so remaining time stays accurate after switching apps; displays target finish clock time, triggers sound + vibration when reaching `0` while active, and notes PWA background/screen-off alert limitations (with Capacitor local notifications planned for APK).
- Protein target: `bodyweightKg × proteinFactor` (default `proteinFactor = 1.6` g/kg).

## Visual Direction (Gym-Friendly Pastel + High-Contrast Action)
- Inspired by clean mobile card UI: soft off-white/light neutral background, rounded cards, pill badges/chips, and high-contrast dark (`#111` / near-black) primary CTAs and timer bar.
- Use soft pastel accents purposefully for status/categories (e.g., active exercise highlight, progression badges `⬆` / `●` / `⬇`, completed/dimmed states) while keeping large tap targets (`>= 44px`), steppers (`+`/`-` for weight and reps), and clear legibility under gym lighting.

## Tech Stack & Data
- Stack: Vite + TypeScript + Preact, IndexedDB via Dexie, `vite-plugin-pwa`, Chart.js, GitHub Pages hosting, Capacitor (later APK).
- Entities:
  - `Settings { bodyweightKg, proteinFactor, restDefault, restMin, restMax, autoStartTimer, lastBackupAt }`
  - `Exercise { id, name, variants[], day: 'A'|'B'|'both', sets, repMin, repMax, increment, isAccessory, enabled, order }`
  - `Session { id, date, dayType: 'A'|'B', status: 'in_progress'|'done', startedAt, finishedAt }`
  - `SetLog { id, sessionId, exerciseId, variant, setNo, weightKg, reps, completed }`
  - `ProteinLog { date, grams }`

## Roadmap & Core Screens
- **v0.1**: Today screen (clear day A/B toggle, target weights & progression badges, start session), Active Workout screen (variant selector, quick weight/rep steppers, `✓` set completion, non-blocking rest timer), Finish/Summary screen (session stats + next-session progression preview).
- **v0.2**: History calendar, exercise/variant progression charts, view/edit past sessions.
- **v0.3**: Protein tracker (daily target `kg × 1.6` + quick-add buttons), Settings (bodyweight, rest defaults, manage main/accessory exercises), JSON Backup/Restore with a gentle reminder every 14 days.
- **v1.0**: PWA install + GitHub Pages deploy -> **Later**: APK via Capacitor.

---

## Implementation decisions (not in the spec above)
- `Exercise.increment` is stored per variant (`increments[]`, same order as `variants[]`) so barbell = 2.5 kg and machine = 5 kg inside one exercise.
- Deload rule is read as "reps < repMin in each of the last 2 consecutive sessions" (not a single bad session). One bad day keeps the same weight.
- For bodyweight (0) or assisted (negative) lifts a deload moves one increment toward more assistance (`weight − increment`).
- Switching today's day type away from the rotation asks for confirmation; the rotation then continues from the session actually completed.
- Weight edits copy to the remaining unchecked sets of the same exercise. Unchecked sets are discarded when the session is finished.

## Run
- `npm install` once, then `npm run dev` (opens on http://localhost:5173, also reachable from a phone on the same Wi-Fi)
- `npm run build` writes the installable PWA to `dist/` (manifest + service worker + icons)
- Screen mockups for review live in `mockups/`

## Status
- Done: v0.1 (Today, Workout, Summary), v0.2 (History calendar, Chart.js progress charts, view/edit past sessions), Protein, Settings (accessories, increments, rest, JSON export/import with validation, 14-day backup reminder), PWA build
- Not done: GitHub Pages deploy, APK via Capacitor
- Not verified: offline mode / install on a real Android phone (needs HTTPS hosting; the preview pane blocks service workers)

## Deploy (GitHub Pages)
1. Create a GitHub repo, push this folder to the `main` branch (`node_modules` and `dist` are git-ignored).
2. Repo Settings → Pages → Source: **GitHub Actions**.
3. `.github/workflows/deploy.yml` runs `npm ci && npm run build` and publishes `dist/` on every push to `main`.
4. On Android open the Pages URL in Chrome → menu → "Install app". `base: './'` makes it work under the `/<repo>/` sub-path.
