// Standalone: do not import from /shared/ or other game folders.

// Breathing patterns. Durations in seconds, in phase order.
const PATTERNS = [
  {
    id: "calm",
    name: "Calm",
    sub: "In 4 · Out 6",
    phases: [
      { kind: "in", seconds: 4 },
      { kind: "out", seconds: 6 },
    ],
  },
  {
    id: "square",
    name: "Square",
    sub: "In 4 · Hold 4 · Out 4 · Hold 4",
    phases: [
      { kind: "in", seconds: 4 },
      { kind: "hold", seconds: 4 },
      { kind: "out", seconds: 4 },
      { kind: "rest", seconds: 4 },
    ],
  },
  {
    id: "sleepy",
    name: "Sleepy",
    sub: "In 4 · Hold 7 · Out 8",
    phases: [
      { kind: "in", seconds: 4 },
      { kind: "hold", seconds: 7 },
      { kind: "out", seconds: 8 },
    ],
  },
];

// Announced to screen readers only. There is no on-screen equivalent —
// the pond is the visual cue.
const PHASE_WORDS = {
  in: "Breathe in",
  hold: "Hold",
  out: "Breathe out",
  rest: "Rest",
};

// Short forms for the on-screen cue above the frog.
const CUE_WORDS = {
  in: "In",
  hold: "Hold",
  out: "Out",
  rest: "Rest",
};

// Each scene is a different place with the same breathing mechanic: the
// exhale pushes that world outward. `emit` is what the animal actually
// breathes out; `drift` seeds whatever the gust displaces.
const SCENES = [
  { id: "frog", name: "Pond", svg: "scene-frog" },
  { id: "whale", name: "Ocean", svg: "scene-whale" },
  { id: "fox", name: "Snow", svg: "scene-fox" },
];

const STORAGE_KEY = "breathing-frog-settings";

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!PATTERNS.some((p) => p.id === parsed.patternId)) return null;
    const sceneId = SCENES.some((s) => s.id === parsed.sceneId)
      ? parsed.sceneId
      : SCENES[0].id;
    return { patternId: parsed.patternId, sound: parsed.sound === true, sceneId };
  } catch {
    return null;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        patternId: state.patternId,
        sound: state.sound,
        sceneId: state.sceneId,
      })
    );
  } catch {
    // Private browsing or full storage: settings just won't persist.
  }
}

const saved = loadSettings();

const state = {
  patternId: saved ? saved.patternId : "calm",
  sound: saved ? saved.sound : false,
  sceneId: saved ? saved.sceneId : SCENES[0].id,
  running: false,
  paused: false,
  phaseIndex: 0,
  phaseElapsed: 0,
  lastFrame: 0,
  rafId: null,
};

const el = {
  setupScreen: document.getElementById("setup-screen"),
  playScreen: document.getElementById("play-screen"),
  playBtn: document.getElementById("play-btn"),
  pauseBtn: document.getElementById("pause-btn"),
  patternOptions: document.getElementById("pattern-options"),
  soundOptions: document.getElementById("sound-options"),
  menuPatternOptions: document.getElementById("menu-pattern-options"),
  menuSoundOptions: document.getElementById("menu-sound-options"),
  menuBtn: document.getElementById("menu-btn"),
  sceneBtn: document.getElementById("scene-btn"),
  sceneOptions: document.getElementById("scene-options"),
  menuSceneOptions: document.getElementById("menu-scene-options"),
  menuDrawer: document.getElementById("menu-drawer"),
  menuBackdrop: document.getElementById("menu-backdrop"),
  menuCloseBtn: document.getElementById("menu-close-btn"),
  status: document.getElementById("status"),
  cueWord: document.getElementById("breath-cue-word"),
  cueCount: document.getElementById("breath-cue-count"),
  pond: document.getElementById("pond"),
  driftLayer: document.getElementById("drift-layer"),
  mistLayer: document.getElementById("mist-layer"),
  fireflies: document.getElementById("fireflies"),
  eyes: [document.getElementById("eye-left"), document.getElementById("eye-right")],
};

const SVG_NS = "http://www.w3.org/2000/svg";
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

