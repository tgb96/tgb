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
  trekkingLocations,
  trekkingRoutes,
  trainingCategories
} from "./data.js?v=22";
import { createRepository } from "./storage.js?v=22";
import {
  dayIndexFromISO,
  formatLongDate,
  formatShortDate,
  getChileDateISO,
  groupRecordsByWeek,
  isoWeekInfo,
  normalizeRecord,
  recordDetails,
  recordTitle,
  recordsToCSV,
  trekkingBestTimes,
  validateRecord,
  weekDays,
  weeklyReport
} from "./utils.js?v=22";

const $ = id => document.getElementById(id);
const repository = createRepository(window.localStorage);

let currentCategory = null;
let editingRecordId = null;
let waitingServiceWorker = null;
let toastTimer = null;
let timerTicker = null;
let timerAudioContext = null;
let timerLastCountdownSecond = null;
let routineSessionTicker = null;
let openRoutineId = "";

const ROUTINE_PROGRESS_KEY = "tgb-routine-progress-v1";
const ROUTINE_SETTINGS_KEY = "tgb-routine-settings-v1";
const ROUTINE_SESSION_KEY = "tgb-routine-session-v1";
const TIMER_SETTINGS_KEY = "tgb-series-timer-v1";
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
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openRegistration() {
  resetRegistration();
  showView("register");
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
  const week = isoWeekInfo(todayISO);
  const records = repository.list().filter(record => record.dateISO >= week.startISO && record.dateISO <= week.endISO);
  const trainingRecords = records.filter(record => record.category !== "rest");
  const todayRecords = records.filter(record => record.dateISO === todayISO);
  const activeDays = new Set(records.map(record => record.dateISO)).size;

  $("currentWeekBadge").textContent = `Semana ${week.weekNumber} · ${week.weekYear}`;
  $("todayStatus").textContent = todayRecords.length ? `${todayRecords.length} ${todayRecords.length === 1 ? "actividad" : "actividades"} hoy` : "Sin registrar hoy";
  $("homeTitle").textContent = formatLongDate(todayISO);
  $("weekRange").textContent = `${formatShortDate(week.startISO)} — ${formatShortDate(week.endISO)}`;
  $("weekSessionCount").textContent = String(trainingRecords.length);
  $("weekMinutes").textContent = String(Math.round(trainingRecords.reduce((sum, record) => sum + (Number(record.durationMinutes) || 0), 0)));
  $("weekCalories").textContent = String(trainingRecords.reduce((sum, record) => sum + (Number(record.calories) || 0), 0));
  $("weekProgress").textContent = `${activeDays}/7 días`;

  const ledger = $("weekLedger");
  ledger.replaceChildren();
  for (const dateISO of weekDays(todayISO)) {
    const day = dayIndexFromISO(dateISO);
    const dayRecords = records.filter(record => record.dateISO === dateISO);
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
    if (!dayRecords.length) {
      const empty = document.createElement("span");
      empty.className = "day-empty";
      empty.textContent = dateISO > todayISO ? "Aún sin actividad" : "Sin entrenamiento registrado";
      content.append(empty);
    } else {
      const activities = document.createElement("div");
      activities.className = "day-activities";
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
  if (!editingRecordId) {
    const heading = document.createElement("div");
    heading.className = "routine-launch-heading";
    const title = document.createElement("h2");
    title.textContent = "Elige la rutina de hoy";
    const description = document.createElement("p");
    description.textContent = "Al elegirla comenzará el cronómetro y podrás avanzar ejercicio por ejercicio y serie por serie.";
    heading.append(title, description);
    const grid = document.createElement("div");
    grid.className = "routine-launch-grid";
    physicalRoutines.forEach((routine, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "routine-launch-card";
      button.setAttribute("aria-label", `Comenzar ${routine.name}`);
      const number = document.createElement("span");
      number.className = "routine-launch-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const copy = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = routine.name;
      const focus = document.createElement("small");
      focus.textContent = routine.focus;
      copy.append(name, focus);
      const action = document.createElement("span");
      action.className = "routine-launch-action";
      action.textContent = "Comenzar →";
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
  if (!$("ascentHours") && !$("ascentMinutes") && !$("ascentSeconds")) return "";
  return (Number($("ascentHours")?.value || 0) * 3600)
    + (Number($("ascentMinutes")?.value || 0) * 60)
    + Number($("ascentSeconds")?.value || 0);
}

function currentDistanceKm() {
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
    const label = document.createElement("label");
    label.textContent = cardio.id === "trekking" ? "Distancia del trekking (KK:MMM)" : "Distancia (KK:MMM)";
    const distance = distanceParts(values.distanceKm);
    const fields = document.createElement("div");
    fields.className = "distance-parts";
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
    fields.append(
      createDistancePart({ id: "distanceKilometers", value: distance.kilometers, max: 999, caption: "km" }),
      createDistancePart({ id: "distanceMeters", value: distance.meters, max: 999, caption: "m" })
    );
    box.append(label, fields);
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
    ascentLabel.textContent = "Tiempo de subida (HH:MM:SS)";
    const ascentParts = durationParts({ durationSeconds: values.ascentDurationSeconds || 0 });
    const ascentFields = document.createElement("div");
    ascentFields.className = "duration-parts hms";
    ascentFields.append(
      durationPart({ id: "ascentHours", label: "Horas", max: 12, value: ascentParts.hours }),
      durationPart({ id: "ascentMinutes", label: "Min", max: 59, value: ascentParts.minutes }),
      durationPart({ id: "ascentSeconds", label: "Seg", max: 59, value: ascentParts.seconds })
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
      updateCardioExtraFields(currentCardioExtraValues());
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
  return "hms";
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
  const label = document.createElement("label");
  label.textContent = "Duración (HH:MM:SS)";
  const parts = durationParts(record);
  const fields = document.createElement("div");
  fields.className = "duration-parts hms";
  fields.append(
    durationPart({ id: "durationHours", label: "Horas", max: 12, value: parts.hours }),
    durationPart({ id: "durationMinutesPart", label: "Min", max: 59, value: parts.minutes }),
    durationPart({ id: "durationSecondsPart", label: "Seg", max: 59, value: parts.seconds })
  );
  box.append(label, fields);
}

function loadTimerSettings() {
  let saved = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(TIMER_SETTINGS_KEY) || "{}");
  } catch {
    saved = {};
  }
  const safeSeconds = (value, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(43200, Math.max(0, Math.round(number))) : fallback;
  };
  const requestedSets = Number.parseInt(saved.totalSets, 10);
  return {
    workSeconds: safeSeconds(saved.workSeconds, 45),
    restSeconds: safeSeconds(saved.restSeconds, 60),
    totalSets: Number.isFinite(requestedSets) ? Math.min(50, Math.max(1, requestedSets)) : 3
  };
}

function timerDurationValue(prefix) {
  const hours = Number($(`${prefix}Hours`)?.value || 0);
  const minutes = Number($(`${prefix}Minutes`)?.value || 0);
  const seconds = Number($(`${prefix}Seconds`)?.value || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
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

function renderTimerDuration(containerId, prefix, totalSeconds) {
  const container = $(containerId);
  const parts = durationParts({ durationSeconds: totalSeconds });
  container.replaceChildren(
    durationPart({ id: `${prefix}Hours`, label: "Horas", max: 12, value: parts.hours }),
    durationPart({ id: `${prefix}Minutes`, label: "Min", max: 59, value: parts.minutes }),
    durationPart({ id: `${prefix}Seconds`, label: "Seg", max: 59, value: parts.seconds })
  );
  container.querySelectorAll("select").forEach(select => select.addEventListener("change", saveTimerSettings));
}

function initializeTimer() {
  const settings = loadTimerSettings();
  renderTimerDuration("timerWorkDuration", "timerWork", settings.workSeconds);
  renderTimerDuration("timerRestDuration", "timerRest", settings.restSeconds);
  const totalSets = $("timerTotalSets");
  totalSets.replaceChildren();
  for (let number = 1; number <= 50; number += 1) {
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
    work: "Intervalo",
    rest: "Descanso",
    complete: "Completado"
  };
  const phaseKey = timerState.status === "idle" || timerState.status === "complete" ? timerState.status : timerState.phase;
  $("timerPhase").textContent = timerState.status === "paused" ? `Pausa · ${phaseLabels[timerState.phase]}` : phaseLabels[phaseKey];
  $("timerPhase").className = `timer-phase ${phaseKey}`;
  const stageLabel = timerState.status === "complete"
    ? "Completado"
    : timerState.phase === "rest"
      ? "Descanso"
      : `Serie ${Math.min(timerState.currentSet, settings.totalSets)}`;
  $("timerStageLabel").textContent = timerState.status === "paused" ? `${stageLabel} · Pausa` : stageLabel;
  $("timerStageLabel").className = `timer-stage-label ${phaseKey}`;
  $("timerSetStatus").textContent = timerState.status === "complete"
    ? `${settings.totalSets}/${settings.totalSets} series`
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
  if (timerState.phase === "work") {
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
    timerState.phase = "work";
    timerState.currentSet = 1;
    timerState.remainingSeconds = settings.workSeconds;
    timerState.phaseTotalSeconds = settings.workSeconds;
  }
  timerState.status = "running";
  timerState.endAt = Date.now() + (timerState.remainingSeconds * 1000);
  if (timerTicker) clearInterval(timerTicker);
  timerTicker = setInterval(tickTimer, 250);
  if (!wasPaused) playTimerSound("work");
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
  const isRoutineLauncher = categoryId === "physical" && !editingRecordId;
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

function resetRegistration() {
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
  return {
    id: editingRecordId || createId(),
    dateISO: $("recordDate").value,
    category: currentCategory,
    categoryName: category?.shortName || "",
    routineId,
    routineName: physicalRoutineById(routineId)?.name || "",
    cardioTypeId,
    cardioTypeName: cardioTypeById(cardioTypeId)?.name || "",
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
    routineStartedAt: preserveRoutineBalance ? existing.routineStartedAt : "",
    routineEndedAt: preserveRoutineBalance ? existing.routineEndedAt : "",
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
  if (!durationPartsAreValid()) return showFormError("Revisa la duración: los minutos y segundos deben estar entre 0 y 59.");
  if (!distancePartsAreValid()) return showFormError("Revisa la distancia: usa kilómetros entre 0 y 999 y metros entre 0 y 999.");
  const candidate = formRecord();
  const validation = validateRecord(candidate);
  if (!validation.valid) return showFormError(validation.errors.join(" "));
  try {
    repository.upsert(candidate);
  } catch (error) {
    return showFormError(error.message);
  }
  const message = editingRecordId
    ? "Registro actualizado."
    : candidate.category === "rest" ? "Descanso registrado." : "Entrenamiento registrado.";
  resetRegistration();
  renderHome();
  showView("home");
  showToast(message);
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

function routineSessionSummary(routine, progress, settings, dateISO) {
  let completedSets = 0;
  let plannedSets = 0;
  let completedExercises = 0;
  let startedExercises = 0;
  let totalReps = 0;
  let volumeKg = 0;

  routine.exercises.forEach(exercise => {
    const exerciseSettings = currentExerciseSettings(routine, exercise, settings);
    const checkedSets = Array.from({ length: exerciseSettings.sets }, (_, setIndex) => setIndex)
      .filter(setIndex => progress[routineProgressKey(dateISO, routine.id, exercise.id, setIndex)]).length;
    const repsPerSet = targetRepetitions(exerciseSettings.target);
    const weight = Number(exerciseSettings.weightKg) || 0;
    plannedSets += exerciseSettings.sets;
    completedSets += checkedSets;
    if (checkedSets > 0) startedExercises += 1;
    if (checkedSets === exerciseSettings.sets) completedExercises += 1;
    totalReps += repsPerSet * checkedSets;
    volumeKg += weight * repsPerSet * checkedSets;
  });

  return {
    completedSets,
    plannedSets,
    completedExercises,
    startedExercises,
    totalExercises: routine.exercises.length,
    totalReps: Math.round(totalReps),
    volumeKg: Math.round(volumeKg * 100) / 100
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
  const sets = Number.isFinite(requestedSets) ? Math.min(12, Math.max(1, requestedSets)) : exercise.sets;
  const target = String(saved.target ?? exercise.target).slice(0, 40);
  const rawWeight = saved.weightKg ?? exercise.weightKg;
  const numericWeight = rawWeight === "" ? "" : Number(rawWeight);
  const weightKg = numericWeight === "" || (Number.isFinite(numericWeight) && numericWeight >= 0) ? numericWeight : exercise.weightKg;
  return { sets, target, weightKg };
}

function routineProgressKey(dateISO, routineId, exerciseId, setIndex) {
  return `${dateISO}:${routineId}:${exerciseId}:${setIndex}`;
}

function totalRoutineSets(routine, settings) {
  return routine.exercises.reduce((total, exercise) => total + currentExerciseSettings(routine, exercise, settings).sets, 0);
}

function completedRoutineSets(routine, progress, settings, dateISO) {
  return routine.exercises.reduce((total, exercise) => {
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

  const dateISO = getChileDateISO();
  const alreadyRecordedToday = repository.list().some(record =>
    record.dateISO === dateISO && record.routineId === routine.id && record.routinePlannedSets !== ""
  );
  if ((existing?.status === "complete" && existing.routineId === routine.id && existing.dateISO === dateISO) || alreadyRecordedToday) {
    clearRoutineProgress(loadRoutineProgress(), dateISO, routine.id);
  }
  const now = new Date().toISOString();
  saveRoutineSession({
    status: "active",
    routineId: routine.id,
    dateISO,
    startedAt: now,
    endedAt: "",
    elapsedSeconds: 0
  });
  openRoutineId = routine.id;
  renderRoutines();
  ensureRoutineSessionTicker();
  showToast("Rutina iniciada. El tiempo ya está corriendo.");
}

function scrollToRoutine(routineId) {
  requestAnimationFrame(() => {
    document.querySelector(`[data-routine-id="${routineId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function scrollToRoutineProgress(routineId) {
  const routine = physicalRoutineById(routineId);
  const session = loadRoutineSession();
  if (!routine || session?.status !== "active" || session.routineId !== routineId) return scrollToRoutine(routineId);
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
  const exerciseStates = routine.exercises.map(exercise => {
    const setCount = currentExerciseSettings(routine, exercise, settings).sets;
    const completedSets = Array.from({ length: setCount }, (_, index) => index)
      .filter(setIndex => progress[routineProgressKey(session.dateISO, routine.id, exercise.id, setIndex)]).length;
    return { exercise, setCount, completedSets };
  });
  const targetState = exerciseStates.find(state => state.completedSets > 0 && state.completedSets < state.setCount)
    || exerciseStates.find(state => state.completedSets < state.setCount);

  requestAnimationFrame(() => {
    const routineCard = [...document.querySelectorAll("[data-routine-id]")]
      .find(card => card.dataset.routineId === routineId);
    const target = targetState
      ? [...(routineCard?.querySelectorAll("[data-exercise-id]") || [])]
        .find(card => card.dataset.exerciseId === targetState.exercise.id)
      : routineCard?.querySelector(".routine-finish-card");
    (target || routineCard)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  startRoutineSession(routine);
  showView("routines");
  scrollToRoutine(routine.id);
}

function finishRoutineSession(routine) {
  const session = loadRoutineSession();
  if (!session || session.status !== "active" || session.routineId !== routine.id) return;
  const caloriesInput = $(`routineCalories-${routine.id}`);
  const sensationsInput = $(`routineSensations-${routine.id}`);
  const message = $(`routineFinishMessage-${routine.id}`);
  const calories = caloriesInput?.value === "" ? null : Number(caloriesInput?.value);
  const sensations = sensationsInput?.value.trim() || "";
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
  const summary = routineSessionSummary(routine, progress, settings, session.dateISO);

  if (summary.completedSets === 0) {
    message.textContent = "Marca al menos una serie antes de finalizar.";
    message.classList.remove("hidden");
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
    routineStartedAt: session.startedAt,
    routineEndedAt: endedAt,
    createdAt: session.startedAt,
    updatedAt: endedAt
  };

  try {
    repository.upsert(record);
  } catch (error) {
    message.textContent = error.message;
    message.classList.remove("hidden");
    return;
  }

  saveRoutineSession({ ...session, status: "complete", endedAt, elapsedSeconds, calories, sensations, recordId: record.id, summary });
  if (routineSessionTicker) clearInterval(routineSessionTicker);
  routineSessionTicker = null;
  openRoutineId = routine.id;
  renderRoutines();
  renderHome();
  showToast("Rutina finalizada y registrada como entrenamiento de hoy.");
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

function routineBalanceGrid(summary, elapsedSeconds, calories, preview = false) {
  const grid = document.createElement("div");
  grid.className = "routine-balance-grid";
  const metrics = [
    ["Tiempo", formatClock(elapsedSeconds), "time"],
    ["Calorías", calories === "" || calories === null || calories === undefined ? "—" : `${calories} kcal`, "calories"],
    ["Series", `${summary.completedSets}/${summary.plannedSets}`, "sets"],
    ["Ejercicios trabajados", `${summary.startedExercises}/${summary.totalExercises}`, "exercises"],
    ["Repeticiones", String(summary.totalReps), "reps"],
    ["Volumen estimado", `${Number(summary.volumeKg).toLocaleString("es-CL")} kg`, "volume"]
  ];
  metrics.forEach(([label, value, key]) => {
    const metric = balanceMetric(label, value);
    if (preview) metric.id = `routinePreview-${key}`;
    grid.append(metric);
  });
  return grid;
}

function updateRoutineSessionPreview(routine, progress, settings, dateISO) {
  const session = loadRoutineSession();
  if (!session || session.status !== "active" || session.routineId !== routine.id) return;
  const summary = routineSessionSummary(routine, progress, settings, dateISO);
  const values = {
    sets: `${summary.completedSets}/${summary.plannedSets}`,
    exercises: `${summary.startedExercises}/${summary.totalExercises}`,
    reps: String(summary.totalReps),
    volume: `${Number(summary.volumeKg).toLocaleString("es-CL")} kg`
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

  if (isActive) {
    eyebrow.textContent = "En curso";
    title.textContent = "Tiempo de entrenamiento";
    description.textContent = `Iniciada hoy a las ${new Date(session.startedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
  } else if (isComplete) {
    eyebrow.textContent = "Registrada";
    title.textContent = "Última sesión finalizada";
    description.textContent = "El balance quedó guardado en tu historial.";
  } else {
    eyebrow.textContent = anotherActive ? "Otra rutina en curso" : "Lista para comenzar";
    title.textContent = "Registra esta rutina completa";
    description.textContent = "El cronómetro seguirá corriendo aunque cambies de pestaña.";
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
    start.textContent = isComplete ? "Iniciar otra" : "Iniciar";
    start.disabled = anotherActive;
    start.addEventListener("click", () => startRoutineSession(routine));
    action.append(start);
  }
  panel.append(copy, action);
  return panel;
}

function createRoutineSensationPicker(routine) {
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
    });
    chips.append(button);
  });
  textarea.addEventListener("input", sync);
  box.append(label, heading, chips, textarea);
  return box;
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
    panel.append(eyebrow, heading, copy, routineBalanceGrid(session.summary, session.elapsedSeconds, session.calories));
    const note = document.createElement("small");
    note.textContent = "Volumen estimado = peso anotado × repeticiones de las series marcadas. No incluye ejercicios por tiempo ni sin carga.";
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
  const sensations = createRoutineSensationPicker(routine);
  const message = document.createElement("div");
  message.id = `routineFinishMessage-${routine.id}`;
  message.className = "form-message error hidden";
  message.setAttribute("role", "status");
  const finish = document.createElement("button");
  finish.type = "button";
  finish.className = "routine-finish-button";
  finish.textContent = "Finalizar y registrar";
  finish.addEventListener("click", () => finishRoutineSession(routine));
  panel.append(eyebrow, heading, copy, routineBalanceGrid(preview, routineSessionElapsedSeconds(session), "", true), caloriesLabel, calories, sensations, message, finish);
  const note = document.createElement("small");
  note.textContent = "El volumen es estimado y usa los pesos, repeticiones y series que dejaste registrados.";
  panel.append(note);
  return panel;
}

function renderRoutines() {
  const container = $("routineLibrary");
  const session = loadRoutineSession();
  const dateISO = session?.status === "active" ? session.dateISO : getChileDateISO();
  const progress = loadRoutineProgress();
  const settings = loadRoutineSettings();
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
    const title = document.createElement("h2");
    title.textContent = routine.name;
    const focus = document.createElement("p");
    focus.textContent = routine.focus;
    summaryCopy.append(title, focus);
    const counter = document.createElement("span");
    counter.className = "routine-progress";
    const updateCounter = () => {
      const completed = completedRoutineSets(routine, progress, settings, dateISO);
      const total = totalRoutineSets(routine, settings);
      counter.textContent = `${completed}/${total} series`;
      counter.classList.toggle("complete", completed === total);
    };
    updateCounter();
    summary.append(number, summaryCopy, counter);

    const body = document.createElement("div");
    body.className = "routine-body";
    const note = document.createElement("p");
    note.className = "routine-note";
    note.textContent = `Avance del ${formatShortDate(dateISO)} · tus cambios quedan guardados`;
    const objective = document.createElement("p");
    objective.className = "routine-objective";
    objective.textContent = routine.objective;
    body.append(note, objective, createRoutineSessionHeader(routine, session));

    routine.exercises.forEach((exercise, exerciseIndex) => {
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
      const setsInput = document.createElement("input");
      setsInput.type = "number";
      setsInput.inputMode = "numeric";
      setsInput.min = "1";
      setsInput.max = "12";
      setsInput.step = "1";
      setsInput.value = String(exerciseSettings.sets);
      setsInput.setAttribute("aria-label", `Series de ${exercise.name}`);
      const targetInput = document.createElement("input");
      targetInput.type = "text";
      targetInput.maxLength = 40;
      targetInput.value = exerciseSettings.target;
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
        createControl({ labelText: "Reps / tiempo", input: targetInput }),
        createControl({ labelText: "Peso (kg)", input: weightInput })
      );

      const series = document.createElement("div");
      series.className = "series-checks";

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
        const setCount = Math.min(12, Math.max(1, Number.parseInt(setsInput.value, 10) || exercise.sets));
        const target = targetInput.value.trim().slice(0, 40) || exercise.target;
        const enteredWeight = weightInput.value === "" ? "" : Number(weightInput.value);
        const weightKg = enteredWeight === "" || (Number.isFinite(enteredWeight) && enteredWeight >= 0) ? enteredWeight : exercise.weightKg;
        settings[routineSettingsKey(routine.id, exercise.id)] = { sets: setCount, target, weightKg };
        setsInput.value = String(setCount);
        targetInput.value = target;
        weightInput.value = weightKg;
        saveRoutineSettings(settings);
        renderSeries();
        updateCounter();
        updateRoutineSessionPreview(routine, progress, settings, dateISO);
      };
      setsInput.addEventListener("input", persistExerciseSettings);
      targetInput.addEventListener("input", persistExerciseSettings);
      weightInput.addEventListener("input", persistExerciseSettings);
      renderSeries();
      exerciseCard.append(exerciseTop, description, benefit, guidance, controls, series);
      body.append(exerciseCard);
    });
    const finishPanel = createRoutineFinishPanel(routine, session, progress, settings, dateISO);
    if (finishPanel) body.append(finishPanel);
    card.append(summary, body);
    container.append(card);
  });
  ensureRoutineSessionTicker();
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

function renderHistory() {
  const records = repository.list();
  const groups = groupRecordsByWeek(records);
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
    title.textContent = `Semana ${group.weekNumber} · ${group.weekYear}`;
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
    copyButton.textContent = "Copiar informe semanal";
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
      ["Volumen", `${Number(record.routineVolumeKg || 0).toLocaleString("es-CL")} kg`]
    ].forEach(([label, value]) => balance.append(balanceMetric(label, value)));
    copy.append(balance);
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
  downloadText(`tgb-semana-${group.weekNumber}-${group.weekYear}.txt`, weeklyReport(repository.list(), group));
  showToast("Informe semanal descargado.");
}

function exportJSON() {
  downloadText(`tgb-respaldo-${getChileDateISO()}.json`, repository.backup(), "application/json;charset=utf-8");
  showToast("Respaldo JSON descargado.");
}

function exportCSV() {
  downloadText(`tgb-entrenamientos-${getChileDateISO()}.csv`, recordsToCSV(repository.list()), "text/csv;charset=utf-8");
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
  $("homeRegisterButton").addEventListener("click", openRegistrationOrActiveRoutine);
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
  const activeSession = loadRoutineSession();
  if (activeSession?.status === "active") {
    openRoutineId = activeSession.routineId;
    showView("routines");
    scrollToRoutineProgress(activeSession.routineId);
  }
  registerServiceWorker();
}

initialize();
