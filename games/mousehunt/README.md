# MouseHunt — Spooky Shuffle Memory

A [Tampermonkey](https://www.tampermonkey.net/) userscript for
[MouseHunt](https://www.mousehuntgame.com)'s Halloween **Spooky Shuffle** card-matching game.
It remembers every card you flip and tells you which card to open next.

## Features

| Feature | What it does |
| --- | --- |
| **Remembers flipped cards** | Every card you reveal stays visible (image + name) on its face-down card, even after a miss flips it back. |
| **Tells you what to open** | After your first flip, if its twin is already known, the twin glows green with an **OPEN** tag. Before a first flip, any known pair is tagged the same way. |
| **Known pairs outlined** | Remembered cards whose twin is also known get a gold outline. |
| **Normal + Dusted boards** | Works on both. Memory resets when a board completes or a new one starts. |
| **Survives reloads** | Memory is kept in `localStorage`. |

## Install

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension.
2. **[Click here to install](https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/mousehunt/mousehunt-spooky-shuffle-memory.user.js)**. Tampermonkey opens its install prompt.
3. Confirm. Reload MouseHunt and open Spooky Shuffle.

Updates install automatically via the `@updateURL` header.

## Notes

- Only remembers cards flipped while the script is running. Cards flipped before
  installing it can't be recovered, because the server doesn't send them again.
- Read-only: it never clicks or sends requests for you.

## Development

See [AGENTS.md](AGENTS.md).

## Changelog

See [changelog/spooky-shuffle-memory.md](changelog/spooky-shuffle-memory.md).