// Old/donated hardware is the design target, so the scene thins itself
// out rather than dropping frames. deviceMemory is absent on Safari and
// Firefox, in which case we assume the better case.
const lowPower =
  (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
  (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

function currentPattern() {
  return PATTERNS.find((p) => p.id === state.patternId) || PATTERNS[0];
}

function currentPhase() {
  const phases = currentPattern().phases;
  return phases[state.phaseIndex % phases.length];
}

/* ---------- Sound ---------- */

let audioCtx = null;

function ensureAudio() {
  if (!state.sound) return null;
  if (audioCtx === null) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playTone(frequency) {
  const ctx = ensureAudio();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const now = ctx.currentTime;

  osc.type = "sine";
  osc.frequency.value = frequency;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
  gain.gain.linearRampToValueAtTime(0, now + 0.7);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.75);
}

const PHASE_TONES = { in: 396, hold: 440, out: 297, rest: 330 };

/* ---------- Scene contents ----------
   Every scene follows the same rule: the exhale displaces things, and
   the animal emits something. Only the material changes. */

function layer(kind) {
  return document.getElementById(`${kind}-layer-${state.sceneId}`)
    || document.getElementById(`${kind}-layer`);
}

// Petals on the pond. Displaced by the gust, never consumed.
function buildPondDrifters(count) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    const x = fromLeft ? 40 + Math.random() * 260 : 500 + Math.random() * 260;
    const y = 312 + Math.random() * 170;
    const scale = 0.6 + Math.random() * 0.8;

    const petal = document.createElementNS(SVG_NS, "ellipse");
    petal.setAttribute("class", "drifter");
    petal.setAttribute("cx", x.toFixed(1));
    petal.setAttribute("cy", y.toFixed(1));
    petal.setAttribute("rx", (7 * scale).toFixed(1));
    petal.setAttribute("ry", (3.4 * scale).toFixed(1));
    petal.setAttribute("fill", Math.random() > 0.5 ? "#f6dfe6" : "#fbeccd");

    const dir = fromLeft ? -1 : 1;
    petal.style.setProperty("--push-x", `${(dir * (50 + Math.random() * 90)).toFixed(0)}px`);
    petal.style.setProperty("--push-y", `${(-10 - Math.random() * 26).toFixed(0)}px`);
    petal.style.setProperty("--spin", `${(Math.random() * 90 - 45).toFixed(0)}deg`);
    nodes.push(petal);
  }
  return nodes;
}

// Plankton motes suspended in the water column.
function buildPlankton(count) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = i % 2 === 0;
    const x = fromLeft ? 20 + Math.random() * 240 : 520 + Math.random() * 250;
    const y = 60 + Math.random() * 400;

    const mote = document.createElementNS(SVG_NS, "circle");
    mote.setAttribute("class", "drifter");
    mote.setAttribute("cx", x.toFixed(1));
    mote.setAttribute("cy", y.toFixed(1));
    mote.setAttribute("r", (1.6 + Math.random() * 3).toFixed(1));
    mote.setAttribute("fill", "#dff2fa");

    const dir = fromLeft ? -1 : 1;
    mote.style.setProperty("--push-x", `${(dir * (40 + Math.random() * 90)).toFixed(0)}px`);
    mote.style.setProperty("--push-y", `${(-20 - Math.random() * 50).toFixed(0)}px`);
    mote.style.setProperty("--spin", "0deg");
    nodes.push(mote);
  }
  return nodes;
}

// Falling snow. Two nested groups: the outer is blown by the gust, the
// inner runs the fall animation — one element cannot do both on the
// same transform property.
function buildSnow(count) {
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const gust = document.createElementNS(SVG_NS, "g");
    gust.setAttribute("class", "snow-gust");
    const dir = i % 2 === 0 ? -1 : 1;
    gust.style.setProperty("--push-x", `${(dir * (60 + Math.random() * 120)).toFixed(0)}px`);

    const fall = document.createElementNS(SVG_NS, "g");
    fall.setAttribute("class", "snow-fall");
    fall.style.setProperty("--dur", `${(9 + Math.random() * 9).toFixed(1)}s`);
    fall.style.setProperty("--delay", `${(-Math.random() * 14).toFixed(1)}s`);

    const flake = document.createElementNS(SVG_NS, "circle");
    flake.setAttribute("class", "snowflake");
    flake.setAttribute("cx", (20 + Math.random() * 760).toFixed(1));
    flake.setAttribute("cy", (40 + Math.random() * 200).toFixed(1));
    flake.setAttribute("r", (1.4 + Math.random() * 2.6).toFixed(1));

    fall.appendChild(flake);
    gust.appendChild(fall);
    nodes.push(gust);
  }
  return nodes;
}

