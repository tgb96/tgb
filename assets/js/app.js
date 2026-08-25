import {
  cardioTypes,
  cardioTypeById,
  categoryById,
  dayNamesFull,
  dayNamesShort,
  physicalRoutines,
  physicalRoutineById,
  sensationSuggestions,
  tennisLocations,
  tennisSurfaces,
  trekkingLocations,
  trainingCategories
} from "./data.js";
import { createRepository } from "./storage.js";
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
  validateRecord,
  weekDays,
  weeklyReport
} from "./utils.js";

const $ = id => document.getElementById(id);
const repository = createRepository(window.localStorage);

let currentCategory = null;
let editingRecordId = null;
let waitingServiceWorker = null;
let toastTimer = null;

const ROUTINE_PROGRESS_KEY = "tgb-routine-progress-v1";

function showView(name) {
  for (const viewName of ["Home", "Register", "Routines", "History"]) {
    const view = $(`view${viewName}`);
    const visible = viewName.toLowerCase() === name;
    view.hidden = !visible;
    view.classList.toggle("hidden", !visible);
  }
  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.viewTarget === name;
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

function renderHome() {
  const todayISO = getChileDateISO();
  const week = isoWeekInfo(todayISO);
  const records = repository.list().filter(record => record.dateISO >= week.startISO && record.dateISO <= week.endISO);
  const todayRecords = records.filter(record => record.dateISO === todayISO);
  const activeDays = new Set(records.map(record => record.dateISO)).size;

  $("currentWeekBadge").textContent = `Semana ${week.weekNumber} · ${week.weekYear}`;
  $("todayStatus").textContent = todayRecords.length ? `${todayRecords.length} ${todayRecords.length === 1 ? "actividad" : "actividades"} hoy` : "Sin registrar hoy";
  $("homeTitle").textContent = formatLongDate(todayISO);
  $("weekRange").textContent = `${formatShortDate(week.startISO)} — ${formatShortDate(week.endISO)}`;
  $("weekSessionCount").textContent = String(records.length);
  $("weekMinutes").textContent = String(Math.round(records.reduce((sum, record) => sum + (Number(record.durationMinutes) || 0), 0)));
  $("weekCalories").textContent = String(records.reduce((sum, record) => sum + (Number(record.calories) || 0), 0));
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
    tennis: `<svg viewBox="0 0 64 64" role="img"><ellipse cx="27" cy="23" rx="15" ry="20" transform="rotate(38 27 23)"/><path d="M36 38l14 14M44 46l-7 7M14 15l25 19M11 24l20 15"/><circle cx="52" cy="14" r="5"/></svg>`
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

function currentCardioExtraValues() {
  return {
    location: selectedLocation("cardioLocationSelect", "cardioLocationOther"),
    distanceKm: $("distanceKm")?.value || ""
  };
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
  }
  if (cardio.distance) {
    const label = document.createElement("label");
    label.htmlFor = "distanceKm";
    label.textContent = cardio.id === "trekking" ? "Distancia del trekking (km)" : "Distancia (km)";
    const input = document.createElement("input");
    input.id = "distanceKm";
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "0.01";
    input.placeholder = "Ej: 8.5";
    input.value = values.distanceKm ?? "";
    input.required = cardio.id === "trekking";
    box.append(label, input);
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
}

function durationMode() {
  if (currentCategory === "tennis") return "hms";
  if (currentCategory === "cardio") {
    const cardioTypeId = document.querySelector('input[name="cardioTypeId"]:checked')?.value;
    if (cardioTypeId === "running") return "hms";
    if (cardioTypeId === "trekking") return "hm";
  }
  return "minutes";
}

function currentDurationValues() {
  const simpleMinutes = $("durationMinutes")?.value;
  if (simpleMinutes !== undefined && simpleMinutes !== "") {
    return { durationMinutes: Number(simpleMinutes), durationSeconds: Math.round(Number(simpleMinutes) * 60) };
  }
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
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: Math.floor(totalSeconds % 60)
  };
}

function durationPart({ id, label, max, value, placeholder = "00" }) {
  const wrapper = document.createElement("div");
  const input = document.createElement("input");
  input.id = id;
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.max = String(max);
  input.step = "1";
  input.placeholder = placeholder;
  input.value = value || "";
  input.setAttribute("aria-label", label);
  const caption = document.createElement("small");
  caption.textContent = label;
  wrapper.append(input, caption);
  return wrapper;
}

function renderDurationField(record = {}) {
  const box = $("durationField");
  box.replaceChildren();
  const label = document.createElement("label");
  const mode = durationMode();
  if (mode === "minutes") {
    label.htmlFor = "durationMinutes";
    label.textContent = "Duración (min)";
    const input = document.createElement("input");
    input.id = "durationMinutes";
    input.name = "durationMinutes";
    input.type = "number";
    input.inputMode = "numeric";
    input.min = "0";
    input.step = "1";
    input.placeholder = "Ej: 60";
    input.required = true;
    input.value = record.durationMinutes ?? "";
    box.append(label, input);
    return;
  }

  label.textContent = mode === "hms" ? "Duración exacta" : "Duración";
  const parts = durationParts(record);
  const fields = document.createElement("div");
  fields.className = `duration-parts ${mode}`;
  fields.append(
    durationPart({ id: "durationHours", label: "Horas", max: 99, value: parts.hours }),
    durationPart({ id: "durationMinutesPart", label: "Min", max: 59, value: parts.minutes })
  );
  if (mode === "hms") fields.append(durationPart({ id: "durationSecondsPart", label: "Seg", max: 59, value: parts.seconds }));
  box.append(label, fields);
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
  document.querySelectorAll(".suggestion-chip").forEach(button => {
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
  $("registerIntro").textContent = editingRecordId ? "Actualiza los datos y guarda los cambios." : "Completa los datos principales de la sesión.";
  $("categoryFields").replaceChildren();

  if (categoryId === "physical") renderPhysicalFields(record || {});
  if (categoryId === "cardio") renderCardioFields(record || {});
  if (categoryId === "tennis") renderTennisFields(record || {});

  $("recordDate").value = record?.dateISO || getChileDateISO();
  renderDurationField(record || {});
  $("calories").value = record?.calories ?? "";
  $("sensations").value = record?.sensations || "";
  renderSensationSuggestions();
  $("saveTrainingButton").textContent = editingRecordId ? "Guardar cambios" : "Guardar entrenamiento";
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
  $("registerHeading").textContent = "¿Qué entrenamiento hiciste?";
  $("registerIntro").textContent = "Elige uno de los tres grandes grupos.";
  $("formMessage").className = "form-message hidden";
  $("cancelEditButton").classList.add("hidden");
  $("categoryFields").replaceChildren();
  $("durationField").replaceChildren();
  $("sensationSuggestions").replaceChildren();
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
  const duration = currentDurationValues();
  return {
    id: editingRecordId || createId(),
    dateISO: $("recordDate").value,
    category: currentCategory,
    categoryName: category?.shortName || "",
    routineId,
    routineName: physicalRoutineById(routineId)?.name || "",
    cardioTypeId,
    cardioTypeName: cardioTypeById(cardioTypeId)?.name || "",
    location: currentCategory === "tennis"
      ? selectedLocation("tennisLocationSelect", "tennisLocationOther")
      : selectedLocation("cardioLocationSelect", "cardioLocationOther"),
    surface: $("tennisSurface")?.value || "",
    distanceKm: $("distanceKm")?.value ?? "",
    durationMinutes: duration.durationMinutes,
    durationSeconds: duration.durationSeconds,
    durationPrecision: durationMode(),
    calories: $("calories").value,
    sensations: $("sensations").value,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function showFormError(text) {
  $("formMessage").textContent = text;
  $("formMessage").className = "form-message error";
}

function durationPartsAreValid() {
  if (durationMode() === "minutes") return true;
  const hours = Number($("durationHours")?.value || 0);
  const minutes = Number($("durationMinutesPart")?.value || 0);
  const seconds = Number($("durationSecondsPart")?.value || 0);
  return hours >= 0 && hours <= 99 && minutes >= 0 && minutes <= 59 && seconds >= 0 && seconds <= 59;
}

function saveTraining(event) {
  event.preventDefault();
  if (!durationPartsAreValid()) return showFormError("Revisa la duración: los minutos y segundos deben estar entre 0 y 59.");
  const candidate = formRecord();
  const validation = validateRecord(candidate);
  if (!validation.valid) return showFormError(validation.errors.join(" "));
  try {
    repository.upsert(candidate);
  } catch (error) {
    return showFormError(error.message);
  }
  const message = editingRecordId ? "Entrenamiento actualizado." : "Entrenamiento registrado.";
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

function routineProgressKey(dateISO, routineId, exerciseId, setIndex) {
  return `${dateISO}:${routineId}:${exerciseId}:${setIndex}`;
}

function completedRoutineSets(routine, progress, dateISO) {
  return routine.exercises.reduce((total, exercise) => total + [0, 1, 2].filter(setIndex => progress[routineProgressKey(dateISO, routine.id, exercise.id, setIndex)]).length, 0);
}

function renderRoutines() {
  const container = $("routineLibrary");
  const dateISO = getChileDateISO();
  const progress = loadRoutineProgress();
  container.replaceChildren();

  physicalRoutines.forEach((routine, routineIndex) => {
    const card = document.createElement("details");
    card.className = "routine-card";
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
      const completed = completedRoutineSets(routine, progress, dateISO);
      counter.textContent = `${completed}/${routine.exercises.length * 3} series`;
      counter.classList.toggle("complete", completed === routine.exercises.length * 3);
    };
    updateCounter();
    summary.append(number, summaryCopy, counter);

    const body = document.createElement("div");
    body.className = "routine-body";
    const note = document.createElement("p");
    note.className = "routine-note";
    note.textContent = `Contenido provisorio · avance del ${formatShortDate(dateISO)}`;
    body.append(note);

    routine.exercises.forEach((exercise, exerciseIndex) => {
      const exerciseCard = document.createElement("article");
      exerciseCard.className = "exercise-card";
      const exerciseTop = document.createElement("div");
      exerciseTop.className = "exercise-top";
      const exerciseTitle = document.createElement("h3");
      exerciseTitle.textContent = `${exerciseIndex + 1}. ${exercise.name}`;
      const prescription = document.createElement("span");
      prescription.textContent = exercise.prescription;
      exerciseTop.append(exerciseTitle, prescription);
      const description = document.createElement("p");
      description.textContent = exercise.description;
      const benefit = document.createElement("p");
      benefit.className = "tennis-benefit";
      const benefitLabel = document.createElement("strong");
      benefitLabel.textContent = "Para el tenis: ";
      benefit.append(benefitLabel, exercise.benefit);
      const series = document.createElement("div");
      series.className = "series-checks";

      [0, 1, 2].forEach(setIndex => {
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
          exerciseCard.classList.toggle("complete", [...series.querySelectorAll('input[type="checkbox"]')].every(item => item.checked));
        });
        series.append(input, label);
      });
      exerciseCard.classList.toggle("complete", [...series.querySelectorAll('input[type="checkbox"]')].every(item => item.checked));
      exerciseCard.append(exerciseTop, description, benefit, series);
      body.append(exerciseCard);
    });
    card.append(summary, body);
    container.append(card);
  });
}

function renderHistory() {
  const records = repository.list();
  const groups = groupRecordsByWeek(records);
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
    if (target === "register") openRegistration();
    else showView(target);
  }));
  $("homeRegisterButton").addEventListener("click", openRegistration);
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
}

function initialize() {
  renderCategoryChooser();
  resetRegistration();
  bindEvents();
  renderHome();
  renderRoutines();
  renderHistory();
  registerServiceWorker();
}

initialize();
