import {
  cardioTypes,
  cardioTypeById,
  categoryById,
  dayNamesFull,
  dayNamesShort,
  physicalRoutines,
  physicalRoutineById,
  restTypes,
  sensationSuggestions,
  tennisLocations,
  tennisSurfaces,
  tennisTypes,
  tennisTypeById,
  trekkingLocations,
  trekkingRoutes,
  trainingCategories
} from "./data.js?v=59";
import {
  coachOption,
  coachSessionForDate,
  coachTrainingBlock,
  coachWeekForDate
} from "./coach-plan.js?v=59";
import { createRepository } from "./storage.js?v=59";
import { createCloudSync } from "./cloud.js?v=59";
import { COACH_PROFILE_VERSION, DEFAULT_COACH_EQUIPMENT, createAiClient } from "./ai.js?v=59";
import { newestTrainingBlock, normalizeTrainingBlock, summarizeTrainingBlock, weekDisplayTitle } from "./training-plan.js?v=59";
import { comparableActivity, plannedContextForRecord, planAssessment } from "./coach-tracking.js?v=59";
import { activityTiming, durationModeFor } from "./training-metrics.js?v=59";
import {
  dayIndexFromISO,
  addDaysISO,
  exerciseProgress,
  formatLongDate,
  formatShortDate,
  getChileDateISO,
  globalAbdominalRecord,
  groupRecordsByWeek,
  isoWeekInfo,
  normalizeRecord,
  physicalBestRecords,
  physicalRoutineDurationAverages,
  recordDetails,
  recordTitle,
  recordsToCSV,
  runningBestTimes,
  routineExerciseLine,
  routineCompletionSummary,
  trekkingBestTimes,
  validateRecord,
  weekDays,
  weeklyEvolution,
  weeklyReport
} from "./utils.js?v=59";

const $ = id => document.getElementById(id);
const repository = createRepository(window.localStorage);
const aiClient = createAiClient();
const cloudSync = createCloudSync({
  repository,
  storage: window.localStorage,
  onStatus: updateCloudStatus,
  onDataChanged: () => {
    renderHome();
    renderHistory();
    renderCoachPlanDialog();
    updateCoachProfileButton();
  }
});

let currentCategory = null;
let editingRecordId = null;
let waitingServiceWorker = null;
let toastTimer = null;
let timerTicker = null;
let timerAudioContext = null;
let timerLastCountdownSecond = null;
let routineSessionTicker = null;
let openRoutineId = "";
let currentCloudStatus = { state: "unconfigured", user: null };
let plannedRegistrationContext = null;
let plannedActivityTicker = null;
let aiPlanCandidate = null;
const aiAnalysisInFlight = new Set();

const ROUTINE_PROGRESS_KEY = "tgb-routine-progress-v1";
const ROUTINE_SETTINGS_KEY = "tgb-routine-settings-v1";
const ROUTINE_SESSION_KEY = "tgb-routine-session-v1";
const PLANNED_ROUTINE_CONTEXT_KEY = "tgb-planned-routine-v1";
const PLANNED_ACTIVITY_KEY = "tgb-planned-activity-v1";
const TIMER_SETTINGS_KEY = "tgb-series-timer-v1";
const TIMER_WORK_OPTIONS = [20, 25, 30, 35, 40, 45];
const TIMER_REST_OPTIONS = [20, 30, 40, 50];
const TIMER_PREP_SECONDS = 3;
const timerState = {
  status: "idle",
  phase: "work",
  currentSet: 1,
  remainingSeconds: 0,
  phaseTotalSeconds: 0,
  endAt: 0
};

function showView(name) {
  for (const viewName of ["Home", "Register", "Routines", "Timer", "History"]) {
    const view = $(`view${viewName}`);
    const visible = viewName.toLowerCase() === name;
    view.hidden = !visible;
    view.classList.toggle("hidden", !visible);
  }
  const activeNavTarget = name === "routines" ? "register" : name;
  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.viewTarget === activeNavTarget;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "home") renderHome();
  if (name === "routines") renderRoutines();
  if (name === "history") renderHistory();
  window.scrollTo({ top: 0, behavior: name === "routines" ? "auto" : "smooth" });
}

function openRegistration() {
  clearPlannedRoutineContext({ restore: true });
  resetRegistration();
  showView("register");
}

function activeTrainingBlock() {
  return newestTrainingBlock(repository.listTrainingBlocks()) || coachTrainingBlock;
}

function planRecordForSession(session, records = repository.list(), block = activeTrainingBlock()) {
  const related = records.filter(record => plannedContextForRecord(record, block)?.session.id === session?.id);
  // Preferir la actividad que sí cubre la opción prevista, sin ocultar otras actividades del día.
  return related.find(record => record.routineAiAnalysis?.planComparison?.status === "completed")
    || related.find(record => plannedContextForRecord(record, block)?.exact)
    || related[0] || null;
}

function createPlanActualFeedback(session, records, block = activeTrainingBlock()) {
  const box = document.createElement("div");
  box.className = "plan-actual-feedback";
  records.filter(record => plannedContextForRecord(record, block)?.session.id === session.id).forEach(record => {
    const assessment = planAssessment(record, plannedContextForRecord(record, block));
    const row = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = `${assessment.label} · ${recordTitle(record)}`;
    const detail = document.createElement("small");
    detail.textContent = assessment.reason;
    row.append(title, detail);
    box.append(row);
  });
  return box;
}

function attachMatchingPlan(record) {
  const block = activeTrainingBlock();
  const match = plannedContextForRecord(record, block);
  if (!match) return record.planBlockId === block.id
    ? { ...record, planBlockId: "", planWeekKey: "", planSessionId: "", planOptionId: "", plannedTitle: "" }
    : record;
  return {
    ...record,
    planBlockId: block.id,
    planWeekKey: match.week.weekKey,
    planSessionId: match.session.id,
    planOptionId: match.option.id,
    plannedTitle: `${match.option.title} · ${match.option.summary}`
  };
}

