// Standalone: do not import from /shared/ or other game folders.
//
// Adapted from a public-domain-style Pong clone (see ../../ideas/retro-ping-pong-game
// for the original reference source). The original was already close to this
// project's rules performance-wise (a handful of canvas fills/arcs per
// frame, nothing expensive) but broke them on design: a WINNING_SCORE of 10
// with a "Left/Right Player Won" screen that gated the game behind a click
// to continue. This version removes the win condition entirely - the ball
// just keeps resetting and play continues indefinitely - and makes score
// an optional running tally (off by default, toggleable from the menu),
// never a comparison with a winner. Also: requestAnimationFrame instead of
// a fixed setInterval, touch support, a responsive canvas, and a real menu
// instead of a debug fps counter baked into the corner of the table.

const SETTINGS_KEY = "ls-ping-pong-settings";

const PADDLE_THICKNESS = 12;
const PADDLE_HEIGHT_RATIO = 0.18; // relative to table height, so it scales
const BALL_RADIUS_RATIO = 0.014;
const BASE_SPEED_RATIO = 0.45; // table-widths per second, horizontal
const COMPUTER_SPEED_RATIO = 0.34; // table-heights per second the CPU paddle can move, at 1x difficulty

// Multipliers on COMPUTER_SPEED_RATIO. "Normal" is the original tuning;
// Slower/Faster just scale it, so relative feel stays the same across
// screen sizes exactly like the base ratio does.
const DIFFICULTIES = [
  { value: "slower", label: "Slower", multiplier: 0.65 },
  { value: "normal", label: "Normal", multiplier: 1 },
  { value: "faster", label: "Faster", multiplier: 1.4 },
];

const els = {
  scoreBar: document.getElementById("score-bar"),
  scoreYou: document.getElementById("score-value-you"),
  scoreCpu: document.getElementById("score-value-cpu"),
  boardWrap: document.getElementById("board-wrap"),
  canvas: document.getElementById("board-canvas"),
  menuBtn: document.getElementById("menu-btn"),
  menuBackdrop: document.getElementById("menu-backdrop"),
  menuDrawer: document.getElementById("menu-drawer"),
  menuCloseBtn: document.getElementById("menu-close-btn"),
};

const ctx = els.canvas.getContext("2d");

// ---------- Settings ----------

function defaultSettings() {
  return { showScore: false, difficulty: "normal" };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    const base = defaultSettings();
    if (!DIFFICULTIES.some((d) => d.value === parsed.difficulty)) {
      parsed.difficulty = base.difficulty;
    }
    return { ...base, ...parsed };
  } catch (e) {
    return defaultSettings();
  }
}

function difficultyMultiplier() {
  const found = DIFFICULTIES.find((d) => d.value === settings.difficulty);
  return found ? found.multiplier : 1;
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // storage unavailable, setting just won't persist
  }
}

let settings = loadSettings();

// ---------- Table / sizing ----------
// Sizes are computed from the canvas's own pixel dimensions each resize,
// so paddle/ball/speed all scale together rather than being tuned for one
// fixed resolution like the original.

let W = 0,
  H = 0,
  paddleHeight = 0,
  ballRadius = 0,
  baseSpeed = 0,
  computerSpeed = 0;

function sizeCanvas() {
  const availW = Math.min(window.innerWidth - 32, 760);
  const availH = window.innerHeight - 120 - 70;
  W = Math.max(280, Math.floor(availW));
  H = Math.max(200, Math.floor(Math.min(availH, W * 0.62)));

  els.canvas.width = W;
  els.canvas.height = H;

  paddleHeight = H * PADDLE_HEIGHT_RATIO;
  ballRadius = Math.max(6, W * BALL_RADIUS_RATIO);
  baseSpeed = W * BASE_SPEED_RATIO;
  applyDifficulty();
}

// Recomputes computerSpeed from the table's current size and the selected
// difficulty. Called on resize (via sizeCanvas) and immediately when the
// difficulty setting changes, so a mid-game change takes effect on the
// very next frame rather than waiting for a resize.
function applyDifficulty() {
  computerSpeed = H * COMPUTER_SPEED_RATIO * difficultyMultiplier();
}

