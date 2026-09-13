# Colour Match — dev notes

## Current state
Two-screen flow (#setup-screen / #play-screen, toggled by JS, mutually
exclusive via `hidden`) — this replaced an earlier one-screen layout
where Settings, "Match this", and "Your grid" all sat in one row with
equal visual weight and no indication of what to do first. Splitting
setup from play gives a clear sequence: configure -> Play -> game.

Setup screen: title, intro line, Settings controls, and a single
prominent "Play" button. This is what loads first (unless resuming,
see below). Play screen: a toolbar (top) with a "☰ Menu" button that
opens a left-aligned slide-in drawer (`#menu-drawer` + `#menu-backdrop`)
containing the same settings controls as the setup screen (grid size,
colour count, pattern, picture), and a "? How to play" button that
toggles the numbered how-to-play strip ("1 Look at Match this. 2 Pick a
colour below. 3 Tap squares in Your grid.") — collapsed/hidden by
default so it doesn't take up permanent space once a player already
knows the flow, shown via `toggleHowToPlay()` — and a "New pattern"
button, all three in one `.play-toolbar` row. Then `#play-area-wrap`:
the two grids side by side ("Match this" / "Your grid") PLUS the
colour palette (no visible "Pick a colour" label any more — just the
bare swatches; `aria-label="Colour palette"` on `.palette-panel`
still covers accessibility) — then status text. The two grids NEVER
stack relative to EACH OTHER via wrapping — `.game-row` is
`flex-wrap: nowrap` always; side-by-side vs stacked is still a
deliberate JS decision (`.game-row--stacked`), not incidental
wrapping (see "Fit-to-viewport" section below for why).

"New pattern" means different things per mode, handled in
`startNewPattern()`: in Random mode, `randomPattern()` already re-rolls
every tile independently each call, so calling it again is enough. In
Picture mode, `picturePattern()` is deterministic for a given
`settings.picture`/`gridSize` — calling it again alone would just
redraw the exact same picture — so `startNewPattern()` first calls
`pickNewPicture()`, which reassigns `settings.picture` to a random
OTHER picture (excluding the current one, when more than one exists)
and persists it via `saveSettings()`, before regenerating the target.

Palette placement is a FIXED breakpoint (`MOBILE_BREAKPOINT = 500`px
viewport width, in script.js), unlike every other measurement in this
file which scales continuously from real measured space — deliberately
different here because a vertical palette squeezed next to grids that
have already stacked on a narrow phone is genuinely cramped and harder
to tap, and there's no sensible "half vertical" state to scale through
the way cell/swatch size can shrink continuously. Above the breakpoint,
the palette is a vertical column of swatches to the right of the grids
(`.palette-panel`, sized against the grids' height budget); below it,
`isMobileLayout()` (checked fresh on every `layoutGrids()` call,
including on resize) adds `.play-area-wrap--mobile`, which switches
`#play-area-wrap` to a column so the palette drops below the grids as
a horizontal row (`.play-area-wrap--mobile .palette`), sized against
width the way it always was before the vertical-palette change. Which
branch is active also changes which budget (height vs width) the
palette's own footprint gets subtracted from in `layoutGrids()` — see
the `mobile` branch there.

Toggling the how-to-play strip calls `layoutGrids()` since the strip's
height feeds into that function's chrome measurement — same reasoning
as every other piece of play-screen chrome. `.play-screen--compact`
(the extreme-viewport fallback, see "Guaranteed-fit layout" below) now
force-hides the strip regardless of its own toggle state, same as
before.

Unlike the setup screen (settings take effect on next Play), changing
a setting in the in-play menu drawer takes effect immediately —
`updateSetting()` calls `startNewPattern()` right away whenever
`#play-screen` is visible, since there's a real grid on screen for the
player to see react. The drawer and setup screen render into separate
DOM ids (`menu-*` prefix vs unprefixed) but share one rendering
function, `renderSettingsControls(ids)`, parameterised by which set of
element ids to fill — added specifically to avoid duplicating the
segmented-control building logic across the two surfaces.

Gotcha hit while building this: `.screen`/`.settings-row` both set
`display: flex`, which — being an author-stylesheet rule — beats the
UA stylesheet's `[hidden] { display: none }`, so toggling the `hidden`
attribute alone did NOT actually hide those elements (confirmed via a
Playwright check: `hidden` was true but computed `display` was still
`flex`). Fixed with explicit `.screen[hidden] { display: none }` and
`.settings-row[hidden] { display: none }` rules. Any future element
that both gets `hidden` toggled AND has its own `display` rule needs
the same `[hidden]` override — the UA default does not "win" just
because `hidden` is a boolean attribute.

Grid size (3x3 up to 14x14 — see GRID_SIZES), number of colours (2-6,
Random mode only — see COLOUR_COUNTS), and pattern mode (Random /
Picture) are configurable on the setup screen. Settings persist in
localStorage separately from in-progress grid state; changing a
setting takes effect on next Play, not immediately (no live-updating
grid behind the setup form).

Resuming: on load, if saved in-progress grid state matches the current
saved settings, the game goes straight to the play screen (skips
setup) so reloading mid-game doesn't lose your place. Otherwise it
lands on setup.

Select a colour from the palette row, then tap grid squares to paint
them that colour (select-then-paint, not cycle-on-tap), OR press and
drag across multiple squares to paint all of them in one gesture — see
"Drag-to-paint" below. Eraser swatch (checkerboard) resets a tile to
empty. Match a shown target. Untimed, no score.

Picture mode: ten built-in shapes (sun, moon, house, flower, cat, dog,
butterfly, fish, mushroom, umbrella), each hand-authored SEPARATELY per
grid size (3/4/5/6/8/10/12/14 — every entry in GRID_SIZES) in
PICTURES[name].grids — not scaled from one master grid. Earlier version
downsampled a single 5x5 grid via nearest-neighbour for smaller sizes,
but that turned recognizable shapes (heart, tree) into unrecognizable
blobs at 3x3 — a straight line or single off pixel at 5x5 can vanish
or dominate when naively resampled to 3x3. Hand-tuning per size fixes
it; keep doing this for any new picture rather than re-adding a scaler.
Each picture declares its own colours; the playable palette always
includes exactly what the current target needs (eraser + those
colours), regardless of the colour-count setting — that setting only
affects Random mode. No photo upload — built-in set only, keeps it
offline and predictable.

The original set (heart, star, house, tree, sun, fish, flower, boat)
only existed at 3/4/5 — when grid sizes grew up to 14x14, hand-drawing
all of them at 8 sizes each wasn't practical, so the set was redesigned
around 10 subjects (dropped heart/star/tree/boat, kept/redid
house/sun/fish/flower, added cat/dog/butterfly/mushroom/moon/umbrella)
and generated with small per-picture Python builder functions (ellipse/
triangle/taper primitives) rather than typed out by hand — this made it
practical to iterate quickly on a contact-sheet render (all pictures x
all sizes rendered to one PNG, see the design scratch dir from that
session) and re-tune whichever shapes read poorly before copying the
final grid strings into script.js. The generator script itself was not
kept in the repo — only its output (the grid literals) — since
PICTURES is meant to stay hand-editable data, not generated at runtime.

Small sizes (3x3/4x4) are inherently abstract for shapes with fine
detail (sun rays, a moon's crescent bite, a cat's ears) — there just
aren't enough pixels to disambiguate "sun" from a generic dot pattern
at 3x3. This mirrors a limit already accepted in the original set
(3x3 sun was already just a corner+centre dot pattern) — sizes 6x6 and
up are where every picture becomes clearly recognizable. Don't chase
perfect legibility at 3x3/4x4 for detailed subjects; it's a genuine
resolution floor, not a bug.

Two new palette colours were added for this expansion — sand (warm
gold, cross-shaped glyph) and rose (dusty mauve, star-shaped glyph) —
alongside the original sage/clay/sky/plum, bringing COLOUR_COUNTS up to
2-6 and PALETTE to 6 playable colours. Picked to stay in the same
muted, non-primary family as the rest of the palette (see the PALETTE
comment for the "why" on avoiding saturated red/green).

Styling mirrors the homepage's design language (Nunito/Baloo 2, warm
cream background, rounded cards, soft shadows) via copy/pasted values,
per the standalone-game convention. Segmented-control style reused for
settings buttons. `.panel` is the shared card style for all three
row items.

## Responsive / desktop space usage
First pass at the two-screen layout stayed mobile-sized on desktop —
everything centred in one narrow ~360-420px card floating in a lot of
empty background. Fixed by:
- Grid cells were originally sized via a `clamp()` ceiling (64px, then
  100px) shared between `.cell` in CSS and script.js's inline
  `grid-template-columns`/`rows` — cells were barely growing past phone
  size on desktop. This whole approach (and the "keep both in sync"
  problem it created) was later replaced entirely by a JS-measured
  layout with no CSS clamp() involved — see "Guaranteed-fit layout"
  below for the current system and why it changed.
- `.screen` max-width raised to 1360px (was 1000px, briefly) so two
  5x5 grids at the larger cell size can sit side by side without
  wrapping — a 5x5 grid at ~100px cells is ~530px wide alone, so two
  side by side plus gap needs close to 1100px+ before padding.
- Setup screen: settings rows wrap in a `.settings-groups` div that
  goes row-wise (3 columns: Grid size / Number of colours / Pattern)
  above a 720px breakpoint, with the Picture row (5 buttons) spanning
  full width below when visible (`flex-basis: 100%`). Below 720px it's
  the original stacked single column.

Two bugs hit while doing this, both worth remembering for future CSS
here:
1. `.screen[hidden]` / `.settings-row[hidden]` needed explicit
   `display: none` rules — seed note below still applies, keep it.
2. The `.settings-groups` media-query override set `flex-wrap`,
   `align-items`, `justify-content` etc. for the row-wise layout but
   never re-declared `flex-direction: row` — so the base rule's
   `flex-direction: column` kept winning and all three "columns"
   rendered stacked directly on top of each other (same `left`
   coordinate, confirmed via a Playwright `getBoundingClientRect`
   check) even though `display: flex` and `flex: 1 1 0` looked
   correct in devtools. Lesson: a media-query override of a flex
   container must restate every flex-container property it changes,
   not just the ones that look new — an unset property silently falls
   through to the base rule, not to the CSS default.

## Guaranteed-fit layout (no scrollbars, no overlap, at any grid size)
Superseded an earlier clamp()/vw-based approach (see git history) that
could only approximate fit and still had a horizontal-scroll fallback
for when the approximation failed — once grid sizes went up to 3-14
(not just 3-5), that approach produced real overflow and overlap bugs
on small/short viewports, so it was replaced with layout that actually
MEASURES available space in JS and computes an exact-fit cell size,
rather than guessing from viewport units and hoping.

Core idea (`layoutGrids()` in script.js, called from `render()` and
`showPlayScreen()`, and on every `resize` while the play screen is
visible): measure the real space left for the two grids after every
other piece of chrome, decide side-by-side vs stacked from that real
number, and set an exact pixel cell size (and gap) so both panels are
guaranteed to fit with no scrollbar and no overlap.

- **Measuring the budget**: `heightBudget` = `.game-area`'s content
  height minus the actual rendered height of every OTHER direct child
  of `#play-screen` (how-to-play strip, menu button,
  palette, status text, new-pattern button) plus the gaps between them
  — all read live via `getBoundingClientRect()`/`getComputedStyle()`,
  not hand-tallied constants, so it stays correct if any of that chrome
  changes size (e.g. palette gaining a row when colour count goes up).
  `widthBudget` is `#game-row-wrap`'s measured width. `measurePanelChrome()`
  separately measures one `.panel`'s own padding/border/label footprint
  (needed twice: once per panel for width, since each panel has its own
  chrome).
- **Side-by-side vs stacked**: `computeCellSize()` (side-by-side) and
  `computeStackedCellSize()` (stacked, one panel per row) each solve
  for the largest cell size that fits their orientation, given the
  budgets and chrome above. `layoutGrids()` picks side-by-side if it
  clears `MIN_INTERACTIVE_CELL` (30px, a comfortable-tap PREFERENCE,
  not a hard floor — see below); otherwise it picks whichever
  orientation yields the larger cell. If NEITHER fits at a positive
  size (an extremely tight viewport), stacked always wins as the last
  resort — side-by-side needs a panel's chrome width TWICE (once per
  panel) plus a row gap, so it's structurally more width-hungry and
  degrades worse than stacked ever does.
