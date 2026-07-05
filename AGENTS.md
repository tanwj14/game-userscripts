# AGENTS.md

Development context for humans and AI coding harnesses working in this repo.
Repo is a collection of Tampermonkey userscripts for browser games. Each game is
self-contained in its own folder with its own `README.md`, `CHANGELOG.md`, and
(where useful) an `AGENTS.md` carrying that game's dev-specific knowledge.

**Working on a specific game? Read its folder's `AGENTS.md` too.** Agents read
the nearest one, so game-specific DOM facts and gotchas live there
(e.g. [`games/cartel-empire/AGENTS.md`](games/cartel-empire/AGENTS.md)).

## Maintainer

GitHub: `tanwj14`. Per-game in-game handles (where relevant) are noted in that
game's own `AGENTS.md`.

## Shipping an update (any script)

1. Edit the `.user.js`.
2. Bump the `@version` header (semver).
3. Add a `CHANGELOG.md` entry in the game's folder.
4. `git commit` + `git push` to `main`.

Every script carries `@updateURL` / `@downloadURL` pointing at its **raw** GitHub
URL on `main`:

```
https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/<game>/<script>.user.js
```

Tampermonkey polls these, so bumping `@version` and pushing is all it takes for
installed clients to update. **Do not rename a game folder or script file.**
That breaks the raw URL and silently kills auto-update for everyone installed.

## Local sanity checks

- `node --check <script>.user.js` — syntax.
- Unit-test pure decision logic where a game folder provides a harness
  (e.g. `games/cartel-empire/dev/browser-inspect/test-logic.js`).
- Live-verify behavioural changes in a debug browser before shipping (see the
  game's `AGENTS.md` for its inspection workflow).

## Dev tooling

Shared, game-agnostic CDP tooling lives in [`tools/browser-inspect/`](tools/browser-inspect/)
(the `inspect.js` connector + debug-Chrome setup). `playwright` is declared once
in the repo-root `package.json`. Run `npm install` at the root once. Every script
under `tools/` and `games/<game>/dev/` then resolves it via Node's upward
`node_modules` lookup. Game-specific probes live in `games/<game>/dev/browser-inspect/`,
where they hard-code that game's own selectors and localStorage keys.

## Adding a new game

1. Create `games/<game>/` with `<game>.user.js`, `README.md`, `CHANGELOG.md`.
2. Add `@updateURL` / `@downloadURL` headers pointing at the raw URL above.
3. Add `games/<game>/AGENTS.md` if the game has non-obvious DOM/behaviour notes.
4. Add a row to the root `README.md` scripts table.
5. Put any game-specific inspectors in `games/<game>/dev/browser-inspect/`. Reuse the
   shared setup and the root `playwright`. Do not re-declare the dependency.
