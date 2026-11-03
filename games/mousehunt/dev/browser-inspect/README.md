# browser-inspect — MouseHunt probes

Probes for developing `../../mousehunt-spooky-shuffle-memory.user.js`. For the
common setup, see the shared [`tools/browser-inspect/`](../../../../tools/browser-inspect/README.md) README.

Run from the repo root.

- `record-ajax.js [outfile]` — appends every `/managers/ajax/` request and its
  response (as JSONL) to `outfile` (default `mh-ajax.jsonl`) while you play. Stop it with Ctrl+C.
