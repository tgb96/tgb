import {
  dayNamesFull,
  dayNamesShort,
  exerciseDescriptions,
  readinessThresholds,
  routines,
  suggestedWeights
} from "./data.js";
import { createRepository } from "./storage.js";
import {
  advanceIntervalState,
  dayIndexFromISO,
  doneKeyForDate,
  exerciseSetKey,
  formatHHMMSS,
  formatMMSS,
  getChileDateISO,
  getChileDateText,
  isoForWeekDay,
  legacyDoneKey,
  legacyExerciseSetKey,
  legacySessionKey,
  metricText,
  normalizeRecord,
  parseDurationSeconds,
  recordsToCSV,
  remainingSeconds,
  reportForPeriod,
  sessionKeyForDate,
  validateRecord
} from "./utils.js";

const $ = id => document.getElementById(id);
const repository = createRepository(window.localStorage);
const CUSTOM_TIMER_KEY = "tgb-custom-timer-v1";
const EXERCISE_TIMER_KEY = "tgb-exercise-timer-v1";

let selectedDay = dayIndexFromISO(getChileDateISO());
let editingRecordId = null;
let sessionTick = null;
let customTimerTick = null;
let exerciseTimerTick = null;
let audioContext = null;
let waitingServiceWorker = null;
let activeExerciseTimer = loadJSON(EXERCISE_TIMER_KEY, null);
let intervalState = loadCustomTimer();

if (!activeExerciseTimer || !activeExerciseTimer.key || !Number.isFinite(Number(activeExerciseTimer.deadline))) {
  activeExerciseTimer = null;
  localStorage.removeItem(EXERCISE_TIMER_KEY);
}

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Los registros muestran errores de cuota; los cronómetros pueden continuar en memoria.
  }
}

function selectedDateISO() {
  return isoForWeekDay(selectedDay);
}

function hasCompletion(dateISO) {
  return Boolean(localStorage.getItem(doneKeyForDate(dateISO)) || localStorage.getItem(legacyDoneKey(dateISO)));
}

function setCompletion(dateISO, complete) {
  if (complete) localStorage.setItem(doneKeyForDate(dateISO), "done");
  else {
    localStorage.removeItem(doneKeyForDate(dateISO));
    localStorage.removeItem(legacyDoneKey(dateISO));
  }
}

function showTab(name, { focusHeading = false } = {}) {
  for (const tabName of ["Hoy", "Registrar", "Timer", "Historial"]) {
    const section = $(`tab${tabName}`);
    const visible = tabName === name;
    section.classList.toggle("hidden", !visible);
    section.hidden = !visible;
  }
  document.querySelectorAll(".nav-btn").forEach(button => {
    const active = button.dataset.tab === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "Historial") renderHistory();
  if (focusHeading) {
    const heading = document.querySelector(`#tab${name} h2`);
    heading?.setAttribute("tabindex", "-1");
    heading?.focus({ preventScroll: true });
  }
}

function renderWeek() {
  const week = $("week");
  week.replaceChildren();
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    const dateISO = isoForWeekDay(day);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.classList.toggle("active", day === selectedDay);
    button.classList.toggle("done", hasCompletion(dateISO));
    button.setAttribute("aria-pressed", String(day === selectedDay));
    button.setAttribute("aria-label", `${dayNamesFull[day]}: ${routines[day].name}${hasCompletion(dateISO) ? ", completado" : ""}`);

    const shortName = document.createElement("strong");
    shortName.textContent = dayNamesShort[day];
    const routineName = document.createElement("small");
    routineName.textContent = routines[day].name;
    button.append(shortName, routineName);
    button.addEventListener("click", () => {
      selectedDay = day;
      renderWeek();
      renderRoutine();
    });
    week.append(button);
  }
}

function isSetDone(dateISO, exerciseIndex, setNumber) {
  return Boolean(
    localStorage.getItem(exerciseSetKey(dateISO, exerciseIndex, setNumber)) ||
    localStorage.getItem(legacyExerciseSetKey(dateISO, exerciseIndex, setNumber))
  );
}

