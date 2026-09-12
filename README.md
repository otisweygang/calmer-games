# Calmer Games

## Mission

Free, low-stimulus games for children in care homes — no accounts, no
addictive mechanics, no cost. Kids in care often have limited or no access
to calm, non-exploitative games. This exists to fix that.

## Design rules (games must NOT have)

- Timers, countdowns, or fail states
- Streaks, daily logins, or "come back or lose progress" mechanics
- Leaderboards or score comparison
- Random/variable-reward loops (loot-box style mechanics)
- Sudden loud audio or flashing visuals

Every game must be exitable back to the homepage at any time, with no
penalty and no confirmation trap.

## Architecture decisions

- **Fully static site.** No backend, no server, no build step to deploy.
  Simplicity, offline-friendliness, and reliability over features.
- **No accounts, no user data collection.** Removes safeguarding/compliance
  risk and removes the addictive pull of accounts/profiles.
- **localStorage only**, and only for resuming in-progress state (e.g.
  puzzle piece positions). Never for streaks, achievements, or anything
  that creates a reason to return.
- **Every game is fully standalone.** A game folder is self-contained
  (its own HTML/CSS/JS) and imports nothing from other games or from
  `/shared/`. Copy-paste small snippets rather than share code across
  games — isolation over reuse.
- **`/shared/` is portal-only** (homepage shell, game menu/registry). It
  is never imported by games.
- **Navigation is full-page**, not iframe or SPA injection. Clicking a game
  loads its own page directly. No iframe performance tax, no shared JS
  runtime between portal and games.
- **TypeScript is optional per-game**, compiled ahead of time to plain JS
  before shipping. The deployed site is always plain JS — no runtime build
  step required to run a game.
- **Target hardware: worst-case.** Old/donated devices, ~2GB RAM,
  integrated graphics, possibly outdated browsers. Every game must run
  acceptably on this floor.
- **Scale target: 100–1000 concurrent users.** Trivial for static hosting;
  the real constraint this project optimizes for is long-term
  maintainability as more games are added, not traffic.

## Accessibility

Target age range: 5-12. Simple, not childish — respect their intelligence.

- Icon-first navigation; don't rely on reading ability alone
- Large touch targets (44px+ minimum)
- Never rely on color alone to convey meaning
- Respect `prefers-reduced-motion`
- No condescending praise animations or baby-ish visuals

## Initial games (v1 scope)

Starting with two, built and scoped individually in later sessions:

1. A colour/puzzle-type game
2. A basic maths-type game

## Enforcement

Each game folder must pass automated checks before merge:

1. `game.json` exists with required fields (title, description, entry
   file, thumbnail).
2. Entry HTML contains a required exit element (`id="ls-exit"`).
3. No file in the game folder references a path outside that folder
   (no imports from `/shared/` or other games), except the required
   exit link.

Runtime behavior (exit button actually works, no console errors, game
usable on a throttled CPU) is manually checked before a game is added,
until/unless the project grows enough to justify automated browser tests.