- **Floors are preferences, not guarantees**: earlier versions floored
  the applied cell size up to a minimum (44px/28px) regardless of the
  measured budget — which is exactly backwards: a floor-clamped size
  can be BIGGER than what was actually measured to fit, guaranteeing
  overflow instead of preventing it. Floors here only ever influence
  which orientation gets chosen; the actual applied size is always
  `Math.max(1, Math.min(160, computed))` — capped at 160px so cells
  don't balloon to absurd sizes on an ultrawide monitor with a 3x3
  grid, floored at 1px only as an absolute last resort.
- **Cell gap also shrinks on large grids**: at 14 columns, 13 gaps of
  the preferred 8px alone is 104px — more than the entire remaining
  budget can be on a small phone, even before any cell width is
  counted. `gapForCell()` scales the gap down toward 1px
  (`MIN_CELL_GAP`) proportionally to the chosen cell size, and
  `computeCellSize`/`computeStackedCellSize` each re-solve cell size
  once more for that adjusted gap (two passes; converges close enough
  for a function that already re-runs on every resize).
- **Correction pass**: the budget is computed from sibling sizes
  measured BEFORE this render's DOM changes are applied (e.g. changing
  colour count or picture can change how many rows the palette wraps
  to), so the first-pass applied size can occasionally leave
  `.game-area` still overflowing by a few px once the browser actually
  lays out the new DOM. `layoutGrids()` re-measures
  `gameArea.scrollHeight/Width` vs `clientHeight/Width` after applying,
  and if still overflowing, shrinks the cell size directly by however
  many px are over (divided across the grid's rows), looping (bounded
  to 6 iterations) since a 1px-per-row shrink can itself leave a
  residual px or two from rounding.
