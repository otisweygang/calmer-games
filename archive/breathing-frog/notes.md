# Notes — Breathing Frog

## What this game is for

Teaching paced breathing to 5-12 year olds without asking them to read
instructions, watch a number, or follow an adult's voice.

## The central rule: this must not be a visual timer

The first version of this game failed. It had a countdown ("Breathe in ·
3"), a progress bar, and a phase label, with a frog animated above them.
That is a clock with art on top — a child watching it is reading a
countdown, not breathing. Polishing the art does not fix it, because
**scaling a shape is the visual grammar of a progress indicator.**

The rebuild removes all of it: there is no countdown, no bar, no phase
word, and no on-screen text at all beyond the Exit and Menu buttons.

**Instead, the breath moves the world.** The exhale physically blows the
pond outward:

- petals and seeds on the water are pushed away from the frog
- surface rings spread out from where he sits
- reeds on both banks bend away from him
- mist streams from his mouth out over the water
- the lily pad tilts, the reflection breaks up

The child watches the *consequence* of the breath, and the pond is the
cue. A `--gust` custom property carries exhale strength separately from
`--breath` depth, so the out-breath can surge and settle asymmetrically
rather than just reversing the inhale curve.

## Three places, one mechanic

Each scene is a separate `<svg>` in the same box, shown one at a time:

| Place | Animal | Breath signal | Emits | Gust displaces |
|---|---|---|---|---|
| Pond | Frog | count above him | mist | petals, rings, reeds, lily |
| Ocean | Whale | throat pleats stretch | bubbles rising | plankton, kelp, light shafts, fin |
| Snow | Fox | ribcage lifts | frost breath | falling snow, pine boughs, tail |

**Switching must never restart the breath.** `showScene()` touches
nothing in `state` except `sceneId` — `phaseIndex`, `phaseElapsed` and
the rAF loop are all left alone, so changing place mid-inhale keeps the
count exactly where it was and the counter stays put on screen. Verified
by switching scenes and watching the cue run In 4 → 3 → 2 → 1 across
three switches.

The emitter and drifter material is per-scene (`EMITTERS`,
`buildDrifters`), but the breath curve, gust curve and easing are shared
— so the rhythm is identical wherever the child is.

**Gotcha worth remembering:** SVG elements do not implement the `hidden`
IDL property. `svg.hidden = false` silently leaves the attribute in
place and the scene stays `display: none`. It has to be
`removeAttribute("hidden")`. This cost a blank-scene bug.

## Frog anatomy

**The body does not inflate.** A real frog holds its body still and
inflates only its vocal sac. Scaling the whole animal reads as a balloon
— and as a progress bar.

An inflating gold throat sac was tried and **cut**. However it was
anchored it either expanded through the mouth (reading as a ball being
pushed out of his face) or drifted down into his chest and read as a
belly. It was also simply ugly. The frog now has no inflating part at
all: he lifts and settles slightly, his eyes narrow, and the count above
him plus the moving pond carry the breath.

The lesson generalises — the two later scenes use stretching throat
pleats (whale) and a lifting ribcage (fox), both of which are small
vertical changes *within* a fixed silhouette rather than a part that
balloons outward.

## The counter

A single line above the animal: the phase word and the seconds
remaining, counting down ("In 4, 3, 2, 1" then "Out 6, 5…"). It sits in
the sky with a soft halo rather than a solid chip, is `aria-hidden` so
screen readers get one clean phase announcement from `#status` instead
of per-second chatter, and is positioned as a percentage of the pond so
it stays clear of the animal's head at every viewBox the layout uses.

## Scene

One SVG, layered back to front: sky and sun, far hills, far reeds, water
with bands, breath rings, drifting petals, back pads, frog and lily,
mist, near reeds, foreground pads. Layers move by different amounts
against `--breath`/`--gust` for parallax depth.

`fitScene()` widens the viewBox on portrait and short-landscape screens.
`preserveAspectRatio="slice"` alone crops hard on a phone and throws away
the reeds and side pads that give the scene its depth — so sky and water
rects are drawn well outside the default viewBox to cover the wider
framings without exposing bare background.

## Other decisions

- **No session length, breath count, or completion.** A "10 breaths
  done!" counter turns self-regulation into a performance to optimise.
- **Patterns named by feeling** (Calm / Square / Sleepy), numbers as
  subtitles.
- **Sine easing** on the breath; a linear breath snaps at the turn.
- **Reduced motion**: the scene holds a mid-breath pose, gust is pinned
  to 0, mist and fireflies are suppressed — but `#status` keeps
  announcing each phase, so the actual guidance survives.
- **Screen readers** get phase changes via a visually-hidden live region
  only. No per-second countdown chatter.
- **Low-power devices** (`deviceMemory <= 2` or `hardwareConcurrency <=
  2`) get roughly half the petals, mist puffs and fireflies. The project
  targets donated hardware, so the scene thins rather than drops frames.

## Deliberately not done

- No microphone breath detection — safeguarding risk, and it would give
  breathing a pass/fail.
- No accumulation of scene elements over time; that edges toward a
  progress/reward loop.
- No tap-to-collect on the petals. They are displaced, never consumed.

## Possible later work

- Tap-to-breathe as an alternative mode (Sesame's "Breathe, Think, Do"
  lets the child drive the breath by tapping rather than following it).
- Day passing dawn → dusk across many breaths, as an ambient variation.
