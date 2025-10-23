(() => {
  /** 1) Allow-list: Amex/Citi/Chase offer pages only */
  const host = location.hostname, path = location.pathname, href = location.href;
  const isAmex = (/(^|\.)americanexpress\.com$|(^|\.)aexp\.com$/i.test(host)) && (/\/offers(\/|$)/i.test(path));
  const isCiti = (/(^|\.)citi\.com$/i.test(host)) && (/\/merchantoffers(\/|$)/i.test(path));
  const isChase = (/(^|\.)chase\.com$/i.test(host)) && (/merchantOffers/i.test(href));
  if (!(isAmex || isCiti || isChase)) { alert("❌ Amex/Citi/Chase OFFER pages only."); return; }

  if (window.__OFX && window.__OFX.active) { alert("Learner already running."); return; }

  const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));
  const isVisible = (el) => {
    try { const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    } catch { return false; }
  };
  const getText = (el) => (((el?.innerText ?? "") || (el?.textContent ?? "")) + "").trim();
  const toLower = (s) => (s || "").toLowerCase();
  const clickableAncestor = (el) => el.closest("button,[role='button'],a[href],[tabindex]:not([tabindex='-1'])") || el;
  const nearbyLabel = (el) => { let p = el, d = 0;
    while (p && d++ < 3) {
      const pt = toLower(getText(p)); if (/(add|activate|enroll|save|card|offer)/i.test(pt)) return pt;
      for (const c of p.children) { if (c === el) continue;
        const ct = toLower(getText(c)); if (/(add|activate|enroll|save|card|offer)/i.test(ct)) return ct;
      } p = p.parentElement;
    } return "";
  };
  const classSet = (el) => new Set(String(el.className || "").split(/\s+/).filter(Boolean));
  const ariaLabel = (el) => el.getAttribute?.("aria-label") || el.getAttribute?.("title") || "";

  /** 2) NAV GUARD: block link clicks + router navigation during auto-clicks */
  function withNavFreeze(run) {
    const origHref = location.href;
    // Block anchor/link default navigation
    const linkGuard = (ev) => {
      const linkEl = ev.target && ev.target.closest && ev.target.closest("a,[role='link'],[href]");
      if (!linkEl) return;
      ev.preventDefault(); ev.stopPropagation();
    };
    // Block SPA router pushes
    const origPush = history.pushState, origReplace = history.replaceState;
    history.pushState = function () { /* frozen */ };
    history.replaceState = function () { /* frozen */ };
    // Revert hash if it changes to offer-activated
    const hashReverter = () => {
      if (/merchantOffers\/offer-activated/i.test(location.href)) {
        // restore original hash (stays on grid)
        const originalHash = origHref.split("#")[1] || "";
        location.hash = originalHash;
      }
    };
    window.addEventListener("hashchange", hashReverter, true);
    document.addEventListener("click", linkGuard, true);

    return Promise.resolve(run()).finally(() => {
      document.removeEventListener("click", linkGuard, true);
      window.removeEventListener("hashchange", hashReverter, true);
      history.pushState = origPush;
      history.replaceState = origReplace;
    });
  }

  /** 3) Chase: prefer inner “Add/Activate/Enroll” controls */
  function chasePreferButtons() {
    const sel = "[aria-label*='Add'],[aria-label*='Activate'],[aria-label*='Enroll'],button[aria-label],[role='button'][aria-label]";
    return [...document.querySelectorAll(sel)].filter(el => /add|activate|enroll/i.test(ariaLabel(el) || ""));
  }

  /** 4) Build matcher from user samples */
  function buildMatcher(samples) {
    const tags = [...new Set(samples.map(b => b.tagName.toLowerCase()))];
    samples.map(b => b.getAttribute && b.getAttribute("role")).find(Boolean);
    let inter = null;
    for (const s of samples) { const cs = classSet(s); inter = inter ? new Set([...inter].filter(x => cs.has(x))) : cs; }
    inter = inter ? new Set([...inter].filter(x => x.length > 2)) : new Set();
    const labels = samples.map(b => toLower(ariaLabel(b) || getText(b) || nearbyLabel(b))).filter(Boolean);
    const verb = /add|activate|enroll|save/;
    const hasVerb = labels.some(l => verb.test(l));
    const labelRe = hasVerb ? verb : null;
    let css = tags.length === 1 ? tags[0] : "button,[role='button']";
    if (inter.size) css += "." + [...inter].slice(0, 3).join(".");
    return function isMatch(el) {
      if (!isVisible(el)) return false;
      const a = clickableAncestor(el);
      if (a !== el) return false;
      if (css !== "button,[role='button']") { if (!el.matches(css)) return false; }
      else { if (!(el.matches("button,[role='button']") || el.tagName.toLowerCase() === "a")) return false; }
      const L = toLower(ariaLabel(el) || getText(el) || nearbyLabel(el));
      return labelRe ? labelRe.test(L) : verb.test(L) || L.includes("card") || L.includes("offer");
    };
  }

  /** 5) Candidate gathering (Chase override) */
  function gatherAll(matcher) {
    let cand = [...document.querySelectorAll("button,[role='button'],a,[tabindex]")];
    if (isChase) {
      const preferred = chasePreferButtons();
      if (preferred.length) cand = preferred;
    }
    const out = [], seen = new Set();
    for (const el of cand) {
      const a = clickableAncestor(el);
      if (seen.has(a)) continue;
      seen.add(a);
      if (matcher(a)) out.push(a);
    }
    return out.filter(isVisible);
  }

  /** 6) Visual outline */
  function outlineEl(el, color) { try { el.style.outline = `3px solid ${color}`; } catch {} }

  /** 7) Click loop (with nav freeze) */
  async function clickAll(list) {
    let okCnt = 0, errCnt = 0;
    await withNavFreeze(async () => {
      for (const b of list) {
        b.scrollIntoView({ block: "center" });
        outlineEl(b, "#2196f3");
        await sleepMs(300 + Math.random() * 700);
        try {
          b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          outlineEl(b, "#4caf50");
          okCnt++;
          await sleepMs(700 + Math.random() * 700);
        } catch {
          outlineEl(b, "red");
          errCnt++;
        }
      }
    });
    alert(`✅ Clicked: ${okCnt} • ❌ Errors: ${errCnt}`);
  }

  /** 8) Main Learn → Preview → Activate */
  const state = { samples: [], matcher: null, active: true };
  window.__OFX = state;
  alert("LEARN MODE: Click 2–3 real ACTIVATE buttons. Press ESC when done to preview.");

  const onClickCapture = (ev) => {
    const a = clickableAncestor(ev.target);
    if (!a) return;
    state.samples.push(a);
    outlineEl(a, "orange");
    ev.preventDefault();
    ev.stopPropagation();
  };
  const onKeyDown = (ev) => {
    if (ev.key !== "Escape") return;
    document.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("keydown", onKeyDown, true);

    if (state.samples.length < 1) { alert("No samples captured."); state.active = false; return; }

    state.matcher = buildMatcher(state.samples);
    const all = gatherAll(state.matcher);
    all.forEach(b => outlineEl(b, "orange"));
    if (!all.length) { alert("No matches found. Try selecting other samples."); state.active = false; return; }

    if (confirm(`Preview: found ${all.length} buttons. Click OK to activate them.`)) {
      clickAll(all).finally(() => (state.active = false));
    } else {
      state.active = false;
      alert("Cancelled. (Outlines remain for reference.)");
    }
  };

  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", onKeyDown, true);
})();