- **Last-resort chrome compaction**: on a genuinely extreme viewport
  (e.g. a 600x400 landscape phone), even 1px cells aren't enough
  because the surrounding CHROME itself (how-to-play strip + buttons +
  palette + status) is taller than the space left after the header —
  shrinking grid cells can't fix that, since the grids aren't the
  problem. In that case `layoutGrids()` adds `.play-screen--compact` to
  `#play-screen` (hides the how-to-play strip, shrinks the
  menu/new-pattern buttons and status text — see the
  `.play-screen--compact` rules in style.css) and redoes the entire
  layout computation once more (guarded by an `isRetry` parameter so
  this can only escalate one level, never loop). Compact mode is
  re-evaluated fresh on every top-level call, so resizing back to a
  normal-size viewport drops back out of it automatically. This is
  intentionally a coarse, infrequent fallback, not finely tuned — it
  only matters on unusually extreme viewports.
- **`.game-area` is `justify-content: flex-start`**, not `center` or
  `safe center`. `safe center` was tried first (its whole purpose is
  falling back to start-alignment when content is taller than the
  container) but was observed to still push content off the TOP of the
  viewport on a 600x400 test case rather than falling back as
  documented — top-alignment sidesteps that failure mode
  unconditionally: whatever doesn't fit is guaranteed visible from the
  top down, never centered content spilling off both edges.
  `overflow: auto` on `.game-area` remains as a last-resort safety net
  for that same extreme case, not something expected to trigger in
  normal use.