function loadPlannedRoutineContext() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLANNED_ROUTINE_CONTEXT_KEY) || "null");
    if (!parsed || !parsed.blockId || !physicalRoutineById(parsed.routineId)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePlannedRoutineContext(context) {
  try {
    if (context) window.localStorage.setItem(PLANNED_ROUTINE_CONTEXT_KEY, JSON.stringify(context));
    else window.localStorage.removeItem(PLANNED_ROUTINE_CONTEXT_KEY);
  } catch {
    showToast("No se pudo conservar la sesión planificada.");
  }
}

function restoreSettingsSnapshot(routineId, snapshot = {}) {
  const routine = physicalRoutineById(routineId);
  if (!routine) return;
  const settings = loadRoutineSettings();
  routine.exercises.forEach(exercise => {
    const original = snapshot[exercise.id];
    const key = routineSettingsKey(routine.id, exercise.id);
    if (original) settings[key] = { ...original };
    else delete settings[key];
  });
  saveRoutineSettings(settings);
}

function clearPlannedRoutineContext({ restore = false } = {}) {
  const context = loadPlannedRoutineContext();
  if (restore && context?.settingsBeforePlan && loadRoutineSession()?.status !== "active") {
    restoreSettingsSnapshot(context.routineId, context.settingsBeforePlan);
  }
  savePlannedRoutineContext(null);
}

function planContextPayload(session, option, block = activeTrainingBlock()) {
  return {
    blockId: block.id,
    blockTitle: block.title,
    weekKey: session.week.weekKey,
    weekNumber: session.week.number,
    sessionId: session.id,
    optionId: option.id,
    optionTitle: option.title,
    plannedTitle: `${option.title} · ${option.summary}`,
    dateISO: session.dateISO,
    category: option.category
  };
}

function plannedPrefill(option) {
  const prefill = option.prefill || {};
  return {
    cardioTypeId: prefill.cardioTypeId || "",
    tennisTypeId: prefill.tennisTypeId || "",
    restTypeId: prefill.restTypeId || "planned",
    distanceKm: prefill.distanceKm ?? "",
    durationMinutes: "",
    durationSeconds: "",
    calories: "",
    sensations: ""
  };
}

function applyPlannedRoutineSettings(routine, option) {
  const settings = loadRoutineSettings();
  const before = routineSettingsSnapshot(routine, settings);
  Object.entries(option.prefill?.settings || {}).forEach(([exerciseId, value]) => {
    settings[routineSettingsKey(routine.id, exerciseId)] = { ...value };
  });
  saveRoutineSettings(settings);
  return before;
}

function openPlannedOption(session, optionId, { startNow = false } = {}) {
  const block = activeTrainingBlock();
  const option = coachOption(session, optionId);
  if (!option) return;
  const todayISO = getChileDateISO();
  if (session.dateISO > todayISO) {
    showToast(`Esta sesión estará disponible el ${formatShortDate(session.dateISO)}.`);
    return;
  }
  const actual = planRecordForSession(session, repository.list(), block);
  if (actual && planAssessment(actual, plannedContextForRecord(actual, block)).status === "completed") {
    $("coachPlanDialog")?.close();
    showView("history");
    showToast("Esta sesión ya está registrada. Puedes revisarla en el historial.");
    return;
  }
  const payload = planContextPayload(session, option, block);
  $("coachPlanDialog")?.close();
  $("plannedActivityDialog")?.close();
  if (option.category === "physical") {
    const routine = physicalRoutineById(option.prefill?.routineId);
    if (!routine && startNow) return startGenericPlannedActivity(session, option, block);
    if (!routine) return openPlannedRegistration(session, option, block);
    const active = loadRoutineSession();
    if (active?.status === "active") {
      openRoutineId = active.routineId;
      showView("routines");
      scrollToRoutineProgress(active.routineId);
      showToast("Ya tienes una rutina en curso. Continúa o finalízala primero.");
      return;
    }
    clearPlannedRoutineContext({ restore: true });
    const settingsBeforePlan = applyPlannedRoutineSettings(routine, option);
    savePlannedRoutineContext({
      ...payload,
      routineId: routine.id,
      omitExerciseIds: option.prefill?.omitExerciseIds || [],
      settingsBeforePlan,
      planDetails: option.details || []
    });
    openRoutineId = routine.id;
    showView("routines");
    if (startNow) {
      startRoutineSession(routine);
      scrollToRoutineProgress(routine.id);
    } else {
      scrollToRoutine(routine.id);
      showToast("Plan cargado. Revísalo y pulsa Iniciar cuando estés listo.");
    }
    return;
  }
  if (startNow && option.category !== "rest") return startGenericPlannedActivity(session, option, block);
  openPlannedRegistration(session, option, block);
}

function openPlannedRegistration(session, option, block, timing = {}) {
  const customPhysical = option.category === "physical" && !physicalRoutineById(option.prefill?.routineId);
  plannedRegistrationContext = {
    ...planContextPayload(session, option, block),
    customPhysical,
    startedAt: timing.startedAt || "",
    endedAt: timing.endedAt || "",
    planDetails: option.details || []
  };
  resetRegistration({ keepPlan: true });
  showView("register");
  selectCategory(option.category, {
    ...plannedPrefill(option), ...option.prefill,
    routineName: customPhysical ? option.title : "",
    dateISO: session.dateISO,
    durationSeconds: timing.durationSeconds ?? "",
    durationMinutes: timing.durationSeconds ? timing.durationSeconds / 60 : ""
  });
}

function loadPlannedActivity() {
  try {
    const state = JSON.parse(window.localStorage.getItem(PLANNED_ACTIVITY_KEY) || "null");
    return state?.blockId === activeTrainingBlock().id && state?.sessionId && state?.optionId && ["active", "finished"].includes(state.status) ? state : null;
  } catch { return null; }
}

function savePlannedActivity(state) {
  if (state) window.localStorage.setItem(PLANNED_ACTIVITY_KEY, JSON.stringify(state));
  else window.localStorage.removeItem(PLANNED_ACTIVITY_KEY);
}

function plannedActivityContext(state) {
  const block = activeTrainingBlock();
  if (!state || state.blockId !== block.id) return null;
  const session = coachSessionForDate(state.dateISO, block);
  const option = coachOption(session, state.optionId);
  return session?.id === state.sessionId && option ? { block, session, option } : null;
}

function startGenericPlannedActivity(session, option, block) {
  const current = loadPlannedActivity();
  if (current?.status === "active") return showToast("Ya tienes una actividad programada en curso. Continúala o finalízala primero.");
  if (current?.status === "finished") return showToast("Completa el registro programado pendiente antes de iniciar otro.");
  if (loadRoutineSession()?.status === "active") return showToast("Primero finaliza la rutina física que ya está en curso.");
  try {
    savePlannedActivity({ status: "active", blockId: block.id, sessionId: session.id, optionId: option.id, dateISO: session.dateISO, startedAt: new Date().toISOString() });
  } catch { return showToast("No se pudo conservar el temporizador de esta actividad."); }
  renderPlannedActivityDialog(session, block);
  if (!$("plannedActivityDialog").open) $("plannedActivityDialog").showModal();
  renderHome();
}

function finishGenericPlannedActivity() {
  const state = loadPlannedActivity();
  const context = plannedActivityContext(state);
  if (!context) return showToast("Ya no se encontró esta actividad en el plan activo.");
  const endedAt = state.status === "finished" ? state.endedAt : new Date().toISOString();
  const durationSeconds = Math.max(1, Math.round((Date.parse(endedAt) - Date.parse(state.startedAt)) / 1000));
  const finished = { ...state, status: "finished", endedAt, durationSeconds };
  try { savePlannedActivity(finished); }
  catch { return showToast("No se pudo conservar la duración. Inténtalo otra vez."); }
  $("plannedActivityDialog").close();
  openPlannedRegistration(context.session, context.option, context.block, finished);
  showToast("Tiempo guardado. Completa las calorías y sensaciones para registrar la actividad.");
}

function updatePlannedActivityClock() {
  const state = loadPlannedActivity();
  if (state?.status !== "active") {
    if (plannedActivityTicker) clearInterval(plannedActivityTicker);
    plannedActivityTicker = null;
    return;
  }
  const elapsed = Math.max(0, Math.floor((Date.now() - Date.parse(state.startedAt)) / 1000));
  $("plannedActivityClock").textContent = formatTimerClock(elapsed);
  if (!plannedActivityTicker) plannedActivityTicker = setInterval(updatePlannedActivityClock, 1000);
}

function renderPlannedActivityDialog(session, block) {
  $("plannedActivityDialogTitle").textContent = `${weekDisplayTitle(session.week)} · ${formatShortDate(session.dateISO)}`;
  $("plannedActivityObjective").textContent = session.objective;
  const options = $("plannedActivityOptions");
  options.replaceChildren();
  const state = loadPlannedActivity();
  const active = plannedActivityContext(state);
  session.options.forEach(option => {
    if (active && option.id !== active.option.id) return;
    const card = document.createElement("article");
    card.className = "planned-activity-option";
    const title = document.createElement("h3");
    title.textContent = option.title;
    const summary = document.createElement("p");
    summary.textContent = option.summary;
    const details = document.createElement("ul");
    (option.details || []).forEach(detail => {
      const row = document.createElement("li");
      row.textContent = detail;
      details.append(row);
    });
    card.append(title, summary, details);
    if (!active) {
      const start = document.createElement("button");
      start.type = "button";
      start.textContent = option.category === "rest" ? "Registrar descanso programado" : `Iniciar ${option.title}`;
      start.addEventListener("click", () => openPlannedOption(session, option.id, { startNow: true }));
      card.append(start);
    }
    options.append(card);
  });
  $("plannedActivityTimer").classList.toggle("hidden", !active);
  $("finishPlannedActivityButton").textContent = "Finalizar y completar registro";
  if (active?.status === "active") updatePlannedActivityClock();
  else if (active?.status === "finished") {
    $("plannedActivityClock").textContent = formatTimerClock(state.durationSeconds || 0);
    $("finishPlannedActivityButton").textContent = "Continuar registro";
  }
}

function openTodayPlannedActivity() {
  const state = loadPlannedActivity();
  const active = plannedActivityContext(state);
  const block = activeTrainingBlock();
  const session = active?.session || coachSessionForDate(getChileDateISO(), block);
  if (!session) return;
  renderPlannedActivityDialog(session, block);
  if (!$("plannedActivityDialog").open) $("plannedActivityDialog").showModal();
}

function createPlanOptionButton(session, option, records, { compact = false } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = compact ? "coach-option-button compact" : "coach-option-button";
  const completed = planRecordForSession(session, records);
  const future = session.dateISO > getChileDateISO();
  button.disabled = future;
  const fulfilled = completed && planAssessment(completed, plannedContextForRecord(completed, activeTrainingBlock())).status === "completed";
  button.textContent = fulfilled ? "Ver registro" : future ? `Disponible ${formatShortDate(session.dateISO)}` : completed ? `Realizar ${option.title}` : `Elegir ${option.title}`;
  button.addEventListener("click", () => openPlannedOption(session, option.id));
  return button;
}

function renderCoachTodayPlan(records) {
  const block = activeTrainingBlock();
  const todayISO = getChileDateISO();
  const exact = coachSessionForDate(todayISO, block);
  const next = block.weeks.flatMap(week => week.sessions.map(session => ({ ...session, week })))
    .find(session => session.dateISO >= todayISO && !planRecordForSession(session, records, block));
  const session = exact || next;
  const container = $("coachTodayPlan");
  container.replaceChildren();
  if (!session) {
    const done = document.createElement("p");
    done.className = "coach-plan-done";
    done.textContent = "Bloque finalizado. Tu historial conserva todos los resultados.";
    container.append(done);
    return;
  }
  const copy = document.createElement("div");
  const label = document.createElement("span");
  label.textContent = exact ? "Plan de hoy" : `Próxima sesión · ${formatShortDate(session.dateISO)}`;
  const title = document.createElement("strong");
  const primary = coachOption(session, session.primaryOptionId) || session.options[0];
  title.textContent = primary.title;
  const summary = document.createElement("small");
  summary.textContent = session.options.length > 1 ? `${primary.summary} · ${session.options.length} alternativas` : primary.summary;
  copy.append(label, title, summary);
  container.append(copy);
  if (exact) container.append(createPlanActualFeedback(session, records, block));
  if (exact) container.append(createPlanOptionButton(session, primary, records, { compact: true }));
}

function renderCoachBlock(records = repository.list()) {
  const block = activeTrainingBlock();
  const todayISO = getChileDateISO();
  const week = coachWeekForDate(todayISO, block)
    || (todayISO < block.startISO ? block.weeks[0] : block.weeks.at(-1));
  const sessions = block.weeks.flatMap(item => item.sessions);
  const completed = sessions.filter(session => planRecordForSession(session, records, block)).length;
  const phase = todayISO < block.startISO
    ? `Comienza ${formatShortDate(block.startISO)}`
    : todayISO > block.endISO ? "Bloque finalizado" : `Semana ${week.number} · ${week.label}`;
  $("coachBlockPhase").textContent = phase;
  $("coachBlockProgress").textContent = `${completed}/${sessions.length} días registrados`;
  $("coachBlockTitle").textContent = block.title;
  $("coachBlockContext").textContent = week?.context || block.subtitle || "Plan indicado por tu entrenador.";
  $("coachBlockCard").querySelector(".coach-block-weeks").innerHTML = `${block.weeks.length}<br><small>semanas</small>`;
  renderCoachTodayPlan(records);
}

function renderCoachPlanDialog(records = repository.list()) {
  const block = activeTrainingBlock();
  const container = $("coachPlanWeeks");
  container.replaceChildren();
  $("coachPlanDialogTitle").textContent = `${block.title} · ${block.weeks.length} ${block.weeks.length === 1 ? "semana" : "semanas"}`;
  $("coachPlanDialogTitle").nextElementSibling.textContent = `Del ${formatShortDate(block.startISO)} al ${formatShortDate(block.endISO)} · ${block.source}`;
  block.weeks.forEach((week, weekIndex) => {
    const weekCard = document.createElement("details");
    weekCard.className = "coach-week-card";
    const todayISO = getChileDateISO();
    weekCard.open = coachWeekForDate(todayISO, block)?.weekKey === week.weekKey
      || (todayISO < block.startISO && weekIndex === 0);
    const completed = week.sessions.filter(session => planRecordForSession(session, records, block)).length;
    const summary = document.createElement("summary");
    const copy = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.textContent = `Semana ${week.number} · ${formatShortDate(week.startISO)}–${formatShortDate(week.endISO)}`;
    const title = document.createElement("strong");
    title.textContent = weekDisplayTitle(week);
    const objective = document.createElement("small");
    objective.textContent = week.objective;
    copy.append(eyebrow, title, objective);
    const counter = document.createElement("b");
    counter.textContent = `${completed}/${week.sessions.length}`;
    counter.title = "Días con actividad registrada; el detalle distingue cumplimiento, adaptación y recuperación.";
    summary.append(copy, counter);
    const body = document.createElement("div");
    body.className = "coach-week-body";
    week.sessions.forEach(session => {
      const day = document.createElement("article");
      day.className = "coach-session-card";
      if (session.dateISO === getChileDateISO()) day.classList.add("today");
      const actual = planRecordForSession(session, records, block);
      if (actual && planAssessment(actual, plannedContextForRecord(actual, block)).status === "completed") day.classList.add("complete");
      const heading = document.createElement("div");
      const date = document.createElement("span");
      date.textContent = formatLongDate(session.dateISO);
      const goal = document.createElement("p");
      goal.textContent = session.objective;
      heading.append(date, goal);
      day.append(heading);
      day.append(createPlanActualFeedback(session, records, block));
      session.options.forEach(option => {
        const optionCard = document.createElement("div");
        optionCard.className = "coach-session-option";
        const optionTitle = document.createElement("strong");
        optionTitle.textContent = option.title;
        const optionSummary = document.createElement("small");
        optionSummary.textContent = option.summary;
        const details = document.createElement("ul");
        option.details.forEach(text => {
          const item = document.createElement("li");
          item.textContent = text;
          details.append(item);
        });
        optionCard.append(optionTitle, optionSummary, details, createPlanOptionButton({ ...session, week }, option, records));
        day.append(optionCard);
      });
      body.append(day);
    });
    weekCard.append(summary, body);
    container.append(weekCard);
  });
  const rules = $("coachPlanRules");
  rules.replaceChildren();
  block.rules.forEach(text => {
    const item = document.createElement("li");
    item.textContent = text;
    rules.append(item);
  });
}

function openCoachPlanDialog() {
  renderCoachPlanDialog();
  if (!$("coachPlanDialog").open) $("coachPlanDialog").showModal();
}

function setAiPlanMessage(message, type = "error", targetId = "aiPlanMessage") {
  const target = $(targetId);
  target.textContent = message;
  target.className = message ? `form-message ${type}` : "form-message hidden";
}

function showAiPlanInput() {
  $("aiPlanInputStep").hidden = false;
  $("aiPlanInputStep").classList.remove("hidden");
  $("aiPlanPreviewStep").hidden = true;
  $("aiPlanPreviewStep").classList.add("hidden");
}

function openAiPlanDialog() {
  aiPlanCandidate = null;
  showAiPlanInput();
  setAiPlanMessage("");
  setAiPlanMessage("", "error", "aiPlanSaveMessage");
  if ($("cloudDialog").open) $("cloudDialog").close();
  if (!$("aiPlanDialog").open) $("aiPlanDialog").showModal();
}

function renderAiPlanPreview(block) {
  const summary = summarizeTrainingBlock(block);
  $("aiPlanPreviewTitle").textContent = block.title;
  $("aiPlanPreviewDates").textContent = `${formatShortDate(block.startISO)} — ${formatShortDate(block.endISO)} · ${block.source}`;
  const summaryBox = $("aiPlanPreviewSummary");
  summaryBox.replaceChildren();
  [[summary.weeks, "semanas"], [summary.sessions, "días planificados"], [block.rules.length, "reglas"]].forEach(([value, label]) => {
    const metric = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = String(value);
    const span = document.createElement("span");
    span.textContent = label;
    metric.append(strong, span);
    summaryBox.append(metric);
  });
  const weeks = $("aiPlanPreviewWeeks");
  weeks.replaceChildren();
  block.weeks.forEach(week => {
    const card = document.createElement("section");
    card.className = "ai-preview-week";
    const title = document.createElement("strong");
    title.textContent = `Semana ${week.number} · ${weekDisplayTitle(week)}`;
    card.append(title);
    week.sessions.forEach(session => {
      const option = coachOption(session, session.primaryOptionId) || session.options[0];
      const row = document.createElement("div");
      row.className = "ai-preview-day";
      const date = document.createElement("span");
      date.textContent = formatShortDate(session.dateISO);
      const activity = document.createElement("b");
      activity.textContent = option.title;
      row.append(date, activity);
      card.append(row);
    });
    weeks.append(card);
  });
  $("aiPlanInputStep").hidden = true;
  $("aiPlanInputStep").classList.add("hidden");
  $("aiPlanPreviewStep").hidden = false;
  $("aiPlanPreviewStep").classList.remove("hidden");
}

async function analyzeAiPlan() {
  const planText = $("aiPlanText").value.trim();
  if (planText.length < 100) {
    setAiPlanMessage("Pega una planificación más completa para que la IA pueda reconocer semanas, días y actividades.");
    $("aiPlanText").focus();
    return;
  }
  const button = $("analyzeAiPlanButton");
  button.disabled = true;
  button.textContent = "La IA está organizando el plan…";
  setAiPlanMessage("Puede tardar algunos segundos. No cierres esta ventana.", "success");
  try {
    const result = await aiClient.importTrainingPlan(planText, getChileDateISO());
    const block = normalizeTrainingBlock(result?.block || result);
    if (!block) throw new Error("La IA no devolvió una planificación que TGTrain pudiera validar.");
    aiPlanCandidate = block;
    renderAiPlanPreview(block);
    setAiPlanMessage("");
  } catch (error) {
    setAiPlanMessage(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = '<span aria-hidden="true">✦</span> Analizar y preparar vista previa';
  }
}

function saveAiPlan() {
  if (!aiPlanCandidate) return;
  try {
    const saved = repository.saveTrainingBlock({ ...aiPlanCandidate, updatedAt: new Date().toISOString() });
    aiPlanCandidate = null;
    $("aiPlanDialog").close();
    renderHome();
    renderCoachPlanDialog();
    showToast(`${saved.title} quedó guardado como tu planificación activa.`);
  } catch (error) {
    setAiPlanMessage(error.message, "error", "aiPlanSaveMessage");
  }
}

function updateCloudStatus(status) {
  currentCloudStatus = status;
  const button = $("cloudStatusButton");
  const label = $("cloudStatusLabel");
  if (!button || !label) return;
  const stateLabels = {
    unconfigured: "Activación pendiente",
    "signed-out": "Datos locales",
    syncing: "Sincronizando…",
    synced: "En la nube",
    offline: "Solo local",
    error: "Error de nube",
    "account-mismatch": "Revisa la cuenta"
  };
  button.className = `cloud-status-button ${status.state}`;
  label.textContent = stateLabels[status.state] || "Datos locales";
  $("cloudMessage").textContent = status.message || "";

  const identity = $("cloudIdentity");
  const hasUser = Boolean(status.user);
  identity.classList.toggle("hidden", !hasUser);
  if (hasUser) {
    $("cloudUserName").textContent = status.user.displayName || "Cuenta de Google";
    $("cloudUserEmail").textContent = status.user.email || "";
    $("cloudUserPhoto").src = status.user.photoURL || "assets/brand/tgtrain-mark-160.png?v=36";
  }
  $("cloudSignInButton").classList.toggle("hidden", hasUser);
  $("cloudSignInButton").disabled = !cloudSync.configured || status.state === "syncing";
  $("cloudSyncButton").classList.toggle("hidden", !hasUser || status.state === "account-mismatch");
  $("cloudSignOutButton").classList.toggle("hidden", !hasUser);
  $("cloudSyncButton").disabled = status.state === "syncing";
}

function openCloudDialog() {
  updateCloudStatus(currentCloudStatus);
  updateCoachProfileButton();
  if (!$("cloudDialog").open) $("cloudDialog").showModal();
}

function updateCoachProfileButton() {
  const button = $("openCoachProfileButton");
  if (!button) return;
  button.textContent = repository.getCoachProfile()
    ? "Perfil del entrenador IA · Configurado"
    : "Configurar perfil del entrenador IA";
}

function setCoachProfileMessage(text = "", kind = "error") {
  const message = $("coachProfileMessage");
  message.textContent = text;
  message.className = `form-message ${kind}${text ? "" : " hidden"}`;
}

function openCoachProfileDialog() {
  const profile = repository.getCoachProfile();
  $("coachProfileText").value = profile?.profileText || "";
  $("coachProfileEquipment").value = profile?.equipment || DEFAULT_COACH_EQUIPMENT;
  setCoachProfileMessage();
  if ($("cloudDialog").open) $("cloudDialog").close();
  if (!$("coachProfileDialog").open) $("coachProfileDialog").showModal();
}

function saveCoachProfile(event) {
  event.preventDefault();
  const profileText = $("coachProfileText").value.trim();
  const equipment = $("coachProfileEquipment").value.trim();
  if (!profileText) {
    setCoachProfileMessage("Pega las instrucciones de tu entrenador para activar recomendaciones personalizadas.");
    $("coachProfileText").focus();
    return;
  }
  try {
    repository.saveCoachProfile({
      profileText,
      equipment: equipment || DEFAULT_COACH_EQUIPMENT,
      version: COACH_PROFILE_VERSION,
      updatedAt: new Date().toISOString()
    });
    updateCoachProfileButton();
    setCoachProfileMessage(cloudSync.currentUser
      ? "Perfil guardado y preparado para sincronizarse con tu cuenta."
      : "Perfil guardado en este dispositivo. Inicia sesión para sincronizarlo.", "success");
    showToast("Perfil privado del entrenador guardado.");
  } catch (error) {
    setCoachProfileMessage(error.message);
  }
}

async function signInToCloud() {
  try {
    await cloudSync.signIn();
  } catch (error) {
    const cancelled = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(error?.code);
    if (!cancelled) showToast(error?.message || "No fue posible iniciar sesión con Google.");
  }
}

async function syncCloudNow() {
  try {
    await cloudSync.syncNow();
    showToast("Datos sincronizados con Google.");
  } catch (error) {
    showToast(error?.message || "No fue posible sincronizar ahora.");
  }
}

function openRegistrationOrActiveRoutine() {
  const session = loadRoutineSession();
  if (session?.status === "active") {
    openRoutineId = session.routineId;
    showView("routines");
    scrollToRoutineProgress(session.routineId);
    ensureRoutineSessionTicker();
    return;
  }
  openRegistration();
}

function renderHome() {
  const todayISO = getChileDateISO();
  const block = activeTrainingBlock();
  const week = isoWeekInfo(todayISO);
  const allRecords = repository.list();
  const records = allRecords.filter(record => record.dateISO >= week.startISO && record.dateISO <= week.endISO);
  const todayRecords = records.filter(record => record.dateISO === todayISO);
  const activeDays = new Set(records.filter(record => record.category !== "rest").map(record => record.dateISO)).size;
  const plannedWeek = coachWeekForDate(todayISO, block);
  const plannedState = loadPlannedActivity();
  const activePlanned = plannedActivityContext(plannedState);
  const todayPlan = activePlanned?.session || coachSessionForDate(todayISO, block);

  $("currentWeekBadge").textContent = `Semana ${week.weekNumber} · ${week.weekYear}`;
  $("todayStatus").textContent = todayRecords.length ? `${todayRecords.length} ${todayRecords.length === 1 ? "actividad" : "actividades"} hoy` : "Sin registrar hoy";
  $("homeTitle").textContent = formatLongDate(todayISO);
  $("weekRange").textContent = `${formatShortDate(week.startISO)} — ${formatShortDate(week.endISO)}`;
  $("heroWeekTheme").textContent = plannedWeek ? weekDisplayTitle(plannedWeek) : "";
  renderHeroEvolution(allRecords);
  const plannedPanel = $("heroPlannedActivity");
  plannedPanel.classList.toggle("hidden", !todayPlan);
  if (todayPlan) {
    const option = coachOption(todayPlan, todayPlan.primaryOptionId) || todayPlan.options[0];
    const actual = planRecordForSession(todayPlan, allRecords, block);
    $("heroPlannedTitle").textContent = option.title;
    $("heroPlannedSummary").textContent = todayPlan.objective || option.summary;
    $("startPlannedActivityButton").textContent = activePlanned?.session.id === todayPlan.id
      ? plannedState.status === "active" ? "Continuar actividad en curso" : "Completar registro programado"
      : actual?.routineAiAnalysis?.planComparison?.status === "completed" ? "Ver actividad registrada" : "Iniciar actividad programada";
  }
  $("weekProgress").textContent = `${activeDays}/7 días`;
  const feedback = $("homeCoachFeedback");
  feedback.replaceChildren();
  if (todayRecords[0]) feedback.append(createRoutineAiCard(todayRecords[0], { compact: true }));

  const ledger = $("weekLedger");
  ledger.replaceChildren();
  for (const dateISO of weekDays(todayISO)) {
    const day = dayIndexFromISO(dateISO);
    const dayRecords = records.filter(record => record.dateISO === dateISO);
    const plannedSession = coachSessionForDate(dateISO, block);
    const row = document.createElement("article");
    row.className = "day-row";
    row.classList.toggle("today", dateISO === todayISO);
    row.classList.toggle("future", dateISO > todayISO);

    const label = document.createElement("div");
    label.className = "day-label";
    const dayName = document.createElement("strong");
    dayName.textContent = dayNamesShort[day];
    const dayNumber = document.createElement("span");
    dayNumber.textContent = String(Number(dateISO.slice(-2)));
    label.append(dayName, dayNumber);

    const content = document.createElement("div");
    content.className = "day-content";
    if (!dayRecords.length && !plannedSession) {
      const empty = document.createElement("span");
      empty.className = "day-empty";
      empty.textContent = dateISO > todayISO ? "Aún sin actividad" : "Sin entrenamiento registrado";
      content.append(empty);
    } else {
      const activities = document.createElement("div");
      activities.className = "day-activities";
      if (plannedSession) {
        const primary = coachOption(plannedSession, plannedSession.primaryOptionId) || plannedSession.options[0];
        const planLine = document.createElement("div");
        const actual = planRecordForSession(plannedSession, allRecords, block);
        const assessment = planAssessment(actual, actual ? plannedContextForRecord(actual, block) : null);
        planLine.className = `planned-activity-line ${assessment.status === "completed" ? "complete" : ""}`;
        const planBadge = document.createElement("span");
        planBadge.textContent = assessment.label;
        const planCopy = document.createElement("div");
        const planTitle = document.createElement("strong");
        planTitle.textContent = primary.title;
        const planMeta = document.createElement("small");
        planMeta.textContent = plannedSession.options.length > 1 ? `${primary.summary} · con alternativas` : primary.summary;
        planCopy.append(planTitle, planMeta);
        planLine.append(planBadge, planCopy);
        activities.append(planLine);
      }
      for (const record of dayRecords) {
        const line = document.createElement("div");
        line.className = "activity-line";
        const copy = document.createElement("div");
        copy.className = "activity-copy";
        const dot = document.createElement("span");
        dot.className = `category-dot ${record.category}`;
        const text = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = recordTitle(record);
        const details = document.createElement("small");
        details.textContent = recordDetails(record);
        text.append(title, details);
        copy.append(dot, text);
        line.append(copy);
        activities.append(line);
      }
      content.append(activities);
    }
    row.append(label, content);
    ledger.append(row);
  }
}

function renderCategoryChooser() {
  const chooser = $("categoryChooser");
  chooser.replaceChildren();
  for (const category of trainingCategories) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-card ${category.accent}`;
    button.setAttribute("aria-label", `${category.name}: ${category.description}`);
    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = category.name;
    const description = document.createElement("p");
    description.textContent = category.description;
    copy.append(title, description);
    const icon = document.createElement("span");
    icon.className = `category-icon ${category.id}`;
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = categoryIcon(category.id);
    button.append(copy, icon);
    button.addEventListener("click", () => selectCategory(category.id));
    chooser.append(button);
  }
}

function categoryIcon(categoryId) {
  const icons = {
    physical: `<svg viewBox="0 0 64 64" role="img"><path d="M8 25v14M15 20v24M49 20v24M56 25v14M15 32h34"/></svg>`,
    cardio: `<svg viewBox="0 0 64 64" role="img"><path d="M8 34h11l5-14 9 28 7-21 5 7h11"/><path d="M49 13c-7 0-11 5-11 5s-4-5-11-5c-8 0-14 6-14 14"/></svg>`,
    tennis: `<svg viewBox="0 0 64 64" role="img"><ellipse cx="27" cy="23" rx="15" ry="20" transform="rotate(38 27 23)"/><path d="M36 38l14 14M44 46l-7 7M14 15l25 19M11 24l20 15"/><circle cx="52" cy="14" r="5"/></svg>`,
    rest: `<svg viewBox="0 0 64 64" role="img"><path d="M47 43A23 23 0 0 1 23 17a22 22 0 1 0 24 26Z"/><path d="M43 13v8M39 17h8M51 25v6M48 28h6"/></svg>`
  };
  return icons[categoryId] || "";
}

function createChoice({ name, value, title, description, checked }) {
  const wrapper = document.createElement("div");
  const id = `${name}-${value}`;
  const input = document.createElement("input");
  input.className = "choice-input";
  input.type = "radio";
  input.name = name;
  input.id = id;
  input.value = value;
  input.checked = checked;
  input.required = true;
  const label = document.createElement("label");
  label.className = "choice-label";
  label.htmlFor = id;
  const strong = document.createElement("strong");
  strong.textContent = title;
  label.append(strong);
  if (description) {
    const small = document.createElement("small");
    small.textContent = description;
    label.append(small);
  }
  wrapper.append(input, label);
  return { wrapper, input };
}

function renderPhysicalFields(record = {}) {
  const customPhysical = plannedRegistrationContext?.customPhysical
    || (editingRecordId && record.routineName && !record.routineId);
  if (customPhysical) {
    const box = document.createElement("div");
    box.className = "planned-physical-fields";
    const heading = document.createElement("h2");
    heading.textContent = plannedRegistrationContext?.optionTitle || record.routineName;
    const description = document.createElement("p");
    description.textContent = "Actividad física indicada por tu entrenador. Registra lo que realizaste, aunque no corresponda a una rutina base.";
    box.append(heading, description);
    const details = plannedRegistrationContext?.planDetails || plannedContextForRecord(record, activeTrainingBlock())?.option.details || [];
    if (details.length) {
      const list = document.createElement("ul");
      details.forEach(detail => {
        const item = document.createElement("li");
        item.textContent = detail;
        list.append(item);
      });
      box.append(list);
    }
    const addField = (id, title, { type = "number", value = "", min = "0", max = "", placeholder = "" } = {}) => {
      const label = document.createElement("label");
      label.htmlFor = id;
      label.textContent = title;
      const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
      input.id = id;
      if (type !== "textarea") {
        input.type = type;
        input.inputMode = "numeric";
        input.min = min;
        if (max) input.max = max;
      } else input.maxLength = 3000;
      input.placeholder = placeholder;
      input.value = value === "" || value === null ? "" : String(value);
      box.append(label, input);
    };
    addField("plannedPhysicalExercises", "Ejercicios, series, repeticiones y pesos realizados", { type: "textarea", value: record.routineSummary || "", placeholder: "Ej.: sentadilla 3 × 10 con 8 kg; movilidad 10 min…" });
    addField("plannedPhysicalAbs", "Abdominales finales (si hiciste)", { value: record.routineAbsCount ?? "" });
    addField("plannedPhysicalEffort", "Esfuerzo percibido (1 a 10)", { value: record.routineEffort ?? "", min: "1", max: "10" });
    addField("plannedPhysicalPain", "Dolor o molestia (0 a 10)", { value: record.routinePain ?? "", max: "10" });
    addField("plannedPhysicalPainDetail", "Detalle de la molestia (si corresponde)", { type: "textarea", value: record.routinePainDetail || "", placeholder: "Dónde y cómo se sintió" });
    $("categoryFields").append(box);
    return;
  }
  if (!editingRecordId) {
    const records = repository.list();
    const durationAverages = physicalRoutineDurationAverages(records);
    const abdominalRecord = globalAbdominalRecord(records);
    const heading = document.createElement("div");
    heading.className = "routine-launch-heading";
    const title = document.createElement("h2");
    title.textContent = "Elige una rutina";
    const description = document.createElement("p");
    description.textContent = "Puedes revisar sus ejercicios y preparar tus implementos. El tiempo solo comenzará cuando pulses Iniciar entrenamiento.";
    heading.append(title, description);
    const grid = document.createElement("div");
    grid.className = "routine-launch-grid";
    physicalRoutines.forEach((routine, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "routine-launch-card";
      button.setAttribute("aria-label", `Ver ${routine.name}`);
      const number = document.createElement("span");
      number.className = "routine-launch-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      const nameLine = document.createElement("span");
      nameLine.className = "routine-name-line";
      const name = document.createElement("strong");
      name.textContent = routine.name;
      nameLine.append(
        name,
        createRoutineDurationBadge(routine, durationAverages),
        createRoutineAbsRecordBadge(abdominalRecord)
      );
      const focus = document.createElement("small");
      focus.textContent = routine.focus;
      copy.append(nameLine, focus);
      const action = document.createElement("span");
      action.className = "routine-launch-action";
      action.textContent = "Ver rutina →";
      button.append(number, copy, action);
      button.addEventListener("click", () => launchRoutineFromRegistration(routine));
      grid.append(button);
    });
    $("categoryFields").append(heading, grid);
    return;
  }

  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Elige una de las cuatro rutinas";
  const grid = document.createElement("div");
  grid.className = "choice-grid two";
  physicalRoutines.forEach((routine, index) => {
    const choice = createChoice({
      name: "routineId",
      value: routine.id,
      title: routine.name,
      description: routine.focus,
      checked: record.routineId ? record.routineId === routine.id : index === 0
    });
    grid.append(choice.wrapper);
  });
  fieldset.append(legend, grid);
  $("categoryFields").append(fieldset);
}

function renderRestFields(record = {}) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "¿Qué tipo de descanso necesitas registrar?";
  const grid = document.createElement("div");
  grid.className = "choice-grid two";
  const detailBox = document.createElement("div");
  detailBox.className = "rest-detail-box hidden";
  const detailLabel = document.createElement("label");
  detailLabel.htmlFor = "restDetail";
  detailLabel.textContent = "Detalle de la molestia";
  const detail = document.createElement("textarea");
  detail.id = "restDetail";
  detail.rows = 4;
  detail.maxLength = 2000;
  detail.placeholder = "¿Dónde está la molestia, cómo se siente y desde cuándo?";
  detail.value = record.restDetail || "";
  const hint = document.createElement("small");
  hint.textContent = "Este detalle aparecerá en el historial y en tu informe semanal.";
  detailBox.append(detailLabel, detail, hint);

  const updateDetail = () => {
    const discomfort = document.querySelector('input[name="restTypeId"]:checked')?.value === "discomfort";
    detailBox.classList.toggle("hidden", !discomfort);
    detail.required = discomfort;
    if (!discomfort) detail.value = "";
  };

  restTypes.forEach((type, index) => {
    const choice = createChoice({
      name: "restTypeId",
      value: type.id,
      title: type.name,
      description: type.description,
      checked: record.restTypeId ? record.restTypeId === type.id : index === 0
    });
    choice.input.addEventListener("change", updateDetail);
    grid.append(choice.wrapper);
  });
  fieldset.append(legend, grid, detailBox);
  $("categoryFields").append(fieldset);
  updateDetail();
}

function currentCardioExtraValues() {
  return {
    location: selectedLocation("cardioLocationSelect", "cardioLocationOther"),
    trekkingRoute: $("trekkingRoute")?.value || "",
    distanceKm: currentDistanceKm(),
    elevationGainM: $("elevationGainM")?.value ?? "",
    ascentDurationSeconds: currentAscentDurationSeconds()
  };
}

function currentAscentDurationSeconds() {
  if (!$("ascentHours") && !$("ascentMinutes")) return "";
  return (Number($("ascentHours")?.value || 0) * 3600)
    + (Number($("ascentMinutes")?.value || 0) * 60);
}

function currentDistanceKm() {
  const runningPreset = $("runningDistanceSelect")?.value;
  if (runningPreset && runningPreset !== "other") return Number(runningPreset);
  if (runningPreset === "") return "";
  if (!$("distanceKilometers") && !$("distanceMeters")) return "";
  const kilometers = Number($("distanceKilometers")?.value || 0);
  const meters = Number($("distanceMeters")?.value || 0);
  return kilometers + (meters / 1000);
}

function distanceParts(distanceKm) {
  const totalMeters = Math.max(0, Math.round((Number(distanceKm) || 0) * 1000));
  return { kilometers: Math.floor(totalMeters / 1000), meters: totalMeters % 1000 };
}

function selectedLocation(selectId, otherId) {
  const selected = $(selectId)?.value || "";
  return selected === "other" ? $(otherId)?.value.trim() || "" : selected;
}

function createLocationPicker({ idPrefix, labelText, values, currentValue, placeholder }) {
  const fragment = document.createDocumentFragment();
  const label = document.createElement("label");
  label.htmlFor = `${idPrefix}Select`;
  label.textContent = labelText;
  const select = document.createElement("select");
  select.id = `${idPrefix}Select`;
  select.required = true;
  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = "Selecciona una opción";
  select.append(placeholderOption);
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  const otherOption = document.createElement("option");
  otherOption.value = "other";
  otherOption.textContent = "Otro";
  select.append(otherOption);

  const otherLabel = document.createElement("label");
  otherLabel.htmlFor = `${idPrefix}Other`;
  otherLabel.textContent = "Escribe el lugar";
  const otherInput = document.createElement("input");
  otherInput.id = `${idPrefix}Other`;
  otherInput.type = "text";
  otherInput.maxLength = 300;
  otherInput.placeholder = placeholder;

  const isKnown = values.includes(currentValue);
  select.value = currentValue ? (isKnown ? currentValue : "other") : "";
  otherInput.value = currentValue && !isKnown ? currentValue : "";
  const updateOtherVisibility = () => {
    const visible = select.value === "other";
    otherLabel.classList.toggle("hidden", !visible);
    otherInput.classList.toggle("hidden", !visible);
    otherInput.required = visible;
    if (visible) otherInput.focus({ preventScroll: true });
  };
  select.addEventListener("change", updateOtherVisibility);
  updateOtherVisibility();
  fragment.append(label, select, otherLabel, otherInput);
  return fragment;
}

function updateCardioExtraFields(values = {}) {
  const selected = document.querySelector('input[name="cardioTypeId"]:checked');
  const cardio = cardioTypeById(selected?.value);
  const box = $("cardioExtraFields");
  if (!box || !cardio) return;
  box.replaceChildren();
  if (cardio.location) {
    box.append(createLocationPicker({
      idPrefix: "cardioLocation",
      labelText: "Cerro o lugar del trekking",
      values: trekkingLocations,
      currentValue: values.location || "",
      placeholder: "Escribe el cerro o lugar"
    }));
    if (cardio.id === "trekking") {
      const routeBox = document.createElement("div");
      routeBox.id = "trekkingRouteFields";
      const renderRoutePicker = () => {
        routeBox.replaceChildren();
        const location = selectedLocation("cardioLocationSelect", "cardioLocationOther");
        const routes = trekkingRoutes[location] || [];
        if (!routes.length) return;
        const label = document.createElement("label");
        label.htmlFor = "trekkingRoute";
        label.textContent = `Ruta de ${location}`;
        const select = document.createElement("select");
        select.id = "trekkingRoute";
        select.required = true;
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecciona la ruta";
        select.append(placeholder);
        routes.forEach(route => {
          const option = document.createElement("option");
          option.value = route;
          option.textContent = route;
          select.append(option);
        });
        select.value = routes.includes(values.trekkingRoute) ? values.trekkingRoute : "";
        routeBox.append(label, select);
      };
      box.append(routeBox);
      $("cardioLocationSelect")?.addEventListener("change", renderRoutePicker);
      $("cardioLocationOther")?.addEventListener("input", renderRoutePicker);
      renderRoutePicker();
    }
  }
  if (cardio.distance) {
    const distance = distanceParts(values.distanceKm);
    const createDistancePart = ({ id, value, max, caption }) => {
      const wrapper = document.createElement("div");
      const input = document.createElement("input");
      input.id = id;
      input.type = "number";
      input.inputMode = "numeric";
      input.min = "0";
      input.max = String(max);
      input.step = "1";
      input.value = String(value);
      input.required = cardio.id === "trekking";
      input.setAttribute("aria-label", caption);
      const unit = document.createElement("small");
      unit.textContent = caption;
      wrapper.append(input, unit);
      return wrapper;
    };
    const createDistanceFields = () => {
      const fields = document.createElement("div");
      fields.className = "distance-parts";
      fields.append(
        createDistancePart({ id: "distanceKilometers", value: distance.kilometers, max: 999, caption: "km" }),
        createDistancePart({ id: "distanceMeters", value: distance.meters, max: 999, caption: "m" })
      );
      return fields;
    };

    if (cardio.id === "running") {
      const label = document.createElement("label");
      label.htmlFor = "runningDistanceSelect";
      label.textContent = "Distancia del trote";
      const select = document.createElement("select");
      select.id = "runningDistanceSelect";
      select.className = "running-distance-select";
      select.required = true;
      [
        ["", "Selecciona una distancia"],
        ["3", "3K"],
        ["5", "5K"],
        ["10", "10K"],
        ["other", "Otra distancia"]
      ].forEach(([value, text]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.append(option);
      });
      const exactDistance = Number(values.distanceKm);
      const knownDistance = [3, 5, 10].includes(exactDistance);
      select.value = values.distanceKm === "" || values.distanceKm === null || values.distanceKm === undefined || exactDistance <= 0
        ? ""
        : knownDistance ? String(exactDistance) : "other";
      const helper = document.createElement("small");
      helper.className = "distance-helper";
      helper.textContent = "El ranking de tiempos se separará automáticamente por distancia.";
      const custom = document.createElement("div");
      custom.className = "running-distance-custom";
      custom.append(createDistanceFields());
      const updateCustom = () => custom.classList.toggle("hidden", select.value !== "other");
      select.addEventListener("change", updateCustom);
      updateCustom();
      box.append(label, select, helper, custom);
    } else {
      const label = document.createElement("label");
      label.textContent = cardio.id === "trekking" ? "Distancia del trekking" : "Distancia recorrida";
      const helper = document.createElement("small");
      helper.className = "distance-helper";
      helper.textContent = "Anota los kilómetros y metros por separado.";
      box.append(label, helper, createDistanceFields());
    }
  }
  if (cardio.id === "trekking") {
    const elevationLabel = document.createElement("label");
    elevationLabel.htmlFor = "elevationGainM";
    elevationLabel.textContent = "Desnivel positivo (metros)";
    const elevation = document.createElement("input");
    elevation.id = "elevationGainM";
    elevation.type = "number";
    elevation.inputMode = "numeric";
    elevation.min = "0";
    elevation.max = "10000";
    elevation.step = "1";
    elevation.value = values.elevationGainM === "" || values.elevationGainM === null || values.elevationGainM === undefined ? "0" : values.elevationGainM;
    elevation.placeholder = "Ej: 650";
    elevation.required = true;
    box.append(elevationLabel, elevation);

    const ascentLabel = document.createElement("label");
    ascentLabel.textContent = "Tiempo de subida (HH:MM)";
    const ascentParts = durationParts({ durationSeconds: values.ascentDurationSeconds || 0 });
    const ascentFields = document.createElement("div");
    ascentFields.className = "duration-parts";
    ascentFields.append(
      durationPart({ id: "ascentHours", label: "Horas", max: 12, value: ascentParts.hours }),
      durationPart({ id: "ascentMinutes", label: "Min", max: 59, value: ascentParts.minutes })
    );
    box.append(ascentLabel, ascentFields);
  }
}

function renderCardioFields(record = {}) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "¿Qué tipo de cardio hiciste?";
  const grid = document.createElement("div");
  grid.className = "choice-grid two";
  cardioTypes.forEach((cardio, index) => {
    const choice = createChoice({
      name: "cardioTypeId",
      value: cardio.id,
      title: cardio.name,
      description: cardio.description,
      checked: record.cardioTypeId ? record.cardioTypeId === cardio.id : index === 0
    });
    choice.input.addEventListener("change", () => {
      const duration = currentDurationValues();
      updateCardioExtraFields(currentCardioExtraValues());
      renderDurationField(duration);
    });
    grid.append(choice.wrapper);
  });
  const extras = document.createElement("div");
  extras.id = "cardioExtraFields";
  fieldset.append(legend, grid, extras);
  $("categoryFields").append(fieldset);
  updateCardioExtraFields(record);
}

function renderTennisFields(record = {}) {
  const typeLabel = document.createElement("label");
  typeLabel.htmlFor = "tennisType";
  typeLabel.textContent = "Tipo";
  const type = document.createElement("select");
  type.id = "tennisType";
  type.required = true;
  const typePlaceholder = document.createElement("option");
  typePlaceholder.value = "";
  typePlaceholder.textContent = "Selecciona el tipo de sesión";
  type.append(typePlaceholder);
  tennisTypes.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    type.append(option);
  });
  type.value = record.tennisTypeId || "";

  const surfaceLabel = document.createElement("label");
  surfaceLabel.htmlFor = "tennisSurface";
  surfaceLabel.textContent = "Superficie";
  const surface = document.createElement("select");
  surface.id = "tennisSurface";
  surface.required = true;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona una superficie";
  surface.append(placeholder);
  tennisSurfaces.forEach(value => {
    const option = document.createElement("option");
    option.textContent = value;
    surface.append(option);
  });
  surface.value = record.surface || "";
  $("categoryFields").append(
    typeLabel,
    type,
    createLocationPicker({
      idPrefix: "tennisLocation",
      labelText: "Lugar",
      values: tennisLocations,
      currentValue: record.location || "",
      placeholder: "Escribe el lugar donde jugaste"
    }),
    surfaceLabel,
    surface
  );
  const defaultSurface = location => {
    if (location === "Club Open Tenis") return "Arcilla";
    if (location === "Sport Park de Huechuraba" || location === "Parque Araucano") return "Cemento";
    return "";
  };
  const locationSelect = $("tennisLocationSelect");
  const applySurfaceDefault = () => {
    const suggested = defaultSurface(locationSelect?.value || "");
    if (suggested) surface.value = suggested;
  };
  locationSelect?.addEventListener("change", applySurfaceDefault);
  if (!record.surface) applySurfaceDefault();
}

function durationMode() {
  return durationModeFor(currentCategory, document.querySelector('input[name="cardioTypeId"]:checked')?.value);
}

function currentDurationValues() {
  const hours = Number($("durationHours")?.value || 0);
  const minutes = Number($("durationMinutesPart")?.value || 0);
  const seconds = Number($("durationSecondsPart")?.value || 0);
  const durationSeconds = (hours * 3600) + (minutes * 60) + seconds;
  return { durationMinutes: durationSeconds / 60, durationSeconds };
}

function durationParts(record = {}) {
  const totalSeconds = record.durationSeconds !== "" && record.durationSeconds !== undefined && record.durationSeconds !== null
    ? Number(record.durationSeconds)
    : Math.round((Number(record.durationMinutes) || 0) * 60);
  return {
    hours: Math.min(12, Math.floor(totalSeconds / 3600)),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: Math.floor(totalSeconds % 60)
  };
}

function durationPart({ id, label, max, value = 0 }) {
  const wrapper = document.createElement("div");
  const select = document.createElement("select");
  select.id = id;
  select.setAttribute("aria-label", label);
  for (let number = 0; number <= max; number += 1) {
    const option = document.createElement("option");
    option.value = String(number);
    option.textContent = String(number).padStart(2, "0");
    select.append(option);
  }
  select.value = String(Math.min(max, Math.max(0, Number(value) || 0)));
  const caption = document.createElement("small");
  caption.textContent = label;
  wrapper.append(select, caption);
  return wrapper;
}

function renderDurationField(record = {}) {
  const box = $("durationField");
  box.replaceChildren();
  const includeSeconds = durationMode() === "hms";
  const label = document.createElement("label");
  label.textContent = includeSeconds ? "Duración (HH:MM:SS)" : "Duración (HH:MM)";
  const parts = durationParts(record);
  const fields = document.createElement("div");
  fields.className = `duration-parts${includeSeconds ? " hms" : ""}`;
  const controls = [
    durationPart({ id: "durationHours", label: "Horas", max: 12, value: parts.hours }),
    durationPart({ id: "durationMinutesPart", label: "Min", max: 59, value: parts.minutes })
  ];
  if (includeSeconds) controls.push(durationPart({ id: "durationSecondsPart", label: "Seg", max: 59, value: parts.seconds }));
  fields.append(...controls);
  box.append(label, fields);
}

function loadTimerSettings() {
  let saved = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(TIMER_SETTINGS_KEY) || "{}");
  } catch {
    saved = {};
  }
  const closestAllowed = (value, allowed, fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return allowed.reduce((closest, option) =>
      Math.abs(option - number) < Math.abs(closest - number) ? option : closest, allowed[0]);
  };
  const requestedSets = Number.parseInt(saved.totalSets, 10);
  return {
    workSeconds: closestAllowed(saved.workSeconds, TIMER_WORK_OPTIONS, 30),
    restSeconds: closestAllowed(saved.restSeconds, TIMER_REST_OPTIONS, 30),
    totalSets: Number.isFinite(requestedSets) ? Math.min(10, Math.max(1, requestedSets)) : 3
  };
}

function timerDurationValue(prefix) {
  return Number($(`${prefix}Seconds`)?.value || 0);
}

function timerSettingsFromFields() {
  return {
    workSeconds: timerDurationValue("timerWork"),
    restSeconds: timerDurationValue("timerRest"),
    totalSets: Number($("timerTotalSets")?.value || 3)
  };
}

function saveTimerSettings() {
  const settings = timerSettingsFromFields();
  try {
    window.localStorage.setItem(TIMER_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    showToast("No se pudo guardar la configuración del Timer.");
  }
  if (timerState.status === "idle" || timerState.status === "complete") resetTimer(false);
}

function renderTimerDuration(containerId, prefix, totalSeconds, options) {
  const container = $(containerId);
  const wrapper = document.createElement("div");
  const select = document.createElement("select");
  select.id = `${prefix}Seconds`;
  select.setAttribute("aria-label", prefix === "timerWork" ? "Segundos del intervalo" : "Segundos de descanso");
  options.forEach(seconds => {
    const option = document.createElement("option");
    option.value = String(seconds);
    option.textContent = `${seconds} segundos`;
    select.append(option);
  });
  select.value = String(totalSeconds);
  wrapper.append(select);
  container.replaceChildren(wrapper);
  select.addEventListener("change", saveTimerSettings);
}

function initializeTimer() {
  const settings = loadTimerSettings();
  renderTimerDuration("timerWorkDuration", "timerWork", settings.workSeconds, TIMER_WORK_OPTIONS);
  renderTimerDuration("timerRestDuration", "timerRest", settings.restSeconds, TIMER_REST_OPTIONS);
  const totalSets = $("timerTotalSets");
  totalSets.replaceChildren();
  for (let number = 1; number <= 10; number += 1) {
    const option = document.createElement("option");
    option.value = String(number);
    option.textContent = `${number} ${number === 1 ? "serie" : "series"}`;
    totalSets.append(option);
  }
  totalSets.value = String(settings.totalSets);
  totalSets.addEventListener("change", saveTimerSettings);
  resetTimer(false);
}

function formatTimerClock(totalSeconds) {
  const safe = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function ensureTimerAudio() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    if (!timerAudioContext || timerAudioContext.state === "closed") timerAudioContext = new AudioContextClass();
    if (timerAudioContext.state === "suspended") timerAudioContext.resume().catch(() => {});
    return timerAudioContext;
  } catch {
    return null;
  }
}

function playTimerSound(kind) {
  const context = ensureTimerAudio();
  if (!context) return;
  const patterns = {
    countdown: [[1040, 0.07, 0]],
    work: [[820, 0.1, 0], [1120, 0.14, 0.13]],
    rest: [[520, 0.2, 0]],
    complete: [[660, 0.12, 0], [880, 0.12, 0.17], [1120, 0.28, 0.34]]
  };
  const notes = patterns[kind] || patterns.work;
  const startAt = context.currentTime + 0.025;
  notes.forEach(([frequency, duration, delay]) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = startAt + delay;
    const noteEnd = noteStart + duration;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.34, noteStart + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });
}

function updateTimerDisplay() {
  const settings = timerSettingsFromFields();
  const phaseLabels = {
    idle: "Preparado",
    prepare: "Preparación",
    work: "Intervalo",
    rest: "Descanso",
    complete: "Completado"
  };
  const phaseKey = timerState.status === "idle" || timerState.status === "complete" ? timerState.status : timerState.phase;
  $("timerPhase").textContent = timerState.status === "paused" ? `Pausa · ${phaseLabels[timerState.phase]}` : phaseLabels[phaseKey];
  $("timerPhase").className = `timer-phase ${phaseKey}`;
  const stageLabel = timerState.status === "complete"
    ? "Completado"
    : timerState.phase === "prepare"
      ? "Prepárate"
      : timerState.phase === "rest"
        ? "Descanso"
        : `Serie ${Math.min(timerState.currentSet, settings.totalSets)}`;
  $("timerStageLabel").textContent = timerState.status === "paused" ? `${stageLabel} · Pausa` : stageLabel;
  $("timerStageLabel").className = `timer-stage-label ${phaseKey}`;
  $("timerSetStatus").textContent = timerState.status === "complete"
    ? `${settings.totalSets}/${settings.totalSets} series`
    : timerState.phase === "prepare"
      ? "La Serie 1 comienza enseguida"
      : `Serie ${Math.min(timerState.currentSet, settings.totalSets)} de ${settings.totalSets}`;
  $("timerDisplay").textContent = formatTimerClock(timerState.remainingSeconds);
  const progress = timerState.status === "complete"
    ? 100
    : timerState.phaseTotalSeconds > 0
      ? ((timerState.phaseTotalSeconds - timerState.remainingSeconds) / timerState.phaseTotalSeconds) * 100
      : 0;
  $("timerProgressBar").style.width = `${Math.min(100, Math.max(0, progress))}%`;
  $("timerStartButton").disabled = timerState.status === "running";
  $("timerStartButton").textContent = timerState.status === "paused" ? "Continuar" : timerState.status === "complete" ? "Empezar otra vez" : "Iniciar";
  $("timerPauseButton").disabled = timerState.status !== "running";
  const lockSettings = timerState.status === "running" || timerState.status === "paused";
  document.querySelectorAll("#viewTimer .timer-config-card select").forEach(select => { select.disabled = lockSettings; });
}

function resetTimer(showMessage = true) {
  if (timerTicker) clearInterval(timerTicker);
  timerTicker = null;
  const settings = timerSettingsFromFields();
  timerState.status = "idle";
  timerState.phase = "work";
  timerState.currentSet = 1;
  timerState.remainingSeconds = settings.workSeconds;
  timerState.phaseTotalSeconds = settings.workSeconds;
  timerState.endAt = 0;
  timerLastCountdownSecond = null;
  updateTimerDisplay();
  if (showMessage) showToast("Timer reiniciado.");
}

function notifyTimerChange(message, sound = "work") {
  playTimerSound(sound);
  globalThis.navigator?.vibrate?.([120, 60, 120]);
  showToast(message);
}

function beginTimerPhase(phase, seconds) {
  timerState.phase = phase;
  timerState.remainingSeconds = seconds;
  timerState.phaseTotalSeconds = seconds;
  timerState.endAt = Date.now() + (seconds * 1000);
  timerLastCountdownSecond = null;
}

function completeTimer() {
  if (timerTicker) clearInterval(timerTicker);
  timerTicker = null;
  timerState.status = "complete";
  timerState.remainingSeconds = 0;
  notifyTimerChange("Bloque de series completado.", "complete");
  updateTimerDisplay();
}

function advanceTimerPhase() {
  const settings = timerSettingsFromFields();
  if (timerState.phase === "prepare") {
    beginTimerPhase("work", settings.workSeconds);
    notifyTimerChange("Comienza la serie 1.", "work");
  } else if (timerState.phase === "work") {
    if (timerState.currentSet >= settings.totalSets) return completeTimer();
    if (settings.restSeconds > 0) {
      beginTimerPhase("rest", settings.restSeconds);
      notifyTimerChange(`Descanso antes de la serie ${timerState.currentSet + 1}.`, "rest");
    } else {
      timerState.currentSet += 1;
      beginTimerPhase("work", settings.workSeconds);
      notifyTimerChange(`Comienza la serie ${timerState.currentSet}.`);
    }
  } else {
    timerState.currentSet += 1;
    beginTimerPhase("work", settings.workSeconds);
    notifyTimerChange(`Comienza la serie ${timerState.currentSet}.`);
  }
  updateTimerDisplay();
}

function tickTimer() {
  if (timerState.status !== "running") return;
  timerState.remainingSeconds = Math.max(0, Math.ceil((timerState.endAt - Date.now()) / 1000));
  if (timerState.remainingSeconds <= 0) return advanceTimerPhase();
  if (timerState.remainingSeconds <= 3 && timerState.remainingSeconds !== timerLastCountdownSecond) {
    timerLastCountdownSecond = timerState.remainingSeconds;
    playTimerSound("countdown");
  }
  updateTimerDisplay();
}

function startTimer() {
  const settings = timerSettingsFromFields();
  if (settings.workSeconds <= 0) return showToast("Selecciona un tiempo de intervalo mayor que cero.");
  ensureTimerAudio();
  const wasPaused = timerState.status === "paused";
  if (timerState.status === "idle" || timerState.status === "complete") {
    timerState.phase = "prepare";
    timerState.currentSet = 1;
    timerState.remainingSeconds = TIMER_PREP_SECONDS;
    timerState.phaseTotalSeconds = TIMER_PREP_SECONDS;
  }
  timerState.status = "running";
  timerState.endAt = Date.now() + (timerState.remainingSeconds * 1000);
  if (timerTicker) clearInterval(timerTicker);
  timerTicker = setInterval(tickTimer, 250);
  if (!wasPaused) {
    timerLastCountdownSecond = TIMER_PREP_SECONDS;
    playTimerSound("countdown");
  }
  updateTimerDisplay();
}

function pauseTimer() {
  if (timerState.status !== "running") return;
  tickTimer();
  if (timerState.status !== "running") return;
  timerState.status = "paused";
  if (timerTicker) clearInterval(timerTicker);
  timerTicker = null;
  updateTimerDisplay();
}

function renderSensationSuggestions() {
  const container = $("sensationSuggestions");
  container.replaceChildren();
  const suggestions = [...sensationSuggestions.common, ...(sensationSuggestions[currentCategory] || [])];
  suggestions.forEach(suggestion => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = suggestion;
    button.dataset.suggestion = suggestion;
    button.addEventListener("click", () => toggleSensationSuggestion(suggestion));
    container.append(button);
  });
  syncSensationSuggestions();
}

function sensationParts() {
  return $("sensations").value.split(" · ").map(value => value.trim()).filter(Boolean);
}

function toggleSensationSuggestion(suggestion) {
  const values = sensationParts();
  const index = values.indexOf(suggestion);
  if (index >= 0) values.splice(index, 1);
  else values.push(suggestion);
  $("sensations").value = values.join(" · ");
  syncSensationSuggestions();
  $("sensations").focus({ preventScroll: true });
}

function syncSensationSuggestions() {
  const selected = new Set(sensationParts());
  document.querySelectorAll("#sensationSuggestions .suggestion-chip").forEach(button => {
    const active = selected.has(button.dataset.suggestion);
    button.classList.toggle("selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function selectCategory(categoryId, record = null) {
  const category = categoryById(categoryId);
  if (!category) return;
  currentCategory = categoryId;
  $("categoryChooser").classList.add("hidden");
  $("trainingForm").classList.remove("hidden");
  $("trainingForm").hidden = false;
  $("registrationBackButton").classList.remove("hidden");
  $("registerHeading").textContent = editingRecordId ? `Editar ${category.shortName.toLowerCase()}` : category.name;
  $("registerIntro").textContent = editingRecordId
    ? "Actualiza los datos y guarda los cambios."
    : categoryId === "physical"
      ? "Elige una rutina para comenzar el entrenamiento de hoy."
      : categoryId === "rest" ? "Registra la recuperación de este día." : "Completa los datos principales de la sesión.";
  $("categoryFields").replaceChildren();

  if (categoryId === "physical") renderPhysicalFields(record || {});
  if (categoryId === "cardio") renderCardioFields(record || {});
  if (categoryId === "tennis") renderTennisFields(record || {});
  if (categoryId === "rest") renderRestFields(record || {});

  $("recordDate").value = record?.dateISO || getChileDateISO();
  const isRest = categoryId === "rest";
  const isRoutineLauncher = categoryId === "physical" && !editingRecordId && !plannedRegistrationContext?.customPhysical;
  $("registrationDateRow").classList.toggle("hidden", isRoutineLauncher);
  $("commonFields").classList.toggle("hidden", isRest || isRoutineLauncher);
  $("saveTrainingButton").classList.toggle("hidden", isRoutineLauncher);
  $("calories").required = !isRest && !isRoutineLauncher;
  if (isRest || isRoutineLauncher) {
    $("durationField").replaceChildren();
    $("calories").value = "";
    $("sensations").value = "";
    $("sensationSuggestions").replaceChildren();
  } else {
    renderDurationField(record || {});
    $("calories").value = record?.calories ?? "";
    $("sensations").value = record?.sensations || "";
    renderSensationSuggestions();
  }
  $("saveTrainingButton").textContent = editingRecordId ? "Guardar cambios" : isRest ? "Guardar descanso" : "Guardar entrenamiento";
  $("cancelEditButton").classList.toggle("hidden", !editingRecordId);
  updateFormWeekBadge();
  $("registerHeading").setAttribute("tabindex", "-1");
  $("registerHeading").focus({ preventScroll: true });
}

function resetRegistration({ keepPlan = false } = {}) {
  if (!keepPlan) plannedRegistrationContext = null;
  currentCategory = null;
  editingRecordId = null;
  $("trainingForm").reset();
  $("trainingForm").classList.add("hidden");
  $("trainingForm").hidden = true;
  $("categoryChooser").classList.remove("hidden");
  $("registrationBackButton").classList.add("hidden");
  $("registerHeading").textContent = "¿Qué quieres registrar?";
  $("registerIntro").textContent = "Elige qué actividad quieres registrar.";
  $("formMessage").className = "form-message hidden";
  $("cancelEditButton").classList.add("hidden");
  $("categoryFields").replaceChildren();
  $("durationField").replaceChildren();
  $("sensationSuggestions").replaceChildren();
  $("commonFields").classList.remove("hidden");
  $("registrationDateRow").classList.remove("hidden");
  $("saveTrainingButton").classList.remove("hidden");
  $("calories").required = true;
  $("recordDate").value = getChileDateISO();
}

function updateFormWeekBadge() {
  const dateISO = $("recordDate").value;
  if (!dateISO) return;
  const week = isoWeekInfo(dateISO);
  $("formWeekBadge").textContent = `Semana ${week.weekNumber}`;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formRecord() {
  const existing = editingRecordId ? repository.get(editingRecordId) : null;
  const category = categoryById(currentCategory);
  const routineId = document.querySelector('input[name="routineId"]:checked')?.value || "";
  const cardioTypeId = document.querySelector('input[name="cardioTypeId"]:checked')?.value || "";
  const isRest = currentCategory === "rest";
  const duration = isRest ? { durationMinutes: "", durationSeconds: "" } : currentDurationValues();
  const preserveRoutineBalance = existing?.category === "physical" && existing.routineId === routineId;
  const customPhysical = currentCategory === "physical" && !routineId && Boolean(plannedRegistrationContext?.customPhysical || existing?.routineName);
  return {
    id: editingRecordId || createId(),
    dateISO: $("recordDate").value,
    category: currentCategory,
    categoryName: category?.shortName || "",
    routineId,
    routineName: physicalRoutineById(routineId)?.name || (customPhysical ? plannedRegistrationContext?.optionTitle || existing?.routineName || "" : ""),
    cardioTypeId,
    cardioTypeName: cardioTypeById(cardioTypeId)?.name || "",
    tennisTypeId: $("tennisType")?.value || "",
    tennisTypeName: tennisTypeById($("tennisType")?.value || "")?.name || "",
    restTypeId: document.querySelector('input[name="restTypeId"]:checked')?.value || "",
    restDetail: $("restDetail")?.value.trim() || "",
    location: currentCategory === "tennis"
      ? selectedLocation("tennisLocationSelect", "tennisLocationOther")
      : selectedLocation("cardioLocationSelect", "cardioLocationOther"),
    surface: $("tennisSurface")?.value || "",
    trekkingRoute: $("trekkingRoute")?.value || "",
    distanceKm: currentDistanceKm(),
    elevationGainM: $("elevationGainM")?.value ?? "",
    ascentDurationSeconds: currentAscentDurationSeconds(),
    durationMinutes: duration.durationMinutes,
    durationSeconds: duration.durationSeconds,
    durationPrecision: durationMode(),
    calories: isRest ? "" : $("calories").value,
    sensations: isRest ? "" : $("sensations").value,
    routineCompletedSets: preserveRoutineBalance ? existing.routineCompletedSets : "",
    routinePlannedSets: preserveRoutineBalance ? existing.routinePlannedSets : "",
    routineCompletedExercises: preserveRoutineBalance ? existing.routineCompletedExercises : "",
    routineStartedExercises: preserveRoutineBalance ? existing.routineStartedExercises : "",
    routineTotalExercises: preserveRoutineBalance ? existing.routineTotalExercises : "",
    routineTotalReps: preserveRoutineBalance ? existing.routineTotalReps : "",
    routineVolumeKg: preserveRoutineBalance ? existing.routineVolumeKg : "",
    routineAbsCount: customPhysical ? $("plannedPhysicalAbs")?.value || "" : preserveRoutineBalance ? existing.routineAbsCount : "",
    routineEffort: customPhysical ? $("plannedPhysicalEffort")?.value || "" : preserveRoutineBalance ? existing.routineEffort : "",
    routinePain: customPhysical ? $("plannedPhysicalPain")?.value || "" : preserveRoutineBalance ? existing.routinePain : "",
    routinePainDetail: customPhysical ? $("plannedPhysicalPainDetail")?.value.trim() || "" : preserveRoutineBalance ? existing.routinePainDetail : "",
    routineExercises: preserveRoutineBalance ? existing.routineExercises : [],
    routineSummary: customPhysical ? $("plannedPhysicalExercises")?.value.trim() || "" : preserveRoutineBalance ? existing.routineSummary : "",
    routineAiAnalysis: null,
    routineStartedAt: plannedRegistrationContext?.startedAt || (preserveRoutineBalance || customPhysical ? existing?.routineStartedAt || "" : ""),
    routineEndedAt: plannedRegistrationContext?.endedAt || (preserveRoutineBalance || customPhysical ? existing?.routineEndedAt || "" : ""),
    planBlockId: plannedRegistrationContext?.blockId || existing?.planBlockId || "",
    planWeekKey: plannedRegistrationContext?.weekKey || existing?.planWeekKey || "",
    planSessionId: plannedRegistrationContext?.sessionId || existing?.planSessionId || "",
    planOptionId: plannedRegistrationContext?.optionId || existing?.planOptionId || "",
    plannedTitle: plannedRegistrationContext?.plannedTitle || existing?.plannedTitle || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function showFormError(text) {
  $("formMessage").textContent = text;
  $("formMessage").className = "form-message error";
}

function durationPartsAreValid() {
  const hours = Number($("durationHours")?.value || 0);
  const minutes = Number($("durationMinutesPart")?.value || 0);
  const seconds = Number($("durationSecondsPart")?.value || 0);
  return hours >= 0 && hours <= 12 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
}

function distancePartsAreValid() {
  if (!$("distanceKilometers") && !$("distanceMeters")) return true;
  const kilometers = Number($("distanceKilometers")?.value || 0);
  const meters = Number($("distanceMeters")?.value || 0);
  return kilometers >= 0 && kilometers <= 999 && meters >= 0 && meters <= 999;
}

function saveTraining(event) {
  event.preventDefault();
  if (!durationPartsAreValid()) return showFormError(`Revisa la duración: los minutos${durationMode() === "hms" ? " y segundos" : ""} deben estar entre 0 y 59.`);
  if (!distancePartsAreValid()) return showFormError("Revisa la distancia: usa kilómetros entre 0 y 999 y metros entre 0 y 999.");
  const candidate = attachMatchingPlan(formRecord());
  const validation = validateRecord(candidate);
  if (!validation.valid) return showFormError(validation.errors.join(" "));
  if (candidate.category === "physical" && !candidate.routineId && Number(candidate.routinePain) > 0 && !candidate.routinePainDetail) return showFormError("Describe la molestia para que la guía pueda considerarla.");
  try {
    repository.upsert(candidate);
  } catch (error) {
    return showFormError(error.message);
  }
  const message = editingRecordId
    ? "Registro actualizado."
    : candidate.category === "rest" ? "Descanso registrado." : "Entrenamiento registrado.";
  const pending = loadPlannedActivity();
  if (pending?.status === "finished" && pending.blockId === candidate.planBlockId && pending.sessionId === candidate.planSessionId) savePlannedActivity(null);
  resetRegistration();
  renderHome();
  renderCoachPlanDialog();
  showView("home");
  showToast(message);
  if (cloudSync.currentUser && repository.getCoachProfile()) requestRoutineAiAnalysis(candidate.id, [], { interactive: false });
}

function editRecord(id) {
  const record = repository.get(id);
  if (!record || !categoryById(record.category)) return showToast("Este registro antiguo puede verse y exportarse, pero no editarse desde el formulario nuevo.");
  editingRecordId = record.id;
  showView("register");
  selectCategory(record.category, record);
}

function deleteRecord(id) {
  const record = repository.get(id);
  if (!record) return;
  if (!window.confirm(`¿Eliminar “${recordTitle(record)}” del ${record.dateISO}?`)) return;
  repository.remove(id);
  renderHistory();
  renderHome();
  showToast("Registro eliminado.");
}

function loadRoutineProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROUTINE_PROGRESS_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveRoutineProgress(progress) {
  try {
    window.localStorage.setItem(ROUTINE_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    showToast("No se pudo guardar el avance de la rutina.");
  }
}

function loadRoutineSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROUTINE_SETTINGS_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveRoutineSettings(settings) {
  try {
    window.localStorage.setItem(ROUTINE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    showToast("No se pudieron guardar los ajustes de la rutina.");
  }
}

function loadRoutineSession() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROUTINE_SESSION_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || !physicalRoutineById(parsed.routineId)) return null;
    if (!["active", "complete"].includes(parsed.status)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveRoutineSession(session) {
  try {
    if (session) window.localStorage.setItem(ROUTINE_SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(ROUTINE_SESSION_KEY);
  } catch {
    showToast("No se pudo guardar el estado de la sesión.");
  }
}

function routineSessionElapsedSeconds(session = loadRoutineSession()) {
  if (!session) return 0;
  if (session.status === "complete") return Math.max(0, Number(session.elapsedSeconds) || 0);
  const startedAt = Date.parse(session.startedAt);
  return Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
}

function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
}

function targetRepetitions(target) {
  const text = String(target || "").toLowerCase();
  if (/\b(seg|segundos?|min|minutos?)\b/.test(text)) return 0;
  const match = text.match(/\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const repetitions = Number(match[0].replace(",", "."));
  const sideFactor = /por (lado|pierna|brazo)/.test(text) ? 2 : 1;
  return Number.isFinite(repetitions) ? repetitions * sideFactor : 0;
}

function exerciseTargetMeta(exercise) {
  const target = String(exercise.target || "").toLowerCase();
  const qualifier = target.match(/por (lado|pierna|brazo)/)?.[0] || (target.includes("total") ? "total" : "");
  if (/\b(seg|segundos?)\b/.test(target)) {
    return { label: qualifier ? `Tiempo en segundos (${qualifier})` : "Tiempo en segundos", unit: "seg", qualifier };
  }
  if (/\b(min|minutos?)\b/.test(target)) {
    return { label: qualifier ? `Tiempo en minutos (${qualifier})` : "Tiempo en minutos", unit: "min", qualifier };
  }
  return { label: qualifier ? `Repeticiones (${qualifier})` : "Repeticiones", unit: "", qualifier };
}

function editableTargetValue(target) {
  const text = String(target || "");
  const match = text.match(/\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?/);
  return match?.[0]?.replaceAll(" ", "") || text;
}

function normalizedExerciseTarget(value, exercise) {
  const raw = String(value || "").trim().slice(0, 20);
  if (!raw) return "";
  if (/[a-záéíóúñ]/i.test(raw)) return raw;
  const meta = exerciseTargetMeta(exercise);
  return [raw, meta.unit, meta.qualifier].filter(Boolean).join(" ");
}

function routineExerciseSnapshot(routine, exercise, progress, settings, dateISO) {
  const exerciseSettings = currentExerciseSettings(routine, exercise, settings);
  const completedSetNumbers = Array.from({ length: exerciseSettings.sets }, (_, setIndex) => setIndex + 1)
    .filter(setNumber => progress[routineProgressKey(dateISO, routine.id, exercise.id, setNumber - 1)]);
  const repsPerSet = targetRepetitions(exerciseSettings.target);
  const weight = Number(exerciseSettings.weightKg) || 0;
  return {
    id: exercise.id,
    name: exercise.name,
    phase: exercise.phase,
    target: exerciseSettings.target,
    weightKg: exerciseSettings.weightKg,
    plannedSets: exerciseSettings.sets,
    completedSets: completedSetNumbers.length,
    completedSetNumbers,
    totalReps: Math.round(repsPerSet * completedSetNumbers.length),
    volumeKg: Math.round(weight * repsPerSet * completedSetNumbers.length * 100) / 100
  };
}

function routineSessionSummary(routine, progress, settings, dateISO) {
  const relevantExercises = routineExercisesForDate(routine, dateISO);
  const exercises = relevantExercises.map(exercise => routineExerciseSnapshot(routine, exercise, progress, settings, dateISO));
  const completedSets = exercises.reduce((total, exercise) => total + exercise.completedSets, 0);
  const plannedSets = exercises.reduce((total, exercise) => total + exercise.plannedSets, 0);
  const completedExercises = exercises.filter(exercise => exercise.completedSets === exercise.plannedSets).length;
  const startedExercises = exercises.filter(exercise => exercise.completedSets > 0).length;
  const totalReps = exercises.reduce((total, exercise) => total + exercise.totalReps, 0);
  const volumeKg = exercises.reduce((total, exercise) => total + exercise.volumeKg, 0);

  return {
    completedSets,
    plannedSets,
    completedExercises,
    startedExercises,
    totalExercises: relevantExercises.length,
    totalReps: Math.round(totalReps),
    volumeKg: Math.round(volumeKg * 100) / 100,
    exercises
  };
}

function clearRoutineProgress(progress, dateISO, routineId) {
  const prefix = `${dateISO}:${routineId}:`;
  Object.keys(progress).forEach(key => {
    if (key.startsWith(prefix)) delete progress[key];
  });
  saveRoutineProgress(progress);
}

function updateRoutineSessionClock() {
  const session = loadRoutineSession();
  if (!session || session.status !== "active") {
    if (routineSessionTicker) clearInterval(routineSessionTicker);
    routineSessionTicker = null;
    return;
  }
  const elapsed = formatClock(routineSessionElapsedSeconds(session));
  const display = $(`routineElapsed-${session.routineId}`);
  if (display) display.textContent = elapsed;
  const preview = $("routinePreview-time")?.querySelector("strong");
  if (preview) preview.textContent = elapsed;
}

function ensureRoutineSessionTicker() {
  updateRoutineSessionClock();
  if (!routineSessionTicker && loadRoutineSession()?.status === "active") {
    routineSessionTicker = setInterval(updateRoutineSessionClock, 1000);
  }
}

function routineSettingsKey(routineId, exerciseId) {
  return `${routineId}:${exerciseId}`;
}

function currentExerciseSettings(routine, exercise, settings) {
  const saved = settings[routineSettingsKey(routine.id, exercise.id)] || {};
  const requestedSets = Number.parseInt(saved.sets ?? exercise.sets, 10);
  const sets = Number.isFinite(requestedSets) ? Math.min(10, Math.max(1, requestedSets)) : Math.min(10, exercise.sets);
  const target = String(saved.target ?? exercise.target).slice(0, 40);
  const rawWeight = saved.weightKg ?? exercise.weightKg;
  const numericWeight = rawWeight === "" ? "" : Number(rawWeight);
  const weightKg = numericWeight === "" || (Number.isFinite(numericWeight) && numericWeight >= 0) ? numericWeight : exercise.weightKg;
  return { sets, target, weightKg };
}

function renderHeroEvolution(records) {
  const weeks = weeklyEvolution(records, getChileDateISO(), 2);
  const current = weeks.at(-1);
  const previous = weeks[0];
  const values = [
    ["weekSessionCount", "weekSessionDelta", current.sessions, previous.sessions, ""],
    ["weekMinutes", "weekMinutesDelta", current.minutes, previous.minutes, " min"],
    ["weekCalories", "weekCaloriesDelta", current.calories, previous.calories, " kcal"],
    ["weekActiveDays", "weekActiveDaysDelta", current.activeDays, previous.activeDays, ""],
    ["weekVolumeKg", "weekVolumeDelta", current.volumeKg, previous.volumeKg, " kg"],
    ["weekBestAbs", "weekBestAbsDelta", current.maxAbdominals, previous.maxAbdominals, ""]
  ];
  values.forEach(([valueId, comparisonId, value, before, unit]) => {
    $(valueId).textContent = valueId === "weekBestAbs" && !value ? "—" : `${Number(value).toLocaleString("es-CL")}${valueId === "weekVolumeKg" ? " kg" : ""}`;
    $(comparisonId).textContent = valueId === "weekBestAbs" && !value
      ? "Sin marca esta semana" : signedDifference(value, before, unit);
  });
}

function routineSettingsSnapshot(routine, settings) {
  return Object.fromEntries(routine.exercises.map(exercise => [
    exercise.id,
    currentExerciseSettings(routine, exercise, settings)
  ]));
}

function routineSettingsChangeCount(routine, settings, settingsAtStart = {}) {
  return routine.exercises.filter(exercise => {
    const current = currentExerciseSettings(routine, exercise, settings);
    const initial = settingsAtStart?.[exercise.id]
      || currentExerciseSettings(routine, exercise, {});
    return current.sets !== initial.sets
      || String(current.target) !== String(initial.target)
      || String(current.weightKg) !== String(initial.weightKg);
  }).length;
}

function restoreRoutineSettings(routine, settings, settingsAtStart = {}) {
  routine.exercises.forEach(exercise => {
    const initial = settingsAtStart?.[exercise.id]
      || currentExerciseSettings(routine, exercise, {});
    settings[routineSettingsKey(routine.id, exercise.id)] = { ...initial };
  });
  saveRoutineSettings(settings);
}

function updateRoutineDefaultsChoice(routine, session, settings) {
  const checkbox = $(`routineSaveDefaults-${routine.id}`);
  const helper = $(`routineSaveDefaultsHelp-${routine.id}`);
  const finish = $(`routineFinishButton-${routine.id}`);
  if (!checkbox || !helper) return;
  const changeCount = routineSettingsChangeCount(routine, settings, session.settingsAtStart);
  const previouslyHadChanges = checkbox.dataset.hadChanges === "true";
  checkbox.disabled = changeCount === 0;
  if (changeCount === 0) {
    checkbox.checked = false;
    checkbox.dataset.hadChanges = "";
    helper.textContent = "Aún no has cambiado los valores con los que comenzaste.";
  } else {
    if (!previouslyHadChanges) checkbox.checked = true;
    checkbox.dataset.hadChanges = "true";
    helper.textContent = checkbox.checked
      ? `${changeCount} ${changeCount === 1 ? "ejercicio modificado" : "ejercicios modificados"}. Se usarán como punto de partida la próxima vez.`
      : "Los cambios quedarán registrados solo en este entrenamiento.";
  }
  if (finish) finish.textContent = changeCount && checkbox.checked
    ? "Finalizar, registrar y guardar cambios"
    : "Finalizar y registrar";
}

function routineProgressKey(dateISO, routineId, exerciseId, setIndex) {
  return `${dateISO}:${routineId}:${exerciseId}:${setIndex}`;
}

function routineExercisesForDate(routine, dateISO) {
  const session = loadRoutineSession();
  const planned = loadPlannedRoutineContext();
  const context = session?.routineId === routine.id && session?.dateISO === dateISO
    ? session
    : planned?.routineId === routine.id && planned?.dateISO === dateISO ? planned : null;
  const omitted = new Set(context?.planOmitExerciseIds || context?.omitExerciseIds || []);
  return routine.exercises.filter(exercise => !omitted.has(exercise.id));
}

function totalRoutineSets(routine, settings, dateISO = getChileDateISO()) {
  return routineExercisesForDate(routine, dateISO).reduce((total, exercise) => total + currentExerciseSettings(routine, exercise, settings).sets, 0);
}

function completedRoutineSets(routine, progress, settings, dateISO) {
  return routineExercisesForDate(routine, dateISO).reduce((total, exercise) => {
    const exerciseSettings = currentExerciseSettings(routine, exercise, settings);
    return total + Array.from({ length: exerciseSettings.sets }, (_, index) => index)
      .filter(setIndex => progress[routineProgressKey(dateISO, routine.id, exercise.id, setIndex)]).length;
  }, 0);
}

function startRoutineSession(routine) {
  const existing = loadRoutineSession();
  if (existing?.status === "active") {
    const activeRoutine = physicalRoutineById(existing.routineId);
    showToast(existing.routineId === routine.id
      ? "Esta rutina ya está en curso."
      : `Primero finaliza ${activeRoutine?.name || "la rutina en curso"}.`);
    return;
  }

  const planned = loadPlannedRoutineContext();
  const plannedForRoutine = planned?.routineId === routine.id ? planned : null;
  const dateISO = plannedForRoutine?.dateISO || getChileDateISO();
  const alreadyRecordedToday = repository.list().some(record =>
    record.dateISO === dateISO && record.routineId === routine.id && record.routinePlannedSets !== ""
  );
  if ((existing?.status === "complete" && existing.routineId === routine.id && existing.dateISO === dateISO) || alreadyRecordedToday) {
    clearRoutineProgress(loadRoutineProgress(), dateISO, routine.id);
  }
  const now = new Date().toISOString();
  const settingsAtStart = routineSettingsSnapshot(routine, loadRoutineSettings());
  saveRoutineSession({
    status: "active",
    routineId: routine.id,
    dateISO,
    startedAt: now,
    endedAt: "",
    elapsedSeconds: 0,
    absCount: "",
    calories: "",
    sensations: "",
    effort: "",
    pain: 0,
    painDetail: "",
    settingsAtStart,
    planBlockId: plannedForRoutine?.blockId || "",
    planWeekKey: plannedForRoutine?.weekKey || "",
    planSessionId: plannedForRoutine?.sessionId || "",
    planOptionId: plannedForRoutine?.optionId || "",
    plannedTitle: plannedForRoutine?.plannedTitle || "",
    planDetails: plannedForRoutine?.planDetails || [],
    planOmitExerciseIds: plannedForRoutine?.omitExerciseIds || [],
    settingsBeforePlan: plannedForRoutine?.settingsBeforePlan || null
  });
  openRoutineId = routine.id;
  renderRoutines();
  ensureRoutineSessionTicker();
  showToast(plannedForRoutine ? "Rutina planificada iniciada. El tiempo ya está corriendo." : "Rutina iniciada. El tiempo ya está corriendo.");
}

function scrollToRoutine(routineId) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelector(`[data-routine-id="${routineId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function scrollToRoutineProgress(routineId) {
  const routine = physicalRoutineById(routineId);
  const session = loadRoutineSession();
  if (!routine || session?.status !== "active" || session.routineId !== routineId) return scrollToRoutine(routineId);
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
  const exerciseStates = routineExercisesForDate(routine, session.dateISO).map(exercise => {
    const setCount = currentExerciseSettings(routine, exercise, settings).sets;
    const completedSets = Array.from({ length: setCount }, (_, index) => index)
      .filter(setIndex => progress[routineProgressKey(session.dateISO, routine.id, exercise.id, setIndex)]).length;
    return { exercise, setCount, completedSets };
  });
  const partialState = exerciseStates.find(state => state.completedSets > 0 && state.completedSets < state.setCount);
  const lastCompletedIndex = exerciseStates.reduce((latestIndex, state, index) => (
    state.completedSets === state.setCount && state.setCount > 0 ? index : latestIndex
  ), -1);
  const nextAfterCompleted = lastCompletedIndex >= 0
    ? exerciseStates.slice(lastCompletedIndex + 1).find(state => state.completedSets < state.setCount)
    : null;
  const targetState = partialState
    || nextAfterCompleted
    || exerciseStates.find(state => state.completedSets < state.setCount);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const routineCard = [...document.querySelectorAll("[data-routine-id]")]
        .find(card => card.dataset.routineId === routineId);
      const target = targetState
        ? [...(routineCard?.querySelectorAll("[data-exercise-id]") || [])]
          .find(card => card.dataset.exerciseId === targetState.exercise.id)
        : routineCard?.querySelector(".abdominal-finisher") || routineCard?.querySelector(".routine-finish-card");
      (target || routineCard)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function launchRoutineFromRegistration(routine) {
  const existing = loadRoutineSession();
  if (existing?.status === "active") {
    const activeRoutine = physicalRoutineById(existing.routineId);
    openRoutineId = existing.routineId;
    showView("routines");
    scrollToRoutineProgress(existing.routineId);
    showToast(existing.routineId === routine.id
      ? "Tu rutina ya estaba en curso. Continúa desde aquí."
      : `Ya tienes ${activeRoutine?.name || "otra rutina"} en curso. Continúa o finalízala primero.`);
    return;
  }
  clearPlannedRoutineContext({ restore: true });
  openRoutineId = routine.id;
  showView("routines");
  scrollToRoutine(routine.id);
}

function routineForAi(record) {
  const timing = activityTiming(record);
  return {
    category: record.category,
    activity: recordTitle(record),
    cardioTypeId: record.cardioTypeId,
    tennisTypeId: record.tennisTypeId,
    restTypeId: record.restTypeId,
    restDetail: record.restDetail,
    distanceKm: record.distanceKm,
    averagePaceSecondsPerKm: timing.averagePaceSecondsPerKm,
    averagePaceFormatted: timing.averagePaceFormatted,
    location: record.location,
    surface: record.surface,
    trekkingRoute: record.trekkingRoute,
    elevationGainM: record.elevationGainM,
    ascentDurationSeconds: record.ascentDurationSeconds,
    durationSeconds: timing.durationSeconds,
    durationHms: timing.durationHms,
    dateISO: record.dateISO,
    routineId: record.routineId,
    routineName: record.routineName,
    durationMinutes: timing.durationMinutes,
    calories: record.calories,
    sensations: record.sensations,
    routineSummary: record.routineSummary,
    effortRpe: record.routineEffort,
    painScore: record.routinePain,
    painDetail: record.routinePainDetail,
    completedSets: record.routineCompletedSets,
    plannedSets: record.routinePlannedSets,
    completedExercises: record.routineCompletedExercises,
    totalExercises: record.routineTotalExercises,
    totalReps: record.routineTotalReps,
    volumeKg: record.routineVolumeKg,
    abdominalCount: record.routineAbsCount,
    exercises: record.routineExercises.map(exercise => ({
      id: exercise.id,
      name: exercise.name,
      phase: exercise.phase,
      target: exercise.target,
      weightKg: exercise.weightKg,
      plannedSets: exercise.plannedSets,
      completedSets: exercise.completedSets,
      completedSetNumbers: exercise.completedSetNumbers,
      totalReps: exercise.totalReps,
      volumeKg: exercise.volumeKg
    }))
  };
}

function routineAiContext(record) {
  const records = repository.list();
  const startISO = addDaysISO(record.dateISO, -14);
  const endISO = addDaysISO(record.dateISO, 2);
  const recentTrainingLoad = records
    .filter(item => item.id !== record.id && item.dateISO >= startISO && item.dateISO <= record.dateISO)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
    .map(item => ({
      dateISO: item.dateISO,
      category: item.category,
      title: recordTitle(item),
      durationMinutes: Math.round(Number(item.durationMinutes) || 0),
      calories: Number(item.calories) || 0,
      distanceKm: item.distanceKm,
      sensations: item.sensations,
      effortRpe: item.routineEffort,
      painScore: item.routinePain,
      painDetail: item.routinePainDetail,
      volumeKg: Number(item.routineVolumeKg) || 0
    }));
  const block = activeTrainingBlock();
  const next48Hours = (block?.weeks || []).flatMap(week => week.sessions || [])
    .filter(session => session.dateISO > record.dateISO && session.dateISO <= endISO)
    .map(session => {
      const option = coachOption(session, session.primaryOptionId) || session.options?.[0];
      return {
        dateISO: session.dateISO,
        objective: session.objective,
        plannedTitle: option?.title || "",
        category: option?.category || "",
        summary: option?.summary || "",
        alternatives: (session.options || []).map(item => item.title)
      };
    });
  const match = plannedContextForRecord(record, block);
  const currentPlan = match ? {
    blockId: block.id,
    sessionId: match.session.id,
    exactOptionMatch: match.exact,
    title: match.option.title,
    summary: match.option.summary,
    objective: match.session.objective,
    details: match.option.details || [],
    target: match.option.prefill || {},
    referenceRoutine: match.option.category === "physical" ? physicalRoutineById(match.option.prefill?.routineId) : null,
    alternatives: match.session.options.map(option => ({ title: option.title, category: option.category, summary: option.summary, details: option.details, target: option.prefill })),
    sameDayActivities: records.filter(item => item.id !== record.id && item.dateISO === record.dateISO).map(routineForAi),
    weekObjective: match.week.objective,
    weekContext: match.week.context,
    rules: block.rules || []
  } : null;
  return { coachProfile: repository.getCoachProfile(), recentTrainingLoad, next48Hours, currentPlan };
}

async function requestRoutineAiAnalysis(recordId, planDetails = [], { interactive = true } = {}) {
  if (aiAnalysisInFlight.has(recordId)) return;
  const record = repository.get(recordId);
  if (!record) return;
  if (!cloudSync.currentUser) {
    if (interactive) openCloudDialog();
    showToast("Inicia sesión con Google para generar el análisis inteligente.");
    return;
  }
  const context = routineAiContext(record);
  if (!context.coachProfile?.profileText) {
    if (interactive) openCoachProfileDialog();
    showToast("Configura primero el perfil privado de tu entrenador IA.");
    return;
  }
  aiAnalysisInFlight.add(recordId);
  renderRoutines();
  renderHistory();
  renderHome();
  try {
    const recentRecords = repository.list()
      .filter(item => item.id !== record.id && item.dateISO <= record.dateISO && comparableActivity(record, item))
      .slice(0, 8)
      .reverse()
      .map(routineForAi);
    const result = await aiClient.analyzeRoutine(routineForAi(record), recentRecords, planDetails, context);
    const analysis = result?.analysis || result;
    const latest = repository.get(record.id);
    if (!latest || latest.updatedAt !== record.updatedAt) throw new Error("El registro cambió durante el análisis. Vuelve a analizarlo para incluir sus últimos comentarios.");
    repository.upsert({
      ...attachMatchingPlan(latest),
      routineAiAnalysis: {
        ...analysis,
        changes: record.category === "physical" ? analysis.changes : [],
        status: record.category === "physical" ? "pending" : "reviewed",
        generatedAt: new Date().toISOString(),
        model: result?.model || analysis?.model || ""
      },
      updatedAt: new Date().toISOString()
    });
    showToast("Análisis inteligente listo y guardado en el historial.");
  } catch (error) {
    showToast(error.message);
  } finally {
    aiAnalysisInFlight.delete(recordId);
    renderRoutines();
    renderHistory();
    renderHome();
  }
}

function finishRoutineSession(routine) {
  const session = loadRoutineSession();
  if (!session || session.status !== "active" || session.routineId !== routine.id) return;
  const caloriesInput = $(`routineCalories-${routine.id}`);
  const absInput = $(`routineAbsCount-${routine.id}`);
  const sensationsInput = $(`routineSensations-${routine.id}`);
  const effortInput = $(`routineEffort-${routine.id}`);
  const painInput = $(`routinePain-${routine.id}`);
  const painDetailInput = $(`routinePainDetail-${routine.id}`);
  const message = $(`routineFinishMessage-${routine.id}`);
  const calories = caloriesInput?.value === "" ? null : Number(caloriesInput?.value);
  const absCount = absInput?.value === "" ? null : Number(absInput?.value);
  const sensations = sensationsInput?.value.trim() || "";
  const effort = effortInput?.value === "" ? null : Number(effortInput?.value);
  const pain = painInput?.value === "" ? null : Number(painInput?.value);
  const painDetail = painDetailInput?.value.trim() || "";
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
  const summary = routineSessionSummary(routine, progress, settings, session.dateISO);
  const settingsChangeCount = routineSettingsChangeCount(routine, settings, session.settingsAtStart);
  const saveSettingsForNextTime = settingsChangeCount > 0 && Boolean($(`routineSaveDefaults-${routine.id}`)?.checked);

  if (summary.completedSets === 0) {
    message.textContent = "Marca al menos una serie antes de finalizar.";
    message.classList.remove("hidden");
    return;
  }
  if (absCount === null || !Number.isFinite(absCount) || absCount < 0) {
    message.textContent = "Anota cuántos abdominales realizaste al terminar.";
    message.classList.remove("hidden");
    absInput?.focus();
    return;
  }
  if (calories === null || !Number.isFinite(calories) || calories < 0) {
    message.textContent = "Anota las calorías quemadas para registrar la sesión.";
    message.classList.remove("hidden");
    caloriesInput?.focus();
    return;
  }
  if (!sensations) {
    message.textContent = "Elige al menos una sensación o escribe cómo te sentiste.";
    message.classList.remove("hidden");
    sensationsInput?.focus();
    return;
  }
  if (!Number.isFinite(effort) || effort < 1 || effort > 10) {
    message.textContent = "Selecciona tu esfuerzo percibido entre 1 y 10.";
    message.classList.remove("hidden");
    effortInput?.focus();
    return;
  }
  if (!Number.isFinite(pain) || pain < 0 || pain > 10) {
    message.textContent = "Selecciona el nivel de dolor o molestia entre 0 y 10.";
    message.classList.remove("hidden");
    painInput?.focus();
    return;
  }
  if (pain > 0 && !painDetail) {
    message.textContent = "Describe dónde y cómo fue la molestia para que la recomendación sea segura.";
    message.classList.remove("hidden");
    painDetailInput?.focus();
    return;
  }

  const endedAt = new Date().toISOString();
  const elapsedSeconds = Math.max(1, routineSessionElapsedSeconds(session));
  const record = {
    id: createId(),
    dateISO: session.dateISO,
    category: "physical",
    categoryName: "Físico",
    routineId: routine.id,
    routineName: routine.name,
    cardioTypeId: "",
    cardioTypeName: "",
    location: "",
    surface: "",
    distanceKm: "",
    elevationGainM: "",
    durationMinutes: elapsedSeconds / 60,
    durationSeconds: elapsedSeconds,
    durationPrecision: "hms",
    calories,
    sensations,
    routineCompletedSets: summary.completedSets,
    routinePlannedSets: summary.plannedSets,
    routineCompletedExercises: summary.completedExercises,
    routineStartedExercises: summary.startedExercises,
    routineTotalExercises: summary.totalExercises,
    routineTotalReps: summary.totalReps,
    routineVolumeKg: summary.volumeKg,
    routineAbsCount: absCount,
    routineEffort: effort,
    routinePain: pain,
    routinePainDetail: painDetail,
    routineExercises: summary.exercises,
    routineSummary: "",
    routineAiAnalysis: null,
    routineDefaultsSaved: saveSettingsForNextTime,
    routineStartedAt: session.startedAt,
    routineEndedAt: endedAt,
    planBlockId: session.planBlockId || "",
    planWeekKey: session.planWeekKey || "",
    planSessionId: session.planSessionId || "",
    planOptionId: session.planOptionId || "",
    plannedTitle: session.plannedTitle || "",
    createdAt: session.startedAt,
    updatedAt: endedAt
  };
  Object.assign(record, attachMatchingPlan(record));
  record.routineSummary = routineCompletionSummary(record, repository.list());

  try {
    repository.upsert(record);
  } catch (error) {
    message.textContent = error.message;
    message.classList.remove("hidden");
    return;
  }

  if (session.planSessionId && !saveSettingsForNextTime && session.settingsBeforePlan) {
    restoreSettingsSnapshot(routine.id, session.settingsBeforePlan);
  } else if (settingsChangeCount > 0 && !saveSettingsForNextTime) {
    restoreRoutineSettings(routine, settings, session.settingsAtStart);
  }

  saveRoutineSession({
    ...session,
    status: "complete",
    endedAt,
    elapsedSeconds,
    calories,
    sensations,
    absCount,
    effort,
    pain,
    painDetail,
    recordId: record.id,
    summary,
    routineSummary: record.routineSummary,
    settingsChangeCount,
    defaultSettingsSaved: saveSettingsForNextTime
  });
  if (routineSessionTicker) clearInterval(routineSessionTicker);
  routineSessionTicker = null;
  clearPlannedRoutineContext();
  openRoutineId = routine.id;
  renderRoutines();
  renderHome();
  renderCoachPlanDialog();
  if (cloudSync.currentUser && repository.getCoachProfile()) requestRoutineAiAnalysis(record.id, session.planDetails || [], { interactive: false });
  showToast(saveSettingsForNextTime
    ? "Rutina registrada y cambios guardados para la próxima vez."
    : settingsChangeCount > 0
      ? "Rutina registrada. Los cambios se usaron solo esta vez."
      : "Rutina finalizada y registrada como entrenamiento de hoy.");
}

function balanceMetric(label, value) {
  const metric = document.createElement("div");
  const strong = document.createElement("strong");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  metric.append(strong, span);
  return metric;
}

function routineBalanceGrid(summary, elapsedSeconds, calories, absCount = "", preview = false, effort = "", pain = "") {
  const grid = document.createElement("div");
  grid.className = "routine-balance-grid";
  const metrics = [
    ["Tiempo", formatClock(elapsedSeconds), "time"],
    ["Calorías", calories === "" || calories === null || calories === undefined ? "—" : `${calories} kcal`, "calories"],
    ["Series", `${summary.completedSets}/${summary.plannedSets}`, "sets"],
    ["Ejercicios trabajados", `${summary.startedExercises}/${summary.totalExercises}`, "exercises"],
    ["Repeticiones", String(summary.totalReps), "reps"],
    ["Volumen estimado", `${Number(summary.volumeKg).toLocaleString("es-CL")} kg`, "volume"],
    ["Abdominales", absCount === "" || absCount === null || absCount === undefined ? "—" : String(absCount), "abdominals"]
  ];
  if (effort !== "" && effort !== null && effort !== undefined) metrics.push(["Esfuerzo", `${effort}/10`, "effort"]);
  if (pain !== "" && pain !== null && pain !== undefined) metrics.push(["Dolor", `${pain}/10`, "pain"]);
  metrics.forEach(([label, value, key]) => {
    const metric = balanceMetric(label, value);
    if (preview) metric.id = `routinePreview-${key}`;
    grid.append(metric);
  });
  return grid;
}

function saveRoutineAiStatus(record, status, appliedChanges = []) {
  repository.upsert({
    ...record,
    routineAiAnalysis: {
      ...record.routineAiAnalysis,
      status,
      appliedAt: status === "applied" ? new Date().toISOString() : "",
      appliedChanges: status === "applied" ? appliedChanges : []
    },
    updatedAt: new Date().toISOString()
  });
}

function applyRoutineAiChanges(record, selectedChanges = record.routineAiAnalysis?.changes || []) {
  const routine = physicalRoutineById(record.routineId);
  if (!routine) return showToast("No se encontró la rutina vinculada a esta propuesta.");
  const settings = loadRoutineSettings();
  const allowedExercises = new Map(routine.exercises.map(exercise => [exercise.id, exercise]));
  const applied = [];
  selectedChanges.forEach(change => {
    const exercise = allowedExercises.get(change.exerciseId);
    if (!exercise) return;
    const current = currentExerciseSettings(routine, exercise, settings);
    const sets = Math.min(10, Math.max(1, Number.parseInt(change.proposedSets, 10) || current.sets));
    const target = String(change.proposedTarget || current.target).trim().slice(0, 40) || current.target;
    const requestedWeight = change.proposedWeightKg;
    const weightKg = requestedWeight === "" || requestedWeight === null || requestedWeight === undefined
      ? ""
      : Math.min(40, Math.max(0, Number(requestedWeight) || 0));
    const next = { ...change, proposedSets: sets, proposedTarget: target, proposedWeightKg: weightKg };
    if (change.action !== "substitute") settings[routineSettingsKey(routine.id, exercise.id)] = { sets, target, weightKg };
    applied.push(next);
  });
  saveRoutineSettings(settings);
  saveRoutineAiStatus(record, "applied", applied);
  renderRoutines();
  renderHistory();
  showToast(applied.length ? "Propuesta aplicada como base de la próxima rutina." : "Recomendación aceptada sin cambios de carga.");
  renderHome();
}

function createRoutineAiEditor(record) {
  const editor = document.createElement("div");
  editor.className = "routine-ai-editor";
  const intro = document.createElement("p");
  intro.textContent = "Elige qué ajustes conservar y edita sus valores antes de aplicarlos.";
  editor.append(intro);
  (record.routineAiAnalysis?.changes || []).forEach((change, index) => {
    const row = document.createElement("div");
    row.className = "routine-ai-edit-row";
    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = change.action !== "substitute";
    enabled.setAttribute("aria-label", `Aplicar ajuste de ${change.exerciseName}`);
    const name = document.createElement("strong");
    name.textContent = change.exerciseName;
    const sets = document.createElement("select");
    sets.setAttribute("aria-label", `Series propuestas de ${change.exerciseName}`);
    for (let number = 1; number <= 10; number += 1) {
      const option = document.createElement("option");
      option.value = String(number);
      option.textContent = `${number} series`;
      sets.append(option);
    }
    sets.value = String(change.proposedSets);
    const target = document.createElement("input");
    target.type = "text";
    target.maxLength = 40;
    target.value = change.proposedTarget;
    target.setAttribute("aria-label", `Repeticiones o tiempo propuesto de ${change.exerciseName}`);
    const weight = document.createElement("input");
    weight.type = "number";
    weight.inputMode = "decimal";
    weight.min = "0";
    weight.max = "40";
    weight.step = "0.25";
    weight.placeholder = "Sin carga";
    weight.value = change.proposedWeightKg;
    weight.setAttribute("aria-label", `Peso propuesto de ${change.exerciseName}`);
    row.dataset.index = String(index);
    row.append(enabled, name, sets, target, weight);
    editor.append(row);
  });
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "routine-ai-apply";
  apply.textContent = "Aplicar ajustes editados";
  apply.addEventListener("click", () => {
    const selected = [...editor.querySelectorAll(".routine-ai-edit-row")].flatMap(row => {
      const [enabled, , sets, target, weight] = row.children;
      if (!enabled.checked) return [];
      const original = record.routineAiAnalysis.changes[Number(row.dataset.index)];
      return [{
        ...original,
        proposedSets: Number(sets.value),
        proposedTarget: target.value.trim(),
        proposedWeightKg: weight.value === "" ? "" : Number(weight.value)
      }];
    });
    applyRoutineAiChanges(record, selected);
  });
  editor.append(apply);
  return editor;
}

function createRoutineAiCard(record, { compact = false } = {}) {
  const card = document.createElement("section");
  card.className = `routine-ai-card${compact ? " compact" : ""}`;
  const eyebrow = document.createElement("span");
  eyebrow.textContent = `✦ Guía del entrenador · ${recordTitle(record)}`;
  card.append(eyebrow);
  const loading = aiAnalysisInFlight.has(record?.id);
  const analysis = record?.routineAiAnalysis;
  if (analysis) {
    const decisionLabels = {
      progress: "Progresar",
      maintain: "Mantener",
      reduce: "Reducir carga",
      recover: "Priorizar recuperación"
    };
    if (analysis.decision) {
      const decision = document.createElement("span");
      decision.className = `routine-ai-decision ${analysis.decision}`;
      decision.textContent = decisionLabels[analysis.decision] || analysis.decision;
      card.append(decision);
    }
    const heading = document.createElement("h4");
    heading.textContent = analysis.headline || "Lectura de tu entrenamiento";
    const summary = document.createElement("p");
    summary.textContent = analysis.summary;
    card.append(heading, summary);
    if (analysis.planComparison?.status) {
      const comparison = document.createElement("p");
      comparison.className = "routine-ai-plan-comparison";
      const assessment = planAssessment(record, plannedContextForRecord(record, activeTrainingBlock()));
      comparison.textContent = `Plan y realidad · ${assessment.label}: ${analysis.planComparison.reason}`;
      card.append(comparison);
    }
    const groups = document.createElement("div");
    groups.className = "routine-ai-groups";
    [
      ["Puntos destacados", analysis.highlights],
      ["Evolución", analysis.progress],
      ["Para la próxima sesión", analysis.nextSession],
      ["Atención", analysis.cautions]
    ].forEach(([title, items]) => {
      if (!items?.length) return;
      const group = document.createElement("div");
      group.className = "routine-ai-group";
      const strong = document.createElement("strong");
      strong.textContent = title;
      const list = document.createElement("ul");
      items.forEach(item => {
        const row = document.createElement("li");
        row.textContent = item;
        list.append(row);
      });
      group.append(strong, list);
      groups.append(group);
    });
    if (groups.childElementCount) card.append(groups);
    if (analysis.changes?.length) {
      const changes = document.createElement("div");
      changes.className = "routine-ai-changes";
      analysis.changes.forEach(change => {
        const row = document.createElement("article");
        const title = document.createElement("strong");
        title.textContent = change.exerciseName;
        const values = document.createElement("p");
        const currentWeight = change.currentWeightKg === "" ? "sin carga" : `${change.currentWeightKg} kg`;
        const proposedWeight = change.proposedWeightKg === "" ? "sin carga" : `${change.proposedWeightKg} kg`;
        values.textContent = `${change.currentSets} × ${change.currentTarget || "—"} · ${currentWeight} → ${change.proposedSets} × ${change.proposedTarget || "—"} · ${proposedWeight}`;
        const reason = document.createElement("small");
        reason.textContent = change.reason;
        row.append(title, values, reason);
        changes.append(row);
      });
      card.append(changes);
    }
    if (analysis.goal) {
      const goal = document.createElement("p");
      goal.className = "routine-ai-goal";
      goal.textContent = `Meta de la próxima sesión: ${analysis.goal}`;
      card.append(goal);
    }
    if (analysis.encouragement) {
      const closing = document.createElement("p");
      closing.className = "routine-ai-encouragement";
      closing.textContent = analysis.encouragement;
      card.append(closing);
    }
    if (analysis.status === "pending" && record.category === "physical") {
      const actions = document.createElement("div");
      actions.className = "routine-ai-actions";
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "routine-ai-apply";
      apply.textContent = "Aplicar propuesta";
      apply.addEventListener("click", () => applyRoutineAiChanges(record));
      const modify = document.createElement("button");
      modify.type = "button";
      modify.textContent = "Modificar";
      modify.addEventListener("click", () => {
        const existing = card.querySelector(".routine-ai-editor");
        if (existing) existing.remove();
        else card.append(createRoutineAiEditor(record));
      });
      const discard = document.createElement("button");
      discard.type = "button";
      discard.textContent = "Descartar";
      discard.addEventListener("click", () => {
        saveRoutineAiStatus(record, "discarded");
        renderRoutines();
        renderHistory();
        renderHome();
        showToast("Propuesta descartada. La rutina no cambió.");
      });
      actions.append(apply, modify, discard);
      card.append(actions);
    } else if (analysis.status) {
      const status = document.createElement("p");
      status.className = `routine-ai-status ${analysis.status}`;
      status.textContent = analysis.status === "reviewed" ? "Comentario guardado en tu historial."
        : analysis.status === "applied" ? "Propuesta aplicada a la próxima rutina." : "Propuesta descartada; no se cambió la rutina.";
      card.append(status);
    }
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.className = "routine-ai-button";
    refresh.disabled = loading;
    refresh.textContent = loading ? "Actualizando comentario…" : "Actualizar comentario de la guía";
    refresh.addEventListener("click", () => requestRoutineAiAnalysis(record.id));
    card.append(refresh);
    return card;
  }
  const heading = document.createElement("h4");
  heading.textContent = loading ? "Analizando tu entrenamiento…" : "Obtén una lectura más profunda";
  const summary = document.createElement("p");
  summary.textContent = loading
    ? "La IA está leyendo tus comentarios y comparando esta actividad con el plan y tu historial. El registro ya quedó guardado."
    : repository.getCoachProfile()
      ? "La guía lee tus sensaciones y comentarios, compara esta actividad con el plan y tu historial y considera tus próximas 48 horas."
      : "Configura el perfil privado de tu entrenador para recibir recomendaciones enfocadas en tenis y tus limitaciones.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "routine-ai-button";
  button.disabled = loading;
  button.textContent = loading ? "Preparando análisis…" : !repository.getCoachProfile() ? "Configurar perfil" : cloudSync.currentUser ? "Analizar con IA" : "Iniciar sesión para analizar";
  button.addEventListener("click", () => repository.getCoachProfile() ? requestRoutineAiAnalysis(record.id) : openCoachProfileDialog());
  card.append(heading, summary, button);
  return card;
}

function updateRoutineSessionPreview(routine, progress, settings, dateISO) {
  const session = loadRoutineSession();
  if (!session || session.status !== "active" || session.routineId !== routine.id) return;
  const summary = routineSessionSummary(routine, progress, settings, dateISO);
  const values = {
    sets: `${summary.completedSets}/${summary.plannedSets}`,
    exercises: `${summary.startedExercises}/${summary.totalExercises}`,
    reps: String(summary.totalReps),
    volume: `${Number(summary.volumeKg).toLocaleString("es-CL")} kg`,
    abdominals: session.absCount === "" || session.absCount === undefined ? "—" : String(session.absCount)
  };
  Object.entries(values).forEach(([key, value]) => {
    const target = $(`routinePreview-${key}`)?.querySelector("strong");
    if (target) target.textContent = value;
  });
}

function createRoutineSessionHeader(routine, session) {
  const panel = document.createElement("section");
  panel.className = "routine-session-card";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "routine-session-status";
  const title = document.createElement("strong");
  const description = document.createElement("p");
  const isActive = session?.status === "active" && session.routineId === routine.id;
  const isComplete = session?.status === "complete" && session.routineId === routine.id;
  const anotherActive = session?.status === "active" && session.routineId !== routine.id;
  const planned = !isActive && !isComplete ? loadPlannedRoutineContext() : session;
  const plannedForRoutine = planned?.routineId === routine.id && (planned?.planSessionId || planned?.sessionId) ? planned : null;

  if (isActive) {
    eyebrow.textContent = session.planSessionId ? "Plan del entrenador · En curso" : "En curso";
    title.textContent = "Tiempo de entrenamiento";
    description.textContent = `${session.plannedTitle ? `${session.plannedTitle}. ` : ""}Iniciada a las ${new Date(session.startedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (isComplete) {
    eyebrow.textContent = "Registrada";
    title.textContent = "Última sesión finalizada";
    description.textContent = "El balance quedó guardado en tu historial.";
  } else {
    eyebrow.textContent = anotherActive ? "Otra rutina en curso" : plannedForRoutine ? `Plan del entrenador · Semana ${plannedForRoutine.weekNumber}` : "Lista para comenzar";
    title.textContent = plannedForRoutine?.optionTitle || "Revisa y prepara tu entrenamiento";
    description.textContent = anotherActive
      ? "Puedes revisarla, pero primero debes finalizar la rutina que está en curso."
      : plannedForRoutine
        ? `Programada para ${formatShortDate(plannedForRoutine.dateISO)}. El cronómetro comenzará solo cuando pulses Iniciar.`
        : "El cronómetro todavía no está corriendo. Puedes revisar los ejercicios y ajustar sus valores.";
  }
  copy.append(eyebrow, title, description);

  const action = document.createElement("div");
  action.className = "routine-session-action";
  if (isActive || isComplete) {
    const clock = document.createElement("strong");
    clock.id = `routineElapsed-${routine.id}`;
    clock.className = "routine-elapsed";
    clock.textContent = formatClock(routineSessionElapsedSeconds(session));
    action.append(clock);
  }
  if (!isActive) {
    const start = document.createElement("button");
    start.type = "button";
    start.textContent = isComplete ? "Iniciar otra" : "Iniciar entrenamiento";
    start.disabled = anotherActive;
    start.addEventListener("click", () => startRoutineSession(routine));
    action.append(start);
  }
  panel.append(copy, action);
  if (plannedForRoutine?.planDetails?.length) {
    const notes = document.createElement("ul");
    notes.className = "routine-plan-details";
    plannedForRoutine.planDetails.forEach(text => {
      const item = document.createElement("li");
      item.textContent = text;
      notes.append(item);
    });
    panel.append(notes);
  }
  return panel;
}

function createRoutineSensationPicker(routine, session) {
  const box = document.createElement("div");
  box.className = "routine-sensation-box";
  const label = document.createElement("label");
  label.htmlFor = `routineSensations-${routine.id}`;
  label.textContent = "Sensaciones finales";
  const heading = document.createElement("div");
  heading.className = "suggestion-heading";
  const headingText = document.createElement("span");
  headingText.textContent = "Ideas rápidas";
  const headingHelp = document.createElement("small");
  headingHelp.textContent = "Puedes elegir más de una";
  heading.append(headingText, headingHelp);
  const chips = document.createElement("div");
  chips.className = "suggestion-chips routine-suggestion-chips";
  chips.setAttribute("aria-label", "Sugerencias de sensaciones para la rutina");
  const textarea = document.createElement("textarea");
  textarea.id = `routineSensations-${routine.id}`;
  textarea.rows = 4;
  textarea.maxLength = 5000;
  textarea.placeholder = "Selecciona sensaciones o escribe cómo terminaste la rutina.";
  textarea.value = session?.sensations || "";
  const persist = () => {
    const current = loadRoutineSession();
    if (current?.status === "active" && current.routineId === routine.id) {
      saveRoutineSession({ ...current, sensations: textarea.value });
    }
  };
  const values = () => textarea.value.split(" · ").map(value => value.trim()).filter(Boolean);
  const sync = () => {
    const selected = new Set(values());
    chips.querySelectorAll(".suggestion-chip").forEach(button => {
      const active = selected.has(button.dataset.suggestion);
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };
  [...sensationSuggestions.common, ...sensationSuggestions.physical].forEach(suggestion => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = suggestion;
    button.dataset.suggestion = suggestion;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const selected = values();
      const index = selected.indexOf(suggestion);
      if (index >= 0) selected.splice(index, 1);
      else selected.push(suggestion);
      textarea.value = selected.join(" · ");
      sync();
      persist();
    });
    chips.append(button);
  });
  textarea.addEventListener("input", () => {
    sync();
    persist();
  });
  sync();
  box.append(label, heading, chips, textarea);
  return box;
}

function createRoutineDurationBadge(routine, averages) {
  const average = averages.get(routine.id) || averages.get(routine.name);
  const badge = document.createElement("span");
  badge.className = "routine-duration-average";
  badge.textContent = average ? `Duración aprox. ${average.minutes} min` : "Sin promedio aún";
  badge.title = average
    ? `Promedio calculado con ${average.sessions} ${average.sessions === 1 ? "entrenamiento" : "entrenamientos"}`
    : "Aparecerá después de registrar esta rutina";
  return badge;
}

function createRoutineAbsRecordBadge(record) {
  const badge = document.createElement("span");
  badge.className = "routine-abs-record";
  badge.textContent = record.count > 0
    ? `Récord abs. ${record.count} · meta ${record.nextTarget}`
    : "Abs. · crea tu primera marca";
  badge.title = "Este récord es único y se comparte entre las cuatro rutinas";
  return badge;
}

function createRoutineAbsFinisher(routine, session, record, exerciseCount = routine.exercises.length) {
  const isCurrentRoutine = session?.routineId === routine.id;
  const isActive = isCurrentRoutine && session.status === "active";
  const card = document.createElement("article");
  card.className = "exercise-card abdominal-finisher";
  card.dataset.exerciseId = "abdominals-finisher";
  const top = document.createElement("div");
  top.className = "exercise-top";
  const titleBox = document.createElement("div");
  const phase = document.createElement("span");
  phase.className = "exercise-phase";
  phase.textContent = record.count > 0 ? `Récord global · ${record.count}` : "Cierre · Primera marca";
  const title = document.createElement("h3");
  title.textContent = `${exerciseCount + 1}. Abdominales`;
  titleBox.append(phase, title);
  top.append(titleBox);
  const description = document.createElement("p");
  description.textContent = record.count > 0
    ? `Tu marca vigente para todas las rutinas es ${record.count}. Hoy intenta completar al menos ${record.nextTarget} abdominales.`
    : "Termina la rutina con abdominales para establecer una primera marca global que deberás superar en cualquier día.";
  const benefit = document.createElement("p");
  benefit.className = "tennis-benefit";
  const benefitLabel = document.createElement("strong");
  benefitLabel.textContent = "Para el tenis: ";
  benefit.append(benefitLabel, "refuerza el core para estabilizar golpes, frenadas y cambios de dirección.");
  const target = document.createElement("div");
  target.className = "abdominal-record-target";
  const currentMark = document.createElement("div");
  const currentValue = document.createElement("strong");
  currentValue.textContent = record.count > 0 ? String(record.count) : "—";
  const currentLabel = document.createElement("span");
  currentLabel.textContent = "Marca global actual";
  currentMark.append(currentValue, currentLabel);
  const nextMark = document.createElement("div");
  const nextValue = document.createElement("strong");
  nextValue.textContent = `${record.nextTarget}+`;
  const nextLabel = document.createElement("span");
  nextLabel.textContent = "Objetivo de hoy";
  nextMark.append(nextValue, nextLabel);
  target.append(currentMark, nextMark);
  const control = document.createElement("label");
  control.className = "abdominal-count-control";
  control.htmlFor = `routineAbsCount-${routine.id}`;
  const caption = document.createElement("span");
  caption.textContent = "Total de abdominales realizados";
  const input = document.createElement("input");
  input.id = `routineAbsCount-${routine.id}`;
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.max = "10000";
  input.step = "1";
  input.placeholder = isActive ? `Meta: ${record.nextTarget}` : "Disponible al iniciar";
  input.value = isCurrentRoutine && session.absCount !== undefined ? session.absCount : "";
  input.disabled = !isActive;
  const feedback = document.createElement("small");
  feedback.className = "abdominal-record-feedback";
  const updateFeedback = value => {
    if (value === "") {
      feedback.textContent = "El resultado se comparará con la misma marca global sin importar qué rutina realices.";
      feedback.classList.remove("record-beaten");
      return;
    }
    if (Number(value) > record.count) {
      feedback.textContent = `¡Nuevo récord global: ${value}! La siguiente meta será ${Number(value) + 1}.`;
      feedback.classList.add("record-beaten");
      return;
    }
    const remaining = Math.max(1, record.nextTarget - Number(value));
    feedback.textContent = Number(value) === record.count
      ? `Igualas la marca. Necesitas ${record.nextTarget} para superarla.`
      : `Te ${remaining === 1 ? "falta" : "faltan"} ${remaining} para alcanzar la meta de ${record.nextTarget}.`;
    feedback.classList.remove("record-beaten");
  };
  input.addEventListener("input", () => {
    const current = loadRoutineSession();
    if (!current || current.status !== "active" || current.routineId !== routine.id) return;
    const value = input.value === "" ? "" : Math.max(0, Math.floor(Number(input.value) || 0));
    if (input.value !== "") input.value = String(value);
    saveRoutineSession({ ...current, absCount: value });
    updateFeedback(value);
    const preview = $("routinePreview-abdominals")?.querySelector("strong");
    if (preview) preview.textContent = value === "" ? "—" : String(value);
  });
  updateFeedback(input.value);
  control.append(caption, input, feedback);
  card.append(top, description, benefit, target, control);
  return card;
}

function createRoutineFinishPanel(routine, session, progress, settings, dateISO) {
  if (!session || session.routineId !== routine.id) return null;
  const panel = document.createElement("section");
  panel.className = `routine-finish-card ${session.status}`;
  const eyebrow = document.createElement("span");
  eyebrow.className = "routine-session-status";
  const heading = document.createElement("h3");
  const copy = document.createElement("p");

  if (session.status === "complete") {
    eyebrow.textContent = "Balance final";
    heading.textContent = "Entrenamiento registrado";
    copy.textContent = "Este resultado ya cuenta dentro del entrenamiento diario y del informe semanal.";
    panel.append(eyebrow, heading, copy, routineBalanceGrid(session.summary, session.elapsedSeconds, session.calories, session.absCount, false, session.effort, session.pain));
    const automaticSummary = document.createElement("p");
    automaticSummary.className = "routine-auto-summary";
    automaticSummary.textContent = session.routineSummary || "Tu balance completo quedó guardado para comparar la próxima sesión.";
    panel.append(automaticSummary);
    const completedRecord = repository.get(session.recordId);
    if (completedRecord) panel.append(createRoutineAiCard(completedRecord));
    const note = document.createElement("small");
    note.textContent = session.settingsChangeCount > 0
      ? session.defaultSettingsSaved
        ? "Tus nuevos pesos, repeticiones y series quedaron guardados para esta rutina."
        : "Los cambios quedaron registrados en este entrenamiento, pero la rutina conserva sus valores anteriores."
      : "Volumen estimado = peso anotado × repeticiones de las series marcadas. No incluye ejercicios por tiempo ni sin carga.";
    const history = document.createElement("button");
    history.type = "button";
    history.className = "routine-history-button";
    history.textContent = "Ver en historial";
    history.addEventListener("click", () => showView("history"));
    panel.append(note, history);
    return panel;
  }

  const preview = routineSessionSummary(routine, progress, settings, dateISO);
  eyebrow.textContent = "Cierre de la sesión";
  heading.textContent = "Finaliza y guarda tu entrenamiento";
  copy.textContent = "Puedes terminar aunque la rutina haya quedado parcial. Solo se contará lo que marcaste.";
  const caloriesLabel = document.createElement("label");
  caloriesLabel.htmlFor = `routineCalories-${routine.id}`;
  caloriesLabel.textContent = "Calorías quemadas";
  const calories = document.createElement("input");
  calories.id = `routineCalories-${routine.id}`;
  calories.type = "number";
  calories.inputMode = "numeric";
  calories.min = "0";
  calories.step = "1";
  calories.placeholder = "Ej: 420";
  calories.value = session.calories ?? "";
  calories.addEventListener("input", () => {
    const current = loadRoutineSession();
    if (current?.status === "active" && current.routineId === routine.id) saveRoutineSession({ ...current, calories: calories.value });
  });
  const loadSelect = ({ id, label, min, max, blank = false, value }) => {
    const wrapper = document.createElement("label");
    wrapper.className = "routine-rating-control";
    wrapper.htmlFor = id;
    const caption = document.createElement("span");
    caption.textContent = label;
    const select = document.createElement("select");
    select.id = id;
    if (blank) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Seleccionar";
      select.append(option);
    }
    for (let number = min; number <= max; number += 1) {
      const option = document.createElement("option");
      option.value = String(number);
      option.textContent = `${number}/10`;
      select.append(option);
    }
    select.value = value === undefined || value === null ? "" : String(value);
    wrapper.append(caption, select);
    return { wrapper, select };
  };
  const ratings = document.createElement("div");
  ratings.className = "routine-ratings";
  const effortControl = loadSelect({ id: `routineEffort-${routine.id}`, label: "Esfuerzo percibido (RPE)", min: 1, max: 10, blank: true, value: session.effort });
  const painControl = loadSelect({ id: `routinePain-${routine.id}`, label: "Dolor o molestia", min: 0, max: 10, value: session.pain ?? 0 });
  ratings.append(effortControl.wrapper, painControl.wrapper);
  const painDetailWrap = document.createElement("label");
  painDetailWrap.className = "routine-pain-detail";
  painDetailWrap.htmlFor = `routinePainDetail-${routine.id}`;
  const painCaption = document.createElement("span");
  painCaption.textContent = "¿Dónde y cómo fue la molestia?";
  const painDetail = document.createElement("textarea");
  painDetail.id = `routinePainDetail-${routine.id}`;
  painDetail.rows = 3;
  painDetail.maxLength = 2000;
  painDetail.placeholder = "Ej: molestia leve en el antebrazo durante el remo.";
  painDetail.value = session.painDetail || "";
  painDetailWrap.append(painCaption, painDetail);
  const syncPainVisibility = () => {
    const hasPain = Number(painControl.select.value) > 0;
    painDetailWrap.classList.toggle("hidden", !hasPain);
    painDetail.required = hasPain;
  };
  const persistRatings = () => {
    const current = loadRoutineSession();
    if (current?.status !== "active" || current.routineId !== routine.id) return;
    saveRoutineSession({ ...current, effort: effortControl.select.value, pain: Number(painControl.select.value), painDetail: painDetail.value });
    const effortPreview = $("routinePreview-effort")?.querySelector("strong");
    const painPreview = $("routinePreview-pain")?.querySelector("strong");
    if (effortPreview) effortPreview.textContent = effortControl.select.value ? `${effortControl.select.value}/10` : "—";
    if (painPreview) painPreview.textContent = `${painControl.select.value}/10`;
  };
  effortControl.select.addEventListener("change", persistRatings);
  painControl.select.addEventListener("change", () => { syncPainVisibility(); persistRatings(); });
  painDetail.addEventListener("input", persistRatings);
  syncPainVisibility();
  const sensations = createRoutineSensationPicker(routine, session);
  const defaultsOption = document.createElement("label");
  defaultsOption.className = "routine-defaults-option";
  defaultsOption.htmlFor = `routineSaveDefaults-${routine.id}`;
  const defaultsCheckbox = document.createElement("input");
  defaultsCheckbox.id = `routineSaveDefaults-${routine.id}`;
  defaultsCheckbox.type = "checkbox";
  const defaultsCopy = document.createElement("span");
  const defaultsTitle = document.createElement("strong");
  defaultsTitle.textContent = "Usar mis cambios la próxima vez";
  const defaultsHelp = document.createElement("small");
  defaultsHelp.id = `routineSaveDefaultsHelp-${routine.id}`;
  defaultsCopy.append(defaultsTitle, defaultsHelp);
  defaultsOption.append(defaultsCheckbox, defaultsCopy);
  defaultsCheckbox.addEventListener("change", () => updateRoutineDefaultsChoice(routine, session, settings));
  const message = document.createElement("div");
  message.id = `routineFinishMessage-${routine.id}`;
  message.className = "form-message error hidden";
  message.setAttribute("role", "status");
  const finish = document.createElement("button");
  finish.type = "button";
  finish.className = "routine-finish-button";
  finish.id = `routineFinishButton-${routine.id}`;
  finish.textContent = "Finalizar y registrar";
  finish.addEventListener("click", () => finishRoutineSession(routine));
  panel.append(eyebrow, heading, copy, routineBalanceGrid(preview, routineSessionElapsedSeconds(session), session.calories || "", session.absCount, true, session.effort, session.pain), caloriesLabel, calories, ratings, painDetailWrap, sensations, defaultsOption, message, finish);
  const note = document.createElement("small");
  note.textContent = "El volumen es estimado y usa los pesos, repeticiones y series que dejaste registrados.";
  panel.append(note);
  updateRoutineDefaultsChoice(routine, session, settings);
  return panel;
}

function renderRoutines() {
  const container = $("routineLibrary");
  let session = loadRoutineSession();
  const planned = loadPlannedRoutineContext();
  const dateISO = session?.status === "active" ? session.dateISO : planned?.dateISO || getChileDateISO();
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
  if (session?.status === "active" && !session.settingsAtStart) {
    const activeRoutine = physicalRoutineById(session.routineId);
    if (activeRoutine) {
      session = { ...session, settingsAtStart: routineSettingsSnapshot(activeRoutine, settings) };
      saveRoutineSession(session);
    }
  }
  const durationAverages = physicalRoutineDurationAverages(repository.list());
  const abdominalRecord = globalAbdominalRecord(repository.list());
  container.replaceChildren();

  physicalRoutines.forEach((routine, routineIndex) => {
    const card = document.createElement("details");
    card.className = "routine-card";
    card.dataset.routineId = routine.id;
    card.open = openRoutineId === routine.id || session?.routineId === routine.id;
    card.addEventListener("toggle", () => {
      if (card.open) openRoutineId = routine.id;
      else if (openRoutineId === routine.id) openRoutineId = "";
    });
    const summary = document.createElement("summary");
    const number = document.createElement("span");
    number.className = "routine-number";
    number.textContent = String(routineIndex + 1).padStart(2, "0");
    const summaryCopy = document.createElement("div");
    const titleLine = document.createElement("div");
    titleLine.className = "routine-name-line";
    const title = document.createElement("h2");
    title.textContent = routine.name;
    titleLine.append(title, createRoutineDurationBadge(routine, durationAverages), createRoutineAbsRecordBadge(abdominalRecord));
    const focus = document.createElement("p");
    focus.textContent = routine.focus;
    summaryCopy.append(titleLine, focus);
    const counter = document.createElement("span");
    counter.className = "routine-progress";
    const updateCounter = () => {
      const completed = completedRoutineSets(routine, progress, settings, dateISO);
      const total = totalRoutineSets(routine, settings, dateISO);
      counter.textContent = `${completed}/${total} series`;
      counter.classList.toggle("complete", completed === total);
    };
    updateCounter();
    summary.append(number, summaryCopy, counter);

    const body = document.createElement("div");
    body.className = "routine-body";
    const note = document.createElement("p");
    note.className = "routine-note";
    note.textContent = `Avance del ${formatShortDate(dateISO)} · al finalizar eliges si conservar los cambios`;
    const objective = document.createElement("p");
    objective.className = "routine-objective";
    objective.textContent = routine.objective;
    body.append(note, objective, createRoutineSessionHeader(routine, session));
    const isRoutineActive = session?.status === "active" && session.routineId === routine.id;

    const displayedExercises = routineExercisesForDate(routine, dateISO);
    displayedExercises.forEach((exercise, exerciseIndex) => {
      const exerciseCard = document.createElement("article");
      exerciseCard.className = "exercise-card";
      exerciseCard.dataset.exerciseId = exercise.id;
      const exerciseSettings = currentExerciseSettings(routine, exercise, settings);
      const exerciseTop = document.createElement("div");
      exerciseTop.className = "exercise-top";
      const titleBox = document.createElement("div");
      const phase = document.createElement("span");
      phase.className = "exercise-phase";
      phase.textContent = exercise.phase;
      const exerciseTitle = document.createElement("h3");
      exerciseTitle.textContent = `${exerciseIndex + 1}. ${exercise.name}`;
      titleBox.append(phase, exerciseTitle);
      exerciseTop.append(titleBox);
      const description = document.createElement("p");
      description.textContent = exercise.description;
      const benefit = document.createElement("p");
      benefit.className = "tennis-benefit";
      const benefitLabel = document.createElement("strong");
      benefitLabel.textContent = "Para el tenis: ";
      benefit.append(benefitLabel, exercise.benefit);
      const guidance = document.createElement("div");
      guidance.className = "exercise-guidance";
      if (exercise.weightSuggestion) {
        const weightSuggestion = document.createElement("p");
        weightSuggestion.textContent = exercise.weightSuggestion;
        guidance.append(weightSuggestion);
      }
      if (exercise.caution) {
        const caution = document.createElement("p");
        caution.className = "exercise-caution";
        caution.textContent = exercise.caution;
        guidance.append(caution);
      }

      const controls = document.createElement("div");
      controls.className = "exercise-controls";
      const createControl = ({ labelText, input }) => {
        const wrapper = document.createElement("label");
        const caption = document.createElement("span");
        caption.textContent = labelText;
        wrapper.append(caption, input);
        return wrapper;
      };
      const setsInput = document.createElement("select");
      Array.from({ length: 10 }, (_, index) => index + 1).forEach(value => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        setsInput.append(option);
      });
      setsInput.value = String(exerciseSettings.sets);
      setsInput.setAttribute("aria-label", `Series de ${exercise.name}`);
      const targetInput = document.createElement("input");
      targetInput.type = "text";
      targetInput.inputMode = "numeric";
      targetInput.maxLength = 20;
      targetInput.value = editableTargetValue(exerciseSettings.target);
      targetInput.placeholder = editableTargetValue(exercise.target);
      targetInput.setAttribute("aria-label", `Repeticiones o tiempo de ${exercise.name}`);
      const weightInput = document.createElement("input");
      weightInput.type = "number";
      weightInput.inputMode = "decimal";
      weightInput.min = "0";
      weightInput.max = "200";
      weightInput.step = "0.25";
      weightInput.placeholder = "Sin carga";
      weightInput.value = exerciseSettings.weightKg;
      weightInput.setAttribute("aria-label", `Peso en kilos de ${exercise.name}`);
      controls.append(
        createControl({ labelText: "Series", input: setsInput }),
        createControl({ labelText: exerciseTargetMeta(exercise).label, input: targetInput }),
        createControl({ labelText: "Peso (kg)", input: weightInput })
      );

      const series = document.createElement("div");
      series.className = "series-checks";
      series.classList.toggle("locked", !isRoutineActive);

      const updateExerciseComplete = () => {
        const checkboxes = [...series.querySelectorAll('input[type="checkbox"]')];
        exerciseCard.classList.toggle("complete", checkboxes.length > 0 && checkboxes.every(item => item.checked));
      };
      const renderSeries = () => {
        series.replaceChildren();
        const setCount = currentExerciseSettings(routine, exercise, settings).sets;
        Array.from({ length: setCount }, (_, index) => index).forEach(setIndex => {
          const id = `set-${routine.id}-${exercise.id}-${setIndex}`;
          const key = routineProgressKey(dateISO, routine.id, exercise.id, setIndex);
          const input = document.createElement("input");
          input.type = "checkbox";
          input.id = id;
          input.checked = Boolean(progress[key]);
          input.disabled = !isRoutineActive;
          const label = document.createElement("label");
          label.htmlFor = id;
          label.textContent = `Serie ${setIndex + 1}`;
          input.addEventListener("change", () => {
            if (input.checked) progress[key] = true;
            else delete progress[key];
            saveRoutineProgress(progress);
            updateCounter();
            updateExerciseComplete();
            updateRoutineSessionPreview(routine, progress, settings, dateISO);
          });
          series.append(input, label);
        });
        updateExerciseComplete();
      };
      const persistExerciseSettings = () => {
        const setCount = Math.min(10, Math.max(1, Number.parseInt(setsInput.value, 10) || exercise.sets));
        const target = normalizedExerciseTarget(targetInput.value, exercise);
        const enteredWeight = weightInput.value === "" ? "" : Number(weightInput.value);
        const weightKg = enteredWeight === "" || (Number.isFinite(enteredWeight) && enteredWeight >= 0) ? enteredWeight : exercise.weightKg;
        settings[routineSettingsKey(routine.id, exercise.id)] = { sets: setCount, target, weightKg };
        setsInput.value = String(setCount);
        saveRoutineSettings(settings);
        renderSeries();
        updateCounter();
        updateRoutineSessionPreview(routine, progress, settings, dateISO);
        if (isRoutineActive) updateRoutineDefaultsChoice(routine, session, settings);
      };
      setsInput.addEventListener("change", persistExerciseSettings);
      targetInput.addEventListener("input", persistExerciseSettings);
      targetInput.addEventListener("focus", () => targetInput.select());
      weightInput.addEventListener("input", persistExerciseSettings);
      weightInput.addEventListener("focus", () => weightInput.select());
      renderSeries();
      exerciseCard.append(exerciseTop, description, benefit, guidance, controls, series);
      body.append(exerciseCard);
    });
    body.append(createRoutineAbsFinisher(routine, session, abdominalRecord, displayedExercises.length));
    const finishPanel = createRoutineFinishPanel(routine, session, progress, settings, dateISO);
    if (finishPanel) body.append(finishPanel);
    card.append(summary, body);
    container.append(card);
  });
  ensureRoutineSessionTicker();
}

function renderPhysicalRankings(records) {
  const container = $("physicalRankings");
  const rankings = physicalBestRecords(records);
  container.replaceChildren();
  if (!rankings.abdominals.length && !rankings.volume.length) {
    const empty = document.createElement("div");
    empty.className = "trekking-ranking-empty";
    empty.textContent = "Cuando finalices una rutina, aquí aparecerán tus récords de abdominales y volumen de carga.";
    container.append(empty);
    return;
  }

  const addCurrentAbdominalRecord = attempt => {
    if (!attempt) return;
    const card = document.createElement("div");
    card.className = "physical-current-record";
    const copy = document.createElement("div");
    const label = document.createElement("span");
    label.textContent = "Récord global único";
    const title = document.createElement("h3");
    title.textContent = "Abdominales finales";
    const meta = document.createElement("p");
    meta.textContent = `${formatShortDate(attempt.dateISO)} · ${attempt.routineName || "Entrenamiento físico"}`;
    copy.append(label, title, meta);
    const mark = document.createElement("div");
    const markLabel = document.createElement("span");
    markLabel.textContent = "Marca actual";
    const markValue = document.createElement("strong");
    markValue.textContent = `${attempt.routineAbsCount}`;
    const next = document.createElement("small");
    next.textContent = `Próxima meta: ${Number(attempt.routineAbsCount) + 1}`;
    mark.append(markLabel, markValue, next);
    card.append(copy, mark);
    container.append(card);
  };

  const addRanking = ({ titleText, attempts, valueFor }) => {
    if (!attempts.length) return;
    const details = document.createElement("details");
    details.className = "trekking-ranking-group";
    details.open = true;
    const summary = document.createElement("summary");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = titleText;
    const count = document.createElement("p");
    count.textContent = `${attempts.length} ${attempts.length === 1 ? "rutina registrada" : "rutinas registradas"}`;
    copy.append(title, count);
    const best = document.createElement("div");
    const bestLabel = document.createElement("span");
    bestLabel.textContent = "Récord";
    const bestValue = document.createElement("strong");
    bestValue.textContent = valueFor(attempts[0]);
    best.append(bestLabel, bestValue);
    summary.append(copy, best);
    const list = document.createElement("ol");
    list.className = "trekking-attempts";
    attempts.slice(0, 3).forEach((attempt, index) => {
      const item = document.createElement("li");
      const position = document.createElement("span");
      position.className = "trekking-position";
      position.textContent = `#${index + 1}`;
      const attemptCopy = document.createElement("div");
      const value = document.createElement("strong");
      value.textContent = valueFor(attempt);
      const meta = document.createElement("small");
      meta.textContent = `${formatShortDate(attempt.dateISO)} · ${attempt.routineName || "Entrenamiento físico"}`;
      attemptCopy.append(value, meta);
      item.append(position, attemptCopy);
      list.append(item);
    });
    details.append(summary, list);
    container.append(details);
  };

  addCurrentAbdominalRecord(rankings.abdominals[0]);
  addRanking({
    titleText: "Volumen total levantado",
    attempts: rankings.volume,
    valueFor: record => `${Number(record.routineVolumeKg).toLocaleString("es-CL")} kg`
  });
}

function runningPace(rankingSeconds, distanceKm) {
  const secondsPerKm = Math.round(Number(rankingSeconds) / Number(distanceKm));
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = secondsPerKm % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")} min/km`;
}

function renderRunningRankings(records) {
  const container = $("runningRankings");
  const groups = runningBestTimes(records);
  container.replaceChildren();
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "trekking-ranking-empty";
    empty.textContent = "Cuando registres un trote de 3K, 5K o 10K, aquí aparecerán tus mejores tiempos.";
    container.append(empty);
    return;
  }

  groups.forEach((group, groupIndex) => {
    const details = document.createElement("details");
    details.className = "trekking-ranking-group";
    details.open = groupIndex === 0;
    const summary = document.createElement("summary");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = group.label;
    const count = document.createElement("p");
    count.textContent = `${group.attempts.length} ${group.attempts.length === 1 ? "trote registrado" : "trotes registrados"}`;
    copy.append(title, count);
    const best = document.createElement("div");
    const bestLabel = document.createElement("span");
    bestLabel.textContent = "Mejor tiempo";
    const bestTime = document.createElement("strong");
    bestTime.textContent = formatTimerClock(group.attempts[0].rankingSeconds);
    best.append(bestLabel, bestTime);
    summary.append(copy, best);

    const list = document.createElement("ol");
    list.className = "trekking-attempts";
    group.attempts.forEach((attempt, index) => {
      const item = document.createElement("li");
      const position = document.createElement("span");
      position.className = "trekking-position";
      position.textContent = `#${index + 1}`;
      const attemptCopy = document.createElement("div");
      const time = document.createElement("strong");
      time.textContent = formatTimerClock(attempt.rankingSeconds);
      const meta = document.createElement("small");
      meta.textContent = [formatShortDate(attempt.dateISO), runningPace(attempt.rankingSeconds, group.distanceKm), `${attempt.calories || 0} kcal`]
        .filter(Boolean)
        .join(" · ");
      attemptCopy.append(time, meta);
      item.append(position, attemptCopy);
      list.append(item);
    });
    details.append(summary, list);
    container.append(details);
  });
}

function renderTrekkingRankings(records) {
  const container = $("trekkingRankings");
  const groups = trekkingBestTimes(records);
  container.replaceChildren();
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "trekking-ranking-empty";
    empty.textContent = "Cuando registres una subida, aquí aparecerán tus mejores tiempos por cerro y ruta.";
    container.append(empty);
    return;
  }

  groups.forEach((group, groupIndex) => {
    const details = document.createElement("details");
    details.className = "trekking-ranking-group";
    details.open = groupIndex === 0;
    const summary = document.createElement("summary");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = group.location;
    const route = document.createElement("p");
    route.textContent = group.route || "Ruta general";
    copy.append(title, route);
    const best = document.createElement("div");
    const bestLabel = document.createElement("span");
    bestLabel.textContent = "Mejor tiempo";
    const bestTime = document.createElement("strong");
    bestTime.textContent = formatTimerClock(group.attempts[0].rankingSeconds);
    best.append(bestLabel, bestTime);
    summary.append(copy, best);

    const list = document.createElement("ol");
    list.className = "trekking-attempts";
    group.attempts.forEach((attempt, index) => {
      const item = document.createElement("li");
      const position = document.createElement("span");
      position.className = "trekking-position";
      position.textContent = `#${index + 1}`;
      const attemptCopy = document.createElement("div");
      const time = document.createElement("strong");
      time.textContent = formatTimerClock(attempt.rankingSeconds);
      const meta = document.createElement("small");
      const parts = [formatShortDate(attempt.dateISO)];
      if (typeof attempt.distanceKm === "number") parts.push(`${attempt.distanceKm.toLocaleString("es-CL")} km`);
      if (typeof attempt.elevationGainM === "number") parts.push(`${attempt.elevationGainM} m desnivel`);
      meta.textContent = parts.join(" · ");
      attemptCopy.append(time, meta);
      if (attempt.usesTotalDuration) {
        const legacy = document.createElement("span");
        legacy.className = "trekking-legacy-time";
        legacy.textContent = "Duración total";
        attemptCopy.append(legacy);
      }
      item.append(position, attemptCopy);
      list.append(item);
    });
    details.append(summary, list);
    container.append(details);
  });
}

