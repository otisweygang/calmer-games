#!/usr/bin/env node
// Enforcement checks for each game folder. Run with: node scripts/check-games.js
// 1. game.json exists with required fields
// 2. entry HTML contains id="ls-exit"
// 3. no file references a path outside its own game folder

const fs = require("fs");
const path = require("path");

const GAMES_DIR = path.join(__dirname, "..", "games");
const REQUIRED_FIELDS = ["title", "description", "entry", "thumbnail"];
const SKIP = new Set(["_template"]);

let errors = [];

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else out.push(full);
  }
  return out;
}

function checkGame(name) {
  const gameDir = path.join(GAMES_DIR, name);
  const manifestPath = path.join(gameDir, "game.json");

  if (!fs.existsSync(manifestPath)) {
    errors.push(`[${name}] missing game.json`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (e) {
    errors.push(`[${name}] game.json is not valid JSON`);
    return;
  }

  for (const field of REQUIRED_FIELDS) {
    if (!manifest[field]) {
      errors.push(`[${name}] game.json missing required field "${field}"`);
    }
  }

  const entryPath = path.join(gameDir, manifest.entry || "index.html");
  if (!fs.existsSync(entryPath)) {
    errors.push(`[${name}] entry file not found: ${manifest.entry}`);
  } else {
    const html = fs.readFileSync(entryPath, "utf8");
    if (!/id=["']ls-exit["']/.test(html)) {
      errors.push(`[${name}] entry file missing required id="ls-exit" element`);
    }
  }

  // Isolation: no <script src>, <link href>, import, or fetch may reach
  // outside the game's own folder. The required exit link (the element
  // with id="ls-exit") is exempt — it must point back to the portal.
  // shared/lock.js + shared/lock.css are also exempt: the one deliberate
  // exception to game isolation, documented in README.md under "Kiosk
  // lock" — portal-owned safety enforcement, included unmodified by
  // every game.
  const FORBIDDEN_REF = /(?:src|href|import\s+.*?from|fetch)\s*=?\(?\s*["'](\.\.\/[^"']*|\/shared\/[^"']*)["']/g;

  for (const file of walkFiles(gameDir)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/id=["']ls-exit["']/.test(line)) return; // sanctioned exception
      if (/shared\/lock\.(js|css)["']/.test(line)) return; // sanctioned exception
      let match;
      FORBIDDEN_REF.lastIndex = 0;
      while ((match = FORBIDDEN_REF.exec(line)) !== null) {
        errors.push(
          `[${name}] ${path.relative(gameDir, file)}:${i + 1} references outside its own folder: ${match[1]}`
        );
      }
    });
  }
}

if (!fs.existsSync(GAMES_DIR)) {
  console.error("games/ directory not found");
  process.exit(1);
}

for (const entry of fs.readdirSync(GAMES_DIR, { withFileTypes: true })) {
  if (entry.isDirectory() && !SKIP.has(entry.name)) {
    checkGame(entry.name);
  }
}

if (errors.length > 0) {
  console.error("Game checks failed:\n");
  for (const err of errors) console.error(" -", err);
  process.exit(1);
}

console.log("All games passed checks.");