function setSetDone(dateISO, exerciseIndex, setNumber, done) {
  const currentKey = exerciseSetKey(dateISO, exerciseIndex, setNumber);
  const oldKey = legacyExerciseSetKey(dateISO, exerciseIndex, setNumber);
  if (done) localStorage.setItem(currentKey, "done");
  else {
    localStorage.removeItem(currentKey);
    localStorage.removeItem(oldKey);
  }
}

function appendDescription(container, text, className = "") {
  if (!text) return;
  const description = document.createElement("div");
  description.className = `ex-desc ${className}`.trim();
  if (className) {
    const label = document.createElement("strong");
    label.textContent = "Peso sugerido: ";
    description.append(label, document.createTextNode(text));
  } else {
    description.textContent = text;
  }
  container.append(description);
}

function renderRoutine() {
  const today = routines[dayIndexFromISO(getChileDateISO())];
  $("todayName").textContent = today.name;
  $("todayType").textContent = today.type;

  const routine = routines[selectedDay];
  const dateISO = selectedDateISO();
  $("routineTitle").textContent = `${dayNamesFull[selectedDay]} · ${routine.name}`;
  $("routineGoal").textContent = routine.goal;
  renderSessionTimer();

  const routineBox = $("routineBox");
  routineBox.replaceChildren();
  routine.exercises.forEach((exercise, exerciseIndex) => {
    const [name, meta, sets, options = {}] = exercise;
    const card = document.createElement("article");
    card.className = "exercise";
    const title = document.createElement("div");
    title.className = "ex-title";
    title.textContent = name;
    const details = document.createElement("div");
    details.className = "ex-meta";
    details.textContent = meta;
    card.append(title, details);
    appendDescription(card, exerciseDescriptions[name]);
    appendDescription(card, suggestedWeights[name], "weight-box");

    const setsBox = document.createElement("div");
    setsBox.className = "sets";
    setsBox.setAttribute("aria-label", `Series de ${name}`);
    const duration = options.noCountdown ? null : parseDurationSeconds(meta);
    for (let setNumber = 1; setNumber <= sets; setNumber += 1) {
      const key = exerciseSetKey(dateISO, exerciseIndex, setNumber);
      const done = isSetDone(dateISO, exerciseIndex, setNumber);
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.setKey = key;
      button.classList.toggle("timer-btn", Boolean(duration));
      button.classList.toggle("done-btn", done);
      button.setAttribute("aria-pressed", String(done));
      button.setAttribute("aria-label", `${name}, serie ${setNumber} de ${sets}${done ? ", completada" : ""}`);

      if (activeExerciseTimer?.key === key && activeExerciseTimer.deadline > Date.now()) {
        button.classList.add("timer-running");
        button.textContent = formatMMSS(Math.ceil((activeExerciseTimer.deadline - Date.now()) / 1000));
      } else {
        button.textContent = done ? "OK" : duration ? formatMMSS(duration) : "Hecho";
      }

      button.addEventListener("click", () => {
        if (duration) toggleExerciseTimer({ dateISO, exerciseIndex, setNumber, duration, key });
        else {
          setSetDone(dateISO, exerciseIndex, setNumber, !done);
          renderRoutine();
        }
      });
      setsBox.append(button);
    }
    card.append(setsBox);
    routineBox.append(card);
  });
  ensureExerciseTimerTick();
}

function toggleExerciseTimer({ dateISO, exerciseIndex, setNumber, duration, key }) {
  ensureAudioContext();
  if (isSetDone(dateISO, exerciseIndex, setNumber)) {
    setSetDone(dateISO, exerciseIndex, setNumber, false);
    renderRoutine();
    return;
  }
  if (activeExerciseTimer?.key === key) {
    activeExerciseTimer = null;
    localStorage.removeItem(EXERCISE_TIMER_KEY);
    stopExerciseTimerTick();
    renderRoutine();
    return;
  }
  activeExerciseTimer = { key, dateISO, exerciseIndex, setNumber, duration, deadline: Date.now() + duration * 1000 };
  saveJSON(EXERCISE_TIMER_KEY, activeExerciseTimer);
  ensureExerciseTimerTick();
  renderRoutine();
}

