// ==UserScript==
// @name         Torn.com - Flight Countdown on Tab
// @namespace    http://tampermonkey.net/
// @version      9.9
// @description  Persistent flight countdown on the tab title. Destination read from the header travel status (aria-label / logo title), not whole-page text.
// @author       ToiletPaper1USD [2875069]
// @match        https://www.torn.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=torn.com
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/torn/torn-flight-countdown.user.js
// @downloadURL  https://raw.githubusercontent.com/tanwj14/game-userscripts/main/games/torn/torn-flight-countdown.user.js
// ==/UserScript==

(function() {
    'use strict';

    let originalTitle = "TORN";
    let currentPageName = "Traveling";

    // localStorage keys for the cached flight.
    const KEY_LANDING = 'torn_flight_landing';
    const KEY_DEST = 'torn_flight_destination';

    // A title is ours (not the game's) if it carries any of our markers.
    const isScriptTitle = (t) => t.includes(":") || t.includes("[") || t.includes("Reached!");

    // Country -> tab label. Tokens matched as whole words against short, trusted strings.
    const COUNTRY_MAP = [
        { label: "[HAWAII]", tokens: ["hawaii", "honolulu"] },
        { label: "[UK]",     tokens: ["united kingdom", "london"] },
        { label: "[CHINA]",  tokens: ["china", "beijing"] },
        { label: "[MEX]",    tokens: ["mexico"] },
        { label: "[CAYMAN]", tokens: ["cayman"] },
        { label: "[CANADA]", tokens: ["canada", "toronto"] },
        { label: "[ARG]",    tokens: ["argentina", "buenos aires"] },
        { label: "[SWISS]",  tokens: ["switzerland", "zurich"] },
        { label: "[JAPAN]",  tokens: ["japan", "tokyo"] },
        { label: "[UAE]",    tokens: ["united arab emirates", "dubai"] },
        { label: "[SA]",     tokens: ["south africa", "johannesburg"] },
    ];

    function labelFromText(text) {
        if (!text) return null;
        const t = text.toLowerCase();
        for (const c of COUNTRY_MAP) {
            for (const tok of c.tokens) {
                const rx = new RegExp("\\b" + tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
                if (rx.test(t)) return c.label;
            }
        }
        return null;
    }

    // State from the header travel link, which mirrors the globe/cart icons.
    // Destination is the name after "to", so a return flight reads as Torn.
    function detectTravel() {
        const link = document.querySelector('a[href*="sid=travel"][aria-label]');
        const aria = link ? (link.getAttribute("aria-label") || "") : "";
        const body = document.body ? document.body.innerText : "";

        let state = "home", dest = null, m;
        if ((m = aria.match(/abroad\s+in\s+(.+)$/i))) {           // cart icon: arrived overseas
            state = "abroad";
            dest = m[1].trim();
        } else if ((m = aria.match(/traveling\s+from\s+.+?\s+to\s+(.+)$/i))) { // globe icon: in transit
            state = "flying";
            dest = m[1].trim();
        } else if (/Remaining Flight Time/i.test(body)) {
            state = "flying";                                     // fallback if aria wording changes
        } else if (/Travel home/i.test(body)) {
            state = "abroad";
        }                                                         // no link = home in Torn

        let label = null;
        if (dest) label = /^torn\b/i.test(dest) ? "[TORN]" : labelFromText(dest);
        if (!label) {                                             // arrived-only fallback
            const logo = document.getElementById("tcLogo");
            if (logo && logo.getAttribute("title")) label = labelFromText(logo.getAttribute("title"));
        }

        return { state, label };
    }

    // Remember the game's own title (ignoring ones we've written) to restore later.
    const titleObserver = new MutationObserver(() => {
        const rawTitle = document.title;
        if (!isScriptTitle(rawTitle)) {
            originalTitle = rawTitle;
            detectCurrentPage();
        }
    });

    if (document.head) {
        titleObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    }

    // Name the current page for the title suffix, preferring the URL over the title.
    function detectCurrentPage() {
        const url = window.location.href.toLowerCase();
        const rawTitle = document.title;

        if (url.includes("sid=travel")) {
            currentPageName = "Traveling";
            return;
        }
        if (url.includes("newspaper")) {
            currentPageName = "Newspaper";
            return;
        }
        if (url.includes("forums")) {
            currentPageName = "Forums";
            return;
        }
        if (url.includes("sid=awards")) {
            currentPageName = "Awards";
            return;
        }
        if (url.includes("sid=hof")) {
            currentPageName = "Hall of Fame";
            return;
        }
        if (url.includes("factions")) {
            currentPageName = "My Faction";
            return;
        }

        // Fallback: derive the name from the page title.
        if (!isScriptTitle(rawTitle)) {
            const cleanTitle = rawTitle
                .replace(/\|?\s*TORN\s*\|?/gi, '')
                .replace(/[^a-zA-Z0-9\s]/g, '')
                .trim();
            currentPageName = cleanTitle || "Traveling";
        }
    }

    function formatSeconds(totalSeconds) {
        if (totalSeconds <= 0) return null;
        const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    // Cache landing time + destination label. Label is recomputed each tick so a
    // stale value from a previous trip self-corrects.
    function parseFlightData(travel) {
        const mainText = document.body ? document.body.innerText : "";
        if (!mainText) return;

        if (travel.state === "flying") {
            // Landing time comes from the on-page countdown; label from the header.
            const timeMatch = mainText.match(/Remaining Flight Time\s*-\s*(\d{2}:\d{2}:\d{2})/i);
            if (timeMatch) {
                const parts = timeMatch[1].split(':');
                const secondsLeft = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
                localStorage.setItem(KEY_LANDING, String(Date.now() + secondsLeft * 1000));
            }
            if (travel.label) localStorage.setItem(KEY_DEST, travel.label);
            return;
        }

        // Arrived: no countdown, so mark as landed (label already known).
        if (travel.state === "abroad" && !/welcome back to torn/i.test(mainText)) {
            if (travel.label) localStorage.setItem(KEY_DEST, travel.label);
            localStorage.setItem(KEY_LANDING, String(Date.now()));
        }
    }

    function updateTabTimer() {
        const travel = detectTravel();

        if (travel.state === "flying" || travel.state === "abroad") {
            parseFlightData(travel);
            detectCurrentPage();
        } else if (document.body) {
            // Home in Torn: clear any leftover flight data so the title resets.
            if (localStorage.getItem(KEY_LANDING) || localStorage.getItem(KEY_DEST)) {
                localStorage.removeItem(KEY_LANDING);
                localStorage.removeItem(KEY_DEST);
            }
        }

        // Render the tab title from the cache: countdown while flying, "Reached!"
        // once landed abroad, and restore the game's title once home.
        const cachedLanding = localStorage.getItem(KEY_LANDING);
        const cachedLabel = localStorage.getItem(KEY_DEST) || "[✈️]";
        const pageContext = currentPageName ? ` | ${currentPageName}` : "";

        if (cachedLanding) {
            const remainingMs = parseInt(cachedLanding, 10) - Date.now();
            const remainingSeconds = Math.ceil(remainingMs / 1000);

            if (remainingSeconds > 0) {
                const countdownStr = formatSeconds(remainingSeconds);
                const newTitle = `${cachedLabel} ${countdownStr}${pageContext} | TORN`;
                if (document.title !== newTitle) {
                    document.title = newTitle;
                }
                return;
            } else {
                if (cachedLabel === "[TORN]") {
                    localStorage.removeItem(KEY_LANDING);
                    localStorage.removeItem(KEY_DEST);
                } else {
                    const arrivedTitle = `${cachedLabel} Reached!${pageContext} | TORN`;
                    if (document.title !== arrivedTitle) {
                        document.title = arrivedTitle;
                    }
                    return;
                }
            }
        }

        if (isScriptTitle(document.title)) {
            document.title = originalTitle;
        }
    }

    setInterval(updateTabTimer, 1000);

    const domObserver = new MutationObserver(updateTabTimer);
    document.addEventListener("DOMContentLoaded", () => {
        if (document.body) {
            domObserver.observe(document.body, { childList: true, subtree: true });
        }
    });
})();