function buildDrifters() {
  const target = layer("drift");
  if (!target) return;

  const many = !lowPower;
  if (state.sceneId === "whale") {
    target.replaceChildren(...buildPlankton(many ? 22 : 11));
  } else if (state.sceneId === "fox") {
    target.replaceChildren(...buildSnow(many ? 26 : 12));
  } else {
    target.replaceChildren(...buildPondDrifters(many ? 14 : 7));
  }
}

// Mist is the one thing genuinely emitted by the breath: puffs are born
// at the frog's mouth on each exhale and drift away. Self-removing.
// Staggered across the first part of the phase so the breath streams out
// rather than appearing as a single burst at the phase boundary.
function puffMist() {
  if (reducedMotion.matches) return;

  const count = lowPower ? 3 : 6;
  const spacing = (currentPhase().seconds * 1000 * 0.45) / count;

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      if (state.running && !state.paused) emitPuff();
    }, i * spacing);
  }
}

// What each animal actually breathes out. All three are self-removing
// and are born at that animal's mouth (or blowhole).
const EMITTERS = {
  frog: () => {
    // Pushed sideways out over open water: against the frog's own body a
    // pale puff has no contrast and reads as a smudge.
    const dir = Math.random() > 0.5 ? 1 : -1;
    return {
      cls: "mist-puff",
      cx: 400 + dir * (4 + Math.random() * 10),
      cy: 336 + Math.random() * 8,
      r: 14 + Math.random() * 12,
      fill: "url(#mistPuff)",
      mx: dir * (150 + Math.random() * 170),
      my: 10 + Math.random() * 40,
      dur: 2.6 + Math.random() * 1.8,
    };
  },
  whale: () => ({
    // Bubbles leave the blowhole and rise toward the surface.
    cls: "bubble",
    cx: 336 + (Math.random() * 16 - 8),
    cy: 236 + Math.random() * 6,
    r: 5 + Math.random() * 11,
    fill: "url(#bubbleFill)",
    mx: Math.random() * 70 - 35,
    my: -(220 + Math.random() * 190),
    dur: 3 + Math.random() * 2.2,
  }),
  fox: () => {
    // Frost-breath leaves the muzzle, which faces left.
    const spread = Math.random() * 40 - 20;
    return {
      cls: "mist-puff",
      cx: 240 + Math.random() * 10,
      cy: 356 + Math.random() * 8,
      r: 11 + Math.random() * 11,
      fill: "url(#frostPuff)",
      mx: -(120 + Math.random() * 150),
      my: -30 + spread,
      dur: 2.4 + Math.random() * 1.8,
    };
  },
};

function emitPuff() {
  const target = layer("mist");
  const make = EMITTERS[state.sceneId];
  if (!target || !make) return;

  const spec = make();
  const puff = document.createElementNS(SVG_NS, "circle");
  puff.setAttribute("class", spec.cls);
  puff.setAttribute("cx", spec.cx.toFixed(1));
  puff.setAttribute("cy", spec.cy.toFixed(1));
  puff.setAttribute("r", spec.r.toFixed(1));
  puff.setAttribute("fill", spec.fill);

  puff.style.setProperty("--mx", `${spec.mx.toFixed(0)}px`);
  puff.style.setProperty("--my", `${spec.my.toFixed(0)}px`);
  puff.style.setProperty("--dur", `${spec.dur.toFixed(1)}s`);

  puff.addEventListener("animationend", () => puff.remove());
  setTimeout(() => puff.remove(), 8000);

  target.appendChild(puff);
}