- **No more horizontal-scroll fallback**: the old `.game-row`
  `overflow-x: auto` + fade-mask + "↔" scroll hint (for when a grid was
  too wide for a narrow phone) is gone entirely — since layout now
  measures and guarantees fit up front, there should never be a case
  that needs it. `.game-row` just toggles `flex-direction` via
  `.game-row--stacked` (plain class, no more scrollable-content
  detection needed).
- **`applyCellSize()`** sets `grid-template-columns`/`rows` AND `gap`
  directly as inline px values on the grid element — cell sizing is
  now 100% JS-driven with no CSS clamp()/vw involved at all. `.cell` in
  style.css is just `width: 100%; height: 100%` (fills its grid
  track).

If you add new play-screen chrome (another button, a longer
how-to-play, etc.), `layoutGrids()`'s live measurement means it should
just work without retuning constants — but it's still worth manually
checking fit at short viewports (~400-600px tall), since more chrome
eats into the same budget the grids need.

### Bugs hit after shipping the measured layout (worth remembering)
Two real "small on a big screen" bugs surfaced from a user screenshot
at 10x10 / 6 colours on a large desktop viewport — grids were tiny
with huge unused space around them, contradicting the whole point of
measuring available space:

1. **`.screen` still had a leftover `max-width: 1360px`** from the old
   fixed-cell-size design (tuned for two 5x5 grids at ~100px cells).
   `layoutGrids()` was measuring correctly, but the box it was given to
   measure had already been artificially capped well below the actual
   viewport width on large screens — the measurement was accurate, the
   INPUT to it was wrong. Removed entirely; the setup screen's
   `.settings-panel` has its own max-width so this didn't affect it.
