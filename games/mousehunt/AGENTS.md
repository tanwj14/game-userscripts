# AGENTS.md — MouseHunt

Game-specific development context for `mousehunt-spooky-shuffle-memory.user.js`. For
the shared shipping workflow, see the [root AGENTS.md](../../AGENTS.md).

## Spooky Shuffle (captured live 2026-11-03)

- The board opens as a popup (e.g. on `camp.php`). Each flip POSTs
  `action=select_card&card_id=N` to `/managers/ajax/events/spooky_shuffle.php` (jQuery XHR).
- The response's `memory_game.cards[]` holds `{ id, name, quantity, thumb, is_revealed, is_matched, is_tested_pair }`.
- The server only sends `name`/`thumb` for matched cards and the current turn's
  cards. After a miss, the next response nulls them again, so the script must
  remember them itself.
- Pending first pick: `has_selected_testing_pair === false` plus one card with
  `is_tested_pair && !is_matched`. When `has_selected_testing_pair === true`, the
  response is the result of the second pick.
- Opening a fresh board POSTs `action=new_game`; its response has no revealed cards.
- `is_complete: true` arrives on the final match's response (verified 2026-11-03).
- Both the normal and Dusted (`is_upgraded: true`) boards have 18 cards.
- DOM: `.halloweenMemoryGame-content > .halloweenMemoryGame-card-container[data-card-id]`.
  Its class includes `revealed` / `is_matched` when the card is face up. The game
  re-renders cards, so overlays are re-applied by a `MutationObserver`.

## Memory reset rules

Memory clears on an `action=new_game` request, `is_complete`, a change in card count, or a server-revealed card
whose name differs from the remembered one (a new board). It does **not** clear
when no card has been revealed yet: reopening the popup mid-game sends nothing
revealed, which would otherwise wipe the memory.

## Dev probes

`dev/browser-inspect/record-ajax.js [outfile]` logs every MouseHunt ajax request
and its response to JSONL while you play (debug Chrome on port 9222; see
[`tools/browser-inspect/`](../../tools/browser-inspect/README.md)). Run it from the
repo root.