function buildFireflies() {
  if (reducedMotion.matches) {
    el.fireflies.replaceChildren();
    return;
  }

  const count = lowPower ? 5 : 10;
  const flies = [];

  for (let i = 0; i < count; i++) {
    const fly = document.createElement("span");
    fly.className = "firefly";

    // Kept out of the centre column so they never crawl across the frog.
    const x = i % 2 === 0 ? 3 + Math.random() * 26 : 71 + Math.random() * 26;

    fly.style.setProperty("--x", `${x.toFixed(1)}%`);
    fly.style.setProperty("--y", `${(6 + Math.random() * 62).toFixed(1)}%`);
    fly.style.setProperty("--size", `${(5 + Math.random() * 5).toFixed(1)}px`);
    fly.style.setProperty("--glow", (0.5 + Math.random() * 0.45).toFixed(2));
    fly.style.setProperty("--dx", `${(Math.random() * 60 - 30).toFixed(0)}px`);
    fly.style.setProperty("--dy", `${(Math.random() * 70 - 45).toFixed(0)}px`);
    fly.style.setProperty("--dur", `${(14 + Math.random() * 12).toFixed(1)}s`);
    fly.style.setProperty("--delay", `${(-Math.random() * 20).toFixed(1)}s`);

    flies.push(fly);
  }

  el.fireflies.replaceChildren(...flies);
}

let blinkTimer = null;

function scheduleBlink() {
  clearTimeout(blinkTimer);
  blinkTimer = setTimeout(() => {
    const depth = parseFloat(
      getComputedStyle(el.playScreen).getPropertyValue("--breath")
    );
    if (!reducedMotion.matches && !state.paused && depth < 0.55) {
      for (const eye of el.eyes) eye.classList.add("frog-eye--blink");
      setTimeout(() => {
        for (const eye of el.eyes) eye.classList.remove("frog-eye--blink");
      }, 140);
    }
    scheduleBlink();
  }, 3200 + Math.random() * 5200);
}

/* ---------- Breath ---------- */

function easeInOut(t) {
  return 0.5 - Math.cos(Math.PI * t) / 2;
}

// How full the frog is, 0..1.
function breathDepth(phase, progress) {
  if (phase.kind === "in") return easeInOut(progress);
  if (phase.kind === "out") return 1 - easeInOut(progress);
  if (phase.kind === "hold") return 1;
  return 0;
}

// How hard the breath is pushing the pond outward, 0..1. Only the
// out-breath generates gust; it peaks early and tails off, the way a
// real exhale does, so the scene surges and then settles rather than
// tracking a symmetrical curve.
function gustStrength(phase, progress) {
  if (phase.kind !== "out") return 0;
  return Math.sin(Math.PI * Math.min(progress * 1.15, 1)) ** 0.7;
}

function render() {
  const phase = currentPhase();
  const progress = Math.min(state.phaseElapsed / phase.seconds, 1);

  const depth = reducedMotion.matches ? 0.5 : breathDepth(phase, progress);
  const gust = reducedMotion.matches ? 0 : gustStrength(phase, progress);

  el.playScreen.style.setProperty("--breath", depth.toFixed(4));
  el.playScreen.style.setProperty("--gust", gust.toFixed(4));

  // Counts down whole seconds remaining in the phase, so it reads
  // "In 4, 3, 2, 1" rather than counting up toward a target.
  const remaining = Math.max(1, Math.ceil(phase.seconds - state.phaseElapsed));
  el.cueWord.textContent = CUE_WORDS[phase.kind];
  el.cueCount.textContent = String(remaining);
}

function advancePhase() {
  const phases = currentPattern().phases;
  state.phaseIndex = (state.phaseIndex + 1) % phases.length;
  state.phaseElapsed = 0;

  const phase = currentPhase();
  if (state.sound) playTone(PHASE_TONES[phase.kind]);
  if (phase.kind === "out") puffMist();

  el.status.textContent = PHASE_WORDS[phase.kind];
}

function tick(timestamp) {
  if (!state.running || state.paused) return;

  if (state.lastFrame === 0) state.lastFrame = timestamp;
  const delta = Math.min((timestamp - state.lastFrame) / 1000, 0.25);
  state.lastFrame = timestamp;

  state.phaseElapsed += delta;
  if (state.phaseElapsed >= currentPhase().seconds) advancePhase();

  render();
  state.rafId = requestAnimationFrame(tick);
}

