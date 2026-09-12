# Constellation Sky — dev notes

## Current state
Built with Three.js (WebGL), replacing an earlier CSS/SVG-only prototype
after directly reverse-engineering neal.fun/constellation-draw's actual
JS bundles (fetched and read, not copied — see "How this was built"
below) to match its real architecture rather than guessing at it.

Scoped down for this project's no-accounts/no-saving/no-sharing/
no-location rules: draw-only, purely local, nothing leaves the device,
nothing persists beyond this browser's localStorage. No audio (the
reference plays synth chimes on every interaction by default; this
project's README explicitly bans "sudden loud audio", so chimes were
left out entirely rather than risk it — revisit as an opt-in,
muted-by-default toggle if ever wanted).

## Architecture (matches the reference)
One real star sphere, not two separate views. All ~300 stars are
`THREE.Points` on a sphere of fixed radius (`SPHERE_RADIUS = 100`).
"Flat sky" and "Globe" are the *same* sphere seen from two camera
distances, not two different scenes:
- Sky view: camera sits near the sphere's center (`radius * 0.01`),
  zoom disabled, `OrbitControls` restricted to near-zero
  min/maxDistance so dragging only *looks around* — the "standing
  under the sky" effect.
- Globe view: camera animates outward (`radius * 2.5`, `* 3.5` on
  mobile) with zoom + orbit enabled, so the same sphere now reads as a
  globe seen from outside.
- Toggling between them is a ~900ms eased camera-position + FOV tween
  (`animateCamera()`), not an instant cut — matches the reference's
  camera-tween approach exactly (they use 1200ms; 900ms felt right
  here, adjust freely).

Stars are rendered in one `THREE.Points` draw call with a custom GLSl
shader (radial glow + bright core, additive blending) rather than
plain dots — same visual approach as the reference. Point size comes
from a real magnitude-to-flux formula (`starPointSize()`), not a linear
guess, so brightness differences read naturally.

