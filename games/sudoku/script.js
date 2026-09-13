// Standalone: do not import from /shared/ or other game folders.
// Uses the vendored `sudoku` global from vendor/sudoku.js (robatron/sudoku.js, MIT).

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "very-hard", label: "Very Hard" },
];

const SETTINGS_KEY = "ls-sudoku-settings";
const STATE_KEY = "ls-sudoku-state";

let settings = { difficulty: "easy" };
let puzzle = null; // 81-char given string, sudoku.BLANK_CHAR for blanks
let solution = null; // 81-char solved string
let entries = null; // 81-char current player entries, sudoku.BLANK_CHAR for blank
let selectedIndex = null;

function defaultSettings() {
  return { difficulty: "easy" };
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

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify({ settings, puzzle, solution, entries }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.puzzle === "string" &&
      parsed.puzzle.length === 81 &&
      typeof parsed.solution === "string" &&
      parsed.solution.length === 81 &&
      typeof parsed.entries === "string" &&
      parsed.entries.length === 81
    ) {
      return parsed;
    }
  } catch (e) {
    // corrupt or missing state, fall through to a fresh puzzle
  }
  return null;
}

function generatePuzzle() {
  const board = sudoku.generate(settings.difficulty);
  const solved = sudoku.solve(board);
  return { puzzle: board, solution: solved };
}

function isGiven(index) {
  return puzzle[index] !== sudoku.BLANK_CHAR;
}

function valueAt(index) {
  return isGiven(index) ? puzzle[index] : entries[index];
}

function setEntry(index, digit) {
  if (isGiven(index)) return;
  entries = entries.substring(0, index) + digit + entries.substring(index + 1);
  saveState();
  render();
  checkComplete();
}

// Returns a Set of indices that conflict with another same-value cell in
// their row, column, or 3x3 box. Blanks never conflict.
function findConflicts() {
  const conflicts = new Set();
  const rows = Array.from({ length: 9 }, () => new Map());
  const cols = Array.from({ length: 9 }, () => new Map());
  const boxes = Array.from({ length: 9 }, () => new Map());

  for (let i = 0; i < 81; i++) {
    const value = valueAt(i);
    if (value === sudoku.BLANK_CHAR) continue;
    const row = Math.floor(i / 9);
    const col = i % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

    for (const [map, key] of [
      [rows[row], value],
      [cols[col], value],
      [boxes[box], value],
    ]) {
      if (map.has(key)) {
        conflicts.add(i);
        for (const otherIndex of map.get(key)) conflicts.add(otherIndex);
        map.get(key).push(i);
      } else {
        map.set(key, [i]);
      }
    }
  }

  return conflicts;
}

function checkComplete() {
  const status = document.getElementById("status");
  const filled = !Array.from(entries).some(
    (ch, i) => !isGiven(i) && ch === sudoku.BLANK_CHAR
  );
  const matches = Array.from({ length: 81 }, (_, i) => valueAt(i) === solution[i]).every(Boolean);
  status.textContent = filled && matches ? "Solved. Nicely done." : "";
}

function renderBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";
  const conflicts = findConflicts();

  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const given = isGiven(i);
    const value = valueAt(i);

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    if (given) cell.classList.add("cell-given");
    if (selectedIndex === i) cell.classList.add("cell-selected");
    if (conflicts.has(i)) cell.classList.add("cell-conflict");
    cell.dataset.index = String(i);
    cell.dataset.row = String(row);
    cell.dataset.col = String(col);
    cell.textContent = value === sudoku.BLANK_CHAR ? "" : value;
    cell.disabled = given;
    cell.setAttribute(
      "aria-label",
      `Row ${row + 1}, column ${col + 1}${value === sudoku.BLANK_CHAR ? ", empty" : `, ${value}`}`
    );
    cell.addEventListener("click", () => {
      selectedIndex = i;
      render();
    });
    board.appendChild(cell);
  }
}

function renderNumberPad() {
  const pad = document.getElementById("number-pad");
  pad.innerHTML = "";

  for (let digit = 1; digit <= 9; digit++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pad-btn";
    btn.textContent = String(digit);
    btn.setAttribute("aria-label", `Enter ${digit}`);
    btn.addEventListener("click", () => {
      if (selectedIndex !== null) setEntry(selectedIndex, String(digit));
    });
    pad.appendChild(btn);
  }

  const eraser = document.createElement("button");
  eraser.type = "button";
  eraser.className = "pad-btn pad-btn-eraser";
  eraser.textContent = "Erase";
  eraser.setAttribute("aria-label", "Erase cell");
  eraser.addEventListener("click", () => {
    if (selectedIndex !== null) setEntry(selectedIndex, sudoku.BLANK_CHAR);
  });
  pad.appendChild(eraser);
}

