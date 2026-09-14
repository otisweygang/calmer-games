// Standalone: do not import from /shared/ or other game folders.
//
// Adapted from a public-domain-style Tetris clone (see ../../ideas/tetris-game
// for the original reference source). Rebuilt rather than copied in, because
// the original violated this project's rules: an exponential level-based
// speed-up (the classic Tetris "pressure" mechanic), a hard GAME OVER fail
// screen, a persisted cross-session high score, and keyboard-only input.
// This version drops at one constant, comfortable speed forever, treats a
// full board as "time to reset" rather than "you lost", keeps score as an
// optional running count with no persisted best, and adds on-screen touch
// controls alongside the keyboard.

const COLS = 10;
const ROWS = 20;
const DROP_MS = 650; // constant fall speed - no levels, no speed-up

const SETTINGS_KEY = "ls-tetris-settings";
const STATE_KEY = "ls-tetris-state";

const COLORS = {
  I: "#41e0c9",
  O: "#ffe833",
  T: "#a03eff",
  S: "#6aff33",
  Z: "#ff3353",
  L: "#ff8133",
  J: "#4064ff",
};

// Each shape as a list of rotation states, each state a list of [col, row]
// cells relative to the piece's own top-left. Standard SRS-ish layouts,
// simplified (no wall-kick table - collision check just rejects the
// rotation if it doesn't fit, which is gentle enough for this audience).
const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
};
const SHAPE_NAMES = Object.keys(SHAPES);

const els = {
  scoreBar: document.getElementById("score-bar"),
  scoreValue: document.getElementById("score-value"),
  boardCanvas: document.getElementById("board-canvas"),
  nextCanvas: document.getElementById("next-canvas"),
  fullBoardPanel: document.getElementById("full-board-panel"),
  resetBtn: document.getElementById("reset-btn"),
  startPanel: document.getElementById("start-panel"),
  startBtn: document.getElementById("start-btn"),
  menuBtn: document.getElementById("menu-btn"),
  menuResetBtn: document.getElementById("menu-reset-btn"),
  menuBackdrop: document.getElementById("menu-backdrop"),
  menuDrawer: document.getElementById("menu-drawer"),
  menuCloseBtn: document.getElementById("menu-close-btn"),
};

const boardCtx = els.boardCanvas.getContext("2d");
const nextCtx = els.nextCanvas.getContext("2d");

// ---------- Settings ----------

function defaultSettings() {
  return { showScore: false };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw);
    return { ...defaultSettings(), ...parsed };
  } catch (e) {
    return defaultSettings();
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // storage unavailable, setting just won't persist
  }
}

let settings = loadSettings();

// ---------- Game state ----------
// grid[row][col] = null (empty) or a colour string. No score is persisted
// across sessions - "score" is only ever this session's running count of
// cleared lines, reset to 0 whenever the board resets.

let grid = makeEmptyGrid();
let current = null; // { name, rotation, col, row }
let nextName = randomShapeName();
let linesCleared = 0;
let dropTimer = null;
let boardFull = false;
// True once the player has pressed Start (or resumed a board with real
// progress on it already - see init()). Nothing falls and no input does
// anything until then, so the board sits still behind the Start overlay
// instead of a piece already dropping under it.
let started = false;

function makeEmptyGrid() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
}

function isEmptyGrid(g) {
  return g.every((row) => row.every((cell) => cell === null));
}

function randomShapeName() {
  return SHAPE_NAMES[Math.floor(Math.random() * SHAPE_NAMES.length)];
}

function cellsFor(piece) {
  return SHAPES[piece.name][piece.rotation].map(([c, r]) => [
    piece.col + c,
    piece.row + r,
  ]);
}

function fits(piece) {
  for (const [c, r] of cellsFor(piece)) {
    if (c < 0 || c >= COLS || r >= ROWS) return false;
    if (r >= 0 && grid[r][c]) return false;
  }
  return true;
}

function spawnPiece() {
  const name = nextName;
  nextName = randomShapeName();
  const piece = { name, rotation: 0, col: Math.floor(COLS / 2) - 1, row: -1 };
  if (!fits(piece)) {
    // New piece has nowhere to appear - the board is full. Not a "you
    // lose" moment, just a prompt to clear it and carry on.
    current = null;
    showFullBoard();
    return;
  }
  current = piece;
  drawNext();
}

function lockPiece() {
  for (const [c, r] of cellsFor(current)) {
    if (r >= 0) grid[r][c] = COLORS[current.name];
  }
  clearFullRows();
  current = null;
  spawnPiece();
  saveState();
}