Connections use the `Line2`/`LineGeometry`/`LineMaterial` fat-line
addon (plain `THREE.Line` can't do line width) so they stay visibly
thicker than the default 1px `THREE.LineBasicMaterial` would allow.

## Interaction (matches the reference)
Click-vs-drag is disambiguated by a pixel-movement threshold
(`CLICK_DRAG_THRESHOLD`), not a separate gesture — this lets the same
pointer both orbit the camera (via OrbitControls) and pick a star,
exactly like the reference, rather than my earlier tap-only approach
which sidestepped the disambiguation problem entirely.

Click a star to select it (small highlight sphere appears), click a
second star to connect them (fades in as a `Line2` immediately — no
fade animation implemented yet, easy to add via opacity tween on
creation if wanted). Click an already-selected star again to
deselect. Click an existing connection **line itself** to delete it —
this matches the reference's actual behavior, which is different from
"tap the same two stars again" (that was my pre-reverse-engineering
guess and is no longer how it works).

Hovering a named star shows its name in a small tooltip
(`#star-info`), positioned near the cursor — mirrors the reference's
own `#star-info` element (same id, deliberately, since it's a faithful
recreation of the same UI role).

## Data
`sky-data.json` — 300 stars, RA stored in **hours** (0-24), not degrees
— converted from the original degree-based version to match the
reference's own RA/Dec-to-3D convention exactly:
```
ra = -RAhours/24 * 2π;  dec = Dec° * π/180
x = r·cos(dec)·cos(ra); y = r·sin(dec); z = r·cos(dec)·sin(ra)
```
35 stars are members of hand-picked named constellations (common names
+ connecting-line pairs identified by cross-referencing known real
star positions against the catalog's RA/Dec), the remaining ~265 are
just the next-brightest catalog entries by magnitude, included as
unnamed background stars. All are real stars with real positions —
nothing in this game is randomly generated.

Source: Yale Bright Star Catalog v5, released to the Public Domain,
converted to JSON by github.com/aduboisforge/Bright-Star-Catalog-JSON.
No attribution required by the license, credited here anyway as useful
provenance. Star IDs in sky-data.json are Harvard Reference Numbers
from that catalog. Constellation membership/line data is hand-authored
for this game (the source catalog only has positions, not constellation
shapes).

## Vendored Three.js
`vendor/three/` — Three.js r158 (ES module build) plus the
`OrbitControls`, `Line2`, `LineGeometry`, `LineMaterial`,
`LineSegments2`, `LineSegmentsGeometry` addon modules, vendored locally
(no CDN dependency, fully offline, no build step — loaded via a plain
`<script type="module">` tag).

Deliberately flat, not nested in `addons/controls/` + `addons/lines/`
subfolders like upstream ships them: this project's
`scripts/check-games.js` isolation check does naive string-matching on
`../` in import paths rather than resolving them, so nested addon-to-
addon relative imports (`../lines/LineSegments2.js`) trip a false
positive even though they never leave the game folder. Flattening the
folder so every internal import is a same-directory `./File.js`
sidesteps that without touching the shared checker script. If more
addons are ever vendored here, keep them flat for the same reason.

The 4 files that import the bare `'three'` specifier
(`OrbitControls.js`, `LineMaterial.js`, `LineSegmentsGeometry.js`,
`LineSegments2.js`) were hand-patched to `from './three.module.min.js'`
instead — deliberately avoiding a `<script type="importmap">`, since
import maps aren't supported before Safari 16.4 / Firefox 108 / Chrome
89, and this project's README explicitly targets "possibly outdated
browsers." A relative-path import works on any browser that supports
ES modules at all, which is a much lower bar.

## How this was built
The first version of this game was CSS/SVG-only (no WebGL), built from
guesses about how neal.fun's tool worked. The user preferred the real
thing's look/feel and asked for a Three.js version closer to the
original. Rather than guess a second time, I fetched neal.fun's actual
page HTML and JS bundles directly (the user pasted the fetched HTML;
I then pulled the linked `/_nuxt/*.js` chunks myself), beautified the
relevant one with js-beautify, and read through it to extract the
*architectural facts* above — one sphere/two camera distances, the
exact RA/Dec projection formula, the magnitude-to-size formula, the
click-vs-drag threshold, click-line-to-delete. No code or assets from
neal.fun were copied into this project — everything here is a fresh
implementation built from those facts, using this project's own data
(a different, public-domain star catalog) and its own UI code. The
downloaded reference bundles were deleted from the scratchpad once the
architectural read-through was done; they were never committed.

Confirmed-and-deliberately-excluded reference features: geolocation
("My Sky" / `locateNightSky`), save/share to their backend API
(`POST https://neal.fun/api/constellation-draw/save`), constellation
renaming, a color picker, and default-on audio chimes — all either
conflict with this project's rules (accounts/saving/sharing/location)
or its no-sudden-audio rule.

## Constellation sidebar
A right-side panel (collapsible via a "Constellations" header button,
for small screens) lists all 15 included constellations with a short,
one-line factual description each (real mythology/identity facts, not
invented trivia — Orion the hunter, Ursa Major containing the Big
Dipper, etc.). Clicking an entry highlights that constellation's guide
lines in the player's accent color (independent of the "Show
constellations" toggle — a highlighted entry stays visible even with
guides off) and smoothly turns/orbits the camera to center it. Clicking
the same entry again turns the highlight off.

All 15 constellations were expanded from single-star stubs to real
multi-star outlines for this feature (previously Lyra, Cygnus, Aquila,
Scorpius, Bootes, Virgo, Canis Major, and Piscis Austrinus were just
their one brightest named star, with no shape to highlight/locate) — 9
new real stars were added to sky-data.json, each identified by
searching the catalog for stars at the correct real RA/Dec position for
that constellation (not guessed from memory: an early attempt to recall
HR numbers directly produced one confirmed wrong ID, caught by
cross-checking declination against the real constellation's known sky
position before it was used).

Centering math: `OrbitControls` always calls `camera.lookAt(target)`
with `target` fixed at the origin, so "look toward point P" means
positioning the camera such that looking at the origin faces P. In
globe view (camera outside the sphere) that means moving the camera to
`normalize(P) * currentDistance` — same side as P. In sky view (camera
sits just inside the sphere, near the origin) it's the opposite sign,
`normalize(P) * -currentDistance`, since the camera has to be on the
far side of the origin from P for `lookAt(origin)` to end up facing
toward it. Getting this sign wrong was an actual bug during
development (sky-view locate pointed away from the target instead of
at it) caught by screenshotting the result rather than assuming the
same formula as the globe case would work for both.

## Ideas / open questions
- Only ~15 constellations included; several southern-hemisphere ones
  (Piscis Austrinus, Canis Major) use a partial outline since their
  full traditional shape pulls in stars outside the current ~309-star
  cut.
- No connection fade-in animation on creation (reference fades in over
  ~350ms). Cosmetic, easy to add later via an opacity tween in
  `makeLine()`.
- `pickRaycaster.params.Points.threshold` is a fixed world-unit value;
  since point size varies per-star in the vertex shader (magnitude-
  based), very faint/small stars may be slightly harder to click
  precisely than bright ones. Watch for this during real playtesting,
  especially on touch.
- No pinch-to-zoom tuning done beyond OrbitControls' defaults in globe
  view; sky view has zoom disabled entirely (matches reference).

## Known limitations
- No thumbnail image yet (game.json references thumbnail.png, doesn't exist).
- WebGL is required — there's a `<noscript>` fallback message for
  no-JS, but no fallback for a browser/device that has JS but lacks
  WebGL support (rare on real hardware from the last decade, but
  possible on very old/locked-down devices). Worth a "sorry, this
  needs WebGL" message if that ever turns out to matter in practice.
