// Portal shell only. Never imported by games.
// To add a game: add its folder name to shared/games.json, e.g. ["colour-match"]

// Card colour + icon cycle through this list per game. Not tied to any
// game's own palette — purely portal decoration.
const CARD_THEMES = [
  { bg: "#FFE3D1", icon: "🎨" },
  { bg: "#D8F0DB", icon: "🔢" },
  { bg: "#DCE8FA", icon: "🧩" },
  { bg: "#F4E3F7", icon: "⭐" },
];

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

    const card = document.createElement("a");
    card.className = "game-card";
    card.href = `games/${folder}/${manifest.entry}`;
    card.style.backgroundColor = theme.bg;
    card.innerHTML = `
      <span class="game-icon" aria-hidden="true">${theme.icon}</span>
      <span class="game-title">${manifest.title}</span>
      <span class="game-desc">${manifest.description}</span>
    `;
    grid.appendChild(card);
  }
}

loadGames();
