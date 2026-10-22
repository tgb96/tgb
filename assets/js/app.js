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
} from "./data.js?v=70";
import {
  coachOption,
  coachBaseTrainingBlock,
  coachSessionForDate,
  coachTrainingBlock,
  coachWeekForDate,
  withCoachPlanAdjustments,
  withMatchCalendar,
  withWeeklyCadenceForDate
} from "./coach-plan.js?v=99";
import { createRepository } from "./storage.js?v=104";
import { createCloudSync } from "./cloud.js?v=76";
import { createNutritionUI } from "./nutrition-ui.js?v=103";
import { nutritionDayTotals, nutritionPlanForDate, plannedNutritionContext } from "./nutrition.js?v=95";
import { nutritionEntryWithEstimate } from "./nutrition-presets.js?v=98";
import { createGuidedUI } from "./guided-ui.js?v=99";
import { COACH_EQUIPMENT_OPTIONS, COACH_PROFILE_VERSION, DEFAULT_COACH_EQUIPMENT, createAiClient } from "./ai.js?v=102";
import { newestTrainingBlock, normalizeTrainingBlock, summarizeTrainingBlock, weekDisplayTitle } from "./training-plan.js?v=99";
import { syncOpenTennisMatches } from "./open-tennis-sync.js?v=100";
import { dailyBrief, rollingFourWeekSummary } from "./daily-insights.js?v=96";
import { recoveryContextsFromQuestions, strongestRecoveryImpact } from "./recovery-context.js?v=100";
import { analysisMatchesCurrentPlan, canQuickRegisterRest, comparableActivity, dayActivitySummary, dayPlanOverview, isComplementaryActivity, isMainDayRecord, plannedContextForRecord, planAssessment, planNeedsSeparateLine, recordWorkflowState } from "./coach-tracking.js?v=76";
import { activityTiming, durationModeFor } from "./training-metrics.js?v=63";
import { buildProgressionEvidence, fallbackProgressionChanges, sanitizeProgressionChanges } from "./progression.js?v=3";
import { normalizeWearableSnapshot, wearableCandidates, wearableComparison, wearableInbox, wearableSummaryText } from "./wearable-link.js?v=70";
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
  routineComparison,
  trekkingBestTimes,
  validateRecord,
  weekDays,
  weeklyEvolution,
  weeklyReport
} from "./utils.js?v=73";

const $ = id => document.getElementById(id);
const repository = createRepository(window.localStorage);
const aiClient = createAiClient();
let wearableData = { days: [], sessions: [], status: null };
const cloudSync = createCloudSync({
  repository,
  storage: window.localStorage,
  onStatus: updateCloudStatus,
  onWearableChanged: data => {
    wearableData = data;
    renderWearable();
    renderWearableSyncStatus();
    renderHistory();
    nutritionUI.render();
    if (loadRoutineSession()?.status === "complete") renderRoutines();
  },
  onDataChanged: () => {
    renderHome();
    renderHistory();
    nutritionUI.render();
    renderCoachPlanDialog();
    updateCoachProfileButton();
  }
});
const nutritionUI = createNutritionUI(repository, {
  showToast: message => showToast(message),
  getWearableData: () => wearableData,
  getTrainingSession: dateISO => coachSessionForDate(dateISO, activeTrainingBlock(dateISO)),
  getNutritionInsight: dateISO => repository.getNutritionEntry(`nutrition-analysis-${dateISO}`),
  analyzeNutritionDay: dateISO => requestNutritionAnalysis(dateISO),
  isNutritionAnalysisLoading: dateISO => nutritionAnalysisInFlight.has(dateISO),
  analyzeMealPhoto: (file, context) => aiClient.analyzeMealPhoto(file, context)
});
const guidedUI = createGuidedUI(repository, {
  showView: name => showView(name),
  showToast: message => showToast(message),
  onStateChanged: () => renderActiveSessionDock(),
  onSaved: record => {
    openHistoryRecord(record.id);
    const hasMainActivity = repository.list().some(item => item.dateISO === record.dateISO && isMainDayRecord(item));
    showToast(hasMainActivity
      ? "Complemento guardado. Tu actividad principal sigue registrada por separado."
      : "Complemento guardado. Tu actividad principal y el plan del día siguen pendientes.");
  }
});

function openHistoryRecord(recordId) {
  showView("history");
  const entry = [...document.querySelectorAll(".history-entry")].find(item => item.dataset.recordId === recordId);
  if (!entry) return;
  const week = entry.closest("details"); if (week) week.open = true;
  const choices = entry.querySelector(".wearable-link-choices"); if (choices) choices.open = true;
  requestAnimationFrame(() => entry.scrollIntoView({ behavior: "smooth", block: "center" }));
}

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
const nutritionAnalysisInFlight = new Set();
let monthlySummaryInFlight = false;
let monthlySummaryAttempted = false;
let coachQuestionInFlight = false;
let coachHistoryExpanded = false;
let wearableBridgePollToken = 0;

const ROUTINE_PROGRESS_KEY = "tgb-routine-progress-v1";
const ROUTINE_SETTINGS_KEY = "tgb-routine-settings-v1";
const ROUTINE_SESSION_KEY = "tgb-routine-session-v1";
const PLANNED_ROUTINE_CONTEXT_KEY = "tgb-planned-routine-v1";
const PLANNED_ACTIVITY_KEY = "tgb-planned-activity-v1";
const MATCH_SYNC_CHECK_KEY = "tgb-open-tennis-auto-check-v1";
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
  for (const viewName of ["Home", "Register", "Guided", "Routines", "Nutrition", "Timer", "History"]) {
    const view = $(`view${viewName}`);
    const visible = viewName.toLowerCase() === name;
    view.hidden = !visible;
    view.classList.toggle("hidden", !visible);
  }
  const activeNavTarget = ["routines", "guided"].includes(name) ? "register" : name;
  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.viewTarget === activeNavTarget;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "home") renderHome();
  if (name === "routines") renderRoutines();
  if (name === "guided") guidedUI.render();
  if (name === "history") renderHistory();
  if (name === "nutrition") nutritionUI.render();
  renderActiveSessionDock();
  window.scrollTo({ top: 0, behavior: name === "routines" ? "auto" : "smooth" });
}

function routineExerciseStates(session = loadRoutineSession()) {
  const routine = session ? physicalRoutineById(session.routineId) : null;
  if (!routine || session.status !== "active") return [];
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
  return routineExercisesForDate(routine, session.dateISO).map(exercise => {
    const sets = currentExerciseSettings(routine, exercise, settings).sets;
    const completed = Array.from({ length: sets }, (_, index) => index)
      .filter(index => progress[routineProgressKey(session.dateISO, routine.id, exercise.id, index)]).length;
    return { exercise, sets, completed };
  });
}

function activeRoutineStep(session = loadRoutineSession()) {
  const states = routineExerciseStates(session);
  if (!states.length) return null;
  const preferred = states.find(state => state.exercise.id === session.activeExerciseId && state.completed < state.sets);
  const partial = states.find(state => state.completed > 0 && state.completed < state.sets);
  const pending = states.find(state => state.completed < state.sets);
  const state = preferred || partial || pending;
  const completedSets = states.reduce((total, item) => total + item.completed, 0);
  const totalSets = states.reduce((total, item) => total + item.sets, 0);
  return { state, states, completedSets, totalSets, allExercisesComplete: !state };
}

function openActiveSession() {
  const session = loadRoutineSession();
  if (session?.status === "active") {
    openRoutineId = session.routineId;
    showView("routines");
    scrollToRoutineProgress(session.routineId);
    return;
  }
  if (guidedUI.getState()) {
    guidedUI.resumePending();
    return;
  }
  const planned = loadPlannedActivity();
  if (plannedActivityContext(planned)) openTodayPlannedActivity();
}

function renderActiveSessionDock() {
  const dock = $("activeSessionDock");
  if (!dock) return;
  const session = loadRoutineSession();
  const routine = session ? physicalRoutineById(session.routineId) : null;
  const routineActive = session?.status === "active" && routine;
  const guided = guidedUI.getState();
  const plannedState = loadPlannedActivity();
  const planned = plannedActivityContext(plannedState);
  const active = routineActive || guided || planned;
  dock.classList.toggle("hidden", !active);
  document.body.classList.toggle("has-active-session", Boolean(active));
  if (!active) return;
  if (routineActive) {
    const step = activeRoutineStep(session);
    $("activeSessionDockLabel").textContent = "Sesión activa";
    $("activeSessionDockTitle").textContent = step?.state?.exercise?.name || "Cierre y abdominales";
    $("activeSessionDockMeta").textContent = `${routine.name} · ${step?.completedSets || 0}/${step?.totalSets || 0} series · ${formatClock(routineSessionElapsedSeconds(session))}`;
    $("activeSessionDockButton").textContent = "Volver al ejercicio";
    return;
  }
  if (guided) {
    const guidedName = guided.kind === "warmup" ? "Calentamiento guiado" : "Estiramientos guiados";
    $("activeSessionDockLabel").textContent = guided.status === "review" ? "Sesión por guardar" : "Sesión guiada";
    $("activeSessionDockTitle").textContent = guidedName;
    $("activeSessionDockMeta").textContent = guided.status === "review" ? "Revisa y guarda el resultado" : `Paso ${Number(guided.index || 0) + 1}`;
    $("activeSessionDockButton").textContent = "Continuar";
    return;
  }
  const step = activeRoutineStep(session);
  $("activeSessionDockLabel").textContent = plannedState.status === "finished" ? "Actividad por guardar" : "Actividad programada";
  $("activeSessionDockTitle").textContent = planned.option.title;
  $("activeSessionDockMeta").textContent = plannedState.status === "finished" ? "Completa el registro" : "Cronómetro en curso";
  $("activeSessionDockButton").textContent = "Continuar";
}

function openRegistration() {
  clearPlannedRoutineContext({ restore: true });
  resetRegistration();
  showView("register");
}

function openQuickRestRegistration(dateISO) {
  const todayISO = getChileDateISO();
  if (!canQuickRegisterRest(dateISO, todayISO, repository.list())) {
    showToast("Este día ya tiene un registro o todavía no ha terminado.");
    return;
  }
  openRegistration();
  selectCategory("rest", { dateISO, restTypeId: "planned" });
}

function activeTrainingBlock(referenceDateISO = getChileDateISO()) {
  const saved = newestTrainingBlock(repository.listTrainingBlocks());
  const block = saved ? withMatchCalendar(saved) : coachTrainingBlock;
  const coordinated = withWeeklyCadenceForDate(block, referenceDateISO);
  return withCoachPlanAdjustments(coordinated, repository.listCoachQuestions());
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
  const dayRecords = records.filter(record => record.dateISO === session.dateISO && isMainDayRecord(record));
  const overview = dayPlanOverview(session, dayRecords);
  dayRecords.forEach(record => {
    const row = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = `${overview.label} · ${recordTitle(record)}`;
    const detail = document.createElement("small");
    detail.textContent = overview.reason;
    row.append(title, detail);
    box.append(row);
  });
  return box;
}

