# Adding a game

1. Copy `games/_template/` to `games/<your-game-name>/`.
2. Edit `game.json` (title, description, entry, thumbnail).
3. Build the game in `index.html` / `style.css` / `script.js`. Keep the
   `id="ls-exit"` element — it's how a player always gets back home.
4. Do not import anything from `/shared/` or any other game folder. Copy
   what you need instead. Each game must run standalone.
5. Run `node scripts/check-games.js` and fix anything it flags.
6. Add your game's folder name to `shared/games.json` so it appears on
   the homepage.

See the README for the full list of design rules (no timers, no streaks,
no leaderboards, no random rewards, always exitable).
