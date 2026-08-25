import {
  cardioTypes,
  cardioTypeById,
  categoryById,
  dayNamesFull,
  dayNamesShort,
  physicalRoutines,
  physicalRoutineById,
  tennisSurfaces,
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

function showView(name) {
  for (const viewName of ["Home", "Register", "History"]) {
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
  $("weekMinutes").textContent = String(records.reduce((sum, record) => sum + (Number(record.durationMinutes) || 0), 0));
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
  const icons = { physical: "F", cardio: "C", tennis: "T" };
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
    icon.className = "category-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = icons[category.id];
    button.append(copy, icon);
    button.addEventListener("click", () => selectCategory(category.id));
    chooser.append(button);
  }
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
    location: $("cardioLocation")?.value || "",
    distanceKm: $("distanceKm")?.value || ""
  };
}

function updateCardioExtraFields(values = {}) {
  const selected = document.querySelector('input[name="cardioTypeId"]:checked');
  const cardio = cardioTypeById(selected?.value);
  const box = $("cardioExtraFields");
  if (!box || !cardio) return;
  box.replaceChildren();
  if (cardio.location) {
    const label = document.createElement("label");
    label.htmlFor = "cardioLocation";
    label.textContent = "Cerro o lugar del trekking";
    const input = document.createElement("input");
    input.id = "cardioLocation";
    input.type = "text";
    input.maxLength = 300;
    input.placeholder = "Ej: Cerro Manquehue";
    input.value = values.location || "";
    input.required = true;
    box.append(label, input);
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
    choice.input.addEventListener("change", () => updateCardioExtraFields(currentCardioExtraValues()));
    grid.append(choice.wrapper);
  });
  const extras = document.createElement("div");
  extras.id = "cardioExtraFields";
  fieldset.append(legend, grid, extras);
  $("categoryFields").append(fieldset);
  updateCardioExtraFields(record);
}

function renderTennisFields(record = {}) {
  const locationLabel = document.createElement("label");
  locationLabel.htmlFor = "tennisLocation";
  locationLabel.textContent = "Lugar";
  const location = document.createElement("input");
  location.id = "tennisLocation";
  location.type = "text";
  location.maxLength = 300;
  location.placeholder = "Ej: Club Open Tennis";
  location.value = record.location || "";
  location.required = true;

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
  $("categoryFields").append(locationLabel, location, surfaceLabel, surface);
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
  $("durationMinutes").value = record?.durationMinutes ?? "";
  $("calories").value = record?.calories ?? "";
  $("sensations").value = record?.sensations || "";
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
  return {
    id: editingRecordId || createId(),
    dateISO: $("recordDate").value,
    category: currentCategory,
    categoryName: category?.shortName || "",
    routineId,
    routineName: physicalRoutineById(routineId)?.name || "",
    cardioTypeId,
    cardioTypeName: cardioTypeById(cardioTypeId)?.name || "",
    location: currentCategory === "tennis" ? $("tennisLocation")?.value || "" : $("cardioLocation")?.value || "",
    surface: $("tennisSurface")?.value || "",
    distanceKm: $("distanceKm")?.value ?? "",
    durationMinutes: $("durationMinutes").value,
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

function saveTraining(event) {
  event.preventDefault();
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
  renderHistory();
  registerServiceWorker();
}

initialize();
