# Sudoku — dev notes

## Current state
Standard 9x9 sudoku. Setup screen picks a difficulty (Easy / Medium /
Hard / Very Hard); play screen shows the board, a 1-9 number pad, and
Erase. Tap a cell to select it (outlined), then tap a number to fill it
— same select-then-act interaction as colour-match's paint flow, chosen
for consistency and because it works identically on touch and mouse
without relying on a native `<input>` or keyboard.

Insane and Inhuman (the two hardest built-in tiers, 26 and 17 givens)
were deliberately left off the setup screen — they can take real
backtracking-search effort to solve and didn't seem like a good fit for
the 5-12 target age range. Easy to add later (just another entry in
`DIFFICULTIES` in script.js) if wanted.

## Puzzle generation
Uses a vendored copy of `robatron/sudoku.js` (MIT license, see
`vendor/sudoku.js`) rather than writing a generator/solver from
scratch — puzzle generation with a guaranteed-unique solution is a
solved problem. Picked over other options because it's a single ~27KB
dependency-free file (fits the project's "everything standalone, no
build step" rule via a plain `<script>` vendor include, same pattern as
`constellation-sky`'s vendored three.js), and its generator does real
constraint propagation plus forward/backward-solve uniqueness checking
rather than a naive "randomly punch holes and hope" approach.

`sudoku.generate(difficulty)` returns an 81-character given string
(`sudoku.BLANK_CHAR` for blanks); `sudoku.solve(board)` is called once
up front to get the full solution string, which is compared against
against player entries locally rather than re-invoking the solver on
every move.

## No fail state
Per the project's design rules, wrong entries are never blocked, reset,
or penalized — a player can type any digit into any non-given cell.
The only feedback is a small conflict marker (a plain outlined dot in
the cell's corner, not a colour change) when a value duplicates another
in its row, column, or 3x3 box — informational, not punitive, and kept
non-colour so it doesn't rely on colour vision (see README's "never
rely on colour alone" rule; same reasoning as colour-match's shape
glyphs). Completion is checked by comparing the full board to the
solution string; on an exact match it shows a plain "Solved. Nicely
done." status message — no confetti, animation, or sound, matching
colour-match's "Matched. Nicely done."

## Persistence
Settings (difficulty) and in-progress state (puzzle/solution/entries)
are saved to localStorage under `ls-sudoku-settings` / `ls-sudoku-state`
— same resume-on-reload pattern as colour-match: if saved state matches
current settings on load, the game goes straight to the play screen
instead of setup.

## Known limitations
- No thumbnail image yet (game.json references thumbnail.png, doesn't exist).
- Board cell size is a fixed CSS min/max range (28-44px per cell), not
  a JS-measured guaranteed-fit layout like colour-match's grids — a 9x9
  board is a fixed size (unlike colour-match's variable grid sizes), so
  a simpler CSS-only sizing approach was enough here. Revisit if very
  small viewports turn out to need it.
- No pencil-mark/notes mode (candidate numbers in a cell) — could be a
  future addition if players want it, but adds real UI complexity for
  a first version.
