(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* storage blocked: the deck still works, it just forgets */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* storage blocked */
      }
    },
  };
  const deck = $("#deck");
  const slides = $$(".slide");
  const total = slides.length;
  let current = -1;

  /* ---------- Parts & progress ---------- */
  const parts = [];
  slides.forEach((slide, i) => {
    const name = slide.dataset.part;
    const last = parts[parts.length - 1];
    if (!last || last.name !== name) parts.push({ name, start: i, count: 0 });
    parts[parts.length - 1].count += 1;
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "hoja");
    slide.setAttribute("aria-label", `Hoja ${i + 1} de ${total}: ${slide.dataset.title}`);
  });

  const progress = $("#progress");
  const segs = parts.map((part) => {
    const btn = document.createElement("button");
    btn.className = "seg";
    btn.type = "button";
    btn.style.setProperty("--n", part.count);
    btn.title = `${part.name} (hoja ${part.start + 1})`;
    btn.setAttribute("aria-label", `Ir a ${part.name}`);
    btn.append(document.createElement("i"));
    btn.addEventListener("click", () => go(part.start));
    progress.append(btn);
    return btn;
  });

  /* ---------- Navigation ---------- */
  function go(index) {
    const next = Math.max(0, Math.min(total - 1, index));
    if (next === current) return;
    slides.forEach((slide, i) => {
      const active = i === next;
      slide.classList.toggle("is-active", active);
      slide.classList.toggle("is-before", i < next);
      slide.inert = !active;
      slide.setAttribute("aria-hidden", String(!active));
    });
    current = next;
    slides[next].scrollTop = 0;

    $("#counter").textContent = `${next + 1} / ${total}`;
    $("#btnPrev").disabled = next === 0;
    $("#btnNext").disabled = next === total - 1;
    const partIndex = parts.findLastIndex((p) => p.start <= next);
    $("#partChip").textContent = parts[partIndex].name;
    parts.forEach((part, i) => {
      const done = Math.min(1, Math.max(0, (next - part.start + 1) / part.count));
      segs[i].style.setProperty("--p", next >= part.start ? done : 0);
      segs[i].setAttribute("aria-current", String(i === partIndex));
    });

    history.replaceState(null, "", `#${next + 1}`);
    store.set("promos-deck-slide-v4", String(next));
    hideTip();
  }

  $("#btnPrev").addEventListener("click", () => go(current - 1));
  $("#btnNext").addEventListener("click", () => go(current + 1));

  /* data-go: "next", "prev", a sheet number or a slide id (so links survive reordering). */
  function indexOfTarget(target) {
    if (/^\d+$/.test(target)) return Number(target) - 1;
    return slides.findIndex((slide) => slide.id === target);
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-go]");
    if (!trigger) return;
    if (trigger.tagName === "A") event.preventDefault();
    const target = trigger.dataset.go;
    if (target === "next") go(current + 1);
    else if (target === "prev") go(current - 1);
    else {
      const index = indexOfTarget(target);
      if (index >= 0) go(index);
    }
    if (indexDialog.open) indexDialog.close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (indexDialog.open || zoomDialog.open) return;
    const typing = event.target.closest("input, textarea, select, [contenteditable]");
    const onControl = event.target.closest("button, a, label");
    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
        if (typing) return;
        event.preventDefault();
        go(current + 1);
        break;
      case "ArrowLeft":
      case "PageUp":
        if (typing) return;
        event.preventDefault();
        go(current - 1);
        break;
      case " ":
        if (typing || onControl) return;
        event.preventDefault();
        go(current + (event.shiftKey ? -1 : 1));
        break;
      case "Home":
        if (typing) return;
        go(0);
        break;
      case "End":
        if (typing) return;
        go(total - 1);
        break;
      case "i":
      case "I":
        if (typing) return;
        openIndex();
        break;
      default:
    }
  });

  /* Swipe on touch screens; vertical scrolling inside a slide stays native. */
  let touchStart = null;
  const viewport = $("#viewport");
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    if (event.target.closest("input, button, a, label, .jmap, .msg pre")) return;
    touchStart = { x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener("pointerup", (event) => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) go(current + (dx < 0 ? 1 : -1));
  });
  viewport.addEventListener("pointercancel", () => {
    touchStart = null;
  });

  window.addEventListener("hashchange", () => {
    const n = Number(location.hash.slice(1));
    if (n >= 1 && n <= total) go(n - 1);
  });

  /* ---------- Index ---------- */
  const indexDialog = $("#indexDialog");
  const idxBody = $("#idxBody");
  parts.forEach((part) => {
    const section = document.createElement("section");
    section.className = "idx-part";
    const title = document.createElement("h3");
    title.textContent = part.name;
    const list = document.createElement("ol");
    for (let i = part.start; i < part.start + part.count; i += 1) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.go = String(i + 1);
      const num = document.createElement("span");
      num.textContent = String(i + 1);
      const label = document.createElement("span");
      label.textContent = slides[i].dataset.title;
      btn.append(num, label);
      li.append(btn);
      list.append(li);
    }
    section.append(title, list);
    idxBody.append(section);
  });

  function openIndex() {
    $$("button[data-go]", idxBody).forEach((btn) => {
      btn.setAttribute("aria-current", String(Number(btn.dataset.go) - 1 === current));
    });
    indexDialog.showModal();
    $(`button[data-go="${current + 1}"]`, idxBody)?.focus();
  }
  $("#btnIndex").addEventListener("click", openIndex);
  $("#btnIndexClose").addEventListener("click", () => indexDialog.close());
  indexDialog.addEventListener("click", (event) => {
    if (event.target === indexDialog) indexDialog.close();
  });

  /* ---------- Zoom: any screenshot opens full size ---------- */
  const zoomDialog = $("#zoomDialog");
  const zoomImg = $("#zoomImg");
  const zoomCap = $("#zoomCap");
  document.addEventListener("click", (event) => {
    const img = event.target.closest(".shot img");
    if (!img) return;
    zoomImg.src = img.currentSrc || img.src;
    zoomImg.alt = img.alt;
    const caption = img.closest(".shot").querySelector("figcaption");
    zoomCap.textContent = caption ? caption.textContent.trim() : "";
    zoomCap.hidden = !caption;
    zoomDialog.showModal();
  });
  zoomDialog.addEventListener("click", () => zoomDialog.close());

  /* ---------- Theme ----------
     Follows the system until the button picks one; that choice is saved. Picking the
     system's own theme clears it, so the deck goes back to following the system.
     The key changed (v2) so a choice saved by the old toggle doesn't pin the theme. */
  const THEME_KEY = "promos-deck-theme-v2";
  const root = document.documentElement;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const systemTheme = () => (darkQuery.matches ? "dark" : "light");
  store.remove("promos-deck-theme");
  const savedTheme = store.get(THEME_KEY);
  if (savedTheme === "dark" || savedTheme === "light") root.dataset.theme = savedTheme;
  const effectiveTheme = () => root.dataset.theme || systemTheme();
  function paintThemeButton() {
    const dark = effectiveTheme() === "dark";
    $("#themeIcon").setAttribute("href", dark ? "#i-sun" : "#i-moon");
    $("#btnTheme").setAttribute("aria-label", dark ? "Pasar a modo claro" : "Pasar a modo oscuro");
  }
  function applyTheme(next) {
    if (next === systemTheme()) {
      delete root.dataset.theme;
      store.remove(THEME_KEY);
    } else {
      root.dataset.theme = next;
      store.set(THEME_KEY, next);
    }
    paintThemeButton();
  }
  /* The new theme grows as a circle from the button (same idea as the app's dark-mode
     switch, which grows from the center). Without View Transitions or with reduced
     motion, it just switches. */
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let themeTransition = null;
  $("#btnTheme").addEventListener("click", async () => {
    /* A click mid-animation finishes the running one first (it also unsticks a transition
       that never got a frame, e.g. in a background tab). */
    if (themeTransition) {
      themeTransition.skipTransition();
      await themeTransition.updateCallbackDone.catch(() => {});
    }
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    if (!document.startViewTransition || reducedMotion.matches || document.hidden) {
      applyTheme(next);
      return;
    }
    const box = $("#btnTheme").getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => applyTheme(next));
    themeTransition = transition;
    transition.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 500, easing: "cubic-bezier(0.32, 0, 0.67, 0)", pseudoElement: "::view-transition-new(root)" },
        ),
      )
      .catch(() => {});
    transition.finished
      .catch(() => {})
      .finally(() => {
        if (themeTransition === transition) themeTransition = null;
      });
  });
  darkQuery.addEventListener("change", paintThemeButton);
  paintThemeButton();

  /* ---------- Tooltip ---------- */
  const tip = $("#tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const pad = 14;
    const rect = tip.getBoundingClientRect();
    let left = x + pad;
    let top = y + pad;
    if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
    if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }
  function hideTip() {
    tip.hidden = true;
  }
  $$("[data-tip]").forEach((el) => {
    el.addEventListener("pointermove", (event) => showTip(el.dataset.tip, event.clientX, event.clientY));
    el.addEventListener("pointerleave", hideTip);
  });

  /* ---------- Journey ---------- */
  const jNodes = $$(".jnode");
  const jSteps = $$(".jstep");
  const jX = [100, 300, 500, 700, 900];
  let jCurrent = 0;
  function setStep(n) {
    jCurrent = Math.max(0, Math.min(jSteps.length - 1, n));
    jNodes.forEach((node, i) => {
      node.classList.toggle("is-current", i === jCurrent);
      node.classList.toggle("is-done", i < jCurrent);
      node.setAttribute("aria-current", String(i === jCurrent));
    });
    jSteps.forEach((step, i) => {
      step.hidden = i !== jCurrent;
    });
    $("#jline").setAttribute("x2", String(jX[jCurrent]));
    $("#jPrev").disabled = jCurrent === 0;
    $("#jNext").disabled = jCurrent === jSteps.length - 1;
    $("#jCount").textContent = `Paso ${jCurrent + 1} de ${jSteps.length}`;
  }
  jNodes.forEach((node, i) => {
    node.addEventListener("click", () => setStep(i));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setStep(i);
      }
    });
  });
  $("#jPrev").addEventListener("click", () => setStep(jCurrent - 1));
  $("#jNext").addEventListener("click", () => setStep(jCurrent + 1));
  setStep(0);

  /* ---------- Saved checkboxes ---------- */
  $$("input[type=checkbox][data-save]").forEach((box) => {
    const key = `promos-deck-check-${box.dataset.save}`;
    box.checked = store.get(key) === "1";
    box.addEventListener("change", () => store.set(key, box.checked ? "1" : "0"));
  });

  /* ---------- Copy message (any button with data-copy="<id del <pre>>") ---------- */
  $$("[data-copy]").forEach((btn) => {
    const label = $(".copy-label", btn);
    const original = label.textContent;
    btn.addEventListener("click", async () => {
      const pre = document.getElementById(btn.dataset.copy);
      const text = pre.textContent.trim();
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        const selection = window.getSelection();
        const rangeSel = document.createRange();
        rangeSel.selectNodeContents(pre);
        selection.removeAllRanges();
        selection.addRange(rangeSel);
        try {
          ok = document.execCommand("copy");
        } catch {
          ok = false;
        }
      }
      label.textContent = ok ? "¡Copiado!" : "Seleccionado: copialo con Cmd+C";
      setTimeout(() => {
        label.textContent = original;
      }, 2400);
    });
  });

  /* ---------- Start ---------- */
  const fromHash = Number(location.hash.slice(1));
  const fromStore = Number(store.get("promos-deck-slide-v4"));
  const start = fromHash >= 1 && fromHash <= total ? fromHash - 1 : Number.isInteger(fromStore) ? fromStore : 0;
  deck.classList.add("no-anim");
  go(start);
  requestAnimationFrame(() => requestAnimationFrame(() => deck.classList.remove("no-anim")));
})();