// ---------- Game state ----------
// No score is persisted across sessions - it's only ever this session's
// running rally tally, and there is no fail state or win condition to
// reach: the ball simply resets to centre and play continues.

let paddleYou = 0;
let paddleCpu = 0;
let ball = { x: 0, y: 0, vx: 0, vy: 0 };
let scoreYou = 0;
let scoreCpu = 0;
let pointerY = 0;

function resetBall(direction) {
  ball.x = W / 2;
  ball.y = H / 2;
  const angle = (Math.random() - 0.5) * 0.6; // slight random angle each serve
  ball.vx = direction * baseSpeed * Math.cos(angle);
  ball.vy = baseSpeed * Math.sin(angle) * 0.7;
}

function resetPositions() {
  paddleYou = H / 2;
  paddleCpu = H / 2;
  pointerY = H / 2;
  resetBall(Math.random() < 0.5 ? 1 : -1);
}

// ---------- Input ----------

function setPointer(clientY) {
  const rect = els.canvas.getBoundingClientRect();
  pointerY = clientY - rect.top;
}

els.canvas.addEventListener("mousemove", (e) => setPointer(e.clientY));
els.canvas.addEventListener(
  "touchmove",
  (e) => {
    if (e.touches.length > 0) {
      setPointer(e.touches[0].clientY);
      e.preventDefault();
    }
  },
  { passive: false }
);
els.canvas.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length > 0) setPointer(e.touches[0].clientY);
  },
  { passive: true }
);

// ---------- Update ----------

function updatePaddles(dt) {
  // Player paddle follows the pointer directly, clamped to the table -
  // no acceleration curve needed, this is the whole interaction.
  const half = paddleHeight / 2;
  paddleYou += (pointerY - paddleYou) * Math.min(1, dt * 12);
  paddleYou = Math.max(half, Math.min(H - half, paddleYou));

  // CPU eases toward the ball but is deliberately capped slower than the
  // ball's horizontal speed, so it doesn't play a perfect, oppressive
  // game - missing occasionally just resets the ball, no cost to anyone.
  const targetY = ball.y;
  const maxStep = computerSpeed * dt;
  const delta = targetY - paddleCpu;
  paddleCpu += Math.max(-maxStep, Math.min(maxStep, delta));
  paddleCpu = Math.max(half, Math.min(H - half, paddleCpu));
}

function updateBall(dt) {
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.y < ballRadius) {
    ball.y = ballRadius;
    ball.vy = -ball.vy;
  } else if (ball.y > H - ballRadius) {
    ball.y = H - ballRadius;
    ball.vy = -ball.vy;
  }

  const half = paddleHeight / 2;

  // Left paddle (you)
  if (
    ball.vx < 0 &&
    ball.x - ballRadius < PADDLE_THICKNESS &&
    ball.y > paddleYou - half &&
    ball.y < paddleYou + half
  ) {
    ball.x = PADDLE_THICKNESS + ballRadius;
    ball.vx = -ball.vx;
    const rel = (ball.y - paddleYou) / half;
    ball.vy = rel * baseSpeed * 0.6;
  } else if (ball.x < 0) {
    scoreCpu++;
    updateScoreDisplay();
    resetBall(1);
    return;
  }

  // Right paddle (CPU)
  if (
    ball.vx > 0 &&
    ball.x + ballRadius > W - PADDLE_THICKNESS &&
    ball.y > paddleCpu - half &&
    ball.y < paddleCpu + half
  ) {
    ball.x = W - PADDLE_THICKNESS - ballRadius;
    ball.vx = -ball.vx;
    const rel = (ball.y - paddleCpu) / half;
    ball.vy = rel * baseSpeed * 0.6;
  } else if (ball.x > W) {
    scoreYou++;
    updateScoreDisplay();
    resetBall(-1);
  }
}

function updateScoreDisplay() {
  els.scoreYou.textContent = String(scoreYou);
  els.scoreCpu.textContent = String(scoreCpu);
}

// ---------- Render ----------

function drawNet() {
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  const dashH = H / 22;
  for (let y = 0; y < H; y += dashH * 2) {
    ctx.fillRect(W / 2 - 1, y, 2, dashH);
  }
}