function clearFullRows() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (grid[r].every((cell) => cell !== null)) {
      grid.splice(r, 1);
      grid.unshift(new Array(COLS).fill(null));
      cleared++;
      r++; // re-check this row index, now holding the row above's contents
    }
  }
  if (cleared > 0) {
    linesCleared += cleared;
    updateScoreDisplay();
  }
}

function updateScoreDisplay() {
  els.scoreValue.textContent = String(linesCleared);
}

// ---------- Movement ----------

function tryMove(dCol, dRow) {
  if (!current) return false;
  const moved = { ...current, col: current.col + dCol, row: current.row + dRow };
  if (!fits(moved)) return false;
  current = moved;
  return true;
}

function tryRotate() {
  if (!current) return false;
  const states = SHAPES[current.name].length;
  const rotated = { ...current, rotation: (current.rotation + 1) % states };
  if (fits(rotated)) {
    current = rotated;
    return true;
  }
  // Gentle wall-kick: nudge one column either way before giving up,
  // so rotating near a wall doesn't just silently fail.
  for (const dCol of [-1, 1, -2, 2]) {
    const kicked = { ...rotated, col: rotated.col + dCol };
    if (fits(kicked)) {
      current = kicked;
      return true;
    }
  }
  return false;
}

function softDrop() {
  if (!tryMove(0, 1)) {
    lockPiece();
  }
  resetDropTimer();
}

function hardDrop() {
  if (!current) return;
  while (tryMove(0, 1)) {
    /* keep dropping */
  }
  lockPiece();
  resetDropTimer();
}

// ---------- Drop timer ----------
// One constant interval for the whole game - no levels, no acceleration.

function resetDropTimer() {
  clearInterval(dropTimer);
  if (!boardFull && started) {
    dropTimer = setInterval(softDrop, DROP_MS);
  }
}

// ---------- Board full ----------

function showFullBoard() {
  boardFull = true;
  clearInterval(dropTimer);
  els.fullBoardPanel.hidden = false;
}

function resetBoard() {
  grid = makeEmptyGrid();
  linesCleared = 0;
  boardFull = false;
  els.fullBoardPanel.hidden = true;
  updateScoreDisplay();
  spawnPiece();
  resetDropTimer();
  saveState();
}

// ---------- Rendering ----------

// The next-piece panel is fixed-positioned off the board's right edge
// (see #next-wrap in style.css) rather than sharing a flex row with it,
// so the board itself always sits at true viewport centre regardless of
// the panel's width. Below MOBILE_STACK_WIDTH the panel moves under the
// board instead (CSS media query), so it doesn't need side clearance.
const MOBILE_STACK_WIDTH = 640;
const NEXT_PANEL_CLEARANCE = 160; // approx panel width + gap, wide layout only

function sizeCanvases() {
  const availH = window.innerHeight - 120 - 190;
  const isStacked = window.innerWidth <= MOBILE_STACK_WIDTH;
  const sideBudget = isStacked ? 16 : NEXT_PANEL_CLEARANCE;
  // Board must fit within the space left of the panel on *both* sides,
  // since it's centred - so the usable half-width is bounded by the
  // tighter of (left edge to centre) and (centre to panel).
  const availW = 2 * Math.min(window.innerWidth / 2 - 16, window.innerWidth / 2 - sideBudget);
  const cell = Math.max(14, Math.min(Math.floor(availH / ROWS), Math.floor(availW / COLS), 32));

  els.boardCanvas.width = cell * COLS;
  els.boardCanvas.height = cell * ROWS;
  els.boardCanvas.dataset.cell = String(cell);

  // Tell #next-wrap exactly how far the board's edge is from centre, so
  // it offsets from the real board width instead of a guessed constant.
  document.documentElement.style.setProperty("--board-half-w", `${(cell * COLS) / 2}px`);

  const nextCell = Math.max(14, Math.floor(cell * 0.7));
  els.nextCanvas.width = nextCell * 4;
  els.nextCanvas.height = nextCell * 4;
  els.nextCanvas.dataset.cell = String(nextCell);
}

function drawCell(ctx, cell, col, row, color) {
  const x = col * cell;
  const y = row * cell;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
}