function signedDifference(current, previous, suffix = "") {
  const difference = Number(current) - Number(previous);
  if (!difference) return `Igual que la semana anterior${suffix}`;
  return `${difference > 0 ? "+" : ""}${difference.toLocaleString("es-CL")}${suffix} vs. semana anterior`;
}

function renderExerciseProgress(records) {
  const container = $("exerciseProgress");
  const exercises = exerciseProgress(records);
  container.replaceChildren();
  if (!exercises.length) {
    const empty = document.createElement("div");
    empty.className = "exercise-progress-empty";
    empty.textContent = "Cuando completes ejercicios con peso, aquí verás la evolución de tus cargas.";
    container.append(empty);
    return;
  }
  exercises.forEach((exercise, index) => {
    const details = document.createElement("details");
    details.className = "exercise-progress-item";
    details.open = index === 0;
    const summary = document.createElement("summary");
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = exercise.name;
    const latest = document.createElement("p");
    const latestWeight = Number(exercise.latest.weightKg) || 0;
    const previousWeight = Number(exercise.previous?.weightKg) || 0;
    const weightChange = exercise.previous && latestWeight !== previousWeight
      ? ` · ${latestWeight > previousWeight ? "+" : ""}${(latestWeight - previousWeight).toLocaleString("es-CL")} kg`
      : "";
    latest.textContent = `Último: ${exercise.latest.target || "sin objetivo"}${latestWeight ? ` · ${latestWeight.toLocaleString("es-CL")} kg` : ""}${weightChange}`;
    copy.append(title, latest);
    const best = document.createElement("div");
    best.className = "exercise-progress-best";
    const bestLabel = document.createElement("span");
    bestLabel.textContent = exercise.bestWeightKg ? "Mejor carga" : "Mejor volumen";
    const bestValue = document.createElement("strong");
    bestValue.textContent = exercise.bestWeightKg
      ? `${exercise.bestWeightKg.toLocaleString("es-CL")} kg`
      : `${exercise.bestVolumeKg.toLocaleString("es-CL")} kg`;
    best.append(bestLabel, bestValue);
    summary.append(copy, best);
    const attempts = document.createElement("ol");
    attempts.className = "exercise-attempts";
    exercise.attempts.slice(0, 5).forEach(attempt => {
      const item = document.createElement("li");
      const attemptCopy = document.createElement("div");
      const date = document.createElement("strong");
      date.textContent = `${formatShortDate(attempt.dateISO)} · ${attempt.routineName}`;
      const performed = document.createElement("span");
      performed.textContent = `${attempt.completedSets} series · ${attempt.target || "sin objetivo"}${Number(attempt.weightKg) ? ` · ${Number(attempt.weightKg).toLocaleString("es-CL")} kg` : ""}`;
      const volume = document.createElement("em");
      volume.textContent = `${Number(attempt.volumeKg || 0).toLocaleString("es-CL")} kg vol.`;
      attemptCopy.append(date, performed);
      item.append(attemptCopy, volume);
      attempts.append(item);
    });
    details.append(summary, attempts);
    container.append(details);
  });
}