function startLoop() {
  cancelAnimationFrame(state.rafId);
  state.lastFrame = 0;
  state.rafId = requestAnimationFrame(tick);
}

function startBreathing() {
  state.running = true;
  state.paused = false;
  state.phaseIndex = 0;
  state.phaseElapsed = 0;

  el.pauseBtn.textContent = "Pause";
  el.status.textContent = PHASE_WORDS[currentPhase().kind];

  render();
  startLoop();
}

function setPaused(paused) {
  state.paused = paused;
  el.pauseBtn.textContent = paused ? "Resume" : "Pause";

  if (paused) {
    cancelAnimationFrame(state.rafId);
    el.status.textContent = "Paused";
  } else {
    el.status.textContent = PHASE_WORDS[currentPhase().kind];
    startLoop();
  }
}

/* ---------- Settings controls ---------- */

function buildPatternOptions(container) {
  container.replaceChildren();

  for (const pattern of PATTERNS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.setAttribute("aria-pressed", String(pattern.id === state.patternId));
    btn.innerHTML = `<span>${pattern.name}</span><span class="seg-sub">${pattern.sub}</span>`;

    btn.addEventListener("click", () => {
      state.patternId = pattern.id;
      saveSettings();
      syncControls();

      if (state.running) {
        state.phaseIndex = 0;
        state.phaseElapsed = 0;
        render();
      }
    });

    container.appendChild(btn);
  }
}

function buildSoundOptions(container) {
  container.replaceChildren();

  for (const option of [
    { label: "Off", value: false },
    { label: "Soft tone", value: true },
  ]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.textContent = option.label;
    btn.setAttribute("aria-pressed", String(option.value === state.sound));

    btn.addEventListener("click", () => {
      state.sound = option.value;
      saveSettings();
      syncControls();
      if (state.sound) playTone(PHASE_TONES.in);
    });

    container.appendChild(btn);
  }
}

function buildSceneOptions(container) {
  container.replaceChildren();

  for (const scene of SCENES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seg-btn";
    btn.textContent = scene.name;
    btn.setAttribute("aria-pressed", String(scene.id === state.sceneId));

    btn.addEventListener("click", () => {
      // Before play starts there is nothing to cross-fade from.
      showScene(scene.id, { fade: state.running });
    });

    container.appendChild(btn);
  }
}

function syncControls() {
  for (const container of [el.sceneOptions, el.menuSceneOptions]) {
    const buttons = container.querySelectorAll(".seg-btn");
    SCENES.forEach((scene, i) => {
      if (buttons[i]) {
        buttons[i].setAttribute("aria-pressed", String(scene.id === state.sceneId));
      }
    });
  }

  for (const container of [el.patternOptions, el.menuPatternOptions]) {
    const buttons = container.querySelectorAll(".seg-btn");
    PATTERNS.forEach((pattern, i) => {
      if (buttons[i]) {
        buttons[i].setAttribute(
          "aria-pressed",
          String(pattern.id === state.patternId)
        );
      }
    });
  }

  for (const container of [el.soundOptions, el.menuSoundOptions]) {
    const buttons = container.querySelectorAll(".seg-btn");
    if (buttons[0]) buttons[0].setAttribute("aria-pressed", String(!state.sound));
    if (buttons[1]) buttons[1].setAttribute("aria-pressed", String(state.sound));
  }
}

/* ---------- Menu drawer ---------- */

function openMenu() {
  el.menuBackdrop.hidden = false;
  el.menuDrawer.hidden = false;
  el.menuBtn.setAttribute("aria-expanded", "true");

  requestAnimationFrame(() => {
    el.menuBackdrop.classList.add("menu-backdrop--visible");
    el.menuDrawer.classList.add("menu-drawer--open");
  });

  el.menuCloseBtn.focus();
}

