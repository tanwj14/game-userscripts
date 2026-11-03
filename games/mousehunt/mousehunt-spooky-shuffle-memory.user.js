// ==UserScript==
// @name         MouseHunt - Spooky Shuffle Memory
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Remembers every Spooky Shuffle card you flip and shows it on the face-down card; known pairs are outlined.
// @author       tanwj14
// @match        https://www.mousehuntgame.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=mousehuntgame.com
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/mousehunt/mousehunt-spooky-shuffle-memory.user.js
// @downloadURL  https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/mousehunt/mousehunt-spooky-shuffle-memory.user.js
// ==/UserScript==

(function () {
    'use strict';

    const KEY = 'mhSpookyShuffleMemory';
    const ENDPOINT = /\/managers\/ajax\/events\/spooky_shuffle\.php/;

    // { size, cards: { [id]: { name, thumb, quantity, matched } } }
    let mem = load();

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY)) || { size: 0, cards: {} }; }
        catch { return { size: 0, cards: {} }; }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked */ }
    }

    // Merge server state into memory; reset when the board is clearly a new one.
    function ingest(game) {
        const cards = game && game.cards;
        if (!Array.isArray(cards)) return;

        const conflict = cards.some((c) => c.name && mem.cards[c.id] && mem.cards[c.id].name !== c.name);
        if (game.is_complete || conflict || mem.size !== cards.length) {
            mem = { size: cards.length, cards: {} };
        }

        for (const c of cards) {
            if (!c.name) continue;
            mem.cards[c.id] = { name: c.name, thumb: c.thumb, quantity: c.quantity, matched: !!c.is_matched };
        }
        // First card of the current turn, if a second pick is awaited.
        const first = !game.has_selected_testing_pair && cards.find((c) => c.is_tested_pair && !c.is_matched);
        mem.pending = first ? String(first.id) : null;
        save();
        scheduleRender();
    }

    // Hook XHR (jQuery ajax) so we see every select_card / board response.
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (ENDPOINT.test(String(url))) {
            this.addEventListener('load', () => {
                try { ingest(JSON.parse(this.responseText).memory_game); } catch { /* non-JSON */ }
            });
        }
        return origOpen.apply(this, arguments);
    };

    // Names seen on 2+ unmatched remembered cards = a pair you can take.
    function knownPairs() {
        const count = {};
        for (const c of Object.values(mem.cards)) if (!c.matched) count[c.name] = (count[c.name] || 0) + 1;
        return new Set(Object.keys(count).filter((n) => count[n] >= 2));
    }

    // Card ids to open next: the twin of the pending pick, else one known pair.
    function nextMoves(pairs) {
        const open = Object.entries(mem.cards).filter(([, c]) => !c.matched);
        const first = mem.pending && mem.cards[mem.pending];
        if (first) {
            const twin = open.find(([id, c]) => id !== mem.pending && c.name === first.name);
            return new Set(twin ? [twin[0]] : []);
        }
        const name = [...pairs][0];
        return new Set(name ? open.filter(([, c]) => c.name === name).map(([id]) => id) : []);
    }

    function render() {
        const board = document.querySelector('.halloweenMemoryGame-content');
        if (!board) return;
        const pairs = knownPairs();
        const next = nextMoves(pairs);

        for (const el of board.querySelectorAll('.halloweenMemoryGame-card-container[data-card-id]')) {
            const card = mem.cards[el.dataset.cardId];
            const isNext = next.has(el.dataset.cardId);
            const show = card && !card.matched && !el.classList.contains('revealed');
            let peek = el.querySelector(':scope > .mhss-peek');

            if (!show) { if (peek) peek.remove(); continue; }
            if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
            if (!peek) {
                peek = document.createElement('div');
                peek.className = 'mhss-peek';
                el.appendChild(peek);
            }
            const sig = card.name + '|' + pairs.has(card.name) + '|' + isNext;
            if (peek.dataset.sig === sig) continue;
            peek.dataset.sig = sig;
            peek.classList.toggle('mhss-pair', pairs.has(card.name));
            peek.classList.toggle('mhss-next', isNext);
            peek.innerHTML = '';
            if (isNext) {
                const tag = document.createElement('div');
                tag.className = 'mhss-tag';
                tag.textContent = 'OPEN';
                peek.appendChild(tag);
            }
            const img = document.createElement('div');
            img.className = 'mhss-img';
            img.style.backgroundImage = `url("${card.thumb}")`;
            const name = document.createElement('div');
            name.className = 'mhss-name';
            name.textContent = card.name;
            peek.append(img, name);
        }
    }

    let pending = false;
    function scheduleRender() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; render(); });
    }

    function injectStyle() {
        const s = document.createElement('style');
        s.textContent = `
            .mhss-peek { position:absolute; inset:6px; z-index:5; pointer-events:none;
                display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px;
                background:rgba(20,10,30,.72); border:2px solid rgba(255,255,255,.35); border-radius:8px; }
            .mhss-peek.mhss-pair { border:3px solid #ffd23f; box-shadow:0 0 10px #ffd23f; }
            .mhss-peek.mhss-next { border:3px solid #3dff7a; box-shadow:0 0 14px #3dff7a; background:rgba(10,50,20,.8); }
            .mhss-tag { background:#3dff7a; color:#062; font:bold 11px sans-serif; padding:1px 6px; border-radius:4px; }
            .mhss-img { width:60%; aspect-ratio:1; background:center/contain no-repeat; }
            .mhss-name { color:#fff; font:bold 10px/1.15 sans-serif; text-align:center; padding:0 3px; }
        `;
        document.head.appendChild(s);
    }

    // The game re-renders the board on open/flip; re-apply overlays after each change.
    function start() {
        injectStyle();
        new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true });
        scheduleRender();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