function renderHistory() {
  const records = repository.list();
  const groups = groupRecordsByWeek(records);
  renderExerciseProgress(records);
  renderPhysicalRankings(records);
  renderRunningRankings(records);
  renderTrekkingRankings(records);
  $("historyTotal").textContent = `${records.length} ${records.length === 1 ? "registro" : "registros"}`;
  const container = $("historyWeeks");
  container.replaceChildren();
  if (!groups.length) {
    const empty = document.createElement("div");
    empty.className = "empty-history";
    empty.textContent = "Cuando registres tu primer entrenamiento aparecerá aquí, dentro de su semana.";
    container.append(empty);
    return;
  }

  const currentWeek = isoWeekInfo(getChileDateISO()).key;
  groups.forEach((group, groupIndex) => {
    const details = document.createElement("details");
    details.className = "week-group";
    details.open = group.key === currentWeek || groupIndex === 0;
    const summary = document.createElement("summary");
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    const planWeek = activeTrainingBlock().weeks.find(item => item.weekKey === group.key);
    title.textContent = planWeek
      ? `Semana ${group.weekNumber} · ${weekDisplayTitle(planWeek)}`
      : `Semana ${group.weekNumber} · ${group.weekYear}`;
    const range = document.createElement("p");
    range.textContent = `${formatShortDate(group.startISO)} — ${formatShortDate(group.endISO)}`;
    heading.append(title, range);
    const count = document.createElement("span");
    count.className = "week-summary-count";
    count.textContent = `${group.records.length} ${group.records.length === 1 ? "sesión" : "sesiones"}`;
    summary.append(heading, count);

    const body = document.createElement("div");
    body.className = "week-body";
    const reportActions = document.createElement("div");
    reportActions.className = "week-report-actions";
    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "copy-week-button";
    copyButton.textContent = "Copiar informe para el entrenador";
    copyButton.addEventListener("click", () => copyWeeklyReport(group));
    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "download-week-button";
    downloadButton.textContent = "↓";
    downloadButton.setAttribute("aria-label", `Descargar informe de la semana ${group.weekNumber}`);
    downloadButton.addEventListener("click", () => downloadWeeklyReport(group));
    reportActions.append(copyButton, downloadButton);
    body.append(reportActions);

    for (const dateISO of weekDays(group.startISO)) {
      const dayRecords = group.records.filter(record => record.dateISO === dateISO);
      if (!dayRecords.length) continue;
      const dayBlock = document.createElement("section");
      dayBlock.className = "history-day";
      const dayHeading = document.createElement("div");
      dayHeading.className = "history-day-heading";
      dayHeading.textContent = `${dayNamesFull[dayIndexFromISO(dateISO)]} · ${formatShortDate(dateISO)}`;
      dayBlock.append(dayHeading);
      dayRecords.forEach(record => dayBlock.append(createHistoryEntry(record)));
      body.append(dayBlock);
    }
    details.append(summary, body);
    container.append(details);
  });
}