function closeMenu() {
  el.menuBackdrop.classList.remove("menu-backdrop--visible");
  el.menuDrawer.classList.remove("menu-drawer--open");
  el.menuBtn.setAttribute("aria-expanded", "false");

  const finish = () => {
    el.menuBackdrop.hidden = true;
    el.menuDrawer.hidden = true;
  };

  if (reducedMotion.matches) finish();
  else setTimeout(finish, 220);

  el.menuBtn.focus();
}

/* ---------- Scene switching ----------
   Deliberately touches nothing in `state` except sceneId: phaseIndex,
   phaseElapsed and the rAF loop are all left alone, so changing place
   mid-breath keeps the rhythm and the counter exactly where they were. */

function currentScene() {
  return SCENES.find((s) => s.id === state.sceneId) || SCENES[0];
}

function showScene(id, { fade = true } = {}) {
  const next = SCENES.find((s) => s.id === id);
  if (!next) return;

  // Resolve the outgoing scene BEFORE reassigning sceneId, or both refs
  // point at the incoming one and the cross-fade never runs.
  const prevEl = document.getElementById(currentScene().svg);
  const nextEl = document.getElementById(next.svg);
  state.sceneId = next.id;

  const reveal = () => {
    // SVG elements do not implement the `hidden` IDL property, so
    // `node.hidden = false` leaves the attribute in place and the scene
    // stays display:none. The attribute has to be removed explicitly.
    for (const s of SCENES) {
      const node = document.getElementById(s.svg);
      if (!node) continue;
      if (s.id === next.id) node.removeAttribute("hidden");
      else node.setAttribute("hidden", "");
    }
    nextEl.classList.add("scene--fading");
    // Fireflies belong to the pond only.
    el.fireflies.hidden = next.id !== "frog";
    fitScene();
    buildDrifters();
    requestAnimationFrame(() => nextEl.classList.remove("scene--fading"));
  };

  if (!fade || reducedMotion.matches || !prevEl || prevEl === nextEl) {
    reveal();
  } else {
    prevEl.classList.add("scene--fading");
    setTimeout(reveal, 220);
  }

  syncControls();
  saveSettings();
}

function nextScene() {
  const i = SCENES.findIndex((s) => s.id === state.sceneId);
  showScene(SCENES[(i + 1) % SCENES.length].id);
}

/* ---------- Layout ---------- */

// preserveAspectRatio="slice" fills the screen but crops hard on a tall
// phone, cutting away the reeds and side pads that give the pond its
// depth. Widening the viewBox on portrait screens keeps the full scene
// in frame instead of zooming into the frog.
function fitScene() {
  const ratio = window.innerWidth / window.innerHeight;

  let box;
  if (ratio < 0.85) {
    // Tall: extend the viewBox vertically so more of the scene shows
    // rather than the sides being sliced off.
    box = "60 -120 680 740";
  } else if (ratio < 1.3) {
    box = "20 -40 760 600";
  } else {
    box = "0 0 800 500";
  }

  for (const s of SCENES) {
    const node = document.getElementById(s.svg);
    if (node) node.setAttribute("viewBox", box);
  }
}

/* ---------- Wiring ---------- */

buildSceneOptions(el.sceneOptions);
buildSceneOptions(el.menuSceneOptions);
buildPatternOptions(el.patternOptions);
buildPatternOptions(el.menuPatternOptions);
buildSoundOptions(el.soundOptions);
buildSoundOptions(el.menuSoundOptions);
syncControls();

el.playBtn.addEventListener("click", () => {
  el.setupScreen.hidden = true;
  el.playScreen.hidden = false;
  showScene(state.sceneId, { fade: false });
  buildFireflies();
  scheduleBlink();
  startBreathing();
});

el.pauseBtn.addEventListener("click", () => setPaused(!state.paused));

el.sceneBtn.addEventListener("click", nextScene);

el.menuBtn.addEventListener("click", () => {
  if (el.menuDrawer.hidden) openMenu();
  else closeMenu();
});

el.menuCloseBtn.addEventListener("click", closeMenu);
el.menuBackdrop.addEventListener("click", closeMenu);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !el.menuDrawer.hidden) closeMenu();
});

window.addEventListener("resize", fitScene);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.running && !state.paused) setPaused(true);
});

reducedMotion.addEventListener("change", () => {
  render();
  buildFireflies();
});
