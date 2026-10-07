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

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  const darkQuery = matchMedia("(prefers-color-scheme: dark)");
  const savedTheme = store.get("promos-deck-theme");
  if (savedTheme === "dark" || savedTheme === "light") root.dataset.theme = savedTheme;
  const effectiveTheme = () => root.dataset.theme || (darkQuery.matches ? "dark" : "light");
  function paintThemeButton() {
    const dark = effectiveTheme() === "dark";
    $("#themeIcon").setAttribute("href", dark ? "#i-sun" : "#i-moon");
    $("#btnTheme").setAttribute("aria-label", dark ? "Pasar a modo claro" : "Pasar a modo oscuro");
  }
  $("#btnTheme").addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("promos-deck-theme", next);
    paintThemeButton();
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

  /* ---------- Status data (one list feeds the donut and the team cards) ---------- */
  const STATUSES = [
    { id: "prod", label: "Listo", short: "Listo", icon: "i-check" },
    { id: "falta", label: "Falta hacer", short: "Falta hacer", icon: "i-x" },
    { id: "confirmar", label: "Hay que confirmarlo", short: "A confirmar", icon: "i-question" },
  ];
  const TEAMS = [
    { id: "plan", label: "El plan", sub: "documentos y este deck" },
    { id: "front", label: "El código del front", sub: "las 7 etapas · tu parte" },
    { id: "camino", label: "Para llegar a producción", sub: "vos y la API" },
    { id: "gonzalo", label: "Respuestas de Gonzalo", sub: "la ERS" },
    { id: "vero", label: "Respuestas de Verónica", sub: "el Figma" },
  ];
  const PIECES = [
    { team: "plan", st: "prod", name: "Plan general y planes de las 7 etapas" },
    { team: "plan", st: "prod", name: "Este deck, con capturas reales" },
    { team: "front", st: "prod", name: "Etapa 1 · La base" },
    { team: "front", st: "prod", name: "Etapa 2 · Productos: columna y popup" },
    { team: "front", st: "prod", name: "Etapa 3 · Participar y dejar" },
    { team: "front", st: "prod", name: "Etapa 4 · Varias a la vez" },
    { team: "front", st: "prod", name: "Etapa 5 · Modificar oferta y Meli+" },
    { team: "front", st: "prod", name: "Etapa 6 · Pestaña del Asistente" },
    { team: "front", st: "prod", name: "Etapa 7 · Campañas y detalle" },
    { team: "front", st: "prod", name: "Textos en Tolgee" },
    { team: "front", st: "prod", name: "Arreglo del modo demo" },
    { team: "front", st: "prod", name: "Guardado en dev (sin subir)" },
    { team: "camino", st: "falta", name: "Subirlo a dev (con el flag apagado)" },
    { team: "camino", st: "falta", name: "Probarlo con la API real, cuando esté" },
    { team: "camino", st: "falta", name: "Prender el flag para los clientes" },
    { team: "gonzalo", st: "confirmar", name: "Datos que la ERS no trae (precio, Meli+, total, catálogo)" },
    { team: "gonzalo", st: "confirmar", name: "Cuenta de ML y parámetros que faltan" },
    { team: "gonzalo", st: "confirmar", name: "Formato del avance en vivo y de los errores" },
    { team: "gonzalo", st: "confirmar", name: "Reglas: \"en N\", Meli+, fechas y finalizadas" },
    { team: "gonzalo", st: "confirmar", name: "Detalles de publicación: ¿entra en v1?" },
    { team: "gonzalo", st: "confirmar", name: "Nuevas: respuestas vacías, fechas y redondeo" },
    { team: "vero", st: "confirmar", name: "Pantallas sin diseño (hechas con lo que ya existe)" },
    { team: "vero", st: "confirmar", name: "Donde la app sigue a la ERS y no al Figma" },
    { team: "vero", st: "confirmar", name: "Textos, colores y contraste para revisar" },
  ];
  const statusById = Object.fromEntries(STATUSES.map((s) => [s.id, s]));
  const escapeHtml = (text) =>
    text.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
  const pill = (id) => {
    const s = statusById[id];
    return `<span class="pill" data-st="${id}"><svg class="ic" aria-hidden="true"><use href="#${s.icon}"></use></svg>${s.short}</span>`;
  };

  /* ---------- Donut ---------- */
  const svgNS = "http://www.w3.org/2000/svg";
  const donut = $("#donutSvg");
  const legend = $("#donutLegend");
  const detail = $("#donutDetail");
  const detailDefault = detail.innerHTML;
  const counts = STATUSES.map((s) => ({ ...s, items: PIECES.filter((p) => p.st === s.id) }));
  const CX = 120;
  const R = 112;
  const r = 70;
  const point = (radius, angle) => [CX + radius * Math.cos(angle), CX + radius * Math.sin(angle)];
  function arcPath(a0, a1) {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = point(R, a0);
    const [x1, y1] = point(R, a1);
    const [x2, y2] = point(r, a1);
    const [x3, y3] = point(r, a0);
    return `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z`;
  }
  let angle = -Math.PI / 2;
  const arcs = {};
  /* Ring order: green, red, magenta (validated for color-blind separation in light and dark). */
  const RING_ORDER = ["prod", "falta", "confirmar"];
  [...counts].sort((a, b) => RING_ORDER.indexOf(a.id) - RING_ORDER.indexOf(b.id)).forEach((s) => {
    if (!s.items.length) return;
    const sweep = (s.items.length / PIECES.length) * Math.PI * 2;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", arcPath(angle, angle + sweep));
    path.setAttribute("fill", `var(--st-${s.id})`);
    path.dataset.st = s.id;
    path.addEventListener("pointermove", (event) =>
      showTip(`<b>${s.label}</b><br>${s.items.length} de ${PIECES.length} piezas`, event.clientX, event.clientY),
    );
    path.addEventListener("pointerleave", hideTip);
    path.addEventListener("click", () => focusStatus(s.id));
    donut.insertBefore(path, donut.querySelector("text"));
    arcs[s.id] = path;
    angle += sweep;
  });

  /* Largest-remainder rounding so the legend percentages add up to exactly 100. */
  const exact = counts.map((s) => (s.items.length / PIECES.length) * 100);
  const pcts = exact.map(Math.floor);
  let left = 100 - pcts.reduce((sum, n) => sum + n, 0);
  exact
    .map((value, i) => ({ i, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest)
    .forEach(({ i }) => {
      if (left > 0) {
        pcts[i] += 1;
        left -= 1;
      }
    });

  counts.forEach((s, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.st = s.id;
    btn.setAttribute("aria-pressed", "false");
    const pct = pcts[index];
    btn.innerHTML = `<span class="swatch" style="background: var(--st-${s.id})"></span><span>${pill(s.id)}</span><span class="l-count">${s.items.length}</span><span class="l-pct">${pct}%</span>`;
    btn.setAttribute("aria-label", `${s.label}: ${s.items.length} piezas. Ver cuáles.`);
    btn.addEventListener("click", () => focusStatus(btn.getAttribute("aria-pressed") === "true" ? null : s.id));
    btn.addEventListener("pointerenter", () => dim(s.id));
    btn.addEventListener("pointerleave", () => dim(focused));
    legend.append(btn);
  });

  let focused = null;
  function dim(id) {
    Object.entries(arcs).forEach(([key, path]) => {
      path.classList.toggle("is-dim", Boolean(id) && key !== id);
      path.classList.toggle("is-focus", key === id);
    });
  }
  function focusStatus(id) {
    focused = id;
    dim(id);
    $$("button", legend).forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.st === id)));
    if (!id) {
      detail.innerHTML = detailDefault;
      return;
    }
    const s = counts.find((c) => c.id === id);
    detail.innerHTML = `<p><strong>${s.label}</strong> (${s.items.length}):</p><ul>${s.items
      .map((p) => `<li>${escapeHtml(p.name)}</li>`)
      .join("")}</ul>`;
  }

  /* ---------- Team cards ---------- */
  const teamsEl = $("#teams");
  TEAMS.forEach((team) => {
    const items = PIECES.filter((p) => p.team === team.id);
    const card = document.createElement("article");
    card.className = "card";
    const bar = STATUSES.map((s) => {
      const n = items.filter((p) => p.st === s.id).length;
      return n ? `<span style="--n:${n};--c:var(--st-${s.id})" title="${s.short}: ${n}"></span>` : "";
    }).join("");
    /* If every piece of a team shares one status, show it once in the header instead of on each item. */
    const single = items.every((p) => p.st === items[0].st) ? items[0].st : null;
    card.innerHTML = `
      <div class="team-head"><div><h3>${team.label}</h3><p class="small muted">${team.sub}</p>${single ? `<div class="team-status">${pill(single)}</div>` : ""}</div><span class="team-count" aria-label="${items.length} piezas">${items.length}</span></div>
      ${single ? "" : `<div class="stackbar" role="img" aria-label="${STATUSES.map((s) => `${s.short}: ${items.filter((p) => p.st === s.id).length}`).join(", ")}">${bar}</div>`}
      <ul class="team-items">${items.map((p) => `<li><span>${escapeHtml(p.name)}</span>${single ? "" : pill(p.st)}</li>`).join("")}</ul>`;
    const column = [...teamsEl.querySelectorAll("[data-teams]")].find((col) => col.dataset.teams.split(" ").includes(team.id));
    (column || teamsEl).append(card);
  });
  const teamsLegend = $("#teamsLegend");
  if (teamsLegend) teamsLegend.innerHTML = STATUSES.map((s) => pill(s.id)).join("");

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