2. **Palette swatch sizing was circular.** `sizePalette()` originally
   measured `palette.parentElement.getBoundingClientRect().width` to
   decide swatch size — but that parent (`<div aria-label="Colour
   palette">`) has no explicit width and shrinks to fit ITS content,
   which is the palette itself. So swatch size was being computed from
   a box whose size only existed because of the swatches — on first
   layout (swatches still small/unset) this measured a tiny width and
   collapsed everything to `MIN_SWATCH_SIZE` or below, which cascaded
   into the grid cells collapsing to ~2px (a much smaller footprint
   than they needed, since the correction-pass logic reads real
   overflow, not "did the palette look reasonable"). Fixed by measuring
   against `#game-area`'s content box instead — a box whose size does
   NOT depend on the palette, so no circularity. General lesson: when
   sizing an element X based on "how much space is available", always
   measure against an ancestor whose size is independent of X, never an
   immediate wrapper that hugs X's own content.
3. Relatedly, `sizePalette()` originally only optimized for width
   ("fit all swatches on one row"), so on a short phone screen it would
   pick `MAX_SWATCH_SIZE` (56px) even when that swatch row was a bigger
   share of a small height budget than it needed to be, sometimes
   tipping the layout into needing compact mode (hiding the how-to-play
   strip) to fit a grid that would otherwise fit fine at a slightly
   smaller palette. Added a height-based scale factor
   (`SHORT_SCREEN_HEIGHT`) that shrinks the palette toward
   `MIN_SWATCH_SIZE` on short screens even when width would allow
   bigger — a modest improvement, not a full fix (compact mode still
   triggers in some of these cases, which is an accepted, deliberately
   coarse fallback rather than something to keep tuning constants
   against).
4. `layoutGrids()` also now bails out early if `#play-screen` is
   `hidden` — the very first `render()` call in `init()`/`startGame()`
   happens before `showPlayScreen()` has made the screen visible, so
   every measurement in that call is 0. Computing against all-zero
   measurements could wrongly conclude nothing fits and flip on compact
   mode for no reason; `showPlayScreen()` always calls `layoutGrids()`
   again once the screen is actually visible, so skipping the hidden
   call loses nothing.

