// Kiosk lock: lets a teacher/carer lock the device to this site.
// Include on the portal AND any game page that should enforce the lock:
//   <link rel="stylesheet" href="shared/lock.css" />   (or "../../shared/lock.css" from a game folder)
//   <script src="shared/lock.js"></script>
//
// This is the one deliberate exception to "games never import /shared/":
// it is portal-owned safety/enforcement, not game logic, and every game
// includes it unmodified. Navigation between games and the home screen
// stays completely free while locked — the lock only guards against
// leaving the site itself (closing fullscreen, switching apps, etc).
//
// Storage is shared across all pages on this origin via localStorage:
//   ls_lock_enabled: "1" | absent
//   ls_lock_code:    passcode set by the teacher (3 digits)
//
// Browsers exit fullscreen on any navigation (and won't let JS re-enter
// fullscreen without a fresh user gesture), so a same-site link click
// (exit-to-home, a game card) arms a short sessionStorage grace flag
// before navigating. The destination page consumes it and just stays
// windowed and unlocked-looking (small "locked" badge instead of the
// passcode gate) rather than trying and failing to force fullscreen
// back on. The lock re-asserts itself (gate + fullscreen request) the
// next time the child taps anything on the page, and immediately on
// any real exit-risk signal: tab/app switch, or landing on a locked
// page fresh (no grace flag) such as a bookmark or reopened tab.
//
// Forgotten-code recovery: a fixed master override always works. It is
// documented in README.md for staff use.
(function () {
  const MASTER_CODE = "758243";
  const CODE_LENGTH = 3;
  const ENABLED_KEY = "ls_lock_enabled";
  const CODE_KEY = "ls_lock_code";
  const NAV_GRACE_KEY = "ls_lock_nav_grace";
  const NAV_GRACE_MS = 5000;

  function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) === "1";
  }

  function getCode() {
    return localStorage.getItem(CODE_KEY) || "";
  }

  function injectStylesheetIfMissing() {
    if (document.querySelector('link[href$="shared/lock.css"]')) return;
    const depth = location.pathname.includes("/games/") ? "../../" : "";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${depth}shared/lock.css`;
    document.head.appendChild(link);
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const child of children || []) node.appendChild(child);
    return node;
  }

  function buildCodeInputs(container) {
    container.innerHTML = "";
    const inputs = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      const input = el("input", {
        type: "tel",
        inputmode: "numeric",
        pattern: "[0-9]*",
        maxlength: "1",
        "aria-label": `Digit ${i + 1}`,
      });
      inputs.push(input);
      container.appendChild(input);
    }
    inputs.forEach((input, i) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/[^0-9]/g, "").slice(0, 1);
        if (input.value && inputs[i + 1]) inputs[i + 1].focus();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && inputs[i - 1]) {
          inputs[i - 1].focus();
        }
      });
    });
    return inputs;
  }

  function readCode(inputs) {
    return inputs.map((i) => i.value).join("");
  }

  function requestFullscreen() {
    const de = document.documentElement;
    const req =
      de.requestFullscreen ||
      de.webkitRequestFullscreen ||
      de.msRequestFullscreen;
    if (req) req.call(de).catch(() => {});
  }

  function exitFullscreen() {
    const exit =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.msExitFullscreen;
    if (document.fullscreenElement && exit) exit.call(document).catch(() => {});
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );
  }

  // Real browsers exit fullscreen on any page navigation. Clicking a
  // same-site link (the exit-to-home link, a game card) is expected
  // free navigation, not "leaving the site" — so we mark a short grace
  // window right before navigating. The next page sees the flag and
  // skips the gate (see suspendEnforcementForGraceNav).
  function armNavGrace() {
    sessionStorage.setItem(NAV_GRACE_KEY, String(Date.now()));
  }

  function consumeNavGrace() {
    const stamp = Number(sessionStorage.getItem(NAV_GRACE_KEY) || 0);
    sessionStorage.removeItem(NAV_GRACE_KEY);
    return stamp > 0 && Date.now() - stamp < NAV_GRACE_MS;
  }

  function isSameSiteLink(anchor) {
    return (
      anchor &&
      anchor.href &&
      anchor.origin === location.origin &&
      !anchor.target
    );
  }

  function watchSameSiteLinks() {
    document.addEventListener(
      "click",
      (e) => {
        const anchor = e.target.closest && e.target.closest("a[href]");
        if (isSameSiteLink(anchor)) armNavGrace();
      },
      true
    );
  }

  // Builds the shared unlock UI: 3-digit code row + a "Forgot the
  // passcode?" reveal for the longer master override code. Used by both
  // the re-entry gate and the portal's unlock panel.
  function buildUnlockFields(onUnlocked) {
    const errorMsg = el("p", { class: "ls-lock-error", "aria-live": "polite" });
    const codeRow = el("div", { class: "ls-lock-code-row" });
    const inputs = buildCodeInputs(codeRow);

    const masterRow = el("div", { class: "ls-lock-code-row", hidden: "" });
    const masterInput = el("input", {
      type: "tel",
      inputmode: "numeric",
      pattern: "[0-9]*",
      maxlength: String(MASTER_CODE.length),
      class: "ls-lock-master-input",
      "aria-label": "Master override code",
      placeholder: "Master code",
    });
    masterRow.appendChild(masterInput);

    const forgotBtn = el("button", {
      type: "button",
      class: "ls-lock-forgot",
      text: "Forgot the passcode?",
    });
    forgotBtn.addEventListener("click", () => {
      masterRow.hidden = !masterRow.hidden;
      if (!masterRow.hidden) masterInput.focus();
    });

    function tryUnlock() {
      const entered = readCode(inputs);
      const masterEntered = masterInput.value.trim();
      if (entered === getCode() || masterEntered === MASTER_CODE) {
        localStorage.removeItem(ENABLED_KEY);
        onUnlocked();
      } else {
        errorMsg.textContent = "That code isn't right. Try again.";
        inputs.forEach((i) => (i.value = ""));
        masterInput.value = "";
        inputs[0].focus();
      }
    }

    inputs[inputs.length - 1].addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
    masterInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });

    return { codeRow, masterRow, forgotBtn, errorMsg, inputs, tryUnlock };
  }

  // --- Re-entry gate: shown whenever locked and fullscreen has been left ---

  let gateOverlay = null;

  function buildGate() {
    const fields = buildUnlockFields(() => {
      hideGate();
      exitFullscreen();
    });

    const unlockBtn = el("button", {
      type: "button",
      class: "ls-lock-primary",
      text: "Unlock",
    });
    unlockBtn.addEventListener("click", fields.tryUnlock);

    const resumeBtn = el("button", {
      type: "button",
      class: "ls-lock-secondary",
      text: "Stay locked & continue playing",
    });
    resumeBtn.addEventListener("click", () => {
      hideGate();
      requestFullscreen();
    });

    const card = el(
      "div",
      { class: "ls-lock-card" },
      [
        el("h2", { text: "Locked to this site" }),
        el("p", { text: "Enter the passcode to unlock, or go back in." }),
        fields.codeRow,
        fields.masterRow,
        fields.forgotBtn,
        fields.errorMsg,
        el("div", { class: "ls-lock-actions" }, [unlockBtn, resumeBtn]),
      ]
    );

    const overlay = el("div", {
      class: "ls-lock-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Site locked",
      hidden: "",
    }, [card]);

    overlay._inputs = fields.inputs;
    overlay._errorMsg = fields.errorMsg;
    return overlay;
  }

  function showGate() {
    if (!gateOverlay) {
      gateOverlay = buildGate();
      document.body.appendChild(gateOverlay);
    }
    gateOverlay._errorMsg.textContent = "";
    gateOverlay._inputs.forEach((i) => (i.value = ""));
    gateOverlay.hidden = false;
    gateOverlay._inputs[0].focus();
  }

  function hideGate() {
    if (gateOverlay) gateOverlay.hidden = true;
  }

  // True once this page has decided to skip fullscreen enforcement for
  // now (landed here via a same-site nav, can't force fullscreen back
  // on without a fresh gesture). Cleared as soon as the child taps
  // anything — that tap is a fresh gesture, so the lock can safely
  // re-assert fullscreen at that point instead of staying suspended.
  let enforcementSuspended = false;

  function checkFullscreenState() {
    if (!isEnabled() || enforcementSuspended) return;
    if (!isFullscreen()) {
      showGate();
    }
  }

  // --- Small persistent badge on game pages while locked & suspended ---

  let lockBadge = null;

  function showLockBadge() {
    if (document.querySelector(".ls-lock-btn")) return; // portal already shows lock state
    if (!lockBadge) {
      lockBadge = el(
        "button",
        {
          type: "button",
          class: "ls-lock-badge",
          "aria-label": "Site locked. Tap to resume full screen.",
        },
        [document.createTextNode("🔒 Locked")]
      );
      lockBadge.addEventListener("click", () => {
        requestFullscreen();
        hideLockBadge();
      });
      document.body.appendChild(lockBadge);
    }
    lockBadge.hidden = false;
  }

  function hideLockBadge() {
    if (lockBadge) lockBadge.hidden = true;
  }

  function suspendEnforcementForGraceNav() {
    enforcementSuspended = true;
    showLockBadge();

    const resume = () => {
      if (!enforcementSuspended) return;
      enforcementSuspended = false;
      hideLockBadge();
      requestFullscreen();
      document.removeEventListener("pointerdown", resume, true);
      document.removeEventListener("keydown", resume, true);
    };
    document.addEventListener("pointerdown", resume, true);
    document.addEventListener("keydown", resume, true);
  }

  // --- Portal-only setup UI: lock icon + set-passcode / enable flow ---

  function buildSetupPanel(onDone) {
    const codeRow = el("div", { class: "ls-lock-code-row" });
    const inputs = buildCodeInputs(codeRow);
    const errorMsg = el("p", { class: "ls-lock-error", "aria-live": "polite" });

    const enableBtn = el("button", {
      type: "button",
      class: "ls-lock-primary",
      text: "Set passcode & lock",
    });
    const cancelBtn = el("button", {
      type: "button",
      class: "ls-lock-secondary",
      text: "Cancel",
    });

    enableBtn.addEventListener("click", () => {
      const code = readCode(inputs);
      if (code.length !== CODE_LENGTH) {
        errorMsg.textContent = `Enter all ${CODE_LENGTH} digits.`;
        return;
      }
      localStorage.setItem(CODE_KEY, code);
      localStorage.setItem(ENABLED_KEY, "1");
      onDone(true);
    });

    cancelBtn.addEventListener("click", () => onDone(false));

    return el(
      "div",
      { class: "ls-lock-card" },
      [
        el("h2", { text: "Lock to this site" }),
        el("p", {
          text:
            "Set a 3-digit passcode. A carer will need it to unlock the device.",
        }),
        codeRow,
        errorMsg,
        el("div", { class: "ls-lock-actions" }, [enableBtn, cancelBtn]),
      ]
    );
  }

  function buildUnlockPanel(onDone) {
    const fields = buildUnlockFields(() => {
      exitFullscreen();
      onDone(true);
    });

    const unlockBtn = el("button", {
      type: "button",
      class: "ls-lock-primary",
      text: "Unlock",
    });
    unlockBtn.addEventListener("click", fields.tryUnlock);

    const cancelBtn = el("button", {
      type: "button",
      class: "ls-lock-secondary",
      text: "Cancel",
    });
    cancelBtn.addEventListener("click", () => onDone(false));

    return el(
      "div",
      { class: "ls-lock-card" },
      [
        el("h2", { text: "Unlock this site" }),
        el("p", { text: "Enter the passcode used to lock it." }),
        fields.codeRow,
        fields.masterRow,
        fields.forgotBtn,
        fields.errorMsg,
        el("div", { class: "ls-lock-actions" }, [unlockBtn, cancelBtn]),
      ]
    );
  }

  function setupPortalUI() {
    const btn = el("button", {
      type: "button",
      class: "ls-lock-btn",
      "aria-label": "Lock this site",
      text: "🔓",
    });

    const overlay = el("div", {
      class: "ls-lock-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": "Site lock settings",
      hidden: "",
    });

    function refreshBtn() {
      btn.textContent = isEnabled() ? "🔒" : "🔓";
      btn.setAttribute(
        "aria-label",
        isEnabled() ? "Unlock this site" : "Lock this site"
      );
    }

    function closeOverlay() {
      overlay.hidden = true;
      overlay.innerHTML = "";
    }

    btn.addEventListener("click", () => {
      overlay.innerHTML = "";
      const panel = isEnabled()
        ? buildUnlockPanel((changed) => {
            closeOverlay();
            refreshBtn();
          })
        : buildSetupPanel((changed) => {
            closeOverlay();
            refreshBtn();
            if (changed) requestFullscreen();
          });
      overlay.appendChild(panel);
      overlay.hidden = false;
      const firstInput = overlay.querySelector("input");
      if (firstInput) firstInput.focus();
    });

    document.body.appendChild(btn);
    document.body.appendChild(overlay);
    refreshBtn();
  }

  function init() {
    injectStylesheetIfMissing();
    watchSameSiteLinks();

    if (document.body.dataset.lsPortal === "true" || document.getElementById("game-grid")) {
      setupPortalUI();
    }

    document.addEventListener("fullscreenchange", checkFullscreenState);
    document.addEventListener("webkitfullscreenchange", checkFullscreenState);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkFullscreenState();
    });

    // If arriving on a page while already locked (e.g. navigated from
    // another game), fullscreen was just exited by the browser as part
    // of that navigation. If it was a same-site link we just clicked
    // through (home <-> game), the browser won't let JS force
    // fullscreen back on without a fresh gesture — so stay windowed,
    // unlocked-looking, badge instead of gate, until the child's next
    // tap re-asserts it. Otherwise (fresh tab, bookmark, address bar)
    // there was no such click here, so gate immediately.
    if (isEnabled() && !isFullscreen()) {
      if (consumeNavGrace()) {
        suspendEnforcementForGraceNav();
      } else {
        showGate();
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
