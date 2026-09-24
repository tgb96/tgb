import { guidedElapsedMs, guidedOptions, guidedPlan, guidedRemainingMs, guidedTotalSeconds } from "./guided-sessions.js?v=68";
import { getChileDateISO } from "./utils.js?v=67";

const KEY = "tgtrain-guided-session-v1";
const pad = n => String(Math.max(0, n)).padStart(2, "0");
const clock = ms => { const seconds = Math.ceil(Math.max(0, ms) / 1000); return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`; };
const element = (tag, className = "", value = "") => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
};
const button = (text, className, handler) => {
  const node = element("button", className, text);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
};

export function createGuidedUI(repository, { showView, showToast, onSaved } = {}) {
  let state = null;
  let previewKind = "";
  let previewPlanId = "";
  let editingRecord = null;
  let audioContext = null;
  let notifiedStep = -1;
  const content = () => document.getElementById("guidedContent");

  function load() {
    try {
      const value = JSON.parse(window.localStorage.getItem(KEY) || "null");
      const plan = guidedPlan(value?.kind, value?.planId);
      if (!plan || !["active", "paused", "review"].includes(value.status)
        || !Number.isInteger(value.index) || value.index < 0
        || (value.status === "review" ? value.index > plan.steps.length : value.index >= plan.steps.length)
        || !Array.isArray(value.results) || !value.startedAt) return null;
      return value;
    } catch { return null; }
  }

  function persist(next) {
    state = next;
    try {
      if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
      else window.localStorage.removeItem(KEY);
    } catch { showToast?.("No se pudo guardar el avance local. Mantén la app abierta durante la sesión."); }
  }

  function playStepSound() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
      [0, 0.18].forEach((offset, index) => {
        const tone = audioContext.createOscillator();
        const gain = audioContext.createGain();
        tone.type = "sine"; tone.frequency.value = index ? 740 : 580;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.32, audioContext.currentTime + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + 0.16);
        tone.connect(gain).connect(audioContext.destination);
        tone.start(audioContext.currentTime + offset); tone.stop(audioContext.currentTime + offset + 0.17);
      });
      navigator.vibrate?.([100, 80, 100]);
    } catch { /* El reloj visual sigue funcionando si el sonido no está disponible. */ }
  }

  function currentPlan() {
    if (editingRecord) return guidedPlan(editingRecord.category, editingRecord.guidedSessionId);
    if (state) return guidedPlan(state.kind, state.planId);
    return guidedPlan(previewKind, previewPlanId);
  }

  function start() {
    const plan = currentPlan();
    if (!plan) return;
    const now = Date.now();
    const gentle = Boolean(document.getElementById("guidedGentle")?.checked);
    persist({ kind: plan.category, planId: plan.id, status: "active", index: 0, results: [], gentle,
      startedAt: new Date(now).toISOString(), activeStartedAt: now, stepEndsAt: now + plan.steps[0].seconds * 1000,
      stepRemainingMs: plan.steps[0].seconds * 1000, elapsedMs: 0 });
    notifiedStep = -1;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume?.().catch(() => {}); } catch {}
    render();
  }

  function pause() {
    if (state?.status !== "active") return;
    const now = Date.now();
    persist({ ...state, status: "paused", elapsedMs: guidedElapsedMs(state, now),
      stepRemainingMs: guidedRemainingMs(state, now), activeStartedAt: 0, stepEndsAt: 0 });
    render();
  }

  function resume() {
    if (state?.status !== "paused") return;
    const now = Date.now();
    persist({ ...state, status: "active", activeStartedAt: now, stepEndsAt: now + state.stepRemainingMs });
    render();
  }

  function advance(skipped = false) {
    if (!state || !["active", "paused"].includes(state.status)) return;
    const plan = guidedPlan(state.kind, state.planId);
    const now = Date.now();
    const elapsedMs = guidedElapsedMs(state, now);
    const results = [...state.results.filter(item => item.id !== plan.steps[state.index]?.id)];
    const current = plan.steps[state.index];
    if (current) results.push({ id: current.id, status: skipped ? "skipped" : "done" });
    const index = state.index + 1;
    if (index >= plan.steps.length) {
      persist({ ...state, status: "review", index, results, elapsedMs, activeStartedAt: 0,
        endedAt: new Date(now).toISOString(), stepEndsAt: 0, stepRemainingMs: 0 });
    } else {
      persist({ ...state, status: state.status, index, results, elapsedMs,
        activeStartedAt: state.status === "active" ? now : 0,
        stepEndsAt: state.status === "active" ? now + plan.steps[index].seconds * 1000 : 0,
        stepRemainingMs: plan.steps[index].seconds * 1000 });
    }
    notifiedStep = -1;
    render();
  }

  function finishEarly() {
    if (!state || !window.confirm("¿Finalizar ahora? Los pasos pendientes quedarán como omitidos y podrás decidir si guardas la sesión.")) return;
    const now = Date.now();
    persist({ ...state, status: "review", elapsedMs: guidedElapsedMs(state, now), activeStartedAt: 0,
      endedAt: new Date(now).toISOString(), stepEndsAt: 0, stepRemainingMs: 0 });
    render();
  }

  function discard() {
    if (!window.confirm("¿Descartar esta sesión guiada? Se perderá su avance, pero no tus entrenamientos ya guardados.")) return;
    persist(null); previewKind = ""; editingRecord = null; render(); showView?.("register");
  }

  function renderSteps(plan, activeIndex = -1) {
    const list = element("ol", "guided-step-list");
    plan.steps.forEach((step, index) => {
      const result = state?.results?.find(item => item.id === step.id);
      const row = element("li", index === activeIndex ? "active" : result?.status || "");
      row.append(element("strong", "", step.title), element("small", "", `${clock(step.seconds * 1000)} · ${result?.status === "done" ? "Hecho" : result?.status === "skipped" ? "Omitido" : "Pendiente"}`));
      list.append(row);
    });
    return list;
  }

  function renderReview(plan) {
    const panel = element("section", "guided-review");
    const done = state?.results?.filter(item => item.status === "done").length || 0;
    panel.append(element("p", "eyebrow dark", editingRecord ? "Editar registro" : "Balance de la guía"),
      element("h2", "", editingRecord ? "Ajusta los datos guardados" : `${done}/${plan.steps.length} pasos realizados`));
    if (!editingRecord) panel.append(element("p", "", `Tiempo activo: ${clock(guidedElapsedMs(state))}. Puedes guardar la sesión aunque hayas omitido pasos.`));
    panel.append(element("p", "", "Esta sesión se guarda como complemento. No reemplaza ni completa la actividad principal planificada para el día."));
    const form = element("form", "guided-review-form");
    form.noValidate = true;
    const dateLabel = element("label", "", "Fecha del registro");
    const date = element("input"); date.type = "date"; date.value = editingRecord?.dateISO || getChileDateISO(new Date(state.startedAt)); date.required = true;
    dateLabel.append(date);
    const caloriesLabel = element("label", "", "Calorías (opcional)");
    const calories = element("input"); calories.type = "number"; calories.inputMode = "numeric"; calories.min = "0"; calories.max = "5000"; calories.step = "1";
    calories.placeholder = "Déjalo vacío si no sabes"; calories.value = editingRecord?.calories ?? "";
    caloriesLabel.append(calories);
    const painLabel = element("label", "", "Molestia durante la sesión (0–10)");
    const pain = element("select");
    pain.append(new Option("Sin evaluar", ""));
    for (let i = 0; i <= 10; i++) pain.append(new Option(String(i), String(i)));
    pain.value = editingRecord?.guidedPainScore === "" || editingRecord?.guidedPainScore == null ? "" : String(editingRecord.guidedPainScore);
    painLabel.append(pain);
    const notesLabel = element("label", "", "¿Dónde y cómo fue la molestia? (opcional)");
    const notes = element("textarea"); notes.rows = 2; notes.maxLength = 2000; notes.value = editingRecord?.guidedPainNotes || "";
    notesLabel.append(notes);
    const sensationsLabel = element("label", "", "Sensaciones y observaciones");
    const sensations = element("textarea"); sensations.rows = 3; sensations.maxLength = 5000;
    sensations.placeholder = "Ej.: terminé más suelto, sin molestia; o sentí la rodilla sensible";
    sensations.value = editingRecord?.sensations || "";
    sensationsLabel.append(sensations);
    const chips = element("div", "guided-sensation-chips");
    ["Me sentí más suelto", "Sin molestias", "Rodilla sensible", "Hombro sensible", "Necesité bajar la intensidad", "Buena disposición para jugar"].forEach(text => {
      chips.append(button(text, "", () => {
        const parts = sensations.value.split(" · ").map(part => part.trim()).filter(Boolean);
        if (!parts.includes(text)) sensations.value = [...parts, text].join(" · ");
      }));
    });
    const error = element("p", "guided-error hidden");
    const actions = element("div", "guided-review-actions");
    const save = element("button", "save-button", editingRecord ? "Guardar cambios" : "Guardar sesión en Historial");
    save.type = "submit"; actions.append(save);
    actions.append(button(editingRecord ? "Cancelar" : "Descartar sin guardar", "guided-secondary", editingRecord
      ? () => { editingRecord = null; showView?.("history"); }
      : discard));
    form.append(dateLabel, caloriesLabel, painLabel, notesLabel, sensationsLabel, chips, error, actions);
    form.addEventListener("submit", event => {
      event.preventDefault();
      const kcal = calories.value.trim();
      const painValue = pain.value;
      if (kcal && (!/^\d+$/.test(kcal) || Number(kcal) > 5000)) {
        error.textContent = "Las calorías deben estar entre 0 y 5000, o dejarse vacías."; error.classList.remove("hidden"); return;
      }
      const now = new Date().toISOString();
      const steps = plan.steps.map(step => ({ id: step.id, title: step.title, seconds: step.seconds,
        status: (editingRecord?.guidedSteps || state?.results || []).find(item => item.id === step.id)?.status === "done" ? "done" : "skipped" }));
      const seconds = editingRecord ? editingRecord.durationSeconds : Math.max(1, Math.round(guidedElapsedMs(state) / 1000));
      const record = { ...editingRecord, id: editingRecord?.id || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`),
        category: plan.category, categoryName: plan.category === "warmup" ? "Calentamiento" : "Estiramientos",
        dateISO: date.value, durationSeconds: seconds, durationMinutes: seconds / 60, durationPrecision: "hms",
        calories: kcal, sensations: sensations.value.trim(), guidedSessionId: plan.id, guidedSessionName: plan.title,
        guidedSteps: steps, guidedPainScore: painValue, guidedPainNotes: notes.value.trim(),
        guidedStartedAt: editingRecord?.guidedStartedAt || state?.startedAt || "",
        guidedEndedAt: editingRecord?.guidedEndedAt || state?.endedAt || now,
        routineStartedAt: editingRecord?.routineStartedAt || state?.startedAt || "",
        routineEndedAt: editingRecord?.routineEndedAt || state?.endedAt || now,
        createdAt: editingRecord?.createdAt || now, updatedAt: now };
      try { repository.upsert(record); }
      catch (failure) { error.textContent = failure.message; error.classList.remove("hidden"); return; }
      if (!editingRecord) persist(null);
      editingRecord = null; previewKind = ""; render(); onSaved?.(record);
    });
    panel.append(form);
    return panel;
  }

  function render() {
    const root = content(); root.replaceChildren();
    const plan = currentPlan();
    if (!plan) return;
    const heading = element("div", "page-heading guided-heading");
    const copy = element("div");
    copy.append(element("p", "eyebrow dark", "Sesión guiada"), element("h1", "", plan.title), element("p", "page-subtitle", plan.subtitle));
    heading.append(copy, button("← Registrar", "guided-back", () => showView?.("register")));
    root.append(heading);
    const safety = element("p", "guided-safety", plan.safety); root.append(safety);
    if (editingRecord || state?.status === "review") { root.append(renderReview(plan)); return; }
    if (!state) {
      const options = element("div", "guided-variant-options");
      guidedOptions(plan.category).forEach(option => {
        const choice = button(`${Math.round(guidedTotalSeconds(option) / 60)} min`, option.id === plan.id ? "active" : "", () => {
          previewPlanId = option.id;
          render();
        });
        choice.setAttribute("aria-pressed", String(option.id === plan.id));
        choice.setAttribute("aria-label", option.title);
        options.append(choice);
      });
      root.append(options);
      const card = element("section", "guided-preview");
      card.append(element("strong", "", `${plan.steps.length} pasos · aprox. ${Math.round(guidedTotalSeconds(plan) / 60)} min`),
        element("p", "", "Abre esta guía para revisar movimientos. El tiempo solo comienza cuando pulses Iniciar."));
      const gentleLabel = element("label", "guided-gentle");
      const gentle = element("input"); gentle.type = "checkbox"; gentle.id = "guidedGentle";
      gentleLabel.append(gentle, element("span", "", "Modo suave: priorizar alternativas sin impacto"));
      card.append(gentleLabel, button("Iniciar sesión guiada", "guided-primary", start));
      root.append(card, renderSteps(plan));
      return;
    }
    const step = plan.steps[state.index];
    const active = element("section", "guided-active");
    active.append(element("p", "guided-position", `Paso ${state.index + 1} de ${plan.steps.length}`),
      element("h2", "", step.title), element("strong", "guided-countdown", clock(guidedRemainingMs(state))),
      element("p", "guided-instruction", state.gentle ? step.alternative : step.instruction));
    if (state.gentle) active.append(element("p", "guided-alternative", `Movimiento base: ${step.instruction}`));
    else active.append(element("p", "guided-alternative", `Alternativa suave: ${step.alternative}`));
    active.append(element("p", "guided-time-status", guidedRemainingMs(state) === 0 ? "Tiempo sugerido cumplido: avanza cuando estés listo." : "El contador no pasa al siguiente movimiento sin tu confirmación."));
    const controls = element("div", "guided-controls");
    controls.append(button(state.status === "active" ? "Pausar" : "Reanudar", "guided-secondary", state.status === "active" ? pause : resume),
      button("Omitir", "guided-secondary", () => advance(true)),
      button(state.index === plan.steps.length - 1 ? "Terminar paso" : "Paso siguiente →", "guided-primary", () => advance(false)));
    active.append(controls, button("Finalizar antes", "guided-end-early", finishEarly));
    root.append(active, element("p", "guided-elapsed", `Tiempo activo: ${clock(guidedElapsedMs(state))}`), renderSteps(plan, state.index));
  }

  function tick() {
    if (state?.status !== "active") return;
    const remaining = guidedRemainingMs(state);
    const countdown = content().querySelector(".guided-countdown");
    if (countdown) countdown.textContent = clock(remaining);
    const elapsed = content().querySelector(".guided-elapsed");
    if (elapsed) elapsed.textContent = `Tiempo activo: ${clock(guidedElapsedMs(state))}`;
    const status = content().querySelector(".guided-time-status");
    if (status && remaining === 0) status.textContent = "Tiempo sugerido cumplido: avanza cuando estés listo.";
    if (remaining === 0 && notifiedStep !== state.index) { notifiedStep = state.index; playStepSound(); }
  }

  return {
    initialize() { state = load(); window.setInterval(tick, 300); },
    hasPending() { return Boolean(state); },
    open(kind) {
      if (state && state.kind !== kind) {
        showToast?.("Tienes otra guía en curso. Retómala o descártala antes de iniciar una nueva.");
        previewKind = state.kind;
        previewPlanId = state.planId || guidedPlan(state.kind)?.id || "";
      } else {
        previewKind = kind;
        previewPlanId = guidedPlan(kind)?.id || "";
      }
      editingRecord = null; render(); showView?.("guided");
    },
    resumePending() { if (state) { previewKind = state.kind; previewPlanId = state.planId || guidedPlan(state.kind)?.id || ""; render(); showView?.("guided"); return true; } return false; },
    editRecord(record) { editingRecord = record; previewKind = record.category; previewPlanId = record.guidedSessionId; render(); showView?.("guided"); },
    render,
    getState() { return state; }
  };
}
