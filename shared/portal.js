// Portal shell only. Never imported by games.
// To add a game: add its folder name to shared/games.json, e.g. ["colour-match"]

// Card icon colour cycles through this list per game. Not tied to any
// game's own palette — purely portal decoration. Icon artwork itself
// comes from shared/icons/<folder>.svg (falls back to default-game.svg).
const CARD_THEMES = [
  { bg: "#FBEADC", fg: "#E8935C" },
  { bg: "#E4EFEC", fg: "#7BA098" },
  { bg: "#F5E6E8", fg: "#C97B84" },
  { bg: "#F6EFD9", fg: "#CF9F3F" },
];

async function loadIcon(folder) {
  const res = await fetch(`shared/icons/${folder}.svg`);
  if (res.ok) return res.text();
  return fetch("shared/icons/default-game.svg").then((r) => r.text());
}

async function loadGames() {
  const list = await fetch("shared/games.json").then((r) => r.json());
  const grid = document.getElementById("game-grid");

  if (list.length === 0) {
    grid.innerHTML = '<p class="empty-msg">No games yet — check back soon.</p>';
    return;
  }

  for (const [i, folder] of list.entries()) {
    const manifest = await fetch(`games/${folder}/game.json`).then((r) =>
      r.json()
    );
    const theme = CARD_THEMES[i % CARD_THEMES.length];
    const iconSvg = await loadIcon(folder);

    const card = document.createElement("a");
    card.className = "game-card";
    card.href = `games/${folder}/${manifest.entry}`;
    card.innerHTML = `
      <span class="game-icon" style="background:${theme.bg}; color:${theme.fg}">${iconSvg}</span>
      <span class="game-title">${manifest.title}</span>
      <span class="game-desc">${manifest.description}</span>
    `;
    grid.appendChild(card);
  }
}

loadGames();
