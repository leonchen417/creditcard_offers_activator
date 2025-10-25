(() => {
  /** 1) Allow-list: Amex/Citi/Chase OFFER pages only */
  const host = location.hostname, path = location.pathname, href = location.href;
  const isAmex = (/(^|\.)americanexpress\.com$|(^|\.)aexp\.com$/i.test(host)) && (/\/offers(\/|$)/i.test(path));
  const isCiti = (/(^|\.)citi\.com$/i.test(host)) && (/\/merchantoffers(\/|$)/i.test(path));
  const isChase = (/(^|\.)chase\.com$/i.test(host)) && (/merchantOffers/i.test(href));
  if (!(isAmex || isCiti || isChase)) { alert("❌ Amex/Citi/Chase OFFER pages only."); return; }

  if (window.__OFX && window.__OFX.active) { alert("Learner already running."); return; }

  /** 2) Helpers */
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

  /** 3) Chase navigation freeze (to stop hash-route redirects) */
  function withNavFreeze(run) {
    const origHref = location.href;
    const linkGuard = (ev) => {
      const linkEl = ev.target && ev.target.closest && ev.target.closest("a,[role='link'],[href]");
      if (!linkEl) return; ev.preventDefault(); ev.stopPropagation();
    };
    const origPush = history.pushState, origReplace = history.replaceState;
    history.pushState = function () {}; history.replaceState = function () {};
    const hashReverter = () => {
      if (/merchantOffers\/offer-activated/i.test(location.href)) {
        const originalHash = origHref.split("#")[1] || "";
        location.hash = originalHash;
      }
    };
    window.addEventListener("hashchange", hashReverter, true);
    document.addEventListener("click", linkGuard, true);
    return Promise.resolve(run()).finally(() => {
      document.removeEventListener("click", linkGuard, true);
      window.removeEventListener("hashchange", hashReverter, true);
      history.pushState = origPush; history.replaceState = origReplace;
    });
  }

  /** 4) Chase: prefer inner “Add/Activate/Enroll” controls */
  function chasePreferButtons() {
    const sel = "[aria-label*='Add'],[aria-label*='Activate'],[aria-label*='Enroll'],button[aria-label],[role='button'][aria-label]";
    return [...document.querySelectorAll(sel)].filter(el => /add|activate|enroll/i.test(ariaLabel(el) || ""));
  }

  /** 5) Build matcher from user samples */
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

  /** 6) Candidate gathering (Chase override) */
  function gatherAll(matcher) {
    let cand = [...document.querySelectorAll("button,[role='button'],a,[tabindex]")];
    if (isChase) {
      const preferred = chasePreferButtons();
      if (preferred.length) cand = preferred;
    }
    const out = [], seen = new Set();
    for (const el of cand) {
      const a = clickableAncestor(el);
      if (seen.has(a)) continue; seen.add(a);
      if (matcher(a)) out.push(a);
    }
    return out.filter(isVisible);
  }

  /** 7) Visual outline */
  function outlineEl(el, color) { try { el.style.outline = `3px solid ${color}`; } catch {} }

  /** 8) PRINT PREP — expand text, undo clamps, but DO NOT call window.print() */
  function injectPrintCSS() {
    const style = document.createElement("style");
    style.setAttribute("data-ofx-print", "1");
    style.media = "print";
    style.textContent = `
      @page { margin: 12mm; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      a[href]:after { content: ""; }
    `;
    document.head.appendChild(style);
  }

  function expandForPDF() {
    const all = document.querySelectorAll("*");
    for (const el of all) {
      el.style.setProperty("text-overflow", "clip", "important");
      el.style.setProperty("overflow", "visible", "important");
      el.style.setProperty("white-space", "normal", "important");
      el.style.setProperty("-webkit-line-clamp", "unset", "important");
      el.style.setProperty("line-clamp", "unset", "important");
      if (getComputedStyle(el).display === "-webkit-box") {
        el.style.setProperty("display", "block", "important");
      }
    }
    document.querySelectorAll("details:not([open])").forEach(d => d.setAttribute("open",""));
    document.querySelectorAll("img[loading]").forEach(img => img.loading = "eager");
  }

  function showPrintBanner() {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const shortcut = isMac ? "⌘P" : "Ctrl+P";
    const bar = document.createElement("div");
    bar.setAttribute("data-ofx-banner","1");
    bar.style.cssText = `
      position: fixed; inset: 12px 12px auto 12px; z-index: 2147483647;
      background: #111; color: #fff; padding: 10px 14px; border-radius: 8px;
      font: 14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      box-shadow: 0 6px 20px rgba(0,0,0,.3);
    `;
    bar.innerHTML = `
      <strong>Page prepared for PDF.</strong>
      <div style="opacity:.9;margin-top:4px">
        Use <b>${shortcut}</b> or your browser menu to open <b>Print</b>, then “Save as PDF”.
      </div>
      <button type="button" style="
        margin-top:8px; background:#2e7d32; color:#fff; border:0; padding:6px 10px; border-radius:6px; cursor:pointer;
      ">OK</button>
    `;
    bar.querySelector("button").onclick = () => bar.remove();
    document.body.appendChild(bar);
  }

  async function prepareForUserPrint() {
    injectPrintCSS();
    expandForPDF();
    await new Promise(r => setTimeout(r, 100)); // let layout settle
    showPrintBanner(); // just inform; do NOT call window.print()
  }

  /** 9) Click loop (Chase uses nav freeze) */
  async function clickAll(list) {
    const runBatch = async () => {
      for (const b of list) {
        b.scrollIntoView({ block: "center" });
        outlineEl(b, "#2196f3");
        await sleepMs(300 + Math.random() * 700);
        try {
          b.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
          outlineEl(b, "#4caf50");
          await sleepMs(700 + Math.random() * 700);
        } catch {
          outlineEl(b, "red");
        }
      }
    };
    if (isChase) { await withNavFreeze(runBatch); } else { await runBatch(); }
    await prepareForUserPrint(); // <-- prep only; user initiates print
  }

  /** 10) Main: Learn → Preview → (Confirm) → Click → Prep */
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