function attachMatchingPlan(record) {
  const block = activeTrainingBlock(record.dateISO);
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
  if (repository.list().some(record => record.dateISO === session.dateISO && isMainDayRecord(record))) {
    $("coachPlanDialog")?.close();
    $("plannedActivityDialog")?.close();
    showView("history");
    showToast("Ya hay una actividad registrada para este día. Revísala en el historial.");
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
  renderActiveSessionDock();
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
  renderActiveSessionDock();
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
  const hasActivity = records.some(record => record.dateISO === session.dateISO && isMainDayRecord(record));
  const future = session.dateISO > getChileDateISO();
  button.disabled = future;
  button.textContent = future ? `Disponible ${formatShortDate(session.dateISO)}` : hasActivity ? "Ver registro" : `Elegir ${option.title}`;
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
    const completed = week.sessions.filter(session => records.some(record => record.dateISO === session.dateISO && isMainDayRecord(record))).length;
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
      const overview = dayPlanOverview(session, records.filter(record => record.dateISO === session.dateISO && isMainDayRecord(record)));
      if (overview.status === "registered") day.classList.add("complete");
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
  const activePlan = activeTrainingBlock();
  const importedPlan = repository.listTrainingBlocks().length > 0;
  const updatedAt = Date.parse(activePlan.updatedAt || "");
  $("cloudPlanStatus").textContent = importedPlan
    ? `Plan activo en este dispositivo: ${activePlan.title}${Number.isFinite(updatedAt) ? ` · actualizado ${new Date(updatedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}` : ""}.`
    : "Plan activo: el plan incluido en TGTrain. Aún no hay una planificación importada en este dispositivo.";
  const importedMatches = activePlan.matchCalendar?.length || 0;
  const futureMatches = (activePlan.matchCalendar || []).filter(item => item.status !== "played" && item.dateISO >= getChileDateISO()).length;
  const matchSyncedAt = Date.parse(activePlan.matchCalendarSyncedAt || "");
  $("matchSyncStatus").textContent = Number.isFinite(matchSyncedAt)
    ? `${importedMatches} partidos importados · ${futureMatches} vigentes · actualizado ${new Date(matchSyncedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}.`
    : "Usando las fechas incluidas en TGTrain. Puedes importar todos los partidos públicos de Tomás Gómez.";

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
  if (status.state === "synced") queueMicrotask(maybeGenerateMonthlySummary);
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

function renderCoachEquipmentChoices() {
  const container = $("coachEquipmentChoices");
  const textarea = $("coachProfileEquipment");
  if (!container || !textarea) return;
  container.replaceChildren();
  const selectedText = textarea.value;
  COACH_EQUIPMENT_OPTIONS.forEach(option => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.value;
    input.checked = selectedText.includes(option.value);
    const copy = document.createElement("span");
    copy.textContent = option.label;
    input.addEventListener("change", () => {
      const selected = [...container.querySelectorAll('input[type="checkbox"]:checked')].map(item => item.value);
      const custom = textarea.value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
        .filter(line => !COACH_EQUIPMENT_OPTIONS.some(candidate => candidate.value === line));
      textarea.value = [...selected, ...custom].join("\n");
    });
    label.append(input, copy);
    container.append(label);
  });
}

function openCoachProfileDialog() {
  const profile = repository.getCoachProfile();
  $("coachProfileText").value = profile?.profileText || "";
  $("coachProfileEquipment").value = profile?.equipment || DEFAULT_COACH_EQUIPMENT;
  renderCoachEquipmentChoices();
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

function renderWearableSyncStatus(message = "") {
  const output = $("wearableSyncStatus");
  if (!output) return;
  if (message) {
    output.textContent = message;
    return;
  }
  const status = wearableData.status;
  if (!status?.syncedAt) {
    output.textContent = "Abre el sincronizador para buscar datos nuevos.";
    return;
  }
  const when = new Date(status.syncedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  const todayCount = Number(status.workoutsToday) || 0;
  const sleepTodayCount = Number(status.sleepSessionsToday) || 0;
  const total = Number(status.workoutsUploaded) || 0;
  const adjusted = Number(status.workoutsClockAdjusted) || 0;
  const adjustedSleep = Number(status.sleepSessionsClockAdjusted) || 0;
  const newestSleepEnd = status.newestSleepEndTime ? new Date(status.newestSleepEndTime) : null;
  const newestSleepLabel = newestSleepEnd && Number.isFinite(newestSleepEnd.getTime())
    ? ` El último sueño disponible terminó ${newestSleepEnd.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}.`
    : "";
  const clockCorrection = `${adjusted ? ` TGTrain corrigió el desfase horario de ${adjusted} entrenamiento${adjusted === 1 ? "" : "s"} de Mi Fitness.` : ""}${adjustedSleep ? ` También corrigió la hora de ${adjustedSleep} sesión${adjustedSleep === 1 ? "" : "es"} de sueño sin cambiar su duración.` : ""}`;
  const sleepStatus = sleepTodayCount > 0
    ? `Health Connect entregó el sueño de anoche (${sleepTodayCount} sesión${sleepTodayCount === 1 ? "" : "es"}).`
    : `Health Connect aún no entregó el sueño terminado hoy.${newestSleepLabel}${status.backgroundReadGranted ? " TGTrain Sync volverá a revisarlo automáticamente." : " Abre Mi Fitness y vuelve a sincronizar."}`;
  const workoutStatus = todayCount > 0
    ? `Entregó ${todayCount} entrenamiento${todayCount === 1 ? "" : "s"} de hoy (${total} en el período revisado).`
    : `Entregó 0 entrenamientos de hoy.${status.backgroundReadGranted ? " También volverá a revisarlos automáticamente." : ""}`;
  output.textContent = `Última lectura ${when}: ${sleepStatus} ${workoutStatus}${clockCorrection}`;
}

const wait = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));

async function refreshWearableAfterBridge(startedAt, knownSessionIds) {
  const token = ++wearableBridgePollToken;
  const button = $("wearableSyncButton");
  for (const delay of [0, 2000, 4000]) {
    if (delay) await wait(delay);
    if (token !== wearableBridgePollToken) return;
    try {
      renderWearableSyncStatus("Comprobando directamente en la nube si llegaron datos nuevos…");
      const fresh = await cloudSync.refreshWearableNow();
      const newSessions = (fresh.sessions || []).filter(session => session?.id && !knownSessionIds.has(session.id));
      if (newSessions.length) {
        renderWearableSyncStatus(`Llegaron ${newSessions.length} entrenamiento${newSessions.length === 1 ? "" : "s"} nuevo${newSessions.length === 1 ? "" : "s"}. Ya puedes vincular.`);
        const inbox = $("wearableSessions")?.querySelector("details.wearable-inbox");
        if (inbox) inbox.open = true;
        showToast("La sesión de la pulsera ya llegó. Revisa la coincidencia y vincúlala.");
        button.disabled = false;
        return;
      }
      const statusTime = Date.parse(fresh.status?.syncedAt || "");
      if (Number.isFinite(statusTime) && statusTime >= startedAt - 5000) {
        renderWearableSyncStatus();
        showToast(Number(fresh.status?.sleepSessionsToday) > 0
          ? "El sueño de anoche ya llegó a TGTrain."
          : Number(fresh.status?.workoutsToday) > 0
            ? "El puente encontró el entrenamiento, pero Health Connect todavía no entregó el sueño de anoche."
          : fresh.status?.backgroundReadGranted
            ? "El puente respondió, pero Health Connect todavía no entregó los datos de hoy. TGTrain Sync volverá a revisar a los 2, 8 y 20 minutos."
            : "El puente respondió, pero Health Connect todavía no entregó los datos de hoy.");
        button.disabled = false;
        return;
      }
    } catch (error) {
      if (delay === 4000) renderWearableSyncStatus(error.message || "No se pudo comprobar la nube de la pulsera.");
    }
  }
  renderWearableSyncStatus("TGTrain Sync no confirmó una lectura nueva. Ábrelo, comprueba que use el mismo Gmail y revisa el resultado bajo Sincronizar ahora.");
  button.disabled = false;
}

function requestWearableBridgeSync() {
  const button = $("wearableSyncButton");
  if (!button) return;
  if (!/Android/i.test(navigator.userAgent)) {
    renderWearableSyncStatus("Abre TGTrain desde tu Android para lanzar TGTrain Sync y leer Health Connect.");
    showToast("La sincronización de la pulsera se inicia desde TGTrain Sync en Android.");
    return;
  }
  if (!cloudSync.currentUser) {
    renderWearableSyncStatus("Inicia sesión con Google en TGTrain antes de abrir el sincronizador.");
    showToast("Primero inicia sesión con Google en TGTrain.");
    return;
  }
  const startedAt = Date.now();
  const knownSessionIds = new Set((wearableData.sessions || []).map(session => session?.id).filter(Boolean));
  button.disabled = true;
  renderWearableSyncStatus("Abriendo TGTrain Sync… al volver comprobaré la nube automáticamente.");
  let returned = false;
  const restore = () => {
    if (returned || document.visibilityState !== "visible") return;
    returned = true;
    document.removeEventListener("visibilitychange", restore);
    refreshWearableAfterBridge(startedAt, knownSessionIds);
  };
  document.addEventListener("visibilitychange", restore);
  window.location.href = "tgtrain://sync";
  window.setTimeout(restore, 2200);
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
  if (guidedUI.resumePending()) return;
  openRegistration();
}

function isWeatherPlanAdjustment(item) {
  const text = [item?.question, item?.answer, item?.planAdjustment?.title, item?.planAdjustment?.reason]
    .filter(Boolean).join(" ").toLocaleLowerCase("es");
  return /lluv|clima|cancha.*(?:cerr|mojad|indispon)|mal tiempo/.test(text);
}

function coachEquipmentSummary() {
  const equipment = String(repository.getCoachProfile()?.equipment || DEFAULT_COACH_EQUIPMENT);
  const selected = COACH_EQUIPMENT_OPTIONS.filter(option => equipment.includes(option.value)).map(option => option.label);
  return selected.length ? selected.join(" · ") : "Revisa tus implementos disponibles antes de pedir otra alternativa.";
}

function recoveryContextDescription(context) {
  const amount = { low: "poco alcohol", moderate: "consumo moderado", high: "consumo alto", unknown: "cantidad no precisada" }[context?.alcoholAmount] || "cantidad no precisada";
  const timing = context?.endTime ? `Terminó ${formatShortDate(context.endDateISO)} a las ${context.endTime}.` : `Terminó ${formatShortDate(context?.endDateISO)}.`;
  return `${amount[0].toUpperCase()}${amount.slice(1)} · ${timing} Se considerará durante ${context?.recoveryHours || 24} horas.`;
}

function requestCoveredPlanAlternative(item) {
  if (coachQuestionInFlight) return;
  const adjustment = item.planAdjustment;
  const input = $("coachQuestionText");
  input.value = `Para el ${adjustment.targetDateISO}, en vez de descanso por lluvia, proponme una sesión suave bajo techo. Usa solamente mis implementos disponibles, considera lo que entrené el día anterior y el próximo partido, y evita repetir grupos musculares o acumular fatiga innecesaria.`;
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  submitCoachQuestion();
}

function appendWeatherAdjustmentActions(proposal, item) {
  if (!isWeatherPlanAdjustment(item)) return;
  const context = document.createElement("small");
  context.className = "coach-equipment-context";
  context.textContent = `Para una alternativa cubierta, la guía considerará: ${coachEquipmentSummary()}`;
  const actions = document.createElement("div");
  actions.className = "coach-equipment-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "secondary";
  edit.textContent = "Revisar implementos";
  edit.addEventListener("click", openCoachProfileDialog);
  actions.append(edit);
  if (item.planAdjustment?.category === "rest") {
    const alternative = document.createElement("button");
    alternative.type = "button";
    alternative.textContent = "Proponer opción cubierta";
    alternative.addEventListener("click", () => requestCoveredPlanAlternative(item));
    actions.append(alternative);
  }
  proposal.append(context, actions);
}

function renderCoachQuestions() {
  const history = $("coachQuestionHistory");
  history.replaceChildren();
  const allQuestions = repository.listCoachQuestions();
  const questions = (coachHistoryExpanded ? allQuestions : allQuestions.slice(0, 3)).reverse();
  const toggle = $("coachHistoryToggle");
  $("coachHistoryClear").classList.toggle("hidden", allQuestions.length === 0);
  toggle.classList.toggle("hidden", allQuestions.length <= 3);
  toggle.textContent = coachHistoryExpanded ? "Mostrar solo las 3 más recientes" : `Ver todas las preguntas (${allQuestions.length})`;
  if (!questions.length) {
    const hint = document.createElement("p");
    hint.className = "coach-question-hint";
    hint.textContent = "Puedes preguntar sobre tu último entrenamiento, el plan de hoy o cómo adaptar una sesión según tus sensaciones.";
    history.append(hint);
    return;
  }
  questions.forEach(item => {
    const exchange = document.createElement("article");
    exchange.className = "coach-exchange";
    const question = document.createElement("p");
    question.className = "coach-exchange-question";
    question.textContent = item.question;
    const answer = document.createElement("p");
    answer.className = "coach-exchange-answer";
    answer.textContent = item.answer || "Sin respuesta todavía. Pulsa Reintentar cuando tengas conexión.";
    exchange.append(question, answer);
    if (item.recoveryContext) {
      const recovery = document.createElement("div");
      recovery.className = "coach-plan-proposal recovery-context";
      const heading = document.createElement("strong");
      heading.textContent = "Contexto de recuperación guardado";
      const detail = document.createElement("span");
      detail.textContent = recoveryContextDescription(item.recoveryContext);
      const note = document.createElement("small");
      note.textContent = "Influirá en la recomendación diaria y en las evaluaciones, pero no cambiará el calendario sin tu confirmación.";
      recovery.append(heading, detail, note);
      exchange.append(recovery);
    }
    if (item.recordAdjustment) {
      const proposal = document.createElement("div");
      proposal.className = `coach-plan-proposal coach-record-proposal ${item.recordAdjustmentStatus || "pending"}`;
      const heading = document.createElement("strong");
      heading.textContent = item.recordAdjustmentStatus === "applied" ? "Corrección aplicada"
        : item.recordAdjustmentStatus === "reverted" ? "Corrección deshecha"
          : item.recordAdjustmentStatus === "dismissed" ? "Corrección descartada" : "Corrección para confirmar";
      const title = document.createElement("span");
      title.textContent = `${formatShortDate(item.recordAdjustment.targetDateISO)} · ${item.recordAdjustment.title}`;
      const reason = document.createElement("small");
      reason.textContent = item.recordAdjustment.reason;
      proposal.append(heading, title, reason);
      if ((item.recordAdjustmentStatus || "pending") === "pending") {
        const actions = document.createElement("div");
        const apply = document.createElement("button");
        apply.type = "button"; apply.textContent = "Aplicar corrección";
        apply.addEventListener("click", () => applyCoachRecordAdjustment(item));
        const dismiss = document.createElement("button");
        dismiss.type = "button"; dismiss.className = "secondary"; dismiss.textContent = "Descartar";
        dismiss.addEventListener("click", () => {
          repository.saveCoachQuestion({ ...item, recordAdjustmentStatus: "dismissed", updatedAt: new Date().toISOString() });
          renderCoachQuestions();
        });
        actions.append(apply, dismiss); proposal.append(actions);
      } else if (item.recordAdjustmentStatus === "applied") {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "secondary";
        undo.textContent = "Deshacer corrección";
        undo.addEventListener("click", () => revertCoachRecordAdjustment(item));
        proposal.append(undo);
      }
      exchange.append(proposal);
    }
    if (item.planAdjustment) {
      const proposal = document.createElement("div");
      proposal.className = `coach-plan-proposal ${item.adjustmentStatus || "pending"}`;
      const heading = document.createElement("strong");
      heading.textContent = item.adjustmentStatus === "applied" ? "Ajuste aplicado" : item.adjustmentStatus === "reverted" ? "Ajuste deshecho" : item.adjustmentStatus === "dismissed" ? "Propuesta descartada" : "Propuesta para confirmar";
      const title = document.createElement("span");
      title.textContent = `${formatShortDate(item.planAdjustment.targetDateISO)} · ${item.planAdjustment.title}`;
      const reason = document.createElement("small");
      reason.textContent = [item.planAdjustment.reason, item.planAdjustment.nutritionReason].filter(Boolean).join(" Alimentación: ");
      proposal.append(heading, title, reason);
      if ((item.adjustmentStatus || "pending") === "pending") {
        const actions = document.createElement("div");
        const apply = document.createElement("button");
        apply.type = "button"; apply.textContent = "Revisar y aplicar";
        apply.addEventListener("click", () => applyCoachPlanAdjustment(item));
        const dismiss = document.createElement("button");
        dismiss.type = "button"; dismiss.className = "secondary"; dismiss.textContent = "Descartar";
        dismiss.addEventListener("click", () => {
          repository.saveCoachQuestion({ ...item, adjustmentStatus: "dismissed", updatedAt: new Date().toISOString() });
          renderCoachQuestions();
        });
        actions.append(apply, dismiss); proposal.append(actions);
      } else if (item.adjustmentStatus === "applied") {
        const undo = document.createElement("button");
        undo.type = "button";
        undo.className = "secondary";
        undo.textContent = "Deshacer ajuste";
        undo.addEventListener("click", () => revertCoachPlanAdjustment(item));
        proposal.append(undo);
      }
      appendWeatherAdjustmentActions(proposal, item);
      exchange.append(proposal);
    }
    if (!item.answer) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "Reintentar";
      retry.disabled = coachQuestionInFlight;
      retry.addEventListener("click", () => submitCoachQuestion(item));
      exchange.append(retry);
    }
    history.append(exchange);
  });
}

async function syncMatchCalendar(options = {}) {
  const silent = options?.silent === true;
  const importAll = options?.all === true;
  const button = $("syncMatchesButton");
  const originalText = button.textContent;
  button.disabled = true;
  if (!silent) button.textContent = "Consultando Open Tennis…";
  try {
    const result = await syncOpenTennisMatches({
      playerName: "Tomás Gómez",
      todayISO: getChileDateISO(),
      includePast: importAll,
      includePlayed: importAll
    });
    const sourceBlock = newestTrainingBlock(repository.listTrainingBlocks()) || coachBaseTrainingBlock;
    repository.saveTrainingBlock({
      ...sourceBlock,
      matchCalendar: result.matches,
      matchCalendarSource: result.source,
      matchCalendarSyncedAt: result.syncedAt,
      updatedAt: result.syncedAt
    });
    renderHome();
    renderCoachPlanDialog();
    updateCloudStatus(currentCloudStatus);
    window.localStorage.setItem(MATCH_SYNC_CHECK_KEY, result.syncedAt);
    const pending = result.matches.filter(item => item.status !== "scheduled").length;
    if (!silent) showToast(`${result.matches.length} partidos importados${pending ? `; ${pending} todavía no confirmado${pending === 1 ? "" : "s"}` : ""}.`);
  } catch (error) {
    if (!silent) showToast(error?.message || "No fue posible actualizar los partidos.");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

function maybeSyncMatchCalendar() {
  const lastCheck = Date.parse(window.localStorage.getItem(MATCH_SYNC_CHECK_KEY) || "");
  if (Number.isFinite(lastCheck) && Date.now() - lastCheck < 24 * 60 * 60 * 1000) return;
  window.localStorage.setItem(MATCH_SYNC_CHECK_KEY, new Date().toISOString());
  syncMatchCalendar({ silent: true });
}

function wearableDayForCoach(day) {
  if (!day) return null;
  return {
    dateISO: day.dateISO,
    steps: Number(day.steps) || 0,
    sleepMinutes: Number(day.sleepMinutes) || null,
    sleepStagesMinutes: day.sleepStagesMinutes || null,
    sleepHeartRateAvgBpm: Number(day.sleepHeartRateAvgBpm) || null,
    sleepHeartRateMinBpm: Number(day.sleepHeartRateMinBpm) || null,
    sleepOxygenAvgPercent: Number(day.sleepOxygenAvgPercent) || null,
    sleepOxygenMinPercent: Number(day.sleepOxygenMinPercent) || null,
    sleepOriginPackage: day.sleepOriginPackage || ""
  };
}

function nutritionDayForCoach(dateISO, block = activeTrainingBlock(dateISO)) {
  const entries = repository.listNutritionEntries(dateISO).filter(item => !item.deleted);
  const meals = entries.filter(item => item.kind === "meal").map(nutritionEntryWithEstimate);
  const totals = nutritionDayTotals(entries.filter(item => item.kind !== "plan").map(nutritionEntryWithEstimate));
  const override = entries.find(item => item.kind === "plan")?.planMode || "default";
  const planned = plannedNutritionContext(coachSessionForDate(dateISO, block));
  const mode = override === "default" && planned?.mode ? planned.mode : override;
  const target = nutritionPlanForDate(dateISO, mode);
  return {
    dateISO, mode, plannedActivity: planned,
    totals,
    target: target ? { caloriesMinKcal: target.caloriesMinKcal, caloriesMaxKcal: target.caloriesMaxKcal, proteinMinG: 110, proteinMaxG: 125, waterMinMl: target.waterMinMl, waterMaxMl: target.waterMaxMl } : null,
    meals: meals.map(item => ({ time: item.time, slotId: item.slotId, summary: item.text, caloriesKcal: item.caloriesKcal, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG })).slice(0, 12)
  };
}

function newestTimestamp(items = []) {
  return items.map(item => String(item?.updatedAt || item?.syncedAt || item?.createdAt || ""))
    .filter(Boolean).sort().at(-1) || "";
}

function coachInsightPayload(result, base) {
  const insight = result?.insight || result || {};
  return {
    ...base,
    title: String(insight.title || base.title || "Comentario del entrenador").trim(),
    summary: String(insight.summary || "").trim(),
    sections: Array.isArray(insight.sections) ? insight.sections : [],
    encouragement: String(insight.encouragement || "").trim(),
    model: String(result?.model || ""),
    generatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function requestNutritionAnalysis(dateISO) {
  if (nutritionAnalysisInFlight.has(dateISO)) return;
  if (!cloudSync.currentUser) {
    openCloudDialog();
    showToast("Inicia sesión con Google para recibir el comentario nutricional.");
    return;
  }
  const profile = repository.getCoachProfile();
  if (!profile?.profileText) {
    openCoachProfileDialog();
    showToast("Configura primero el perfil privado de tu entrenador IA.");
    return;
  }
  const allSourceEntries = repository.listNutritionEntries(dateISO)
    .filter(item => ["meal", "water", "plan"].includes(item.kind));
  const sourceEntries = allSourceEntries.filter(item => !item.deleted);
  const activities = repository.list().filter(item => item.dateISO === dateISO);
  if (!sourceEntries.some(item => item.kind === "meal")) {
    showToast("Registra al menos una comida antes de pedir el comentario nutricional.");
    return;
  }
  nutritionAnalysisInFlight.add(dateISO);
  nutritionUI.render();
  try {
    const dayData = wearableData.days.find(day => day.dateISO === dateISO);
    const result = await aiClient.analyzeNutritionDay({
      dateISO,
      privateCoachProfile: String(profile.profileText || "").slice(0, 14000),
      nutrition: nutritionDayForCoach(dateISO),
      activities: activities.map(record => routineForAi(record)).slice(0, 8),
      wearable: dayData ? wearableDayForCoach(dayData) : null,
      recoveryContext: strongestRecoveryImpact(recoveryContextsFromQuestions(repository.listCoachQuestions()), dateISO),
      previousDays: [2, 1].map(offset => nutritionDayForCoach(addDaysISO(dateISO, -offset)))
    });
    const previous = repository.getNutritionEntry(`nutrition-analysis-${dateISO}`);
    repository.saveNutritionEntry(coachInsightPayload(result, {
      id: `nutrition-analysis-${dateISO}`,
      dateISO,
      kind: "nutrition-analysis",
      title: "Comentario nutricional del día",
      sourceUpdatedAt: newestTimestamp([...allSourceEntries, ...activities]),
      stats: nutritionDayForCoach(dateISO).totals,
      createdAt: previous?.createdAt || new Date().toISOString()
    }));
    renderHistory();
    showToast("Comentario nutricional guardado en el historial.");
  } catch (error) {
    showToast(error.message || "No se pudo generar el comentario nutricional.");
  } finally {
    nutritionAnalysisInFlight.delete(dateISO);
    nutritionUI.render();
  }
}

function previousMonthPeriod(todayISO = getChileDateISO()) {
  const [year, month] = todayISO.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, 0));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { startISO: start.toISOString().slice(0, 10), endISO: end.toISOString().slice(0, 10), key: start.toISOString().slice(0, 7) };
}

function monthlyCoachContext(startISO, endISO) {
  const records = repository.list().filter(item => item.dateISO >= startISO && item.dateISO <= endISO);
  const main = records.filter(isMainDayRecord);
  const nutritionEntries = repository.listNutritionEntries().filter(item => !item.deleted && item.dateISO >= startISO && item.dateISO <= endISO);
  const meals = nutritionEntries.filter(item => item.kind === "meal").map(nutritionEntryWithEstimate);
  const waters = nutritionEntries.filter(item => item.kind === "water");
  const nutritionDays = [...new Set(meals.map(item => item.dateISO))];
  const calorieKnown = meals.filter(item => item.caloriesKcal !== null);
  const proteinKnown = meals.filter(item => item.proteinG !== null);
  const wearableDays = wearableData.days.filter(item => item.dateISO >= startISO && item.dateISO <= endISO);
  const sleepDays = wearableDays.filter(item => Number(item.sleepMinutes) > 0);
  const stepDays = wearableDays.filter(item => Number.isFinite(Number(item.steps)));
  const sum = (items, getter) => items.reduce((total, item) => total + (Number(getter(item)) || 0), 0);
  const stats = {
    sessions: main.length,
    activeDays: new Set(main.filter(item => item.category !== "rest").map(item => item.dateISO)).size,
    minutes: Math.round(sum(main, item => activityTiming(item).durationSeconds) / 60),
    trainingCaloriesKcal: Math.round(sum(main, item => item.calories)),
    physicalVolumeKg: Math.round(sum(main, item => item.routineVolumeKg)),
    tennisSessions: main.filter(item => item.category === "tennis").length,
    cardioSessions: main.filter(item => item.category === "cardio").length,
    physicalSessions: main.filter(item => item.category === "physical").length,
    restDays: main.filter(item => item.category === "rest").length,
    mealRecords: meals.length,
    nutritionDays: nutritionDays.length,
    caloriesKnownMeals: calorieKnown.length,
    averageCaloriesKcal: nutritionDays.length ? Math.round(sum(calorieKnown, item => item.caloriesKcal) / nutritionDays.length) : 0,
    proteinKnownMeals: proteinKnown.length,
    averageProteinG: nutritionDays.length ? Math.round(sum(proteinKnown, item => item.proteinG) / nutritionDays.length) : 0,
    averageWaterMl: nutritionDays.length ? Math.round(sum(waters, item => item.amountMl) / nutritionDays.length) : 0,
    averageSleepMinutes: sleepDays.length ? Math.round(sum(sleepDays, item => item.sleepMinutes) / sleepDays.length) : 0,
    sleepDays: sleepDays.length,
    averageSteps: stepDays.length ? Math.round(sum(stepDays, item => item.steps) / stepDays.length) : 0,
    stepDays: stepDays.length
  };
  return {
    periodStartISO: startISO,
    periodEndISO: endISO,
    stats,
    activities: main.slice().reverse().slice(0, 80).map(item => ({
      dateISO: item.dateISO, title: recordTitle(item), category: item.category,
      durationMinutes: Math.round(activityTiming(item).durationSeconds / 60), calories: item.calories,
      volumeKg: item.routineVolumeKg, abdominalCount: item.routineAbsCount,
      effort: item.routineEffort, pain: item.routinePain, sensations: item.sensations,
      wearable: item.wearableSnapshot ? wearableSummaryText(item.wearableSnapshot) : ""
    })),
    nutritionDays: nutritionDays.map(dateISO => nutritionDayForCoach(dateISO)).slice(0, 31),
    wearableDays: wearableDays.map(wearableDayForCoach).slice(0, 31)
  };
}

async function maybeGenerateMonthlySummary() {
  const todayISO = getChileDateISO();
  if (monthlySummaryAttempted || monthlySummaryInFlight || Number(todayISO.slice(8, 10)) > 5) return;
  if (!cloudSync.currentUser || !repository.getCoachProfile()?.profileText) return;
  const period = previousMonthPeriod(todayISO);
  const id = `monthly-summary-${period.key}`;
  if (repository.getNutritionEntry(id)) return;
  monthlySummaryAttempted = true;
  monthlySummaryInFlight = true;
  try {
    const context = monthlyCoachContext(period.startISO, period.endISO);
    const result = await aiClient.analyzeMonthlySummary({
      ...context,
      privateCoachProfile: String(repository.getCoachProfile().profileText || "").slice(0, 14000)
    });
    repository.saveNutritionEntry(coachInsightPayload(result, {
      id,
      dateISO: period.endISO,
      kind: "monthly-summary",
      title: `Resumen mensual · ${period.key}`,
      periodStartISO: period.startISO,
      periodEndISO: period.endISO,
      sourceUpdatedAt: newestTimestamp([...repository.list(), ...repository.listNutritionEntries(), ...wearableData.days]),
      stats: context.stats,
      createdAt: new Date().toISOString()
    }));
    renderHistory();
    showToast("Tu resumen del mes anterior ya está disponible en Historial.");
  } catch (error) {
    showToast(error.message || "No se pudo preparar el resumen mensual.");
  } finally {
    monthlySummaryInFlight = false;
  }
}

function coachRecordAdjustmentChanges(record, adjustment) {
  const patch = {};
  const lines = [];
  if (record.category === "rest" && adjustment.restTypeId && adjustment.restTypeId !== record.restTypeId) {
    const before = restTypes.find(type => type.id === record.restTypeId)?.name || record.restTypeId || "Sin tipo";
    const after = restTypes.find(type => type.id === adjustment.restTypeId)?.name;
    if (after) {
      patch.restTypeId = adjustment.restTypeId;
      lines.push(`Tipo de descanso: ${before} → ${after}`);
    }
  }
  if (record.category === "rest" && adjustment.restDetail && adjustment.restDetail !== record.restDetail) {
    patch.restDetail = adjustment.restDetail;
    lines.push(`Motivo: ${record.restDetail || "Sin detalle"} → ${adjustment.restDetail}`);
  }
  if (adjustment.sensationsAppend) {
    const exists = String(record.sensations || "").toLocaleLowerCase("es").includes(adjustment.sensationsAppend.toLocaleLowerCase("es"));
    if (!exists) {
      patch.sensations = [record.sensations, adjustment.sensationsAppend].filter(Boolean).join(" · ");
      lines.push(`Agregar a sensaciones: ${adjustment.sensationsAppend}`);
    }
  }
  if (record.category === "physical" && adjustment.routineEffort !== "" && Number(adjustment.routineEffort) !== Number(record.routineEffort)) {
    patch.routineEffort = Number(adjustment.routineEffort);
    lines.push(`Esfuerzo: ${record.routineEffort === "" ? "Sin dato" : `${record.routineEffort}/10`} → ${patch.routineEffort}/10`);
  }
  if (record.category === "physical" && adjustment.routinePain !== "" && Number(adjustment.routinePain) !== Number(record.routinePain)) {
    patch.routinePain = Number(adjustment.routinePain);
    lines.push(`Dolor: ${record.routinePain === "" ? "Sin dato" : `${record.routinePain}/10`} → ${patch.routinePain}/10`);
  }
  if (record.category === "physical" && adjustment.routinePainDetail && adjustment.routinePainDetail !== record.routinePainDetail) {
    patch.routinePainDetail = adjustment.routinePainDetail;
    lines.push(`Detalle de molestia: ${adjustment.routinePainDetail}`);
  }
  if (record.category !== "rest" && adjustment.activityStartTime && adjustment.activityStartTime !== record.activityStartTime) {
    patch.activityStartTime = adjustment.activityStartTime;
    lines.push(`Hora de inicio: ${record.activityStartTime || "Sin dato"} → ${adjustment.activityStartTime}`);
  }
  return { patch, lines };
}

function applyCoachRecordAdjustment(item) {
  const adjustment = item.recordAdjustment;
  const record = repository.get(adjustment?.targetRecordId);
  if (!record || record.dateISO !== adjustment?.targetDateISO) {
    showToast("Ese registro ya no está disponible. Pídele una nueva corrección a la guía.");
    return;
  }
  if (adjustment.expectedUpdatedAt && record.updatedAt !== adjustment.expectedUpdatedAt) {
    showToast("El registro cambió desde esa respuesta. Vuelve a explicarle la corrección para no sobrescribir datos nuevos.");
    return;
  }
  const change = coachRecordAdjustmentChanges(record, adjustment);
  if (!change.lines.length) {
    showToast("La propuesta no contiene cambios aplicables a ese registro.");
    return;
  }
  const preview = [`Registro: ${formatShortDate(record.dateISO)} · ${recordTitle(record)}`, ...change.lines].join("\n");
  if (!window.confirm(`Revisa la corrección antes de aplicarla:\n\n${preview}\n\nEl historial y la lectura del plan usarán estos datos. Podrás deshacerla.`)) return;
  const timestamp = new Date().toISOString();
  const original = {
    restTypeId: record.restTypeId,
    restDetail: record.restDetail,
    sensations: record.sensations,
    routineEffort: record.routineEffort,
    routinePain: record.routinePain,
    routinePainDetail: record.routinePainDetail,
    activityStartTime: record.activityStartTime,
    routineAiAnalysis: record.routineAiAnalysis
  };
  try {
    repository.upsert({
      ...record,
      ...change.patch,
      routineAiAnalysis: record.routineAiAnalysis ? null : record.routineAiAnalysis,
      updatedAt: timestamp
    });
    repository.saveCoachQuestion({
      ...item,
      recordAdjustmentStatus: "applied",
      recordAdjustmentOriginal: original,
      recordAdjustmentAppliedAt: timestamp,
      recordAdjustmentRevertedAt: "",
      recordAdjustmentAppliedRecordUpdatedAt: timestamp,
      updatedAt: timestamp
    });
    renderHome();
    renderHistory();
    renderCoachQuestions();
    showToast(record.routineAiAnalysis
      ? "Registro corregido. El comentario anterior se retiró para que la próxima evaluación use los datos nuevos."
      : "Registro corregido y reflejado en el historial y la planificación.");
  } catch (error) {
    showToast(error.message || "No se pudo aplicar la corrección.");
  }
}

function revertCoachRecordAdjustment(item) {
  const adjustment = item.recordAdjustment;
  const original = item.recordAdjustmentOriginal;
  const record = repository.get(adjustment?.targetRecordId);
  if (!record || !original) return showToast("No está disponible la versión anterior del registro.");
  if (item.recordAdjustmentAppliedRecordUpdatedAt && record.updatedAt !== item.recordAdjustmentAppliedRecordUpdatedAt) {
    showToast("El registro fue editado después de la corrección. Deshazla manualmente desde Historial para no perder esos cambios.");
    return;
  }
  if (!window.confirm(`Se restaurará la versión anterior de ${recordTitle(record)} del ${formatShortDate(record.dateISO)}. ¿Continuar?`)) return;
  const timestamp = new Date().toISOString();
  try {
    repository.upsert({ ...record, ...original, updatedAt: timestamp });
    repository.saveCoachQuestion({
      ...item,
      recordAdjustmentStatus: "reverted",
      recordAdjustmentRevertedAt: timestamp,
      recordAdjustmentAppliedRecordUpdatedAt: "",
      updatedAt: timestamp
    });
    renderHome();
    renderHistory();
    renderCoachQuestions();
    showToast("Corrección deshecha. Se restauró el registro anterior.");
  } catch (error) {
    showToast(error.message || "No se pudo restaurar el registro anterior.");
  }
}

function applyCoachPlanAdjustment(item) {
  const adjustment = item.planAdjustment;
  const block = activeTrainingBlock(adjustment.targetDateISO);
  const copy = JSON.parse(JSON.stringify(block));
  const session = copy.weeks.flatMap(week => week.sessions || []).find(candidate => candidate.dateISO === adjustment.targetDateISO);
  if (!session) { showToast("Esa fecha ya no está en el plan activo. Pídele una nueva propuesta a la guía."); return; }
  const category = adjustment.category;
  const valid = category === "physical" ? physicalRoutineById(adjustment.routineId)
    : category === "cardio" ? cardioTypeById(adjustment.cardioTypeId)
      : category === "tennis" ? tennisTypeById(adjustment.tennisTypeId)
        : restTypes.some(type => type.id === adjustment.restTypeId);
  if (!valid) { showToast("La propuesta usa una actividad que TGTrain no reconoce. Vuelve a preguntarle a la guía."); return; }
  const originalOption = coachOption(session, session.primaryOptionId) || session.options?.[0];
  const previewLines = [
    `Fecha: ${formatShortDate(adjustment.targetDateISO)}`,
    `Plan actual: ${originalOption?.title || "Sin actividad principal"}`,
    `Nuevo plan: ${adjustment.title}`,
    adjustment.summary ? `Detalle: ${adjustment.summary}` : ""
  ].filter(Boolean).join("\n");
  if (!window.confirm(`Revisa el cambio antes de aplicarlo:\n\n${previewLines}\n\nTambién se coordinará la guía de alimentación de ese día. Podrás deshacer el ajuste.`)) return;
  const optionId = `coach-${adjustment.targetDateISO}-${item.id.slice(0, 12)}`;
  const option = {
    id: optionId, title: adjustment.title, category, summary: adjustment.summary,
    details: adjustment.details,
    routineId: category === "physical" ? adjustment.routineId : "",
    cardioTypeId: category === "cardio" ? adjustment.cardioTypeId : "",
    tennisTypeId: category === "tennis" ? adjustment.tennisTypeId : "",
    restTypeId: category === "rest" ? adjustment.restTypeId : "",
    exerciseSettings: category === "physical" ? adjustment.exerciseSettings : []
  };
  session.options = [...session.options.filter(candidate => candidate.id !== optionId), option];
  const originalOptionId = session.primaryOptionId;
  session.primaryOptionId = optionId;
  try {
    repository.saveTrainingBlock({ ...copy, updatedAt: new Date().toISOString() });
    const planId = `nutrition-plan-${adjustment.targetDateISO}`;
    const previous = repository.getNutritionEntry(planId);
    repository.saveNutritionEntry({
      id: planId, dateISO: adjustment.targetDateISO, kind: "plan", planMode: adjustment.nutritionMode || "default",
      createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    repository.saveCoachQuestion({ ...item, adjustmentStatus: "applied", appliedOptionId: optionId, originalOptionId, originalNutritionMode: previous?.planMode || "", appliedAt: new Date().toISOString(), revertedAt: "", updatedAt: new Date().toISOString() });
    renderHome(); renderCoachPlanDialog(); nutritionUI.render();
    showToast("Ajuste aplicado al entrenamiento y a la guía de alimentación.");
  } catch (error) {
    showToast(error.message || "No se pudo aplicar la propuesta.");
  }
}

function revertCoachPlanAdjustment(item) {
  const adjustment = item.planAdjustment;
  const block = activeTrainingBlock(adjustment?.targetDateISO);
  const copy = JSON.parse(JSON.stringify(block));
  const session = copy.weeks.flatMap(week => week.sessions || []).find(candidate => candidate.dateISO === adjustment?.targetDateISO);
  const original = session?.options?.find(option => option.id === item.originalOptionId);
  if (!session || !original) return showToast("El plan cambió y ya no se puede restaurar automáticamente esa versión.");
  if (!window.confirm(`Se restaurará ${original.title} para ${formatShortDate(adjustment.targetDateISO)}. ¿Continuar?`)) return;
  session.primaryOptionId = original.id;
  session.options = session.options.filter(option => option.id !== item.appliedOptionId);
  const timestamp = new Date().toISOString();
  try {
    repository.saveTrainingBlock({ ...copy, updatedAt: timestamp });
    const planId = `nutrition-plan-${adjustment.targetDateISO}`;
    const previous = repository.getNutritionEntry(planId);
    repository.saveNutritionEntry({
      id: planId,
      dateISO: adjustment.targetDateISO,
      kind: "plan",
      planMode: item.originalNutritionMode || "default",
      createdAt: previous?.createdAt || timestamp,
      updatedAt: timestamp
    });
    repository.saveCoachQuestion({ ...item, adjustmentStatus: "reverted", revertedAt: timestamp, updatedAt: timestamp });
    renderHome();
    renderCoachPlanDialog();
    renderCoachQuestions();
    nutritionUI.render();
    showToast("Ajuste deshecho. Se restauró el plan anterior.");
  } catch (error) {
    showToast(error.message || "No se pudo restaurar el plan anterior.");
  }
}

function coachQuestionContext() {
  const records = repository.list();
  const block = activeTrainingBlock();
  const todayISO = getChileDateISO();
  const todaySession = coachSessionForDate(todayISO, block);
  const upcomingSessions = (block.weeks || []).flatMap(week => week.sessions || [])
    .filter(session => session.dateISO >= todayISO && session.dateISO <= addDaysISO(todayISO, 7));
  const latest = records.filter(record => record.routineAiAnalysis)
    .sort((a, b) => String(b.routineAiAnalysis.generatedAt || b.updatedAt || b.createdAt || "")
      .localeCompare(String(a.routineAiAnalysis.generatedAt || a.updatedAt || a.createdAt || "")))[0];
  const recoveryContexts = recoveryContextsFromQuestions(repository.listCoachQuestions());
  return {
    todayISO,
    coachProfile: String(repository.getCoachProfile()?.profileText || "").slice(0, 14000),
    equipment: String(repository.getCoachProfile()?.equipment || DEFAULT_COACH_EQUIPMENT).slice(0, 3000),
    recentActivities: records.filter(isMainDayRecord).slice(0, 6)
      .map(record => ({ ...routineForAi(record), exercises: record.routineExercises.slice(0, 15) })),
    complementaryActivities: records.filter(isComplementaryActivity).slice(0, 6)
      .map(record => ({ ...routineForAi(record), exercises: record.routineExercises.slice(0, 15) })),
    wearableRecovery: wearableData.days.filter(day => day.dateISO >= addDaysISO(todayISO, -6))
      .map(wearableDayForCoach),
    nutrition: {
      recentDays: Array.from({ length: 7 }, (_, index) => nutritionDayForCoach(addDaysISO(todayISO, index - 6), block)),
      today: nutritionDayForCoach(todayISO, block),
      tomorrow: nutritionDayForCoach(addDaysISO(todayISO, 1), block)
    },
    recoveryContexts: recoveryContexts.slice(0, 8),
    activeRecovery: strongestRecoveryImpact(recoveryContexts, todayISO),
    latestAnalysis: latest ? {
      activity: recordTitle(latest),
      dateISO: latest.dateISO,
      analysis: latest.routineAiAnalysis
    } : null,
    currentPlan: {
      title: block.title,
      week: coachWeekForDate(todayISO, block),
      today: todaySession,
      upcomingSessions,
      rules: (block.rules || []).slice(0, 12)
    },
    previousQuestions: repository.listCoachQuestions().filter(item => item.answer).slice(0, 4).reverse()
      .map(item => ({ question: item.question, answer: item.answer }))
  };
}

async function submitCoachQuestion(existing = null) {
  if (coachQuestionInFlight) return;
  const input = $("coachQuestionText");
  const question = existing?.question || input.value.trim();
  if (!question) { input.focus(); return; }
  if (!cloudSync.currentUser) {
    $("coachQuestionStatus").textContent = "Inicia sesión con Google para preguntar a la guía.";
    openCloudDialog();
    return;
  }
  if (!repository.getCoachProfile()?.profileText) {
    $("coachQuestionStatus").textContent = "Configura primero el perfil de tu entrenador IA.";
    openCoachProfileDialog();
    return;
  }
  coachQuestionInFlight = true;
  $("coachAskButton").disabled = true;
  $("coachAskButton").textContent = "Consultando…";
  $("coachQuestionStatus").textContent = "La guía está revisando tus registros y tu plan.";
  const timestamp = new Date().toISOString();
  let saved = existing;
  try {
    const context = coachQuestionContext();
    if (!saved) saved = repository.saveCoachQuestion({
      id: crypto.randomUUID(), question, answer: "", source: "text",
      createdAt: timestamp, updatedAt: timestamp
    });
    renderCoachQuestions();
    const result = await aiClient.askCoach(question, context);
    repository.saveCoachQuestion({
      ...saved,
      answer: result.answer,
      planAdjustment: result.planAdjustment,
      adjustmentStatus: result.planAdjustment ? "pending" : "",
      recordAdjustment: result.recordAdjustment,
      recordAdjustmentStatus: result.recordAdjustment ? "pending" : "",
      recoveryContext: result.recoveryContext,
      updatedAt: new Date().toISOString()
    });
    if (result.recoveryContext) renderHome();
    if (!existing) input.value = "";
    $("coachQuestionStatus").textContent = "Respuesta guardada en este dispositivo y sincronizada con tu cuenta cuando haya conexión.";
  } catch (error) {
    $("coachQuestionStatus").textContent = error.message || "No se pudo obtener respuesta. Puedes reintentarlo.";
  } finally {
    coachQuestionInFlight = false;
    $("coachAskButton").disabled = false;
    $("coachAskButton").textContent = "Preguntar a la guía →";
    renderCoachQuestions();
  }
}

function renderDailyBriefing(todayISO, todayPlan, records) {
  const option = todayPlan ? coachOption(todayPlan, todayPlan.primaryOptionId) || todayPlan.options[0] : null;
  const block = activeTrainingBlock(todayISO);
  const upcomingMatchOffset = Array.from({ length: 3 }, (_, index) => index).find(index => {
    const session = coachSessionForDate(addDaysISO(todayISO, index), block);
    return (session?.options || []).some(item => item.category === "tennis" && item.prefill?.tennisTypeId === "match");
  });
  const brief = dailyBrief({
    dateISO: todayISO,
    planTitle: option?.title || "",
    planCategory: option?.category || "",
    matchWithinDays: upcomingMatchOffset ?? null,
    records,
    wearableDays: wearableData.days,
    nutritionEntries: repository.listNutritionEntries(),
    recoveryContexts: recoveryContextsFromQuestions(repository.listCoachQuestions())
  });
  $("dailyBriefTitle").textContent = brief.title;
  $("dailyBriefSummary").textContent = brief.summary;
  const status = $("dailyBriefStatus");
  status.textContent = brief.label;
  status.className = `daily-brief-status ${brief.tone}`;
  const signals = $("dailyBriefSignals");
  signals.replaceChildren();
  brief.signals.forEach(value => {
    const item = document.createElement("li");
    item.textContent = value;
    signals.append(item);
  });
  const active = loadRoutineSession()?.status === "active" || guidedUI.hasPending() || Boolean(plannedActivityContext(loadPlannedActivity()));
  const button = $("dailyBriefAction");
  // El banner principal y la barra de sesión ya contienen esas acciones.
  // La recomendación diaria conserva un botón solo cuando aporta un destino distinto.
  button.classList.toggle("hidden", active || (!brief.hasTodayActivity && Boolean(todayPlan)));
  button.dataset.action = active ? "active-session" : !brief.hasTodayActivity && todayPlan ? "planned" : brief.hasTodayActivity ? "history" : "register";
  button.textContent = active ? "Volver a mi sesión"
    : !brief.hasTodayActivity && todayPlan ? "Iniciar actividad de hoy"
      : brief.hasTodayActivity ? "Ver actividad de hoy" : "Registrar lo que hice";
}

function renderHome() {
  const todayISO = getChileDateISO();
  const block = activeTrainingBlock();
  const week = isoWeekInfo(todayISO);
  const allRecords = repository.list();
  const records = allRecords.filter(record => record.dateISO >= week.startISO && record.dateISO <= week.endISO);
  const todayRecords = records.filter(record => record.dateISO === todayISO);
  const activeDays = new Set(records.filter(record => isMainDayRecord(record) && record.category !== "rest").map(record => record.dateISO)).size;
  const registeredDays = new Set(records.filter(isMainDayRecord).map(record => record.dateISO)).size;
  const restDays = new Set(records.filter(record => record.category === "rest").map(record => record.dateISO)).size;
  const pendingWearable = records.filter(record => record.metricsPending && !record.wearableSessionId && record.category !== "rest").length;
  const todayMainRecords = todayRecords.filter(isMainDayRecord);
  const plannedWeek = coachWeekForDate(todayISO, block);
  const plannedState = loadPlannedActivity();
  const activePlanned = plannedActivityContext(plannedState);
  const todayPlan = activePlanned?.session || coachSessionForDate(todayISO, block);

  $("currentWeekBadge").textContent = plannedWeek
    ? weekDisplayTitle(plannedWeek)
    : `Semana ${week.weekNumber} · ${week.weekYear}`;
  $("todayStatus").textContent = dayActivitySummary(todayRecords).label;
  $("homeTitle").textContent = formatLongDate(todayISO);
  $("heroWeekTheme").textContent = "";
  $("heroWeekTheme").classList.add("hidden");
  renderHeroEvolution(allRecords);
  const plannedPanel = $("heroPlannedActivity");
  const plannedInProgress = Boolean(todayPlan && activePlanned?.session.id === todayPlan.id);
  const showPlannedPanel = Boolean(todayPlan && (plannedInProgress || !todayMainRecords.length));
  plannedPanel.classList.toggle("hidden", !showPlannedPanel);
  if (todayPlan) {
    const option = coachOption(todayPlan, todayPlan.primaryOptionId) || todayPlan.options[0];
    const overview = dayPlanOverview(todayPlan, todayMainRecords);
    const inProgress = plannedInProgress;
    $("heroPlannedLabel").textContent = inProgress ? "Actividad en curso" : todayMainRecords.length ? "Actividad de hoy" : "Plan de hoy";
    $("heroPlannedTitle").textContent = !inProgress && todayMainRecords.length ? todayMainRecords.map(recordTitle).join(" · ") : option.title;
    $("heroPlannedSummary").textContent = inProgress ? todayPlan.objective : todayMainRecords.length
      ? `${overview.reason} Plan previsto: ${option.title}.`
      : todayPlan.objective || option.summary;
    $("startPlannedActivityButton").textContent = inProgress
      ? plannedState.status === "active" ? "Continuar actividad en curso" : "Completar registro programado"
      : todayMainRecords.length ? "Ver registro en historial"
        : "Iniciar actividad programada";
  }
  renderDailyBriefing(todayISO, todayPlan, allRecords);
  $("weekProgress").textContent = `${registeredDays}/7 registrados`;
  const weekSummary = [`${activeDays} ${activeDays === 1 ? "día activo" : "días activos"}`];
  if (restDays) weekSummary.push(`${restDays} ${restDays === 1 ? "descanso" : "descansos"}`);
  if (pendingWearable) weekSummary.push(`${pendingWearable} ${pendingWearable === 1 ? "sesión por vincular" : "sesiones por vincular"}`);
  $("weekProgressSummary").textContent = weekSummary.join(" · ");
  const feedback = $("homeCoachFeedback");
  feedback.replaceChildren();
  const lastAnalyzed = allRecords
    .filter(record => record.routineAiAnalysis)
    .sort((a, b) => String(b.routineAiAnalysis.generatedAt || b.updatedAt || b.createdAt || "")
      .localeCompare(String(a.routineAiAnalysis.generatedAt || a.updatedAt || a.createdAt || "")))[0];
  if (lastAnalyzed) {
    const disclosure = document.createElement("details");
    disclosure.className = "home-coach-disclosure";
    const summary = document.createElement("summary");
    const summaryCopy = document.createElement("span");
    const date = document.createElement("small");
    date.textContent = `${formatShortDate(lastAnalyzed.dateISO)} · ${recordTitle(lastAnalyzed)}`;
    const headline = document.createElement("strong");
    headline.textContent = lastAnalyzed.routineAiAnalysis.headline || "Último comentario del entrenador";
    summaryCopy.append(date, headline);
    summary.append(summaryCopy, document.createElement("span"));
    disclosure.append(summary, createRoutineAiCard(lastAnalyzed));
    feedback.append(disclosure);
  } else {
    const empty = document.createElement("p");
    empty.className = "coach-home-empty";
    empty.textContent = "Tu último comentario de la guía aparecerá aquí cuando analices un entrenamiento. Puedes hacerle una pregunta mientras tanto.";
    feedback.append(empty);
  }
  renderCoachQuestions();
  renderWearable();

  const ledger = $("weekLedger");
  ledger.replaceChildren();
  const wearableInboxItems = wearableInbox(wearableData.sessions || [], allRecords);
  const recommendedWearableByRecord = new Map();
  const selectableWearableRecords = new Set();
  for (const item of wearableInboxItems) {
    if (item.recommended?.record?.id) recommendedWearableByRecord.set(item.recommended.record.id, item);
    item.candidates.forEach(candidate => selectableWearableRecords.add(candidate.record.id));
  }
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
    const quickRestAvailable = canQuickRegisterRest(dateISO, todayISO, records);
    if (!dayRecords.length && !plannedSession) {
      const empty = document.createElement("span");
      empty.className = "day-empty";
      empty.textContent = dateISO > todayISO ? "Aún sin actividad" : "Sin entrenamiento registrado";
      content.append(empty);
    } else {
      const activities = document.createElement("div");
      activities.className = "day-activities";
      const mainDayRecords = dayRecords.filter(isMainDayRecord);
      if (plannedSession && planNeedsSeparateLine(plannedSession, mainDayRecords, block)) {
        const primary = coachOption(plannedSession, plannedSession.primaryOptionId) || plannedSession.options[0];
        const planLine = document.createElement("div");
        const overview = dayPlanOverview(plannedSession, mainDayRecords);
        planLine.className = `planned-activity-line ${overview.status}`;
        const planBadge = document.createElement("span");
        planBadge.textContent = mainDayRecords.length ? "Plan original" : overview.label;
        const planCopy = document.createElement("div");
        const planTitle = document.createElement("strong");
        planTitle.textContent = primary.title;
        const planMeta = document.createElement("small");
        planMeta.textContent = plannedSession.options.length > 1 ? `${primary.summary} · con alternativas` : primary.summary;
        planCopy.append(planTitle, planMeta);
        planLine.append(planBadge, planCopy);
        activities.append(planLine);
      }
      const orderedRecords = [...dayRecords.filter(isMainDayRecord), ...dayRecords.filter(record => !isMainDayRecord(record))];
      for (const record of orderedRecords) {
        const line = document.createElement("div");
        line.className = "activity-line";
        const copy = document.createElement("div");
        copy.className = "activity-copy";
        const dot = document.createElement("span");
        dot.className = `category-dot ${record.category}`;
        const text = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = isComplementaryActivity(record) ? `Complemento · ${recordTitle(record)}` : recordTitle(record);
        const details = document.createElement("small");
        details.textContent = recordDetails(record);
        text.append(title, details);
        copy.append(dot, text);
        const workflow = recordWorkflowState(record);
        const recommendation = workflow.status === "wearable-pending" ? recommendedWearableByRecord.get(record.id) : null;
        const canChooseWearable = workflow.status === "wearable-pending" && selectableWearableRecords.has(record.id);
        const state = document.createElement(recommendation || canChooseWearable ? "button" : "span");
        state.className = `record-state-badge ${workflow.status}`;
        if (recommendation) {
          state.type = "button";
          state.classList.add("record-state-action");
          state.textContent = "Vincular pulsera";
          state.setAttribute("aria-label", `Vincular la pulsera con ${recordTitle(record)}`);
          state.title = recommendation.recommended.match.reason;
          state.addEventListener("click", () => linkWearableSession(record.id, recommendation.session.id));
        } else if (canChooseWearable) {
          state.type = "button";
          state.classList.add("record-state-action");
          state.textContent = "Elegir pulsera";
          state.setAttribute("aria-label", `Elegir sesión de la pulsera para ${recordTitle(record)}`);
          state.addEventListener("click", () => {
            const inbox = $("wearableSessions")?.querySelector("details.wearable-inbox");
            if (!inbox) return;
            inbox.open = true;
            inbox.scrollIntoView({ behavior: "smooth", block: "center" });
          });
        } else {
          state.textContent = workflow.label;
        }
        line.append(copy, state);
        activities.append(line);
      }
      content.append(activities);
    }
    if (quickRestAvailable) {
      const restButton = document.createElement("button");
      restButton.type = "button";
      restButton.className = "quick-rest-button";
      restButton.textContent = "Registrar descanso";
      restButton.setAttribute("aria-label", `Registrar descanso del ${formatLongDate(dateISO)}`);
      restButton.addEventListener("click", () => openQuickRestRegistration(dateISO));
      content.append(restButton);
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
    button.addEventListener("click", () => ["warmup", "stretching"].includes(category.id)
      ? guidedUI.open(category.id) : selectCategory(category.id));
    chooser.append(button);
  }
}

function categoryIcon(categoryId) {
  const icons = {
    physical: `<svg viewBox="0 0 64 64" role="img"><path d="M8 25v14M15 20v24M49 20v24M56 25v14M15 32h34"/></svg>`,
    cardio: `<svg viewBox="0 0 64 64" role="img"><path d="M8 34h11l5-14 9 28 7-21 5 7h11"/><path d="M49 13c-7 0-11 5-11 5s-4-5-11-5c-8 0-14 6-14 14"/></svg>`,
    tennis: `<svg viewBox="0 0 64 64" role="img"><ellipse cx="27" cy="23" rx="15" ry="20" transform="rotate(38 27 23)"/><path d="M36 38l14 14M44 46l-7 7M14 15l25 19M11 24l20 15"/><circle cx="52" cy="14" r="5"/></svg>`,
    rest: `<svg viewBox="0 0 64 64" role="img"><path d="M47 43A23 23 0 0 1 23 17a22 22 0 1 0 24 26Z"/><path d="M43 13v8M39 17h8M51 25v6M48 28h6"/></svg>`,
    warmup: `<svg viewBox="0 0 64 64" role="img"><path d="M10 44h44M16 44l9-16 9 6 9-17M20 20l-5 5M43 17l4 6"/><circle cx="47" cy="12" r="4"/></svg>`,
    stretching: `<svg viewBox="0 0 64 64" role="img"><circle cx="31" cy="12" r="5"/><path d="M31 18v19M31 25l-16 8M31 25l16 8M31 37l-12 14M31 37l14 14M11 54h42"/></svg>`
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
    const selected = document.querySelector('input[name="restTypeId"]:checked')?.value;
    const discomfort = selected === "discomfort";
    const weather = selected === "weather";
    detailLabel.textContent = discomfort ? "Detalle de la molestia" : "Motivo climático";
    detail.placeholder = discomfort
      ? "¿Dónde está la molestia, cómo se siente y desde cuándo?"
      : "Por ejemplo: lluvia y canchas suspendidas.";
    detailBox.classList.toggle("hidden", !discomfort && !weather);
    detail.required = discomfort;
    if (!discomfort && !weather) detail.value = "";
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
      // La distancia real llegará desde Health Connect; no bloquear el
      // registro manual por no repetir lo que ya mide el reloj.
      input.required = false;
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
      const distanceGroup = document.createElement("div");
      distanceGroup.className = "watch-metric-group";
      const label = document.createElement("label");
      label.htmlFor = "runningDistanceSelect";
      label.textContent = "Distancia del trote";
      const select = document.createElement("select");
      select.id = "runningDistanceSelect";
      select.className = "running-distance-select";
      select.required = false;
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
      distanceGroup.append(label, select, helper, custom);
      box.append(distanceGroup);
    } else {
      const distanceGroup = document.createElement("div");
      distanceGroup.className = "watch-metric-group";
      const label = document.createElement("label");
      label.textContent = cardio.id === "trekking" ? "Distancia del trekking" : "Distancia recorrida";
      const helper = document.createElement("small");
      helper.className = "distance-helper";
      helper.textContent = "Anota los kilómetros y metros por separado.";
      distanceGroup.append(label, helper, createDistanceFields());
      box.append(distanceGroup);
    }
  }
  if (cardio.id === "trekking") {
    const trekkingMetrics = document.createElement("div");
    trekkingMetrics.className = "watch-metric-group";
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
    elevation.required = false;
    trekkingMetrics.append(elevationLabel, elevation);

    const ascentLabel = document.createElement("label");
    ascentLabel.textContent = "Tiempo de subida (HH:MM)";
    const ascentParts = durationParts({ durationSeconds: values.ascentDurationSeconds || 0 });
    const ascentFields = document.createElement("div");
    ascentFields.className = "duration-parts";
    ascentFields.append(
      durationPart({ id: "ascentHours", label: "Horas", max: 12, value: ascentParts.hours }),
      durationPart({ id: "ascentMinutes", label: "Min", max: 59, value: ascentParts.minutes })
    );
    trekkingMetrics.append(ascentLabel, ascentFields);
    box.append(trekkingMetrics);
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
  $("activityStartTimeRow").classList.toggle("hidden", !["cardio", "tennis"].includes(categoryId));
  $("activityStartTime").value = record?.activityStartTime || "";
  $("saveTrainingButton").classList.toggle("hidden", isRoutineLauncher);
  // La pulsera aporta las métricas de la sesión. La hora aproximada queda
  // disponible porque es la señal más útil para ofrecer el vínculo correcto.
  $("commonMetrics")?.classList.add("hidden");
  $("commonMetrics")?.setAttribute("aria-hidden", "true");
  $("watchMetricsNote")?.classList.toggle("hidden", isRest || isRoutineLauncher);
  $("calories").required = false;
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
  $("activityStartTimeRow").classList.add("hidden");
  $("registrationDateRow").classList.remove("hidden");
  $("saveTrainingButton").classList.remove("hidden");
  $("calories").required = false;
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
  const metricsPending = currentCategory !== "rest" && (!editingRecordId || Boolean(existing?.metricsPending));
  const duration = metricsPending || isRest ? { durationMinutes: "", durationSeconds: "" } : currentDurationValues();
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
    distanceKm: metricsPending ? "" : currentDistanceKm(),
    elevationGainM: metricsPending ? "" : $("elevationGainM")?.value ?? "",
    ascentDurationSeconds: metricsPending ? "" : currentAscentDurationSeconds(),
    durationMinutes: duration.durationMinutes,
    durationSeconds: duration.durationSeconds,
    durationPrecision: durationMode(),
    activityStartTime: ["cardio", "tennis"].includes(currentCategory) ? $("activityStartTime").value : existing?.activityStartTime || "",
    calories: isRest || metricsPending ? "" : $("calories").value,
    metricsPending,
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
    wearableSessionId: existing?.wearableSessionId || "",
    wearableSnapshot: existing?.wearableSnapshot || null,
    wearableLinkedAt: existing?.wearableLinkedAt || "",
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
  renderCoachPlanDialog();
  const saved = repository.get(candidate.id);
  const bandCandidates = saved && saved.category !== "rest"
    ? wearableCandidates(saved, wearableData.sessions, repository.list()) : [];
  if (bandCandidates.length) {
    // No vinculamos automáticamente: abrimos las opciones ordenadas por
    // fecha/hora/tipo para que el usuario confirme la sesión correcta.
    showView("history");
    openHistoryRecord(candidate.id);
    showToast(`${message} Hay una sesión de la pulsera para revisar y vincular.`);
  } else {
    renderHome();
    showView("home");
    showToast(message);
  }
  maybeRequestRoutineAiAnalysis(candidate.id, [], { interactive: false });
}

function editRecord(id) {
  const record = repository.get(id);
  if (!record || !categoryById(record.category)) return showToast("Este registro antiguo puede verse y exportarse, pero no editarse desde el formulario nuevo.");
  if (["warmup", "stretching"].includes(record.category)) return guidedUI.editRecord(record);
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
    renderActiveSessionDock();
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

function routineExerciseSnapshot(routine, exercise, progress, settings, dateISO, feedback = {}) {
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
    volumeKg: Math.round(weight * repsPerSet * completedSetNumbers.length * 100) / 100,
    technique: ["solid", "acceptable", "declined"].includes(feedback.technique) ? feedback.technique : "",
    repsInReserve: feedback.repsInReserve === "" || feedback.repsInReserve === undefined
      ? ""
      : Math.min(5, Math.max(0, Number(feedback.repsInReserve) || 0))
  };
}

function routineSessionSummary(routine, progress, settings, dateISO) {
  const relevantExercises = routineExercisesForDate(routine, dateISO);
  const activeSession = loadRoutineSession();
  const exerciseFeedback = activeSession?.routineId === routine.id && activeSession?.dateISO === dateISO
    ? activeSession.exerciseFeedback || {}
    : {};
  const exercises = relevantExercises.map(exercise => routineExerciseSnapshot(routine, exercise, progress, settings, dateISO, exerciseFeedback[exercise.id]));
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
  const dockMeta = $("activeSessionDockMeta");
  if (dockMeta && !$("activeSessionDock")?.classList.contains("hidden")) {
    const routine = physicalRoutineById(session.routineId);
    const step = activeRoutineStep(session);
    dockMeta.textContent = `${routine?.name || "Rutina"} · ${step?.completedSets || 0}/${step?.totalSets || 0} series · ${elapsed}`;
  }
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

function renderWearable() {
  const today = getChileDateISO();
  const days = wearableData.days || [];
  const sessions = wearableData.sessions || [];
  const todayData = days.find(day => day.dateISO === today);
  const lastSleep = days.filter(day => day.dateISO >= addDaysISO(today, -1) && day.dateISO <= today && Number(day.sleepMinutes) > 0)
    .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))[0];
  $("wearableSteps").textContent = todayData ? new Intl.NumberFormat("es-CL").format(Number(todayData.steps) || 0) : "—";
  if (lastSleep) {
    const minutes = Number(lastSleep.sleepMinutes) || 0;
    $("wearableSleep").textContent = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
    $("wearableSleepDate").textContent = formatShortDate(lastSleep.dateISO);
  } else {
    $("wearableSleep").textContent = "—";
    $("wearableSleepDate").textContent = days.length ? "Sin sueño reciente compartido por Mi Fitness" : "";
  }
  const sleepDetails = $("wearableSleepDetails");
  sleepDetails.replaceChildren();
  const stageLabels = { light: "Ligero", deep: "Profundo", rem: "REM", awake: "Despierto", awakeInBed: "Despierto en cama", outOfBed: "Fuera de cama", sleeping: "Sueño sin fase" };
  const stages = lastSleep?.sleepStagesMinutes && typeof lastSleep.sleepStagesMinutes === "object" ? lastSleep.sleepStagesMinutes : null;
  const stageEntries = stages ? Object.entries(stageLabels).map(([key, label]) => [label, Number(stages[key]) || 0]).filter(([, minutes]) => minutes > 0) : [];
  if (stageEntries.length) {
    const title = document.createElement("strong"); title.textContent = "Distribución estimada por Mi Fitness";
    const grid = document.createElement("div");
    stageEntries.forEach(([label, minutes]) => {
      const item = document.createElement("span");
      item.innerHTML = `<b>${label}</b><small>${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ""}${String(minutes % 60).padStart(2, "0")} min</small>`;
      grid.append(item);
    });
    sleepDetails.append(title, grid);
  }
  const signals = [];
  if (Number(lastSleep?.sleepHeartRateAvgBpm) > 0) signals.push(`${Math.round(lastSleep.sleepHeartRateAvgBpm)} lpm promedio durmiendo`);
  if (Number(lastSleep?.sleepOxygenAvgPercent) > 0) signals.push(`${Number(lastSleep.sleepOxygenAvgPercent).toLocaleString("es-CL", { maximumFractionDigits: 1 })}% SpO₂ promedio`);
  if (signals.length) {
    const line = document.createElement("p"); line.textContent = signals.join(" · "); sleepDetails.append(line);
  }
  if (lastSleep && !stageEntries.length) {
    const unavailable = document.createElement("small");
    unavailable.textContent = "Mi Fitness compartió la duración, pero no las fases de sueño en Health Connect.";
    sleepDetails.append(unavailable);
  }
  sleepDetails.classList.toggle("hidden", !lastSleep);
  const newestSync = [...days.map(day => day.syncedAt), wearableData.status?.syncedAt].filter(Boolean).sort().at(-1);
  const syncAgeMinutes = newestSync ? Math.max(0, Math.round((Date.now() - Date.parse(newestSync)) / 60000)) : null;
  const syncLabel = $("wearableSyncTime");
  syncLabel.textContent = newestSync
    ? `Actualizado ${new Date(newestSync).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}${syncAgeMinutes > 30 ? " · datos atrasados" : ""}`
    : "Sin sincronizar";
  syncLabel.classList.toggle("stale", syncAgeMinutes === null || syncAgeMinutes > 30);
  $("wearableHelp").textContent = days.length
    ? "Datos medidos por la pulsera. Las sesiones detectadas no se suman automáticamente al historial para evitar duplicados."
    : "Instala TGTrain Sync, elige Mi Fitness y sincroniza una vez; después se actualizará automáticamente si concedes el permiso de segundo plano.";
  const list = $("wearableSessions");
  list.replaceChildren();
  const records = repository.list();
  const pendingRecords = records.filter(record => record.metricsPending && !record.wearableSessionId && record.category !== "rest");
  const inbox = wearableInbox(sessions, records).slice(0, 10);
  if (!inbox.length && !pendingRecords.length) return;
  const disclosure = document.createElement("details");
  disclosure.className = "wearable-inbox";
  const disclosureSummary = document.createElement("summary");
  const summaryCopy = document.createElement("span");
  const heading = document.createElement("strong");
  heading.textContent = `${inbox.length} entrenamiento${inbox.length === 1 ? "" : "s"} por vincular`;
  const summaryHint = document.createElement("small");
  summaryHint.textContent = inbox.length
    ? "Ordenados por fecha y hora"
    : Number(wearableData.status?.workoutsToday) === 0
      ? "La última lectura encontró 0 entrenamientos de hoy en Health Connect"
      : "Aún no aparece una sesión compatible de Health Connect";
  summaryCopy.append(heading, summaryHint);
  disclosureSummary.append(summaryCopy, document.createElement("span"));
  disclosure.append(disclosureSummary);
  for (const { session, candidates, recommended, state } of inbox) {
    const row = document.createElement("div");
    row.className = `wearable-session ${state}`;
    const stateBadge = document.createElement("small");
    stateBadge.className = "wearable-session-state";
    stateBadge.textContent = state === "recommended" ? "Coincidencia recomendada" : state === "ambiguous" ? "Revisar coincidencia" : "Sin registro compatible";
    const title = document.createElement("strong");
    title.textContent = session.title || "Entrenamiento";
    const details = document.createElement("span");
    const minutes = Math.round((Number(session.durationSeconds) || 0) / 60);
    const start = new Date(session.startTime);
    // New bridge versions already publish startTime corrected and preserve the
    // original in rawStartTime. Only shift legacy cloud sessions here.
    const legacyAdjustmentMinutes = session.rawStartTime ? 0 : Number(recommended?.match?.timeAdjustmentMinutes) || 0;
    const displayStart = Number.isFinite(start.getTime()) ? new Date(start.getTime() + legacyAdjustmentMinutes * 60_000) : start;
    const hour = Number.isFinite(displayStart.getTime()) ? displayStart.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }) : "hora no disponible";
    const distance = Number(session.distanceMeters) > 0 ? ` · ${(Number(session.distanceMeters) / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} km` : "";
    const calories = Number(session.caloriesKcal) > 0 ? ` · ${Math.round(Number(session.caloriesKcal))} kcal` : "";
    const bpm = Number(session.heartRateAvgBpm) > 0 ? ` · ${Math.round(Number(session.heartRateAvgBpm))} lpm media` : "";
    const correctedClock = Number(session.clockAdjustmentMinutes) || legacyAdjustmentMinutes ? " · hora corregida" : "";
    details.textContent = `${formatShortDate(session.dateISO)} · ${hour}${correctedClock} · ${minutes} min${distance}${calories}${bpm}`;
    row.append(stateBadge, title, details);
    if (recommended) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `Vincular con ${recordTitle(recommended.record)}`;
      button.addEventListener("click", () => linkWearableSession(recommended.record.id, session.id));
      row.append(button);
    } else if (candidates.length) {
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Elegir registro para ${session.title || "entrenamiento detectado"}`);
      candidates.slice(0, 8).forEach(({ record, match }) => {
        const option = document.createElement("option");
        option.value = record.id;
        option.textContent = `${formatShortDate(record.dateISO)} · ${recordTitle(record)} · ${match.reason}`;
        select.append(option);
      });
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Vincular";
      button.addEventListener("click", () => linkWearableSession(select.value, session.id));
      row.append(select, button);
    } else {
      const status = document.createElement("small");
      status.textContent = "Sin un registro compatible para vincular.";
      row.append(status);
    }
    disclosure.append(row);
  }
  if (!inbox.length && pendingRecords.length) {
    const waiting = document.createElement("p");
    waiting.className = "wearable-inbox-waiting";
    waiting.textContent = `${pendingRecords.length} registro${pendingRecords.length === 1 ? "" : "s"} espera${pendingRecords.length === 1 ? "" : "n"} las mediciones. Sincroniza Mi Fitness y luego TGTrain Sync.`;
    disclosure.append(waiting);
  }
  list.append(disclosure);
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
    technique: "",
    repsInReserve: "",
    exerciseFeedback: {},
    focusMode: true,
    activeExerciseId: routineExercisesForDate(routine, dateISO)[0]?.id || "",
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
  const selectedState = exerciseStates.find(state => state.exercise.id === session.activeExerciseId);
  const targetState = selectedState
    || partialState
    || nextAfterCompleted
    || exerciseStates.find(state => state.completedSets < state.setCount);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const routineCard = [...document.querySelectorAll("[data-routine-id]")]
        .find(card => card.dataset.routineId === routineId);
      const target = session.activeExerciseId === "abdominals-finisher"
        ? routineCard?.querySelector(".abdominal-finisher")
        : targetState
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
  const routineDefinition = physicalRoutineById(record.routineId);
  const exerciseDefinitions = new Map((routineDefinition?.exercises || []).map(exercise => [exercise.id, exercise]));
  return {
    recordId: record.id,
    recordUpdatedAt: record.updatedAt,
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
    metricsPending: Boolean(record.metricsPending),
    wearableLinked: Boolean(record.wearableSessionId),
    dateISO: record.dateISO,
    routineId: record.routineId,
    routineName: record.routineName,
    durationMinutes: timing.durationMinutes,
    calories: record.calories,
    wearable: record.wearableSnapshot,
    guidedSessionName: record.guidedSessionName,
    guidedSteps: record.guidedSteps,
    guidedPainScore: record.guidedPainScore,
    guidedPainNotes: record.guidedPainNotes,
    sensations: record.sensations,
    routineSummary: record.routineSummary,
    effortRpe: record.routineEffort,
    painScore: record.routinePain,
    painDetail: record.routinePainDetail,
    technique: record.routineTechnique,
    repsInReserve: record.routineRepsInReserve,
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
      volumeKg: exercise.volumeKg,
      technique: exercise.technique,
      repsInReserve: exercise.repsInReserve,
      progression: exerciseDefinitions.get(exercise.id)?.progression || null
    }))
  };
}

function sameProgressionValue(left, right) {
  if ((left === "" || left === null || left === undefined) && (right === "" || right === null || right === undefined)) return true;
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) ? Number(left) === Number(right) : String(left) === String(right);
}

function progressionFollowUp(record, records) {
  if (record.category !== "physical" || !record.routineId) return null;
  const source = records
    .filter(item => item.id !== record.id && item.routineId === record.routineId
      && item.routineAiAnalysis?.status === "applied" && item.routineAiAnalysis.appliedChanges?.length
      && item.dateISO <= record.dateISO)
    .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)) || String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  if (!source) return null;
  const assessments = source.routineAiAnalysis.appliedChanges.flatMap(change => {
    const exercise = record.routineExercises.find(item => item.id === change.exerciseId);
    if (!exercise) return [];
    const usedProposal = Number(exercise.plannedSets) === Number(change.proposedSets)
      && String(exercise.target || "") === String(change.proposedTarget || "")
      && sameProgressionValue(exercise.weightKg, change.proposedWeightKg);
    if (!usedProposal) return [];
    const technique = exercise.technique || record.routineTechnique;
    const reserve = exercise.repsInReserve === "" ? record.routineRepsInReserve : exercise.repsInReserve;
    const completed = Number(exercise.plannedSets) > 0 && Number(exercise.completedSets) >= Number(exercise.plannedSets);
    const pain = Number(record.routinePain);
    const notTolerated = !completed || pain >= 3 || technique === "declined" || (reserve !== "" && Number(reserve) <= 1);
    const tolerated = completed && pain <= 2 && ["solid", "acceptable"].includes(technique)
      && reserve !== "" && Number(reserve) >= 2;
    const status = notTolerated ? "not-tolerated" : tolerated ? "tolerated" : "observe";
    const reason = !completed
      ? "No se completaron todas las series con la configuración aplicada."
      : pain >= 3
        ? `La sesión terminó con dolor ${pain}/10.`
        : technique === "declined"
          ? "La técnica se deterioró al final."
          : reserve !== "" && Number(reserve) <= 1
            ? "La nueva configuración dejó una reserva demasiado baja."
            : tolerated
              ? "Se completó con técnica controlada, dolor bajo y reserva suficiente."
              : "Faltan datos específicos para confirmar si el cambio quedó consolidado.";
    return [{
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      status,
      reason,
      currentSets: change.currentSets,
      proposedSets: change.proposedSets,
      currentTarget: change.currentTarget,
      proposedTarget: change.proposedTarget,
      currentWeightKg: change.currentWeightKg,
      proposedWeightKg: change.proposedWeightKg
    }];
  });
  return assessments.length ? {
    sourceRecordId: source.id,
    sourceDateISO: source.dateISO,
    assessments,
    revertedAt: ""
  } : null;
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
      technique: item.routineTechnique,
      repsInReserve: item.routineRepsInReserve,
      volumeKg: Number(item.routineVolumeKg) || 0,
      wearableHeartRateAvgBpm: item.wearableSnapshot?.heartRateAvgBpm ?? null,
      wearableActiveCaloriesKcal: item.wearableSnapshot?.activeCaloriesKcal ?? null
    }));
  const block = activeTrainingBlock(record.dateISO);
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
        startTime: session.startTime || option?.startTime || "",
        endTime: session.endTime || option?.endTime || "",
        calendarStatus: session.calendarStatus || option?.calendarStatus || "",
        opponent: session.opponent || option?.opponent || "",
        alternatives: (session.options || []).map(item => item.title)
      };
    });
  const match = plannedContextForRecord(record, block);
  const comparableProgressionRecords = records
    .filter(item => item.id !== record.id && item.category === "physical" && item.routineId === record.routineId && item.dateISO <= record.dateISO)
    .map(routineForAi);
  const progressionEvidence = buildProgressionEvidence(routineForAi(record), comparableProgressionRecords);
  const appliedProgressionFollowUp = progressionFollowUp(record, records);
  const currentPlan = match ? {
    blockId: block.id,
    blockUpdatedAt: block.updatedAt || "",
    sessionId: match.session.id,
    optionId: match.option.id,
    exactOptionMatch: match.exact,
    title: match.option.title,
    summary: match.option.summary,
    objective: match.session.objective,
    startTime: match.session.startTime || match.option.startTime || "",
    endTime: match.session.endTime || match.option.endTime || "",
    calendarStatus: match.session.calendarStatus || match.option.calendarStatus || "",
    opponent: match.session.opponent || match.option.opponent || "",
    details: match.option.details || [],
    target: match.option.prefill || {},
    referenceRoutine: match.option.category === "physical" ? physicalRoutineById(match.option.prefill?.routineId) : null,
    alternatives: match.session.options.map(option => ({ title: option.title, category: option.category, summary: option.summary, details: option.details, target: option.prefill })),
    sameDayActivities: records.filter(item => item.id !== record.id && item.dateISO === record.dateISO).map(routineForAi),
    weekObjective: match.week.objective,
    weekContext: match.week.context,
    rules: block.rules || []
  } : null;
  const lastNight = wearableData.days.find(day => day.dateISO === record.dateISO && Number(day.sleepMinutes) > 0);
  const recoveryContext = strongestRecoveryImpact(recoveryContextsFromQuestions(repository.listCoachQuestions()), record.dateISO);
  return {
    coachProfile: repository.getCoachProfile(), recentTrainingLoad, next48Hours, currentPlan, progressionEvidence, progressionFollowUp: appliedProgressionFollowUp,
    recoveryContext,
    nutritionContext: {
      activityDay: nutritionDayForCoach(record.dateISO, block),
      previousDay: nutritionDayForCoach(addDaysISO(record.dateISO, -1), block)
    },
    wearableContext: {
      linkedSession: record.wearableSnapshot,
      precedingSleep: wearableDayForCoach(lastNight),
      dailySteps: wearableData.days.find(day => day.dateISO === record.dateISO)?.steps ?? null
    }
  };
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
    const checkedChanges = record.category === "physical" ? sanitizeProgressionChanges(analysis?.changes, context.progressionEvidence) : [];
    const recoveryDecision = context.recoveryContext?.adaptation === "recover" ? "recover"
      : context.recoveryContext ? "reduce" : "";
    const effectiveDecision = recoveryDecision || analysis?.decision;
    const suggestedChanges = checkedChanges.length || effectiveDecision !== "progress"
      ? checkedChanges
      : fallbackProgressionChanges(context.progressionEvidence);
    const concreteChanges = suggestedChanges.filter(change => change.action === "increase"
      ? effectiveDecision === "progress"
      : ["reduce", "recover"].includes(effectiveDecision));
    const evidenceDecision = context.progressionEvidence?.readiness;
    const safeDecision = recoveryDecision || (record.category === "physical" && ["maintain", "reduce", "recover"].includes(evidenceDecision)
      ? evidenceDecision
      : analysis?.decision);
    const latest = repository.get(record.id);
    if (!latest || latest.updatedAt !== record.updatedAt) throw new Error("El registro cambió durante el análisis. Vuelve a analizarlo para incluir sus últimos comentarios.");
    repository.upsert({
      ...attachMatchingPlan(latest),
      routineAiAnalysis: {
        ...analysis,
        decision: safeDecision,
        changes: concreteChanges,
        progressionBasis: context.progressionEvidence ? {
          readiness: context.progressionEvidence.readiness,
          reason: context.progressionEvidence.reason,
          comparableSessions: context.progressionEvidence.comparableSessions,
          completedPercent: context.progressionEvidence.completedPercent,
          effortRpe: context.progressionEvidence.effortRpe,
          painScore: context.progressionEvidence.painScore,
          technique: context.progressionEvidence.technique,
          repsInReserve: context.progressionEvidence.repsInReserve,
          fatigueHits: context.progressionEvidence.fatigueHits,
          deloadRecommended: context.progressionEvidence.deloadRecommended,
          stalledExercises: context.progressionEvidence.exercises.filter(exercise => exercise.stalled).map(exercise => exercise.exerciseName)
        } : null,
        progressionFollowUp: context.progressionFollowUp,
        recoveryContext: context.recoveryContext,
        status: concreteChanges.length ? "pending" : "reviewed",
        planContext: context.currentPlan ? {
          blockId: context.currentPlan.blockId,
          blockUpdatedAt: context.currentPlan.blockUpdatedAt,
          sessionId: context.currentPlan.sessionId,
          optionId: context.currentPlan.optionId
        } : null,
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

function maybeRequestRoutineAiAnalysis(recordId, planDetails = [], options = {}) {
  const record = repository.get(recordId);
  // La primera evaluación debe esperar a que la pulsera complete las
  // métricas. Así el comentario no se genera con duración/calorías vacías.
  if (record?.metricsPending && !record.wearableSessionId) return false;
  if (!cloudSync.currentUser || !repository.getCoachProfile()) return false;
  requestRoutineAiAnalysis(recordId, planDetails, options);
  return true;
}

function finishRoutineSession(routine) {
  const session = loadRoutineSession();
  if (!session || session.status !== "active" || session.routineId !== routine.id) return;
  const absInput = $(`routineAbsCount-${routine.id}`);
  const sensationsInput = $(`routineSensations-${routine.id}`);
  const effortInput = $(`routineEffort-${routine.id}`);
  const painInput = $(`routinePain-${routine.id}`);
  const techniqueInput = $(`routineTechnique-${routine.id}`);
  const repsInReserveInput = $(`routineRepsInReserve-${routine.id}`);
  const painDetailInput = $(`routinePainDetail-${routine.id}`);
  const message = $(`routineFinishMessage-${routine.id}`);
  // Las calorías, duración y distancia no se preguntan al cerrar la rutina:
  // quedan pendientes de la sesión registrada en el reloj.
  const calories = "";
  const absCount = absInput?.value === "" ? null : Number(absInput?.value);
  const sensations = sensationsInput?.value.trim() || "";
  const effort = effortInput?.value === "" ? null : Number(effortInput?.value);
  const pain = painInput?.value === "" ? null : Number(painInput?.value);
  const technique = techniqueInput?.value || "";
  const repsInReserve = repsInReserveInput?.value === "" ? null : Number(repsInReserveInput?.value);
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
  if (!["solid", "acceptable", "declined"].includes(technique)) {
    message.textContent = "Indica cómo se mantuvo tu técnica al final de la rutina.";
    message.classList.remove("hidden");
    techniqueInput?.focus();
    return;
  }
  if (!Number.isFinite(repsInReserve) || repsInReserve < 0 || repsInReserve > 5) {
    message.textContent = "Indica cuántas repeticiones más crees que podrías haber realizado.";
    message.classList.remove("hidden");
    repsInReserveInput?.focus();
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
    routineTechnique: technique,
    routineRepsInReserve: repsInReserve,
    metricsPending: true,
    routineExercises: summary.exercises,
    routineSummary: "",
    routineAiAnalysis: null,
    routineDefaultsSaved: saveSettingsForNextTime,
    routineStartedAt: session.startedAt,
    routineEndedAt: endedAt,
    wearableSessionId: "",
    wearableSnapshot: null,
    wearableLinkedAt: "",
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
    technique,
    repsInReserve,
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
  maybeRequestRoutineAiAnalysis(record.id, session.planDetails || [], { interactive: false });
  const bandCandidates = wearableCandidates(record, wearableData.sessions, repository.list());
  if (bandCandidates.length) {
    openHistoryRecord(record.id);
    showToast("Rutina registrada. Revisa la sesión de la pulsera para vincularla.");
    return;
  }
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

function routineBalanceGrid(summary, elapsedSeconds, calories, absCount = "", preview = false, effort = "", pain = "", technique = "", repsInReserve = "") {
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
  if (technique) metrics.push(["Técnica final", { solid: "Sólida", acceptable: "Aceptable", declined: "Se deterioró" }[technique] || technique, "technique"]);
  if (repsInReserve !== "" && repsInReserve !== null && repsInReserve !== undefined) metrics.push(["Reps. en reserva", Number(repsInReserve) >= 5 ? "5+" : String(repsInReserve), "reps-in-reserve"]);
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
      revertedAt: status === "reverted" ? new Date().toISOString() : "",
      appliedChanges: ["applied", "reverted"].includes(status) ? appliedChanges : []
    },
    updatedAt: new Date().toISOString()
  });
}

function actionableRoutineAiChanges(analysis) {
  return (analysis?.changes || []).filter(change => {
    if (!["increase", "reduce"].includes(change.action)) return false;
    const currentWeight = change.currentWeightKg === "" || change.currentWeightKg == null ? "" : Number(change.currentWeightKg);
    const proposedWeight = change.proposedWeightKg === "" || change.proposedWeightKg == null ? "" : Number(change.proposedWeightKg);
    return Number(change.currentSets) !== Number(change.proposedSets)
      || String(change.currentTarget || "").trim() !== String(change.proposedTarget || "").trim()
      || currentWeight !== proposedWeight;
  });
}

function routineAiChangeSummary(change) {
  const parts = [];
  if (Number(change.currentSets) !== Number(change.proposedSets)) parts.push(`Series: ${change.currentSets} → ${change.proposedSets}`);
  if (String(change.currentTarget || "").trim() !== String(change.proposedTarget || "").trim())
    parts.push(`Repeticiones/tiempo: ${change.currentTarget || "—"} → ${change.proposedTarget || "—"}`);
  const currentWeight = change.currentWeightKg === "" || change.currentWeightKg == null ? "sin carga" : `${change.currentWeightKg} kg`;
  const proposedWeight = change.proposedWeightKg === "" || change.proposedWeightKg == null ? "sin carga" : `${change.proposedWeightKg} kg`;
  if (currentWeight !== proposedWeight) parts.push(`Carga: ${currentWeight} → ${proposedWeight}`);
  return parts;
}

function applyRoutineAiChanges(record, selectedChanges = actionableRoutineAiChanges(record.routineAiAnalysis)) {
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
    const next = {
      ...change,
      currentSets: current.sets,
      currentTarget: current.target,
      currentWeightKg: current.weightKg,
      previousSets: current.sets,
      previousTarget: current.target,
      previousWeightKg: current.weightKg,
      proposedSets: sets,
      proposedTarget: target,
      proposedWeightKg: weightKg
    };
    if (change.action !== "substitute") settings[routineSettingsKey(routine.id, exercise.id)] = { sets, target, weightKg };
    applied.push(next);
  });
  if (!applied.length) return showToast("No había cambios concretos para guardar.");
  const preview = applied.flatMap(change => routineAiChangeSummary(change).map(value => `${change.exerciseName}: ${value}`)).join("\n");
  if (!window.confirm(`Se guardarán estos ajustes para la próxima rutina:\n\n${preview}\n\nPodrás deshacerlos desde este comentario.`)) return;
  saveRoutineSettings(settings);
  saveRoutineAiStatus(record, "applied", applied);
  renderRoutines();
  renderHistory();
  showToast("Cambios guardados como base de la próxima rutina.");
  renderHome();
}

function undoRoutineAiChanges(record) {
  const changes = record.routineAiAnalysis?.appliedChanges || [];
  const routine = physicalRoutineById(record.routineId);
  if (!routine || !changes.length) return showToast("No hay cambios aplicados para deshacer.");
  if (!window.confirm("Se restaurará la configuración que tenías antes de aplicar esta propuesta. ¿Continuar?")) return;
  const allowed = new Set(routine.exercises.map(exercise => exercise.id));
  const settings = loadRoutineSettings();
  let restored = 0;
  changes.forEach(change => {
    if (!allowed.has(change.exerciseId)) return;
    settings[routineSettingsKey(routine.id, change.exerciseId)] = {
      sets: Number(change.previousSets ?? change.currentSets),
      target: String(change.previousTarget ?? change.currentTarget),
      weightKg: change.previousWeightKg ?? change.currentWeightKg ?? ""
    };
    restored += 1;
  });
  if (!restored) return showToast("No fue posible recuperar la configuración anterior.");
  saveRoutineSettings(settings);
  saveRoutineAiStatus(record, "reverted", changes);
  renderRoutines();
  renderHistory();
  renderHome();
  showToast(`Se restauró la configuración anterior de ${restored} ${restored === 1 ? "ejercicio" : "ejercicios"}.`);
}

function revertProgressionFollowUp(record) {
  const followUp = record.routineAiAnalysis?.progressionFollowUp;
  const routine = physicalRoutineById(record.routineId);
  if (!routine || !followUp?.assessments?.length) return;
  const settings = loadRoutineSettings();
  const definitions = new Map(routine.exercises.map(exercise => [exercise.id, exercise]));
  let reverted = 0;
  followUp.assessments.filter(item => item.status === "not-tolerated").forEach(item => {
    if (!definitions.has(item.exerciseId)) return;
    settings[routineSettingsKey(routine.id, item.exerciseId)] = {
      sets: item.currentSets,
      target: item.currentTarget,
      weightKg: item.currentWeightKg
    };
    reverted += 1;
  });
  if (!reverted) return;
  saveRoutineSettings(settings);
  repository.upsert({
    ...record,
    routineAiAnalysis: {
      ...record.routineAiAnalysis,
      progressionFollowUp: { ...followUp, revertedAt: new Date().toISOString() }
    },
    updatedAt: new Date().toISOString()
  });
  renderRoutines();
  renderHistory();
  renderHome();
  showToast(`Se restauró la configuración anterior de ${reverted} ${reverted === 1 ? "ejercicio" : "ejercicios"}.`);
}

function createRoutineAiEditor(record) {
  const editor = document.createElement("div");
  editor.className = "routine-ai-editor";
  const intro = document.createElement("p");
  intro.textContent = "Elige qué ajustes conservar y edita sus valores antes de aplicarlos.";
  editor.append(intro);
  const proposedChanges = actionableRoutineAiChanges(record.routineAiAnalysis);
  proposedChanges.forEach((change, index) => {
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
  apply.textContent = "Guardar ajustes editados para la próxima rutina";
  apply.addEventListener("click", () => {
    const selected = [...editor.querySelectorAll(".routine-ai-edit-row")].flatMap(row => {
      const [enabled, , sets, target, weight] = row.children;
      if (!enabled.checked) return [];
      const original = proposedChanges[Number(row.dataset.index)];
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
    const proposedChanges = actionableRoutineAiChanges(analysis);
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
    const evidence = document.createElement("p");
    evidence.className = "routine-ai-evidence";
    const evidenceParts = ["registro de la actividad"];
    if (record.wearableSessionId || record.wearableSnapshot) evidenceParts.push("métricas de la pulsera");
    if (record.sensations || record.routinePainDetail || record.guidedPainNotes) evidenceParts.push("tus comentarios y sensaciones");
    if (plannedContextForRecord(record, activeTrainingBlock(record.dateISO))) evidenceParts.push("plan vigente");
    evidence.textContent = `Datos considerados: ${evidenceParts.join(" · ")}.`;
    card.append(evidence);
    if (analysis.progressionBasis && record.category === "physical") {
      const basis = document.createElement("p");
      basis.className = "routine-ai-progression-basis";
      const techniqueLabel = { solid: "técnica sólida", acceptable: "técnica aceptable", declined: "técnica deteriorada" }[analysis.progressionBasis.technique];
      const parts = [
        `${analysis.progressionBasis.completedPercent}% de series`,
        techniqueLabel,
        analysis.progressionBasis.repsInReserve === "" || analysis.progressionBasis.repsInReserve == null
          ? "sin repeticiones en reserva anotadas"
          : `${Number(analysis.progressionBasis.repsInReserve) >= 5 ? "5+" : analysis.progressionBasis.repsInReserve} repeticiones en reserva`,
        `${analysis.progressionBasis.comparableSessions || 0} sesiones comparables`
      ].filter(Boolean);
      basis.textContent = `Base de progresión: ${parts.join(" · ")}. ${analysis.progressionBasis.reason || ""}`;
      card.append(basis);
      if (analysis.progressionBasis.deloadRecommended) {
        const deload = document.createElement("p");
        deload.className = "routine-ai-deload";
        deload.textContent = "Descarga sugerida: mantén los movimientos, evita aumentos y reduce temporalmente una serie o una pequeña parte de la carga.";
        card.append(deload);
      }
      if (analysis.progressionBasis.stalledExercises?.length) {
        const stalled = document.createElement("p");
        stalled.className = "routine-ai-stalled";
        stalled.textContent = `Estancamiento a revisar: ${analysis.progressionBasis.stalledExercises.join(", ")}.`;
        card.append(stalled);
      }
    }
    if (analysis.progressionFollowUp?.assessments?.length && record.category === "physical") {
      const followUp = document.createElement("div");
      followUp.className = "routine-ai-follow-up";
      const title = document.createElement("strong");
      title.textContent = "Resultado del ajuste anterior";
      followUp.append(title);
      const statusLabels = { tolerated: "Bien tolerado", "not-tolerated": "Conviene volver atrás", observe: "Aún por confirmar" };
      analysis.progressionFollowUp.assessments.forEach(item => {
        const row = document.createElement("p");
        row.className = item.status;
        const label = document.createElement("b");
        label.textContent = `${item.exerciseName} · ${statusLabels[item.status]}`;
        row.append(label, document.createTextNode(`. ${item.reason}`));
        followUp.append(row);
      });
      const needsRevert = analysis.progressionFollowUp.assessments.some(item => item.status === "not-tolerated");
      if (needsRevert) {
        if (analysis.progressionFollowUp.revertedAt) {
          const restored = document.createElement("small");
          restored.textContent = "La configuración anterior ya fue restaurada.";
          followUp.append(restored);
        } else {
          const revert = document.createElement("button");
          revert.type = "button";
          revert.textContent = "Volver a la configuración anterior";
          revert.addEventListener("click", () => revertProgressionFollowUp(record));
          followUp.append(revert);
        }
      }
      card.append(followUp);
    }
    if (analysis.planComparison?.status) {
      const comparison = document.createElement("p");
      comparison.className = "routine-ai-plan-comparison";
      const block = activeTrainingBlock();
      const match = plannedContextForRecord(record, block);
      if (analysisMatchesCurrentPlan(record, match, block)) {
        const assessment = planAssessment(record, match, block);
        comparison.textContent = `Plan y realidad · ${assessment.label}: ${assessment.reason || analysis.planComparison.reason}`;
      } else {
        comparison.textContent = "El plan cambió desde este comentario. Su comparación anterior ya no describe la planificación actual.";
      }
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
    if (proposedChanges.length) {
      const changes = document.createElement("div");
      changes.className = "routine-ai-changes";
      const changesHeading = document.createElement("strong");
      changesHeading.className = "routine-ai-changes-heading";
      changesHeading.textContent = `${proposedChanges.length} cambio${proposedChanges.length === 1 ? " concreto propuesto" : "s concretos propuestos"}`;
      changes.append(changesHeading);
      proposedChanges.forEach(change => {
        const row = document.createElement("article");
        const title = document.createElement("strong");
        title.textContent = change.exerciseName;
        const values = document.createElement("ul");
        values.className = "routine-ai-change-values";
        routineAiChangeSummary(change).forEach(value => {
          const item = document.createElement("li"); item.textContent = value; values.append(item);
        });
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
    if (analysis.status === "pending" && record.category === "physical" && proposedChanges.length) {
      const actions = document.createElement("div");
      actions.className = "routine-ai-actions";
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "routine-ai-apply";
      apply.textContent = `Guardar ${proposedChanges.length === 1 ? "este cambio" : "estos cambios"} para la próxima rutina`;
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
      const statusText = analysis.status === "pending" && !proposedChanges.length ? "No hay cambios concretos de peso, series o repeticiones para guardar. Mantén la configuración actual y usa las recomendaciones como guía."
        : analysis.status === "reviewed" && record.category === "physical" && !proposedChanges.length ? "No hay cambios concretos para aplicar en la próxima rutina."
          : analysis.status === "reviewed" ? ""
        : analysis.status === "applied" ? "Propuesta aplicada a la próxima rutina."
          : analysis.status === "reverted" ? "Cambio deshecho: se restauró la configuración anterior."
            : "Propuesta descartada; no se cambió la rutina.";
      if (statusText) {
        const status = document.createElement("p");
        status.className = `routine-ai-status ${analysis.status}`;
        status.textContent = statusText;
        card.append(status);
      }
    }
    if (analysis.status === "applied" && analysis.appliedChanges?.length) {
      const audit = document.createElement("div");
      audit.className = "routine-ai-audit";
      const appliedAt = document.createElement("small");
      appliedAt.textContent = `Aplicado ${analysis.appliedAt ? new Date(analysis.appliedAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : "recientemente"} · ${analysis.appliedChanges.length} ${analysis.appliedChanges.length === 1 ? "ajuste" : "ajustes"}`;
      const undo = document.createElement("button");
      undo.type = "button";
      undo.textContent = "Deshacer cambios aplicados";
      undo.addEventListener("click", () => undoRoutineAiChanges(record));
      audit.append(appliedAt, undo);
      card.append(audit);
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

function createRoutineExerciseFeedbackPanel(routine, session, summary) {
  const completed = (summary.exercises || []).filter(exercise => exercise.completedSets > 0 && !/calentamiento/i.test(exercise.phase || ""));
  if (!completed.length) return null;
  const disclosure = document.createElement("details");
  disclosure.className = "routine-exercise-feedback";
  const heading = document.createElement("summary");
  heading.textContent = "Afinar por ejercicio (opcional)";
  const help = document.createElement("p");
  help.textContent = "Úsalo solo si algún ejercicio se sintió distinto al resto. La guía priorizará este dato sobre la evaluación general.";
  disclosure.append(heading, help);
  const techniqueOptions = [["", "Como la evaluación general"], ["solid", "Técnica sólida"], ["acceptable", "Técnica aceptable"], ["declined", "La técnica se deterioró"]];
  const reserveOptions = [["", "Como la evaluación general"], [0, "0 repeticiones"], [1, "1 repetición"], [2, "2 repeticiones"], [3, "3 repeticiones"], [4, "4 repeticiones"], [5, "5 o más"]];
  completed.forEach(exercise => {
    const saved = session.exerciseFeedback?.[exercise.id] || {};
    const row = document.createElement("div");
    row.className = "routine-exercise-feedback-row";
    const name = document.createElement("strong");
    name.textContent = exercise.name;
    const select = (label, values, value) => {
      const wrapper = document.createElement("label");
      const caption = document.createElement("span");
      caption.textContent = label;
      const input = document.createElement("select");
      values.forEach(([optionValue, optionLabel]) => {
        const option = document.createElement("option");
        option.value = String(optionValue);
        option.textContent = optionLabel;
        input.append(option);
      });
      input.value = value === undefined || value === null ? "" : String(value);
      wrapper.append(caption, input);
      return input;
    };
    const technique = select("Técnica", techniqueOptions, saved.technique);
    const reserve = select("Reserva", reserveOptions, saved.repsInReserve);
    const persist = () => {
      const current = loadRoutineSession();
      if (current?.status !== "active" || current.routineId !== routine.id) return;
      const exerciseFeedback = { ...(current.exerciseFeedback || {}) };
      if (!technique.value && reserve.value === "") delete exerciseFeedback[exercise.id];
      else exerciseFeedback[exercise.id] = {
        technique: technique.value,
        repsInReserve: reserve.value === "" ? "" : Number(reserve.value)
      };
      saveRoutineSession({ ...current, exerciseFeedback });
    };
    technique.addEventListener("change", persist);
    reserve.addEventListener("change", persist);
    const controls = document.createElement("div");
    controls.append(technique.parentElement, reserve.parentElement);
    row.append(name, controls);
    disclosure.append(row);
  });
  return disclosure;
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
    panel.append(eyebrow, heading, copy, routineBalanceGrid(session.summary, session.elapsedSeconds, session.calories, session.absCount, false, session.effort, session.pain, session.technique, session.repsInReserve));
    const automaticSummary = document.createElement("p");
    automaticSummary.className = "routine-auto-summary";
    automaticSummary.textContent = session.routineSummary || "Tu balance completo quedó guardado para comparar la próxima sesión.";
    panel.append(automaticSummary);
    const completedRecord = repository.get(session.recordId);
    if (completedRecord?.wearableSnapshot) {
      const wearable = document.createElement("p");
      wearable.className = "routine-auto-summary";
      wearable.textContent = `Pulsera vinculada · ${wearableSummaryText(completedRecord.wearableSnapshot)}. Las kcal de la pulsera son estimadas y no se suman a las anotadas.`;
      panel.append(wearable);
    }
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
    history.addEventListener("click", () => openHistoryRecord(session.recordId));
    const availableBandSessions = completedRecord && !completedRecord.wearableSessionId
      ? wearableCandidates(completedRecord, wearableData.sessions, repository.list()) : [];
    if (availableBandSessions.length) {
      const reviewBand = document.createElement("button");
      reviewBand.type = "button";
      reviewBand.className = "routine-history-button";
      reviewBand.textContent = "Revisar sesión de pulsera";
      reviewBand.addEventListener("click", () => openHistoryRecord(session.recordId));
      panel.append(reviewBand);
    }
    const wearableHint = document.createElement("small");
    wearableHint.textContent = completedRecord?.wearableSessionId
      ? "Pulsera vinculada. Puedes actualizar o corregir el vínculo desde Historial."
      : availableBandSessions.length
        ? "Hay una sesión de la pulsera del mismo día. Revisa el horario antes de confirmar el vínculo."
        : "Cuando Mi Fitness termine de sincronizar, espera la actualización automática de TGTrain Sync o ábrela, y vincula la sesión desde Historial.";
    panel.append(note, wearableHint, history);
    return panel;
  }

  const preview = routineSessionSummary(routine, progress, settings, dateISO);
  eyebrow.textContent = "Cierre de la sesión";
  heading.textContent = "Finaliza y guarda tu entrenamiento";
  copy.textContent = "Puedes terminar aunque la rutina haya quedado parcial. Solo se contará lo que marcaste.";
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
  const choiceControl = ({ id, label, value, choices }) => {
    const wrapper = document.createElement("label");
    wrapper.className = "routine-rating-control";
    wrapper.htmlFor = id;
    const caption = document.createElement("span");
    caption.textContent = label;
    const select = document.createElement("select");
    select.id = id;
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "Seleccionar";
    select.append(blank);
    choices.forEach(([choiceValue, choiceLabel]) => {
      const option = document.createElement("option");
      option.value = String(choiceValue);
      option.textContent = choiceLabel;
      select.append(option);
    });
    select.value = value === undefined || value === null ? "" : String(value);
    wrapper.append(caption, select);
    return { wrapper, select };
  };
  const techniqueControl = choiceControl({
    id: `routineTechnique-${routine.id}`,
    label: "Técnica en las últimas series",
    value: session.technique,
    choices: [["solid", "Sólida"], ["acceptable", "Aceptable"], ["declined", "Se deterioró"]]
  });
  const reserveControl = choiceControl({
    id: `routineRepsInReserve-${routine.id}`,
    label: "Repeticiones correctas que aún podías hacer",
    value: session.repsInReserve,
    choices: [[0, "0 · ninguna"], [1, "1"], [2, "2"], [3, "3"], [4, "4"], [5, "5 o más"]]
  });
  ratings.append(effortControl.wrapper, painControl.wrapper, techniqueControl.wrapper, reserveControl.wrapper);
  const progressionHint = document.createElement("small");
  progressionHint.className = "routine-progression-hint";
  progressionHint.textContent = "La guía usará la técnica y las repeticiones que te quedaban en la última serie principal para decidir si conviene subir, mantener o reducir.";
  const exerciseFeedback = createRoutineExerciseFeedbackPanel(routine, session, preview);
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
    saveRoutineSession({
      ...current,
      effort: effortControl.select.value,
      pain: Number(painControl.select.value),
      painDetail: painDetail.value,
      technique: techniqueControl.select.value,
      repsInReserve: reserveControl.select.value
    });
    const effortPreview = $("routinePreview-effort")?.querySelector("strong");
    const painPreview = $("routinePreview-pain")?.querySelector("strong");
    const techniquePreview = $("routinePreview-technique")?.querySelector("strong");
    const reservePreview = $("routinePreview-reps-in-reserve")?.querySelector("strong");
    if (effortPreview) effortPreview.textContent = effortControl.select.value ? `${effortControl.select.value}/10` : "—";
    if (painPreview) painPreview.textContent = `${painControl.select.value}/10`;
    if (techniquePreview) techniquePreview.textContent = { solid: "Sólida", acceptable: "Aceptable", declined: "Se deterioró" }[techniqueControl.select.value] || "—";
    if (reservePreview) reservePreview.textContent = reserveControl.select.value === "" ? "—" : Number(reserveControl.select.value) >= 5 ? "5+" : reserveControl.select.value;
  };
  effortControl.select.addEventListener("change", persistRatings);
  painControl.select.addEventListener("change", () => { syncPainVisibility(); persistRatings(); });
  techniqueControl.select.addEventListener("change", persistRatings);
  reserveControl.select.addEventListener("change", persistRatings);
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
  panel.append(eyebrow, heading, copy, routineBalanceGrid(preview, routineSessionElapsedSeconds(session), "", session.absCount, true, session.effort, session.pain, session.technique, session.repsInReserve), ratings, progressionHint);
  if (exerciseFeedback) panel.append(exerciseFeedback);
  panel.append(painDetailWrap, sensations, defaultsOption, message, finish);
  const note = document.createElement("small");
  note.textContent = "El volumen es estimado. Duración y calorías quedan pendientes de la sesión de la pulsera para no pedirte datos duplicados.";
  panel.append(note);
  updateRoutineDefaultsChoice(routine, session, settings);
  return panel;
}

function createRoutineFocusControls(routine, session, displayedExercises, focusId) {
  const controls = document.createElement("nav");
  controls.className = "routine-focus-controls";
  controls.setAttribute("aria-label", "Navegar por la rutina activa");
  const ids = [...displayedExercises.map(exercise => exercise.id), "abdominals-finisher"];
  const currentIndex = Math.max(0, ids.indexOf(focusId));
  const move = nextIndex => {
    const current = loadRoutineSession();
    if (current?.status !== "active" || current.routineId !== routine.id) return;
    saveRoutineSession({ ...current, activeExerciseId: ids[Math.max(0, Math.min(ids.length - 1, nextIndex))] });
    renderRoutines();
    scrollToRoutineProgress(routine.id);
  };
  const previous = document.createElement("button");
  previous.type = "button";
  previous.textContent = "← Anterior";
  previous.disabled = currentIndex === 0;
  previous.addEventListener("click", () => move(currentIndex - 1));
  const position = document.createElement("span");
  position.textContent = currentIndex === displayedExercises.length
    ? "Cierre de la rutina"
    : `Ejercicio ${currentIndex + 1} de ${displayedExercises.length}`;
  const next = document.createElement("button");
  next.type = "button";
  next.textContent = currentIndex === ids.length - 1 ? "Ir al cierre ↓" : "Siguiente →";
  next.disabled = currentIndex === ids.length - 1;
  next.addEventListener("click", () => move(currentIndex + 1));
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "routine-focus-toggle";
  toggle.textContent = session.focusMode === false ? "Usar modo enfocado" : "Ver rutina completa";
  toggle.addEventListener("click", () => {
    const current = loadRoutineSession();
    if (current?.status !== "active" || current.routineId !== routine.id) return;
    saveRoutineSession({ ...current, focusMode: current.focusMode === false });
    renderRoutines();
    scrollToRoutineProgress(routine.id);
  });
  controls.append(previous, position, next, toggle);
  return controls;
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
    const focusStep = isRoutineActive ? activeRoutineStep(session) : null;
    const savedFocusIsValid = displayedExercises.some(exercise => exercise.id === session?.activeExerciseId)
      || session?.activeExerciseId === "abdominals-finisher";
    const focusId = savedFocusIsValid
      ? session.activeExerciseId
      : focusStep?.state?.exercise?.id || "abdominals-finisher";
    body.classList.toggle("routine-focus-mode", isRoutineActive && session.focusMode !== false);
    if (isRoutineActive) body.append(createRoutineFocusControls(routine, session, displayedExercises, focusId));
    displayedExercises.forEach((exercise, exerciseIndex) => {
      const exerciseCard = document.createElement("article");
      exerciseCard.className = "exercise-card";
      exerciseCard.dataset.exerciseId = exercise.id;
      exerciseCard.classList.toggle("focus-current", focusId === exercise.id);
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
      if (exercise.progression?.type === "double") {
        const progressionRule = document.createElement("p");
        progressionRule.className = "exercise-progression-rule";
        progressionRule.textContent = `Progresión ${exercise.progression.minTarget}–${exercise.progression.maxTarget}: primero aumenta repeticiones; al completar el máximo con buena técnica, sube ${Number(exercise.progression.loadStepKg || 1).toLocaleString("es-CL")} kg y vuelve al mínimo.`;
        guidance.append(progressionRule);
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
        createControl({ labelText: exerciseTargetMeta(exercise).label, input: targetInput })
      );
      const acceptsLoad = exerciseSettings.weightKg !== "" || /\bkg\b/i.test(`${exercise.weightSuggestion || ""} ${exercise.caution || ""}`);
      if (acceptsLoad) controls.append(createControl({ labelText: "Peso (kg)", input: weightInput }));

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
            renderActiveSessionDock();
            const checkboxes = [...series.querySelectorAll('input[type="checkbox"]')];
            if (input.checked && checkboxes.length && checkboxes.every(item => item.checked)) {
              const current = loadRoutineSession();
              const nextExercise = displayedExercises.slice(exerciseIndex + 1).find(item => {
                const nextSettings = currentExerciseSettings(routine, item, settings);
                return Array.from({ length: nextSettings.sets }, (_, nextIndex) => progress[routineProgressKey(dateISO, routine.id, item.id, nextIndex)])
                  .some(done => !done);
              });
              if (current?.status === "active" && current.routineId === routine.id) {
                saveRoutineSession({ ...current, activeExerciseId: nextExercise?.id || "abdominals-finisher" });
                requestAnimationFrame(() => { renderRoutines(); scrollToRoutineProgress(routine.id); });
              }
            }
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
    const abdominalFinisher = createRoutineAbsFinisher(routine, session, abdominalRecord, displayedExercises.length);
    abdominalFinisher.classList.toggle("focus-current", focusId === "abdominals-finisher");
    body.append(abdominalFinisher);
    const finishPanel = createRoutineFinishPanel(routine, session, progress, settings, dateISO);
    if (finishPanel) {
      finishPanel.classList.toggle("focus-current", focusId === "abdominals-finisher");
      body.append(finishPanel);
    }
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
    const trend = document.createElement("span");
    trend.className = `exercise-progress-trend ${exercise.trend}`;
    trend.textContent = exercise.trendLabel;
    copy.append(title, latest, trend);
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

function createCoachInsightDisclosure(insight) {
  const details = document.createElement("details");
  details.className = `history-coach-insight ${insight.kind}`;
  const disclosure = document.createElement("summary");
  const copy = document.createElement("span");
  const eyebrow = document.createElement("small");
  eyebrow.textContent = insight.kind === "monthly-summary" ? "Resumen mensual IA" : `Nutrición · ${formatShortDate(insight.dateISO)}`;
  const title = document.createElement("strong");
  title.textContent = insight.title;
  copy.append(eyebrow, title);
  const toggle = document.createElement("span"); toggle.setAttribute("aria-hidden", "true");
  disclosure.append(copy, toggle);
  const body = document.createElement("div");
  body.className = "history-coach-insight-body";
  if (insight.kind === "monthly-summary") {
    const stats = document.createElement("div"); stats.className = "history-monthly-stats";
    const values = [
      ["Sesiones", insight.stats.sessions], ["Días activos", insight.stats.activeDays],
      ["Minutos", insight.stats.minutes], ["Volumen", `${Number(insight.stats.physicalVolumeKg || 0).toLocaleString("es-CL")} kg`],
      ["Días con comida", insight.stats.nutritionDays], ["Sueño registrado", `${insight.stats.sleepDays || 0} días`]
    ];
    values.forEach(([label, value]) => stats.append(balanceMetric(label, value ?? "—")));
    body.append(stats);
  }
  const summary = document.createElement("p"); summary.textContent = insight.summary; body.append(summary);
  (insight.sections || []).forEach(section => {
    const group = document.createElement("section");
    const heading = document.createElement("strong"); heading.textContent = section.title;
    const list = document.createElement("ul");
    section.items.forEach(value => { const item = document.createElement("li"); item.textContent = value; list.append(item); });
    group.append(heading, list); body.append(group);
  });
  if (insight.encouragement) {
    const encouragement = document.createElement("p"); encouragement.className = "history-coach-encouragement";
    encouragement.textContent = insight.encouragement; body.append(encouragement);
  }
  details.append(disclosure, body);
  return details;
}

function renderHistoryCoachInsights() {
  const container = $("historyCoachInsights");
  const insights = repository.listNutritionEntries().filter(item => !item.deleted && ["nutrition-analysis", "monthly-summary"].includes(item.kind))
    .sort((a, b) => String(b.generatedAt || b.updatedAt).localeCompare(String(a.generatedAt || a.updatedAt)));
  container.replaceChildren();
  container.classList.toggle("hidden", !insights.length);
  if (!insights.length) return;
  const heading = document.createElement("div"); heading.className = "history-insights-heading";
  const eyebrow = document.createElement("p"); eyebrow.className = "eyebrow dark"; eyebrow.textContent = "Entrenador IA";
  const title = document.createElement("h2"); title.textContent = "Nutrición y balances mensuales";
  heading.append(eyebrow, title); container.append(heading);
  insights.forEach(insight => container.append(createCoachInsightDisclosure(insight)));
}

function renderFourWeekSummary(records) {
  const summary = rollingFourWeekSummary(records, repository.listNutritionEntries(), wearableData.days, getChileDateISO());
  const metrics = $("historyFourWeekMetrics");
  metrics.replaceChildren();
  const values = [
    [summary.sessions, "Sesiones"],
    [summary.minutes, "Minutos"],
    [summary.tennisSessions, "Tenis"],
    [summary.physicalSessions, "Físico"],
    [summary.nutritionDays, "Días con comidas"],
    [summary.sleepDays, "Noches con sueño"],
    [summary.painDays, "Días con molestias"]
  ];
  values.forEach(([value, labelText]) => metrics.append(balanceMetric(labelText, value)));
  if (summary.averageSleepMinutes) {
    metrics.append(balanceMetric("Sueño promedio", `${Math.floor(summary.averageSleepMinutes / 60)} h ${String(summary.averageSleepMinutes % 60).padStart(2, "0")} min`));
  }
}

function renderHistory() {
  const allRecords = repository.list();
  renderFourWeekSummary(allRecords);
  const category = $("historyCategoryFilter")?.value || "all";
  const periodDays = Number($("historyPeriodFilter")?.value) || 0;
  const cutoff = periodDays ? addDaysISO(getChileDateISO(), -(periodDays - 1)) : "";
  const records = allRecords.filter(record => {
    if (cutoff && record.dateISO < cutoff) return false;
    if (category === "all") return true;
    if (category === "recovery") return ["rest", "warmup", "stretching"].includes(record.category);
    return record.category === category;
  });
  const groups = groupRecordsByWeek(records);
  renderHistoryCoachInsights();
  renderExerciseProgress(allRecords);
  renderPhysicalRankings(allRecords);
  renderRunningRankings(allRecords);
  renderTrekkingRankings(allRecords);
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
    const complementaryCount = group.records.filter(isComplementaryActivity).length;
    count.textContent = `${group.records.length} ${group.records.length === 1 ? "registro" : "registros"}${complementaryCount ? ` · ${complementaryCount} complementario${complementaryCount === 1 ? "" : "s"}` : ""}`;
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

function linkWearableSession(recordId, sessionId) {
  const record = repository.get(recordId);
  const session = wearableData.sessions.find(item => item.id === sessionId);
  if (!record || !session || record.category === "rest") return showToast("No se encontró esta sesión de la pulsera.");
  if (repository.list().some(item => item.id !== recordId && item.wearableSessionId === sessionId))
    return showToast("Esta sesión de la pulsera ya está vinculada a otro entrenamiento.");
  const match = wearableCandidates(record, [session], repository.list())[0]?.match;
  const snapshot = normalizeWearableSnapshot({
    ...session,
    clockAdjustmentMinutes: Number(session.clockAdjustmentMinutes) || Number(match?.timeAdjustmentMinutes) || 0,
    clockAdjustmentReason: session.clockAdjustmentReason || (match?.timeAdjustmentMinutes ? "matched_one_hour_dst_skew" : "")
  });
  if (!snapshot) return showToast("Los datos de la pulsera están incompletos.");
  const updated = {
    ...record,
    wearableSessionId: sessionId,
    wearableSnapshot: snapshot,
    wearableLinkedAt: new Date().toISOString(),
    routineAiAnalysis: null,
    updatedAt: new Date().toISOString()
  };
  try { repository.upsert(updated); }
  catch (error) { return showToast(error.message || "No se pudo guardar el vínculo."); }
  renderHistory();
  renderHome();
  if (loadRoutineSession()?.status === "complete") renderRoutines();
  const evaluationStarted = maybeRequestRoutineAiAnalysis(recordId, [], { interactive: false });
  showToast(evaluationStarted
    ? "Sesión vinculada. El entrenador está preparando el comentario con las métricas de la pulsera."
    : "Sesión vinculada. El registro manual y la pulsera siguen siendo una sola actividad.");
}

function unlinkWearableSession(recordId) {
  if (!window.confirm("¿Desvincular la pulsera de este entrenamiento? Tus datos de la pulsera no se borrarán.")) return;
  const record = repository.get(recordId);
  if (!record) return;
  try {
    repository.upsert({ ...record, wearableSessionId: "", wearableSnapshot: null, wearableLinkedAt: "", routineAiAnalysis: null, updatedAt: new Date().toISOString() });
  } catch (error) { return showToast(error.message || "No se pudo desvincular."); }
  renderHistory();
  renderHome();
  if (loadRoutineSession()?.status === "complete") renderRoutines();
  showToast("Vínculo retirado. El entrenamiento y las mediciones originales se conservan.");
}

function createWearableLinkPanel(record) {
  if (record.category === "rest") return null;
  const panel = document.createElement("div");
  panel.className = "history-wearable";
  const candidates = wearableCandidates(record, wearableData.sessions, repository.list());
  if (record.wearableSnapshot) {
    const title = document.createElement("strong");
    title.textContent = "Pulsera vinculada · " + record.wearableSnapshot.title;
    const metrics = document.createElement("p");
    metrics.textContent = wearableSummaryText(record.wearableSnapshot);
    const note = document.createElement("small");
    note.textContent = `TGTrain: ${record.calories === "" ? "kcal no anotadas" : `${record.calories} kcal anotadas`} · Pulsera: ${record.wearableSnapshot.activeCaloriesKcal === null ? "sin kcal activas" : `${Math.round(record.wearableSnapshot.activeCaloriesKcal)} kcal activas estimadas`}. No se suman.`;
    panel.append(title, metrics, note);
    const comparison = wearableComparison(record, repository.list());
    if (comparison) {
      const reading = document.createElement("p");
      reading.className = "wearable-comparison";
      reading.textContent = comparison;
      panel.append(reading);
    }
    const current = wearableData.sessions.find(item => item.id === record.wearableSessionId);
    if (current && JSON.stringify(normalizeWearableSnapshot(current)) !== JSON.stringify(record.wearableSnapshot)) {
      const refresh = document.createElement("button");
      refresh.type = "button";
      refresh.textContent = "Actualizar mediciones";
      refresh.addEventListener("click", () => linkWearableSession(record.id, current.id));
      panel.append(refresh);
    }
    const unlink = document.createElement("button");
    unlink.type = "button";
    unlink.textContent = "Desvincular";
    unlink.addEventListener("click", () => unlinkWearableSession(record.id));
    panel.append(unlink);
  }
  const alternatives = candidates.filter(item => item.session.id !== record.wearableSessionId);
  if (alternatives.length) {
    const choices = document.createElement("details");
    choices.className = "wearable-link-choices";
    const summary = document.createElement("summary");
    summary.textContent = record.wearableSessionId ? "Cambiar sesión vinculada" : `Vincular pulsera · ${alternatives.length} ${alternatives.length === 1 ? "opción" : "opciones"}`;
    choices.append(summary);
    alternatives.forEach(({ session, match }) => {
      const option = document.createElement("div");
      option.className = "wearable-link-option";
      const description = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = session.title || "Entrenamiento detectado";
      const details = document.createElement("small");
      const start = new Date(session.startTime);
      const hour = Number.isFinite(start.getTime()) ? start.toLocaleTimeString("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit" }) : "hora no disponible";
      details.textContent = `${hour} · ${Math.round((Number(session.durationSeconds) || 0) / 60)} min · ${match.reason}. ${wearableSummaryText(session)}`;
      description.append(name, details);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Vincular";
      button.addEventListener("click", () => linkWearableSession(record.id, session.id));
      option.append(description, button);
      choices.append(option);
    });
    panel.append(choices);
  }
  return panel.childElementCount ? panel : null;
}

function createHistoryEntry(sourceRecord) {
  const record = normalizeRecord(sourceRecord);
  const entry = document.createElement("article");
  entry.className = "history-entry";
  entry.dataset.recordId = record.id;
  const top = document.createElement("div");
  top.className = "history-entry-top";
  const copy = document.createElement("div");
  const titleRow = document.createElement("div");
  titleRow.className = "history-entry-title-row";
  const title = document.createElement("h3");
  title.textContent = isComplementaryActivity(record) ? `Complemento · ${recordTitle(record)}` : recordTitle(record);
  const workflow = recordWorkflowState(record);
  const workflowBadge = document.createElement("span");
  workflowBadge.className = `record-state-badge ${workflow.status}`;
  workflowBadge.textContent = workflow.label;
  titleRow.append(title, workflowBadge);
  const details = document.createElement("p");
  details.textContent = recordDetails(record);
  copy.append(titleRow, details);
  const comparison = routineComparison(record, repository.list());
  if (comparison) {
    const comparisonLine = document.createElement("p");
    comparisonLine.className = "history-session-comparison";
    comparisonLine.textContent = `Vs. ${formatShortDate(comparison.previousDateISO)}: ${comparison.text}.`;
    copy.append(comparisonLine);
  }
  const expanded = document.createElement("div");
  expanded.className = "history-entry-expanded";
  if (record.plannedTitle) {
    const planned = document.createElement("p");
    planned.className = "history-plan-link";
    planned.textContent = `Plan del entrenador · ${record.plannedTitle}`;
    expanded.append(planned);
  }
  if (record.sensations) {
    const sensations = document.createElement("p");
    sensations.textContent = record.sensations;
    expanded.append(sensations);
  }
  if (["warmup", "stretching"].includes(record.category) && record.guidedSteps.length) {
    const disclosure = document.createElement("details");
    disclosure.className = "history-exercise-details";
    const summary = document.createElement("summary");
    summary.textContent = `Ver pasos de la guía (${record.guidedSteps.filter(step => step.status === "done").length}/${record.guidedSteps.length})`;
    const list = document.createElement("ol");
    record.guidedSteps.forEach(step => {
      const item = document.createElement("li");
      item.textContent = `${step.title} · ${step.status === "done" ? "realizado" : "omitido"} · ${step.seconds} s sugeridos`;
      list.append(item);
    });
    disclosure.append(summary, list); expanded.append(disclosure);
    if (record.guidedPainNotes) {
      const note = document.createElement("p"); note.className = "history-pain-detail";
      note.textContent = `Molestia: ${record.guidedPainNotes}`; expanded.append(note);
    }
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
      ["Dolor", record.routinePain === "" ? "—" : `${record.routinePain}/10`],
      ["Técnica final", { solid: "Sólida", acceptable: "Aceptable", declined: "Se deterioró" }[record.routineTechnique] || "—"],
      ["Reps. en reserva", record.routineRepsInReserve === "" ? "—" : Number(record.routineRepsInReserve) >= 5 ? "5+" : String(record.routineRepsInReserve)]
    ].forEach(([label, value]) => balance.append(balanceMetric(label, value)));
    expanded.append(balance);
    if (record.routinePainDetail) {
      const painDetail = document.createElement("p");
      painDetail.className = "history-pain-detail";
      painDetail.textContent = `Molestia: ${record.routinePainDetail}`;
      expanded.append(painDetail);
    }
    if (record.routineSummary) {
      const automaticSummary = document.createElement("p");
      automaticSummary.className = "history-auto-summary";
      automaticSummary.textContent = record.routineSummary;
      expanded.append(automaticSummary);
    }
  }
  const wearablePanel = createWearableLinkPanel(record);
  if (wearablePanel) expanded.append(wearablePanel);
  if (record.category === "physical" && record.routinePlannedSets === "" && record.routineSummary) {
    const notes = document.createElement("p");
    notes.className = "history-auto-summary";
    notes.textContent = `Ejercicios y cargas realizados: ${record.routineSummary}`;
    expanded.append(notes);
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
    expanded.append(exerciseDisclosure);
  }
  if (expanded.childElementCount) {
    const recordDisclosure = document.createElement("details");
    recordDisclosure.className = "history-record-disclosure";
    const recordSummary = document.createElement("summary");
    recordSummary.textContent = "Ver registro completo";
    recordDisclosure.append(recordSummary, expanded);
    copy.append(recordDisclosure);
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
  entry.append(top);
  if (record.routineAiAnalysis || (isMainDayRecord(record) && record.category !== "rest")) {
    const disclosure = document.createElement("details");
    disclosure.className = "history-ai-disclosure";
    const summary = document.createElement("summary");
    summary.textContent = record.routineAiAnalysis ? "Comentario del entrenador IA" : "Análisis del entrenador IA pendiente";
    disclosure.append(summary, aiCard);
    entry.append(disclosure);
  }
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
    nutritionUI.render();
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
  $("activeSessionDockButton").addEventListener("click", openActiveSession);
  $("dailyBriefAction").addEventListener("click", event => {
    const action = event.currentTarget.dataset.action;
    if (action === "active-session") return openActiveSession();
    if (action === "planned") return openTodayPlannedActivity();
    if (action === "history") return showView("history");
    openRegistration();
  });
  $("historyCategoryFilter").addEventListener("change", renderHistory);
  $("historyPeriodFilter").addEventListener("change", renderHistory);
  $("coachQuestionForm").addEventListener("submit", event => {
    event.preventDefault();
    submitCoachQuestion();
  });
  $("coachHistoryToggle").addEventListener("click", () => {
    coachHistoryExpanded = !coachHistoryExpanded;
    renderCoachQuestions();
  });
  $("coachHistoryClear").addEventListener("click", () => {
    const count = repository.listCoachQuestions().length;
    if (!count || !window.confirm(`¿Limpiar ${count} pregunta${count === 1 ? "" : "s"} y sus respuestas? También desaparecerán de tus otros dispositivos al sincronizar.`)) return;
    repository.clearCoachQuestions();
    coachHistoryExpanded = false;
    renderCoachQuestions();
    $("coachQuestionStatus").textContent = "Preguntas y respuestas limpiadas. El cambio se sincronizará con tu cuenta.";
  });
  document.querySelectorAll("[data-view-target]").forEach(button => button.addEventListener("click", () => {
    const target = button.dataset.viewTarget;
    if (target === "register") openRegistrationOrActiveRoutine();
    else showView(target);
  }));
  $("startPlannedActivityButton").addEventListener("click", () => {
    const block = activeTrainingBlock();
    const session = coachSessionForDate(getChileDateISO(), block);
    if (session && !plannedActivityContext(loadPlannedActivity()) && repository.list().some(record => record.dateISO === session.dateISO && isMainDayRecord(record))) return showView("history");
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
  $("wearableSyncButton").addEventListener("click", requestWearableBridgeSync);
  $("syncMatchesButton").addEventListener("click", () => syncMatchCalendar({ all: true }));
  $("cloudSignOutButton").addEventListener("click", async () => {
    try { await cloudSync.signOut(); } catch { showToast("No fue posible cerrar la sesión."); }
  });
  $("timerStartButton").addEventListener("click", startTimer);
  $("timerPauseButton").addEventListener("click", pauseTimer);
  $("timerResetButton").addEventListener("click", () => resetTimer(true));
}

function initialize() {
  nutritionUI.initialize();
  guidedUI.initialize();
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
    } else guidedUI.resumePending();
  }
  cloudSync.initialize();
  queueMicrotask(maybeSyncMatchCalendar);
  registerServiceWorker();
}

initialize();
