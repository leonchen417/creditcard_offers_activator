(function() {
  // --- 1. Domain check ---
  const host = location.hostname;
  const path = location.pathname;
  const url  = location.href;

  const isAmex = /americanexpress\.com|aexp\.com/i.test(host) && /\/offers/i.test(path);
  const isCiti = /citi\.com/i.test(host) && /\/merchantoffers/i.test(path);
  const isChase = /chase\.com/i.test(host) && /merchantOffers/i.test(url);

  if (!(isAmex || isCiti || isChase)) {
    alert("❌ Amex/Citi/Chase OFFER pages only.");
    return;
  }

  if (window.__OFX && window.__OFX.active) {
    alert("Learner already running.");
    return;
  }

  window.__OFX = { active: true };

  // --- 2. Helper functions ---
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const isVisible = el => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const textOf = el => (el.innerText || el.textContent || "").trim().toLowerCase();
  const ariaOrTitle = el => (el.getAttribute("aria-label") || el.getAttribute("title") || "").toLowerCase();

  // --- 3. Interactive Learn Mode ---
  alert("LEARN MODE: Click 2–3 real ACTIVATE buttons. Press ESC when done to preview.");

  const state = { samples: [], matcher: null, matches: [] };

  function onClick(ev) {
    const el = ev.target.closest("button,[role='button'],a,[tabindex]");
    if (!el) return;
    state.samples.push(el);
    el.style.outline = "3px solid orange";
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onKey(ev) {
    if (ev.key !== "Escape") return;
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKey, true);

    // --- 4. Build a matcher function from clicked samples ---
    if (state.samples.length < 1) {
      alert("No samples captured.");
      return;
    }

    state.matcher = buildMatcher(state.samples);
    const allButtons = findAllMatchingButtons(state.matcher);
    state.matches = allButtons;

    allButtons.forEach(btn => btn.style.outline = "3px solid orange");

    if (!allButtons.length) {
      alert("No matches found. Try selecting other samples.");
      return;
    }

    // --- 5. Confirm activation ---
    if (confirm(`Preview: found ${allButtons.length} buttons. Click OK to activate them.`)) {
      clickAll(allButtons)
        .then(() => prepareForPrinting())
        .then(total => {
          alert(`✅ All offers loaded (${total}). Now press Ctrl/⌘+P to save a full PDF.`);
        });
    } else {
      alert("Cancelled. (Outlines remain for reference.)");
    }
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKey, true);

  // --- 6. Button recognition builder ---
  function buildMatcher(samples) {
    // Learn common tag, class names, and text like "Activate" or "Add"
    const verbs = /add|activate|enroll|save|offer|card/i;
    return function(el) {
      if (!isVisible(el)) return false;
      const label = ariaOrTitle(el) || textOf(el);
      return verbs.test(label);
    };
  }

  // --- 7. Gather all matching elements ---
  function findAllMatchingButtons(matcher) {
    const candidates = Array.from(document.querySelectorAll("button,[role='button'],a,[tabindex]"));
    return candidates.filter(el => matcher(el));
  }

  // --- 8. Auto-click them with delay ---
  function clickAll(btns) {
    return new Promise(resolve => {
      (function loop(i) {
        if (i >= btns.length) return resolve();
        try {
          btns[i].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          btns[i].style.outline = "3px solid #4caf50";
        } catch {
          btns[i].style.outline = "3px solid red";
        }
        sleep(700 + Math.random() * 700).then(() => loop(i + 1));
      })(0);
    });
  }

  // --- 9. Prepare for printing ---
  function prepareForPrinting() {
    const css = `
      @page { margin: 12mm; }
      * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .ofx-no-ellipsis * {
        text-overflow: clip !important;
        overflow: visible !important;
        white-space: normal !important;
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    style.media = "print";
    document.head.appendChild(style);
    document.documentElement.classList.add("ofx-no-ellipsis");

    // Scroll to load all offers before printing
    return autoScroll();
  }

  // --- 10. Auto-scroll to load all offers ---
  function autoScroll(max = 90, wait = 900) {
    function count() {
      return document.querySelectorAll("[class*='offer'],[role='listitem']").length;
    }
    return new Promise(resolve => {
      let last = 0, same = 0, i = 0;
      (function scrollLoop() {
        if (i++ >= max || same >= 3) return resolve(last);
        window.scrollTo(0, document.documentElement.scrollHeight);
        sleep(wait).then(() => {
          const now = count();
          if (now === last) same++;
          else { same = 0; last = now; }
          scrollLoop();
        });
      })();
    });
  }
})();