## Drag-to-paint
Pressing on a tile in "Your grid" and dragging across others paints
every tile the pointer passes over with the active colour — implemented
with pointer events (`pointerdown`/`pointermove`/`pointerup`/
`pointercancel`), which unify mouse, touch, and pen so there's one
code path instead of separate mouse/touch handlers.

Mechanics (`initPlayerGridDragPaint()` in script.js, attached once to
the `#player-grid` container, not per-cell — cells get recreated every
render() but the container element persists):
- `pointerdown` on a cell starts painting, calls
  `grid.setPointerCapture(e.pointerId)`, and paints that first cell.
  Pointer capture is what makes drag-off-the-original-element work at
  all: without it, `pointermove` targets whatever element is currently
  under the pointer and you'd need per-cell listeners; WITH capture,
  every move event during the gesture fires on `grid` regardless of
  where the pointer physically is, so there's one listener for the
  whole drag.
- Because capture routes events to `grid` not the cell under the
  pointer, `pointermove` can't rely on `e.target` to know which cell
  is being dragged over — it uses
  `document.elementFromPoint(e.clientX, e.clientY).closest(".cell")`
  instead to find the real cell at the pointer's current screen
  position.
- `lastPaintedIndex` dedupes repeated paints of the same cell while
  the pointer lingers over it (pointermove fires continuously) — only
  paints again once the pointer has moved to a DIFFERENT cell.
  Repainting the same tile every move event would still be harmless
  (paintTile is idempotent) but would mean pointless re-renders and
  re-writes to localStorage on every pixel of movement.
- Old click-based painting was removed (the `<button>` click listener
  per cell) in favour of routing single taps through the same
  pointerdown→paint path — a tap is just a drag that never moves, so
  one code path covers both without double-painting.
- `touch-action: none` on `.cell` stops the browser's own touch
  scroll/pan gesture from competing with the paint drag — without it,
  a finger-drag across the grid tries to scroll the page instead of
  just painting.
- `e.preventDefault()` on pointerdown/pointermove is a second layer of
  the same protection (some browsers still initiate things like
  text-selection or drag-to-refresh without it even with
  touch-action set).

Verified via Playwright: a mouse-drag sequence (`page.mouse.down` /
`.move` / `.up`) across three cells painted all three; a real
multi-touch-style drag via CDP's `Input.dispatchTouchEvent`
(Playwright's built-in `touchscreen` API only supports tap, not drag,
so CDP was used directly to simulate an actual touch-drag) also
painted all three cells AND confirmed `window.scrollY` stayed at 0
throughout — page did not scroll during the gesture.

## Ideas / open questions
- Palette: sage / clay / sky / plum / sand / rose (6, as of the
  size/picture expansion — see above). Revisit if kids find it hard to
  tell apart — could add a subtle pattern/texture per colour instead of
  relying on hue alone.
- "Nicely done" text on match — maybe too plain, maybe fine. Avoid
  anything that reads as a reward loop (no confetti, no sound sting).
- More built-in pictures could still be added to PICTURES in script.js
  (10 currently: sun, moon, house, flower, cat, dog, butterfly, fish,
  mushroom, umbrella) — each needs a hand-authored grid per size (every
  entry in GRID_SIZES, currently 3/4/5/6/8/10/12/14), not just one
  master grid (see note above on why downsampling was dropped).
- Photo upload (pixelate + quantize a user photo) was considered but
  deferred — built-in set is simpler and fully offline.
- Cell size on large grids (10x10+) can drop well under the 44px touch
  target on small phones — the layout guarantees fit, not tap comfort,
  above the 30px `MIN_INTERACTIVE_CELL` preference (see
  "Guaranteed-fit layout" above). Worth watching for feedback on
  whether large grids are hard to tap accurately on small phones; a
  future option could be capping the *interactive* grid at a smaller
  max than the *picture library* supports, if that turns out to matter
  more than the extra challenge is worth.

## Known limitations
- No thumbnail image yet (game.json references thumbnail.png, doesn't exist).