function ensureExerciseTimerTick() {
  if (!activeExerciseTimer) return stopExerciseTimerTick();
  tickExerciseTimer();
  if (!exerciseTimerTick) exerciseTimerTick = window.setInterval(tickExerciseTimer, 500);
}

function stopExerciseTimerTick() {
  if (exerciseTimerTick) clearInterval(exerciseTimerTick);
  exerciseTimerTick = null;
}

function tickExerciseTimer() {
  if (!activeExerciseTimer) return stopExerciseTimerTick();
  const seconds = Math.ceil((activeExerciseTimer.deadline - Date.now()) / 1000);
  if (seconds <= 0) {
    const finished = activeExerciseTimer;
    setSetDone(finished.dateISO, finished.exerciseIndex, finished.setNumber, true);
    activeExerciseTimer = null;
    localStorage.removeItem(EXERCISE_TIMER_KEY);
    stopExerciseTimerTick();
    alertSignal();
    renderRoutine();
    return;
  }
  const button = [...document.querySelectorAll("[data-set-key]")].find(item => item.dataset.setKey === activeExerciseTimer.key);
  if (button) button.textContent = formatMMSS(seconds);
}

function loadSessionState(dateISO) {
  const current = loadJSON(sessionKeyForDate(dateISO), null);
  if (current) return current;
  const legacy = loadJSON(legacySessionKey(dateISO), null);
  if (legacy) saveJSON(sessionKeyForDate(dateISO), legacy);
  return legacy || { elapsed: 0, running: false, startedAt: null };
}

function saveSessionState(dateISO, state) {
  saveJSON(sessionKeyForDate(dateISO), state);
}

function getSessionElapsed(dateISO) {
  const state = loadSessionState(dateISO);
  let elapsed = Math.max(0, Number(state.elapsed) || 0);
  if (state.running && Number(state.startedAt)) elapsed += Math.max(0, Math.floor((Date.now() - Number(state.startedAt)) / 1000));
  return elapsed;
}

function toggleSessionTimer() {
  const dateISO = selectedDateISO();
  const state = loadSessionState(dateISO);
  if (state.running) {
    state.elapsed = getSessionElapsed(dateISO);
    state.running = false;
    state.startedAt = null;
  } else {
    state.running = true;
    state.startedAt = Date.now();
  }
  saveSessionState(dateISO, state);
  renderSessionTimer();
}

function renderSessionTimer() {
  const dateISO = selectedDateISO();
  const state = loadSessionState(dateISO);
  $("sessionTime").textContent = formatHHMMSS(getSessionElapsed(dateISO));
  $("sessionButton").textContent = state.running ? "Detener" : "Iniciar";
  $("sessionButton").classList.toggle("session-running", Boolean(state.running));
  $("sessionButton").setAttribute("aria-pressed", String(Boolean(state.running)));
  if (state.running && !sessionTick) sessionTick = window.setInterval(renderSessionTimer, 1000);
  if (!state.running && sessionTick) {
    clearInterval(sessionTick);
    sessionTick = null;
  }
}

function setDateFieldVisible(visible) {
  $("dateFieldBox").classList.toggle("hidden", !visible);
  $("toggleDateButton").setAttribute("aria-expanded", String(visible));
}

function createNumberField({ id, label, placeholder, value = "", step = "1" }) {
  const wrapper = document.createElement("div");
  const fieldLabel = document.createElement("label");
  fieldLabel.htmlFor = id;
  fieldLabel.textContent = label;
  const input = document.createElement("input");
  input.id = id;
  input.name = id;
  input.type = "number";
  input.inputMode = "decimal";
  input.min = "0";
  input.step = step;
  input.placeholder = placeholder;
  input.value = value === null || value === undefined ? "" : String(value);
  wrapper.append(fieldLabel, input);
  return wrapper;
}