function drawBoard() {
  const cell = Number(els.boardCanvas.dataset.cell);
  boardCtx.clearRect(0, 0, els.boardCanvas.width, els.boardCanvas.height);

  // empty-cell grid, faint
  boardCtx.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!grid[r][c]) boardCtx.fillRect(c * cell + 1, r * cell + 1, cell - 2, cell - 2);
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c]) drawCell(boardCtx, cell, c, r, grid[r][c]);
    }
  }

  if (current) {
    const color = COLORS[current.name];
    for (const [c, r] of cellsFor(current)) {
      if (r >= 0) drawCell(boardCtx, cell, c, r, color);
    }
  }
}

function drawNext() {
  const cell = Number(els.nextCanvas.dataset.cell);
  nextCtx.clearRect(0, 0, els.nextCanvas.width, els.nextCanvas.height);
  const shape = SHAPES[nextName][0];
  const color = COLORS[nextName];
  // Centre the piece's bounding box in the 4x4 preview.
  const maxC = Math.max(...shape.map(([c]) => c));
  const maxR = Math.max(...shape.map(([, r]) => r));
  const offC = (4 - (maxC + 1)) / 2;
  const offR = (4 - (maxR + 1)) / 2;
  for (const [c, r] of shape) {
    drawCell(nextCtx, cell, c + offC, r + offR, color);
  }
}

function render() {
  drawBoard();
  requestAnimationFrame(render);
}

// ---------- Persistence ----------
// Only enough to resume an in-progress board after a reload - never a
// cross-session score/best, per this project's rules.

function saveState() {
  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify({ grid, nextName, linesCleared, showScore: settings.showScore })
    );
  } catch (e) {
    // storage unavailable, play continues without persistence
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed.grid) &&
      parsed.grid.length === ROWS &&
      typeof parsed.nextName === "string" &&
      SHAPES[parsed.nextName]
    ) {
      return parsed;
    }
  } catch (e) {
    // ignore corrupt/unavailable storage
  }
  return null;
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
      saveState();
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

// ---------- Input ----------

document.addEventListener("keydown", (e) => {
  if (boardFull || !started) return;
  switch (e.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      tryMove(-1, 0);
      break;
    case "ArrowRight":
    case "d":
    case "D":
      tryMove(1, 0);
      break;
    case "ArrowDown":
    case "s":
    case "S":
      softDrop();
      break;
    case "ArrowUp":
    case "w":
    case "W":
      tryRotate();
      break;
    case " ":
      e.preventDefault();
      hardDrop();
      break;
    default:
      return;
  }
});

function bindHold(el, action) {
  // Single tap/click performs the action once - held-down repeat isn't
  // needed here since there's no time pressure to justify it.
  el.addEventListener("click", () => {
    if (boardFull || !started) return;
    action();
  });
}

// Called once, either by clicking the Start overlay or automatically at
// init when a saved board already has real progress on it (a refresh or
// reconnect should never cost progress or force an extra tap).
function startGame() {
  if (started) return;
  started = true;
  els.startPanel.hidden = true;
  if (!current) spawnPiece();
  resetDropTimer();
}

function init() {
  sizeCanvases();

  const saved = loadState();
  let resumingProgress = false;
  if (saved) {
    grid = saved.grid;
    nextName = saved.nextName;
    linesCleared = saved.linesCleared || 0;
    if (typeof saved.showScore === "boolean") settings.showScore = saved.showScore;
    resumingProgress = !isEmptyGrid(grid);
  }

  applyScoreVisibility();
  updateScoreDisplay();
  requestAnimationFrame(render);

  els.startBtn.addEventListener("click", startGame);
  if (resumingProgress) {
    startGame();
  }

  bindHold(document.getElementById("tc-left"), () => tryMove(-1, 0));
  bindHold(document.getElementById("tc-right"), () => tryMove(1, 0));
  bindHold(document.getElementById("tc-down"), softDrop);
  bindHold(document.getElementById("tc-rotate"), tryRotate);
  bindHold(document.getElementById("tc-drop"), hardDrop);

  els.resetBtn.addEventListener("click", resetBoard);
  els.menuResetBtn.addEventListener("click", () => {
    closeMenuDrawer();
    resetBoard();
  });

  els.menuBtn.addEventListener("click", openMenuDrawer);
  els.menuCloseBtn.addEventListener("click", closeMenuDrawer);
  els.menuBackdrop.addEventListener("click", closeMenuDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.menuDrawer.classList.contains("menu-drawer--open")) {
      closeMenuDrawer();
    }
  });

  window.addEventListener("resize", () => {
    sizeCanvases();
    // Only redraw the preview if the game has actually started - drawing
    // it before Start would reveal the next piece through/around the
    // start overlay on resize.
    if (started) drawNext();
  });
}

init();