function createHistoryEntry(sourceRecord) {
  const record = normalizeRecord(sourceRecord);
  const entry = document.createElement("article");
  entry.className = "history-entry";
  const top = document.createElement("div");
  top.className = "history-entry-top";
  const copy = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = recordTitle(record);
  const details = document.createElement("p");
  details.textContent = recordDetails(record);
  copy.append(title, details);
  if (record.plannedTitle) {
    const planned = document.createElement("p");
    planned.className = "history-plan-link";
    planned.textContent = `Plan del entrenador · ${record.plannedTitle}`;
    copy.append(planned);
  }
  if (record.sensations) {
    const sensations = document.createElement("p");
    sensations.textContent = record.sensations;
    copy.append(sensations);
  }
  if (record.category === "physical" && record.routinePlannedSets !== "") {
    const balance = document.createElement("div");
    balance.className = "history-routine-balance";
    [
      ["Series", `${record.routineCompletedSets}/${record.routinePlannedSets}`],
      ["Ejercicios", `${record.routineStartedExercises}/${record.routineTotalExercises}`],
      ["Reps", String(record.routineTotalReps || 0)],
      ["Volumen", `${Number(record.routineVolumeKg || 0).toLocaleString("es-CL")} kg`],
      ["Abdominales", record.routineAbsCount === "" ? "—" : String(record.routineAbsCount)],
      ["Esfuerzo", record.routineEffort === "" ? "—" : `${record.routineEffort}/10`],
      ["Dolor", record.routinePain === "" ? "—" : `${record.routinePain}/10`]
    ].forEach(([label, value]) => balance.append(balanceMetric(label, value)));
    copy.append(balance);
    if (record.routinePainDetail) {
      const painDetail = document.createElement("p");
      painDetail.className = "history-pain-detail";
      painDetail.textContent = `Molestia: ${record.routinePainDetail}`;
      copy.append(painDetail);
    }
    if (record.routineSummary) {
      const automaticSummary = document.createElement("p");
      automaticSummary.className = "history-auto-summary";
      automaticSummary.textContent = record.routineSummary;
      copy.append(automaticSummary);
    }
  }
  if (record.category === "physical" && record.routinePlannedSets === "" && record.routineSummary) {
    const notes = document.createElement("p");
    notes.className = "history-auto-summary";
    notes.textContent = `Ejercicios y cargas realizados: ${record.routineSummary}`;
    copy.append(notes);
  }
  const aiCard = createRoutineAiCard(record, { compact: true });
  if (record.category === "physical" && record.routineExercises.length) {
    const exerciseDisclosure = document.createElement("details");
    exerciseDisclosure.className = "history-exercise-details";
    const exerciseSummary = document.createElement("summary");
    exerciseSummary.textContent = "Ver ejercicios, cargas y repeticiones";
    const exerciseList = document.createElement("ol");
    record.routineExercises.forEach(exercise => {
      const item = document.createElement("li");
      const name = document.createElement("strong");
      name.textContent = exercise.name;
      const performed = document.createElement("span");
      performed.textContent = routineExerciseLine(exercise);
      item.append(name, performed);
      exerciseList.append(item);
    });
    exerciseDisclosure.append(exerciseSummary, exerciseList);
    copy.append(exerciseDisclosure);
  }
  const actions = document.createElement("div");
  actions.className = "entry-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.textContent = "Editar";
  edit.addEventListener("click", () => editRecord(record.id));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete";
  remove.textContent = "Borrar";
  remove.addEventListener("click", () => deleteRecord(record.id));
  actions.append(edit, remove);
  top.append(copy, actions);
  entry.append(top, aiCard);
  return entry;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

async function copyWeeklyReport(group) {
  await copyText(weeklyReport(repository.list(), group));
  showToast(`Informe de la semana ${group.weekNumber} copiado.`);
}

function downloadText(filename, content, type = "text/plain;charset=utf-8") {
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

function downloadWeeklyReport(group) {
  downloadText(`tgtrain-semana-${group.weekNumber}-${group.weekYear}.txt`, weeklyReport(repository.list(), group));
  showToast("Informe semanal descargado.");
}

function exportJSON() {
  downloadText(`tgtrain-respaldo-${getChileDateISO()}.json`, repository.backup(), "application/json;charset=utf-8");
  showToast("Respaldo JSON descargado.");
}

function exportCSV() {
  downloadText(`tgtrain-entrenamientos-${getChileDateISO()}.csv`, recordsToCSV(repository.list()), "text/csv;charset=utf-8");
  showToast("Historial CSV descargado.");
}

async function importJSON(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) return showToast("El respaldo supera el máximo de 5 MB.");
  try {
    const content = await file.text();
    if (!window.confirm("El respaldo se combinará con tus registros actuales. ¿Continuar?")) return;
    const count = repository.importMerge(content);
    renderHome();
    renderHistory();
    showToast(`${count} registro(s) importado(s).`);
  } catch (error) {
    showToast(error.message);
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3500);
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
    showToast("La app funciona, pero el modo sin conexión no está disponible.");
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.viewTarget;
    if (target === "register") openRegistrationOrActiveRoutine();
    else showView(target);
  }));
  $("startPlannedActivityButton").addEventListener("click", () => {
    const block = activeTrainingBlock();
    const session = coachSessionForDate(getChileDateISO(), block);
    const actual = session && planRecordForSession(session, repository.list(), block);
    if (!loadPlannedActivity() && actual?.routineAiAnalysis?.planComparison?.status === "completed") return showView("history");
    openTodayPlannedActivity();
  });
  $("heroWeekTheme").addEventListener("click", openCoachPlanDialog);
  $("plannedActivityDialogClose").addEventListener("click", () => $("plannedActivityDialog").close());
  $("plannedActivityDialog").addEventListener("close", () => {
    if (plannedActivityTicker) clearInterval(plannedActivityTicker);
    plannedActivityTicker = null;
  });
  $("finishPlannedActivityButton").addEventListener("click", finishGenericPlannedActivity);
  $("plannedActivityFullPlanButton").addEventListener("click", () => {
    $("plannedActivityDialog").close();
    openCoachPlanDialog();
  });
  $("openAiPlanButton").addEventListener("click", openAiPlanDialog);
  $("coachPlanDialogClose").addEventListener("click", () => $("coachPlanDialog").close());
  $("aiPlanDialogClose").addEventListener("click", () => $("aiPlanDialog").close());
  $("analyzeAiPlanButton").addEventListener("click", analyzeAiPlan);
  $("editAiPlanButton").addEventListener("click", showAiPlanInput);
  $("saveAiPlanButton").addEventListener("click", saveAiPlan);
  $("registrationBackButton").addEventListener("click", () => {
    if (editingRecordId && !window.confirm("¿Cancelar la edición del entrenamiento?")) return;
    resetRegistration();
  });
  $("trainingForm").addEventListener("submit", saveTraining);
  $("recordDate").addEventListener("change", updateFormWeekBadge);
  $("sensations").addEventListener("input", syncSensationSuggestions);
  $("cancelEditButton").addEventListener("click", resetRegistration);
  $("exportJsonButton").addEventListener("click", exportJSON);
  $("exportCsvButton").addEventListener("click", exportCSV);
  $("importJsonButton").addEventListener("click", () => $("backupFileInput").click());
  $("backupFileInput").addEventListener("change", importJSON);
  $("updateButton").addEventListener("click", () => waitingServiceWorker?.postMessage({ type: "SKIP_WAITING" }));
  $("cloudStatusButton").addEventListener("click", openCloudDialog);
  $("cloudDialogClose").addEventListener("click", () => $("cloudDialog").close());
  $("openCoachProfileButton").addEventListener("click", openCoachProfileDialog);
  $("coachProfileDialogClose").addEventListener("click", () => $("coachProfileDialog").close());
  $("coachProfileForm").addEventListener("submit", saveCoachProfile);
  $("cloudSignInButton").addEventListener("click", signInToCloud);
  $("cloudSyncButton").addEventListener("click", syncCloudNow);
  $("cloudSignOutButton").addEventListener("click", async () => {
    try { await cloudSync.signOut(); } catch { showToast("No fue posible cerrar la sesión."); }
  });
  $("timerStartButton").addEventListener("click", startTimer);
  $("timerPauseButton").addEventListener("click", pauseTimer);
  $("timerResetButton").addEventListener("click", () => resetTimer(true));
}

function initialize() {
  renderCategoryChooser();
  resetRegistration();
  initializeTimer();
  bindEvents();
  renderHome();
  renderRoutines();
  renderHistory();
  updateCoachProfileButton();
  const activeSession = loadRoutineSession();
  if (activeSession?.status === "active") {
    openRoutineId = activeSession.routineId;
    showView("routines");
    scrollToRoutineProgress(activeSession.routineId);
  } else {
    const planned = loadPlannedRoutineContext();
    if (planned) {
      openRoutineId = planned.routineId;
      showView("routines");
      scrollToRoutine(planned.routineId);
    }
  }
  cloudSync.initialize();
  registerServiceWorker();
}

initialize();