function currentActivityValues() {
  return {
    physicalRoutine: $("physicalRoutine")?.value || "",
    cardioType: $("cardioType")?.value || "",
    kms: $("kms")?.value ?? "",
    durationMinutes: $("durationMinutes")?.value ?? "",
    calories: $("calories")?.value ?? ""
  };
}

function renderActivityFields(values = {}) {
  const type = $("activityType").value;
  const dateISO = $("recordDate").value || getChileDateISO();
  const day = dayIndexFromISO(dateISO);
  const planned = day === null ? "" : routines[day].name;
  const defaultMinutes = values.durationMinutes !== undefined && values.durationMinutes !== ""
    ? values.durationMinutes
    : (Math.round(getSessionElapsed(dateISO) / 60) || "");
  const box = $("activityFields");
  box.replaceChildren();

  if (type === "Físico") {
    const label = document.createElement("label");
    label.htmlFor = "physicalRoutine";
    label.textContent = "¿Qué físico realizaste?";
    const select = document.createElement("select");
    select.id = "physicalRoutine";
    select.name = "physicalRoutine";
    for (const [value, text] of [["A", "Físico A"], ["B", "Físico B"], ["C", "Físico C"], ["Otro", "Otro físico"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    const defaultRoutine = planned === "Fuerza B" ? "B" : planned === "Fuerza C" ? "C" : "A";
    select.value = values.physicalRoutine || defaultRoutine;
    const grid = document.createElement("div");
    grid.className = "field-grid";
    grid.append(
      createNumberField({ id: "durationMinutes", label: "Tiempo total (min)", placeholder: "Ej: 65", value: defaultMinutes }),
      createNumberField({ id: "calories", label: "Calorías quemadas", placeholder: "Ej: 350", value: values.calories ?? "" })
    );
    box.append(label, select, grid);
  } else if (type === "Tenis") {
    const grid = document.createElement("div");
    grid.className = "field-grid";
    grid.append(
      createNumberField({ id: "durationMinutes", label: "Tiempo total tenis (min)", placeholder: "Ej: 90", value: defaultMinutes }),
      createNumberField({ id: "calories", label: "Calorías quemadas", placeholder: "Ej: 650", value: values.calories ?? "" })
    );
    box.append(grid);
  } else if (type === "Cardio") {
    const label = document.createElement("label");
    label.htmlFor = "cardioType";
    label.textContent = "Tipo de cardio";
    const select = document.createElement("select");
    select.id = "cardioType";
    select.name = "cardioType";
    for (const value of ["Bicicleta", "Trote", "Caminata", "Otro"]) {
      const option = document.createElement("option");
      option.textContent = value;
      select.append(option);
    }
    select.value = values.cardioType || "Bicicleta";
    const grid = document.createElement("div");
    grid.className = "field-grid";
    grid.append(
      createNumberField({ id: "kms", label: "Kilómetros", placeholder: "Ej: 5.2", value: values.kms ?? "", step: "0.01" }),
      createNumberField({ id: "durationMinutes", label: "Tiempo total (min)", placeholder: "Ej: 35", value: defaultMinutes })
    );
    box.append(label, select, grid, createNumberField({ id: "calories", label: "Calorías quemadas opcional", placeholder: "Ej: 280", value: values.calories ?? "" }));
  } else {
    const grid = document.createElement("div");
    grid.className = "field-grid";
    grid.append(
      createNumberField({ id: "durationMinutes", label: "Tiempo total (min)", placeholder: "Ej: 20", value: defaultMinutes }),
      createNumberField({ id: "calories", label: "Calorías opcional", placeholder: "Ej: 100", value: values.calories ?? "" })
    );
    box.append(grid);
  }
}

function recordBase(dateISO) {
  const day = dayIndexFromISO(dateISO);
  if (day === null) return { dateISO, day: "", plannedRoutine: "", plannedType: "" };
  return {
    dateISO,
    day: dayNamesFull[day],
    plannedRoutine: routines[day].name,
    plannedType: routines[day].type
  };
}

function formRecord() {
  const dateISO = $("recordDate").value;
  const existing = editingRecordId ? repository.get(editingRecordId) : null;
  return {
    ...recordBase(dateISO),
    id: editingRecordId || createId(),
    activity: $("activityType").value,
    physicalRoutine: $("physicalRoutine")?.value || "",
    cardioType: $("cardioType")?.value || "",
    kms: $("kms")?.value ?? "",
    durationMinutes: $("durationMinutes")?.value ?? "",
    calories: $("calories")?.value ?? "",
    fatigue: $("fatigue").value,
    thumbPain: $("thumbPain").value,
    legPain: $("legPain").value,
    feeling: $("feeling").value,
    notes: $("notes").value,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showMessage(element, text, tone = "green") {
  element.textContent = text;
  element.className = `status ${tone}`;
}

function saveRegister(event) {
  event.preventDefault();
  const candidate = formRecord();
  const result = validateRecord(candidate);
  if (!result.valid) {
    showMessage($("formMessage"), result.errors.join(" "), "red");
    return;
  }
  try {
    repository.upsert(candidate);
    setCompletion(candidate.dateISO, true);
  } catch (error) {
    showMessage($("formMessage"), error.message, "red");
    return;
  }
  const wasEditing = Boolean(editingRecordId);
  resetRegisterForm();
  showMessage($("formMessage"), wasEditing ? "Registro actualizado correctamente." : "Registro guardado correctamente.", "green");
  renderWeek();
  renderHistory();
}

function resetRegisterForm() {
  editingRecordId = null;
  $("registerForm").reset();
  $("recordDate").value = getChileDateISO();
  $("fatigue").value = "3";
  $("thumbPain").value = "0";
  $("legPain").value = "0";
  $("registerTitle").textContent = "Registrar";
  $("saveButton").textContent = "Guardar registro";
  $("editingBadge").classList.add("hidden");
  $("cancelEditButton").classList.add("hidden");
  $("formMessage").className = "status hidden";
  setDateFieldVisible(false);
  renderActivityFields();
}

function editRecord(id) {
  const record = repository.get(id);
  if (!record) return;
  editingRecordId = record.id;
  $("recordDate").value = record.dateISO;
  $("activityType").value = record.activity;
  $("fatigue").value = metricText(record.fatigue, "0");
  $("thumbPain").value = metricText(record.thumbPain, "0");
  $("legPain").value = metricText(record.legPain, "0");
  $("feeling").value = record.feeling;
  $("notes").value = record.notes;
  $("registerTitle").textContent = "Editar registro";
  $("saveButton").textContent = "Guardar cambios";
  $("editingBadge").classList.remove("hidden");
  $("cancelEditButton").classList.remove("hidden");
  setDateFieldVisible(true);
  renderActivityFields(record);
  $("formMessage").className = "status hidden";
  showTab("Registrar", { focusHeading: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteRecord(id) {
  const record = repository.get(id);
  if (!record) return;
  if (!window.confirm(`¿Eliminar el registro del ${record.dateISO}? Esta acción no se puede deshacer.`)) return;
  repository.remove(id);
  if (!repository.list().some(item => item.dateISO === record.dateISO)) setCompletion(record.dateISO, false);
  if (editingRecordId === id) resetRegisterForm();
  renderWeek();
  renderHistory();
}

function analyzeReadiness() {
  const values = [$("fatigue").value, $("thumbPain").value, $("legPain").value].map(Number);
  const recommendation = $("recommendation");
  if (values.some(value => !Number.isFinite(value) || value < 0 || value > 10)) {
    showMessage(recommendation, "Ingresa valores entre 0 y 10 para analizar tu estado.", "red");
    return;
  }
  const [fatigue, thumb, leg] = values;
  const total = fatigue + thumb + leg;
  if (thumb >= readinessThresholds.highPain || leg >= readinessThresholds.highPain || fatigue >= readinessThresholds.highFatigue) {
    showMessage(recommendation, "Señal de precaución. Considera bajar la carga y priorizar recuperación. Si el dolor es intenso, nuevo o creciente, detén la actividad y consulta a un profesional.", "red");
  } else if (total >= readinessThresholds.moderateTotal || fatigue >= readinessThresholds.moderateFatigue || thumb >= readinessThresholds.moderatePain || leg >= readinessThresholds.moderatePain) {
    showMessage(recommendation, "Carga moderada sugerida. Reduce el volumen, mantén una técnica cómoda y vuelve a evaluar si aumentan las molestias.", "yellow");
  } else {
    showMessage(recommendation, "Tus valores están dentro de tu rango bajo de alerta. Entrena según tus sensaciones y detente si aparece dolor.", "green");
  }
}

function renderHistory() {
  const records = repository.list();
  $("historyCount").textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
  const history = $("history");
  history.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "sub";
    empty.textContent = "Aún no hay registros.";
    history.append(empty);
    return;
  }
  for (const record of records) {
    const item = document.createElement("article");
    item.className = "history-item";
    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = `${record.dateISO} · ${record.day}`;
    const plan = document.createElement("div");
    plan.className = "history-meta";
    plan.textContent = `Plan: ${record.plannedRoutine || "Sin plan"}`;
    const activity = document.createElement("div");
    const activityDetails = [record.activity || "-", record.physicalRoutine ? `Físico ${record.physicalRoutine}` : "", record.cardioType || ""].filter(Boolean).join(" · ");
    activity.textContent = `Actividad: ${activityDetails}`;
    const totals = document.createElement("div");
    totals.textContent = `Tiempo: ${metricText(record.durationMinutes)} min · Calorías: ${metricText(record.calories, "no registradas")}${record.kms !== "" ? ` · Km: ${record.kms}` : ""}`;
    const state = document.createElement("div");
    state.textContent = `Fatiga ${metricText(record.fatigue, "-")}/10 · Pulgar ${metricText(record.thumbPain, "-")}/10 · Rodilla/Aquiles ${metricText(record.legPain, "-")}/10`;
    const feeling = document.createElement("div");
    feeling.textContent = `Sensación: ${record.feeling || "-"}`;
    item.append(title, plan, activity, totals, state, feeling);
    if (record.notes) {
      const notes = document.createElement("div");
      notes.className = "history-notes";
      notes.textContent = `Notas: ${record.notes}`;
      item.append(notes);
    }
    const actions = document.createElement("div");
    actions.className = "history-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.setAttribute("aria-label", `Editar registro del ${record.dateISO}`);
    edit.addEventListener("click", () => editRecord(record.id));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Eliminar";
    remove.setAttribute("aria-label", `Eliminar registro del ${record.dateISO}`);
    remove.addEventListener("click", () => deleteRecord(record.id));
    actions.append(edit, remove);
    item.append(actions);
    history.append(item);
  }
}

function generateReport(days) {
  $("reportOutput").value = reportForPeriod(repository.list(), days, getChileDateISO());
}

async function copyReport() {
  const text = $("reportOutput").value;
  if (!text) return showMessage($("reportMessage"), "Primero genera un informe.", "yellow");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    $("reportOutput").select();
    document.execCommand("copy");
  }
  showMessage($("reportMessage"), "Informe copiado.", "green");
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJSON() {
  downloadText(`tgb-respaldo-${getChileDateISO()}.json`, repository.backup(), "application/json;charset=utf-8");
  showMessage($("backupMessage"), "Respaldo JSON descargado.", "green");
}

function exportCSV() {
  downloadText(`tgb-registros-${getChileDateISO()}.csv`, recordsToCSV(repository.list()), "text/csv;charset=utf-8");
  showMessage($("backupMessage"), "Archivo CSV descargado.", "green");
}

async function importJSON(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return showMessage($("backupMessage"), "El respaldo supera el máximo de 5 MB.", "red");
  try {
    const text = await file.text();
    if (!window.confirm("Los registros del respaldo se combinarán con los actuales. Los registros con el mismo identificador se actualizarán. ¿Continuar?")) return;
    const count = repository.importMerge(text);
    renderHistory();
    renderWeek();
    showMessage($("backupMessage"), `${count} registro(s) importado(s) correctamente.`, "green");
  } catch (error) {
    showMessage($("backupMessage"), error.message, "red");
  }
}

function loadCustomTimer() {
  const fallback = { running: false, phase: "work", currentRound: 1, totalRounds: 6, work: 30, rest: 10, mode: "interval", deadline: 0, status: "Listo", displaySeconds: 30 };
  const saved = loadJSON(CUSTOM_TIMER_KEY, fallback);
  if (!saved || !Number.isFinite(Number(saved.work)) || Number(saved.work) < 1) return fallback;
  return { ...fallback, ...saved };
}

function startCustomTimer() {
  const work = Number($("workSeconds").value);
  const rest = Number($("restSeconds").value);
  const rounds = Number($("rounds").value);
  const mode = $("timerMode").value;
  if (!Number.isInteger(work) || work < 1 || !Number.isInteger(rest) || rest < 0 || !Number.isInteger(rounds) || rounds < 0) {
    $("timerPhase").textContent = "Revisa los valores del timer";
    return;
  }
  ensureAudioContext();
  intervalState = {
    running: true,
    phase: "work",
    currentRound: 1,
    totalRounds: mode === "single" ? 1 : rounds,
    work,
    rest: mode === "single" ? 0 : rest,
    mode,
    deadline: Date.now() + work * 1000,
    status: "Actividad",
    displaySeconds: work
  };
  saveJSON(CUSTOM_TIMER_KEY, intervalState);
  tickCustomTimer();
  ensureCustomTimerTick();
}

function stopCustomTimer(label = "Detenido") {
  intervalState = { ...intervalState, running: false, status: label, displaySeconds: remainingSeconds(intervalState) };
  saveJSON(CUSTOM_TIMER_KEY, intervalState);
  if (customTimerTick) clearInterval(customTimerTick);
  customTimerTick = null;
  updateCustomTimerDisplay();
}

function ensureCustomTimerTick() {
  if (!intervalState.running) return;
  if (!customTimerTick) customTimerTick = window.setInterval(tickCustomTimer, 250);
}

function tickCustomTimer() {
  if (!intervalState.running) return updateCustomTimerDisplay();
  const previousPhase = intervalState.phase;
  const previousRound = intervalState.currentRound;
  const result = advanceIntervalState(intervalState, Date.now());
  intervalState = result.state;
  if (result.transitions > 0 && (result.completed || intervalState.phase !== previousPhase || intervalState.currentRound !== previousRound)) alertSignal();
  intervalState.status = result.completed ? "Terminado" : intervalState.phase === "work" ? "Actividad" : "Descanso";
  intervalState.displaySeconds = remainingSeconds(intervalState);
  saveJSON(CUSTOM_TIMER_KEY, intervalState);
  updateCustomTimerDisplay();
  if (!intervalState.running && customTimerTick) {
    clearInterval(customTimerTick);
    customTimerTick = null;
  }
}

function updateCustomTimerDisplay() {
  const seconds = intervalState.running ? remainingSeconds(intervalState) : intervalState.displaySeconds ?? intervalState.work;
  $("timer").textContent = formatMMSS(seconds);
  if (intervalState.running) {
    const rounds = intervalState.totalRounds === 0 ? "∞" : intervalState.totalRounds;
    $("timerPhase").textContent = `${intervalState.phase === "work" ? "Actividad" : "Descanso"} · Ronda ${intervalState.currentRound}/${rounds}`;
  } else {
    $("timerPhase").textContent = intervalState.status || "Detenido";
  }
}

function quickTimer(seconds) {
  $("timerMode").value = "single";
  $("workSeconds").value = String(seconds);
  $("restSeconds").value = "0";
  $("rounds").value = "1";
  startCustomTimer();
}

function ensureAudioContext() {
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {
    audioContext = null;
  }
}

function alertSignal() {
  navigator.vibrate?.(350);
  try {
    ensureAudioContext();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => oscillator.stop(), 180);
  } catch {
    // La vibración sigue disponible si el navegador bloquea el audio.
  }
}

function goToRegisterFromRoutine() {
  resetRegisterForm();
  const dateISO = selectedDateISO();
  $("recordDate").value = dateISO;
  setDateFieldVisible(dateISO !== getChileDateISO());
  const routineName = routines[selectedDay].name;
  $("activityType").value = routineName.includes("Fuerza") ? "Físico" : routineName.includes("Tenis") ? "Tenis" : routineName.includes("Recuperación") ? "Movilidad" : "Otro";
  renderActivityFields();
  showTab("Registrar", { focusHeading: true });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("service-worker.js");
    const offerUpdate = worker => {
      waitingServiceWorker = worker;
      $("updateBanner").classList.remove("hidden");
    };
    if (registration.waiting) offerUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
    registration.update().catch(() => {});
  } catch {
    // La app continúa funcionando en línea aunque el modo offline no esté disponible.
  }
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
  $("sessionButton").addEventListener("click", toggleSessionTimer);
  $("registerFromRoutine").addEventListener("click", goToRegisterFromRoutine);
  $("toggleDateButton").addEventListener("click", () => setDateFieldVisible($("dateFieldBox").classList.contains("hidden")));
  $("recordDate").addEventListener("change", () => renderActivityFields(currentActivityValues()));
  $("activityType").addEventListener("change", () => renderActivityFields(currentActivityValues()));
  $("registerForm").addEventListener("submit", saveRegister);
  $("cancelEditButton").addEventListener("click", resetRegisterForm);
  $("analyzeButton").addEventListener("click", analyzeReadiness);
  $("startTimerButton").addEventListener("click", startCustomTimer);
  $("stopTimerButton").addEventListener("click", () => stopCustomTimer());
  document.querySelectorAll("[data-quick-timer]").forEach(button => button.addEventListener("click", () => quickTimer(Number(button.dataset.quickTimer))));
  document.querySelectorAll("[data-report-days]").forEach(button => button.addEventListener("click", () => generateReport(Number(button.dataset.reportDays))));
  $("copyReportButton").addEventListener("click", copyReport);
  $("exportJsonButton").addEventListener("click", exportJSON);
  $("exportCsvButton").addEventListener("click", exportCSV);
  $("importJsonButton").addEventListener("click", () => $("backupFileInput").click());
  $("backupFileInput").addEventListener("change", importJSON);
  $("updateButton").addEventListener("click", () => waitingServiceWorker?.postMessage({ type: "SKIP_WAITING" }));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      renderSessionTimer();
      tickExerciseTimer();
      tickCustomTimer();
    }
  });
}

function initialize() {
  $("dateText").textContent = getChileDateText();
  $("recordDate").value = getChileDateISO();
  bindEvents();
  renderWeek();
  renderRoutine();
  renderActivityFields();
  renderHistory();
  $("workSeconds").value = String(intervalState.work);
  $("restSeconds").value = String(intervalState.rest);
  $("rounds").value = String(intervalState.totalRounds);
  $("timerMode").value = intervalState.mode;
  updateCustomTimerDisplay();
  ensureCustomTimerTick();
  ensureExerciseTimerTick();
  registerServiceWorker();
}

initialize();