function render() {
  renderBoard();
  renderNumberPad();
}

function startNewPuzzle() {
  const generated = generatePuzzle();
  puzzle = generated.puzzle;
  solution = generated.solution;
  entries = sudoku.BLANK_BOARD;
  selectedIndex = null;
  saveState();
  render();
  document.getElementById("status").textContent = "";
}

// --- Settings panel ---

function buildSegmented(container, options, current, onSelect) {
  container.innerHTML = "";
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "segment";
    btn.textContent = opt.label;
    if (opt.value === current) btn.classList.add("segment-active");
    btn.setAttribute("aria-pressed", String(opt.value === current));
    btn.addEventListener("click", () => onSelect(opt.value));
    container.appendChild(btn);
  });
}

// Renders the settings controls into a given set of element ids — used
// for both the setup screen (prefix "") and the in-play menu drawer
// (prefix "menu-"), mirroring the colour-match game's treatment so the
// two share one rendering path instead of duplicating this logic.
function renderSettingsControls(ids) {
  buildSegmented(
    document.getElementById(ids.difficulty),
    DIFFICULTIES,
    settings.difficulty,
    (value) => updateSetting("difficulty", value)
  );
}

function renderSettingsPanel() {
  renderSettingsControls({ difficulty: "difficulty-options" });
}

function renderMenuDrawer() {
  renderSettingsControls({ difficulty: "menu-difficulty-options" });
}

// Settings can be changed from two places: the setup screen (before a
// game starts — takes effect on next Play, no live puzzle behind it)
// and the in-play menu drawer (changed while a puzzle is already in
// progress — takes effect immediately by generating a new puzzle,
// since there's a real board on screen for the player to see react).
function updateSetting(key, value) {
  settings[key] = value;
  saveSettings();
  renderSettingsPanel();
  renderMenuDrawer();
  if (!document.getElementById("play-screen").hidden) {
    startNewPuzzle();
  }
}

// --- Menu drawer (in-play settings) ---

function openMenuDrawer() {
  renderMenuDrawer();
  const drawer = document.getElementById("menu-drawer");
  const backdrop = document.getElementById("menu-backdrop");
  drawer.hidden = false;
  backdrop.hidden = false;
  // Force layout before adding the transition-triggering class, so the
  // slide-in actually animates instead of snapping straight to open
  // (toggling a transform-affecting class in the same tick it becomes
  // visible can get coalesced by the browser into one paint).
  void drawer.offsetWidth;
  drawer.classList.add("menu-drawer--open");
  backdrop.classList.add("menu-backdrop--visible");
  document.getElementById("menu-btn").setAttribute("aria-expanded", "true");
}

function closeMenuDrawer() {
  const drawer = document.getElementById("menu-drawer");
  const backdrop = document.getElementById("menu-backdrop");
  drawer.classList.remove("menu-drawer--open");
  backdrop.classList.remove("menu-backdrop--visible");
  document.getElementById("menu-btn").setAttribute("aria-expanded", "false");
  const hide = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
  };
  // Match the CSS transition duration so the drawer/backdrop stay
  // visible (and hittable) throughout the slide-out instead of
  // vanishing instantly.
  window.setTimeout(hide, 220);
}

// --- Screen navigation ---

function showSetupScreen() {
  document.getElementById("setup-screen").hidden = false;
  document.getElementById("play-screen").hidden = true;
}

function showPlayScreen() {
  document.getElementById("setup-screen").hidden = true;
  document.getElementById("play-screen").hidden = false;
}

function startGame() {
  startNewPuzzle();
  showPlayScreen();
}

function init() {
  settings = loadSettings();
  const saved = loadState();
  const resuming = saved && JSON.stringify(saved.settings) === JSON.stringify(settings);
  if (resuming) {
    puzzle = saved.puzzle;
    solution = saved.solution;
    entries = saved.entries;
  } else {
    const generated = generatePuzzle();
    puzzle = generated.puzzle;
    solution = generated.solution;
    entries = sudoku.BLANK_BOARD;
  }
  renderSettingsPanel();
  render();
  checkComplete();

  document.getElementById("play-btn").addEventListener("click", startGame);
  document.getElementById("menu-btn").addEventListener("click", openMenuDrawer);
  document.getElementById("menu-close-btn").addEventListener("click", closeMenuDrawer);
  document.getElementById("menu-backdrop").addEventListener("click", closeMenuDrawer);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("menu-drawer").classList.contains("menu-drawer--open")) {
      closeMenuDrawer();
    }
  });
  document.getElementById("new-puzzle-btn").addEventListener("click", startNewPuzzle);

  if (resuming) {
    showPlayScreen();
  } else {
    showSetupScreen();
  }
}

init();
