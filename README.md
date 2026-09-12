# Low Stress Games

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

## Kiosk lock

A carer can lock a device to this site from the portal (lock icon, top
right of the homepage): set a 3-digit passcode, and the site goes
fullscreen. Exiting fullscreen by any means *other than clicking a link
inside the site* (Esc, switching tabs/apps, reopening the tab, a
bookmark) immediately shows a full passcode gate. This only guards
*leaving the site* — navigating freely between games and the home
screen while locked is never blocked, per the no-penalty rule above:

- Clicking "← Home" or a game card is a real exit from fullscreen too
  (browsers force that on any navigation), but it's expected free
  navigation, not a lock violation — no gate appears. Browsers also
  won't let a page force itself back into fullscreen without a fresh
  tap, so the destination page just shows a small "🔒 Locked" badge
  instead (skipped on the portal, which already shows its own lock
  icon) and quietly re-enters fullscreen the next time the child taps
  anything on the page.
- Any exit that *isn't* a same-site link click — Esc, switching
  apps/tabs, reopening the tab, a bookmark — shows the full passcode
  gate immediately.

Implementation notes:

- Lock state lives in `localStorage` (`ls_lock_enabled`, `ls_lock_code`)
  and is shared across the portal and every game page on the same
  origin/device. The "was this exit a same-site link click" signal is a
  short-lived flag in `sessionStorage` (`ls_lock_nav_grace`), armed
  right before navigating and consumed on the next page load.
- **Forgotten passcode:** a fixed master override code always unlocks
  regardless of the passcode set: `758243`, entered via "Forgot the
  passcode?" on the gate. Staff-only — don't share with children.
  Change it in `shared/lock.js` (`MASTER_CODE`) if it's ever
  compromised.
- `shared/lock.js` + `shared/lock.css` are the one deliberate exception
  to "games never import `/shared/`" (see Architecture decisions below):
  it's portal-owned safety enforcement, not game logic, and every game
  includes it unmodified via a single `<script>` tag.

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
  games — isolation over reuse. The one exception is `shared/lock.js`
  (see Kiosk lock above): portal-owned enforcement, included unmodified
  by every game, not game logic.
- **`/shared/` is portal-only** (homepage shell, game menu/registry,
  kiosk lock). It is never imported by games except for `lock.js`.
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
   (no imports from `/shared/` or other games).

Runtime behavior (exit button actually works, no console errors, game
usable on a throttled CPU) is manually checked before a game is added,
until/unless the project grows enough to justify automated browser tests.
