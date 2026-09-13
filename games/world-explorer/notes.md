# World Explorer — dev notes

## Current state
Built with Three.js (WebGL), following the same architectural pattern as
[Constellation Sky](../constellation-sky/notes.md): one real globe, vendored
Three.js, no CDN, no build step. Two modes on one shared globe:
- **Explore** (default): tap any country or ocean to see its name.
- **Find-it** (quiz): the game names a place, the player rotates the globe
  and taps it. Correct/try-again feedback only — no score, no timer, no
  fail state, per this project's design rules.

## Data
`world-data.json` — 173 countries with real border polygons (lon/lat degree
pairs) plus a label centroid each, and 5 fixed ocean label positions.
Converted from `world-atlas@2`'s 110m-resolution `countries-110m.json`
(itself derived from Natural Earth, public domain), via `topojson-client`
to decode TopoJSON arcs into GeoJSON polygons. A few Natural-Earth-style
abbreviated/contested names were remapped to friendlier common names or
dropped entirely (Antarctica, uninhabited/disputed micro-entities like
N. Cyprus and Somaliland — not useful for a kids' geography quiz and
avoids wading into disputed-territory naming).

Coordinates rounded to 2 decimal places (~1km) — far more precision than
a low-poly globe at this zoom needs, keeps the file to ~150KB.

## Rendering
Countries are real filled meshes, not just outline points/lines (unlike
Constellation Sky's star points): each country's polygon ring(s) are
triangulated in lon/lat space via a vendored `earcut` (see below) and the
resulting triangles are lifted onto the sphere per-vertex. A thin
`THREE.Line` loop is drawn on top of each ring for crisp borders. This
means raycasting hits real mesh geometry directly — no manual
point-in-polygon math needed for click detection, unlike a points-only
approach.

Rings that cross the antimeridian (±180°) are split into separate pieces
before triangulation (`splitAtAntimeridian()`) — otherwise earcut's flat
lon/lat-plane triangulation would treat a huge span as a valid interior
and wrap a giant triangle around the globe. This is a simple threshold
split, not a geometrically exact antimeridian clip; fine at this zoom
level since no country in this dataset both truly spans >180° of
longitude and needs pixel-perfect seam accuracy.

**Post-triangulation subdivision (`subdivideTriangle()`)**: earcut's
ear-clipping routinely connects an interior diagonal between two ring
vertices that are close together along the boundary but far apart in
index order — e.g. the near-straight run of the US/Canada border along
49°N produces one earcut fan whose triangles span tens of degrees of
longitude even though every actual ring edge is short. Projected onto the
sphere, a triangle that large curves away from the flat chord earcut
assumed, which flips some of those triangles' effective winding/normal
direction. The visible symptom was large solid-blue gaps cutting through
otherwise-correct countries (the ocean sphere showing through) — first
found on the US, confirmed on every large country. `DoubleSide` material
was tried first and did *not* fix it (ruled out backface culling as the
cause); tightening the camera's near/far planes was also tried and also
had no effect (ruled out depth-buffer z-fighting). The actual fix:
recursively bisect any triangle whose *longest edge* exceeds
`MAX_SPAN_DEG` (1.5°), splitting only across that one long edge into two
triangles rather than a uniform 4-way quad split. Longest-edge bisection
was chosen over quad-subdivision after quad-subdivision was tried first
and produced ~580K triangles total (Russia alone 254K, and a uniform
split even blew up tiny/thin slivers like Fiji's antimeridian pieces to
tens of thousands of triangles for no visual benefit, since it subdivides
short edges too instead of targeting only the one long diagonal).
Longest-edge bisection cut that to ~99K triangles total (Russia ~20K,
Fiji back to a handful) while producing an identical gap-free result —
verified by locating and screenshotting the US, Fiji, and Russia
specifically (Russia as the largest/most complex case) after the change.

A faint lon/lat graticule (matches Constellation Sky's subtle-guide-line
aesthetic) sits just above a solid ocean-color base sphere.

Ocean labels are plain HTML overlays positioned every frame via
`THREE.Vector3.project()` against the camera — simpler than a
sprite/billboard mesh, and lets them use normal CSS text-shadow for
legibility over both water and land.

## Vendored dependencies
- `vendor/three/` — copied as-is from Constellation Sky's own vendored
  Three.js r158 + OrbitControls (per this project's standalone-per-game
  rule, copied rather than shared from `/shared/`).
- `vendor/earcut.js` — `earcut` v3.2.3 (ISC license) from npm, vendored as
  a single file. The npm package only ships a UMD build, no ES module
  build, so it's wrapped in a small ES-module shim. That shim needed a
  fix during testing: the UMD's own environment check
  (`typeof exports === "object" && typeof module !== "undefined"`) is
  what decides whether it writes to the passed-in `exports` object -- in
  a real browser ES module neither `exports` nor `module` exist as
  globals, so without a local `var module = { exports }` shadow inside
  the wrapper, the UMD silently fell through to its
  `globalThis.earcut = {}` branch instead and the import resolved to
  `undefined`. Caught by an actual headless-browser test (Node's
  `require`/`--input-type=module` eval quirks made it look fine there
  even before the fix) rather than assumed correct from the code alone.

## Interaction
Same click-vs-drag disambiguation as Constellation Sky
(`CLICK_DRAG_THRESHOLD`, pixel-movement based) so the same pointer both
orbits the camera and picks a country/ocean.

Explore mode: click selects a country (accent-color highlight) and shows
its name in a tooltip near the cursor; click again to deselect. Ocean
labels behave the same way via a screen-space distance hit-test against
the label element (since oceans have no mesh to raycast against).

Quiz mode: picks a random name from all countries (plus oceans, if the
"show oceans" toggle is on) and displays it in a banner with a persistent
"Skip" button (skipping is always available — never a required "give up"
penalty, just an easy way out matching this project's no-fail-state
rule). Tapping the right place shows "That's right!" and picks the next
target after a short pause; tapping the wrong place flashes it briefly
and shows "Try again" — no penalty, no counter, no timer.

The sidebar list (shared with Constellation Sky's constellation-list
pattern) lists every ocean and country alphabetically; clicking an entry
smoothly turns the camera to face it, using the same
"OrbitControls always looks at the origin" tween trick as Constellation
Sky's `locateConstellation()`.

## Known limitations
- No thumbnail image yet (game.json references thumbnail.png, doesn't
  exist).
- 110m-resolution borders are simplified/low-poly — fine at globe zoom,
  would look faceted if zoomed in much further (zoom is capped via
  `controls.minDistance` to avoid this).
- No disputed-territory nuance — a handful of contested regions
  (Western Sahara, Palestine, Kosovo as part of Serbia in this dataset)
  follow whatever Natural Earth's 110m dataset defaults to. Not treated
  as a settled political statement, just the upstream public-domain
  dataset's default cut, chosen for simplicity over a young-kids'
  geography game.
- Antarctica is excluded entirely (not useful for a countries/oceans
  quiz, and Natural Earth's polar projection there is awkward at this
  simplification level).