function drawPaddle(x, y) {
  const half = paddleHeight / 2;
  ctx.fillStyle = "#ffffff";
  const r = 4;
  ctx.beginPath();
  ctx.moveTo(x, y - half + r);
  ctx.arcTo(x + PADDLE_THICKNESS, y - half, x + PADDLE_THICKNESS, y - half + r, r);
  ctx.arcTo(x + PADDLE_THICKNESS, y + half, x + PADDLE_THICKNESS - r, y + half, r);
  ctx.arcTo(x, y + half, x, y + half - r, r);
  ctx.arcTo(x, y - half, x + r, y - half, r);
  ctx.closePath();
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawNet();

  drawPaddle(0, paddleYou);
  drawPaddle(W - PADDLE_THICKNESS, paddleCpu);

  ctx.fillStyle = "#7bd3c0";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Loop ----------

let lastTime = null;

function loop(now) {
  if (lastTime === null) lastTime = now;
  const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp to avoid a big jump after a tab switch
  lastTime = now;

  updatePaddles(dt);
  updateBall(dt);
  render();

  requestAnimationFrame(loop);
}

// ---------- Difficulty setting ----------

function renderDifficultyToggle() {
  const container = document.getElementById("difficulty-toggle-options");
  container.innerHTML = "";
  DIFFICULTIES.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segment";
    btn.textContent = opt.label;
    if (opt.value === settings.difficulty) btn.classList.add("segment-active");
    btn.setAttribute("aria-pressed", String(opt.value === settings.difficulty));
    btn.addEventListener("click", () => {
      settings.difficulty = opt.value;
      saveSettings();
      applyDifficulty();
      renderDifficultyToggle();
    });
    container.appendChild(btn);
  });
}

// ---------- Score visibility setting ----------

function renderScoreToggle() {
  const container = document.getElementById("score-toggle-options");
  container.innerHTML = "";
  [
    { value: true, label: "On" },
    { value: false, label: "Off" },
  ].forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segment";
    btn.textContent = opt.label;
    if (opt.value === settings.showScore) btn.classList.add("segment-active");
    btn.setAttribute("aria-pressed", String(opt.value === settings.showScore));
    btn.addEventListener("click", () => {
      settings.showScore = opt.value;
      saveSettings();
      applyScoreVisibility();
      renderScoreToggle();
    });
    container.appendChild(btn);
  });
}

function applyScoreVisibility() {
  els.scoreBar.hidden = !settings.showScore;
}

// ---------- Menu drawer ----------

function openMenuDrawer() {
  renderDifficultyToggle();
  renderScoreToggle();
  els.menuDrawer.hidden = false;
  els.menuBackdrop.hidden = false;
  void els.menuDrawer.offsetWidth;
  els.menuDrawer.classList.add("menu-drawer--open");
  els.menuBackdrop.classList.add("menu-backdrop--visible");
  els.menuBtn.setAttribute("aria-expanded", "true");
}

function closeMenuDrawer() {
  els.menuDrawer.classList.remove("menu-drawer--open");
  els.menuBackdrop.classList.remove("menu-backdrop--visible");
  els.menuBtn.setAttribute("aria-expanded", "false");
  window.setTimeout(() => {
    els.menuDrawer.hidden = true;
    els.menuBackdrop.hidden = true;
  }, 220);
}

// ---------- Init ----------

function init() {
  sizeCanvas();
  resetPositions();
  applyScoreVisibility();
  updateScoreDisplay();
  requestAnimationFrame(loop);

  els.menuBtn.addEventListener("click", openMenuDrawer);
  els.menuCloseBtn.addEventListener("click", closeMenuDrawer);
  els.menuBackdrop.addEventListener("click", closeMenuDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.menuDrawer.classList.contains("menu-drawer--open")) {
      closeMenuDrawer();
    }
  });

  window.addEventListener("resize", () => {
    const prevW = W,
      prevH = H;
    sizeCanvas();
    // Rescale positions proportionally instead of snapping to a corner.
    if (prevW > 0 && prevH > 0) {
      paddleYou = (paddleYou / prevH) * H;
      paddleCpu = (paddleCpu / prevH) * H;
      ball.x = (ball.x / prevW) * W;
      ball.y = (ball.y / prevH) * H;
    }
  });
}

init();
