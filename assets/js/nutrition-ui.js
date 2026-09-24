import { nutritionDayTotals, nutritionPlanForDate } from "./nutrition.js?v=73";
import { describeParts, estimateParts, foodCatalog, foodsForSlot, knownPartsSubtotal, nutritionEntryWithEstimate } from "./nutrition-presets.js?v=73";
import { isComplementaryActivity, isMainDayRecord } from "./coach-tracking.js?v=72";
import { addDaysISO, getChileDateISO, recordTitle, weekDays } from "./utils.js?v=67";

const byId = id => document.getElementById(id);
const newId = () => `nutrition-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const localTime = () => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const numberValue = id => byId(id).value === "" ? null : Number(byId(id).value);
const label = text => { const element = document.createElement("span"); element.textContent = text; return element; };

export function createNutritionUI(repository, { showToast = () => {}, getWearableData = () => ({ days: [], sessions: [] }) } = {}) {
  let selectedDate = getChileDateISO();
  let editingId = "";
  let selectedSlot = "other";
  let selectedParts = {};
  let estimateSource = "";
  const dialog = byId("nutritionEntryDialog");

  function estimateNote(parts) {
    const subtotal = knownPartsSubtotal(parts);
    const estimate = estimateParts(parts);
    if (!estimate) return subtotal.unknownItems
      ? "Faltan datos para algunos ingredientes. Puedes completar las cifras manualmente."
      : "Agrega ingredientes para ver una estimación.";
    return subtotal.genericItems
      ? `≈ ${Math.round(estimate.caloriesKcal)} kcal para las porciones indicadas. El pan Ideal usa su etiqueta; los demás alimentos son referencias promedio. Revisa marcas y cantidades antes de guardar.`
      : `${Math.round(estimate.caloriesKcal)} kcal según la etiqueta del pan Ideal para estas rebanadas.`;
  }

  function refreshPartEstimate() {
    const estimate = estimateParts(selectedParts);
    const subtotal = knownPartsSubtotal(selectedParts);
    for (const [field, key] of [["nutritionMealCalories", "caloriesKcal"], ["nutritionMealProtein", "proteinG"], ["nutritionMealCarbs", "carbsG"], ["nutritionMealFat", "fatG"]]) {
      byId(field).value = estimate?.[key] ?? "";
    }
    estimateSource = estimate ? (subtotal.genericItems ? "generic" : "label") : "";
    byId("nutritionMacrosDetails").open = Boolean(estimate);
    byId("nutritionEstimateNote").textContent = estimateNote(selectedParts);
  }

  function renderSelectedParts({ updateEstimate = true } = {}) {
    const list = byId("nutritionSelectedIngredients"); list.replaceChildren();
    const entries = Object.entries(selectedParts).filter(([id, count]) => foodCatalog[id] && count > 0);
    if (!entries.length) list.append(label("Aún no agregas ingredientes."));
    for (const [id, count] of entries) {
      const row = document.createElement("div"); row.className = "nutrition-selected-row";
      const name = document.createElement("span"); name.textContent = `${foodCatalog[id].name} · ${foodCatalog[id].portion}`;
      const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−";
      minus.setAttribute("aria-label", `Quitar una unidad de ${foodCatalog[id].name}`);
      minus.addEventListener("click", () => changePart(id, -1));
      const amount = document.createElement("strong"); amount.textContent = String(count);
      const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+";
      plus.setAttribute("aria-label", `Agregar una unidad de ${foodCatalog[id].name}`);
      plus.addEventListener("click", () => changePart(id, 1));
      row.append(name, minus, amount, plus); list.append(row);
    }
    if (updateEstimate) refreshPartEstimate();
  }

  function changePart(id, delta) {
    const count = Math.max(0, Math.min(99, (selectedParts[id] || 0) + delta));
    if (count) selectedParts[id] = count;
    else delete selectedParts[id];
    renderSelectedParts();
  }

  function renderIngredientChoices() {
    const list = byId("nutritionIngredientChoices"); list.replaceChildren();
    const foods = foodsForSlot(selectedSlot, byId("nutritionIngredientSearch").value);
    if (!foods.length) list.append(label("No encontré ese alimento. Puedes describirlo en la nota."));
    for (const item of foods) {
      const button = document.createElement("button"); button.type = "button";
      const name = document.createElement("strong"); name.textContent = `${item.name}  +`;
      const detail = document.createElement("small"); detail.textContent = `${item.portion} · ${item.source === "label" ? "" : "≈ "}${item.kcal} kcal`;
      button.append(name, detail);
      button.addEventListener("click", () => changePart(item.id, 1));
      list.append(button);
    }
  }

  function openMeal(slotId = "other", entry = null, initialParts = {}) {
    selectedSlot = slotId;
    editingId = entry?.id || "";
    selectedParts = { ...(entry?.parts || initialParts) };
    byId("nutritionEntryTitle").textContent = entry ? "Editar comida registrada" : "Registrar lo que comiste";
    byId("nutritionEntryMessage").classList.add("hidden");
    byId("nutritionMealTime").value = entry?.time || localTime();
    byId("nutritionMealText").value = entry ? (entry.parts && Object.keys(entry.parts).length ? entry.note || "" : entry.text) : "";
    byId("nutritionIngredientSearch").value = "";
    renderIngredientChoices();
    renderSelectedParts({ updateEstimate: false });
    const estimate = estimateParts(selectedParts);
    const subtotal = knownPartsSubtotal(selectedParts);
    estimateSource = entry?.estimateSource || (estimate ? (subtotal.genericItems ? "generic" : "label") : "");
    for (const [field, key] of [["nutritionMealCalories", "caloriesKcal"], ["nutritionMealProtein", "proteinG"], ["nutritionMealCarbs", "carbsG"], ["nutritionMealFat", "fatG"]]) {
      byId(field).value = entry?.[key] ?? estimate?.[key] ?? "";
    }
    byId("nutritionMacrosDetails").open = Boolean(estimate || (entry && ["caloriesKcal", "proteinG", "carbsG", "fatG"].some(key => entry[key] !== null)));
    byId("nutritionEstimateNote").textContent = estimateNote(selectedParts);
    dialog.showModal();
    byId("nutritionIngredientSearch").focus();
  }

  function saveMeal(event) {
    event.preventDefault();
    const note = byId("nutritionMealText").value.trim();
    const text = [describeParts(selectedParts), note].filter(Boolean).join(" · ");
    if (!text) {
      byId("nutritionEntryMessage").textContent = "Agrega al menos un ingrediente o describe lo que comiste en la nota.";
      byId("nutritionEntryMessage").classList.remove("hidden");
      return;
    }
    const previous = editingId ? repository.getNutritionEntry(editingId) : null;
    try {
      repository.saveNutritionEntry({ id: editingId || newId(), dateISO: selectedDate, kind: "meal", slotId: selectedSlot,
        time: byId("nutritionMealTime").value, text, note, parts: selectedParts, estimateSource,
        caloriesKcal: numberValue("nutritionMealCalories"), proteinG: numberValue("nutritionMealProtein"),
        carbsG: numberValue("nutritionMealCarbs"), fatG: numberValue("nutritionMealFat"),
        createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      dialog.close();
      render();
      showToast("Comida guardada en tu diario.");
    } catch (error) {
      byId("nutritionEntryMessage").textContent = error.message;
      byId("nutritionEntryMessage").classList.remove("hidden");
    }
  }

  function addWater(ml) {
    const amountMl = Number(ml);
    if (!Number.isInteger(amountMl) || amountMl < 1 || amountMl > 3000) return showToast("Ingresa una cantidad entre 1 y 3000 ml.");
    repository.saveNutritionEntry({ id: newId(), dateISO: selectedDate, kind: "water", amountMl,
      time: localTime(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    render();
  }

  function deleteEntry(entry) {
    if (!window.confirm(`¿Quitar este ${entry.kind === "water" ? "vaso de agua" : "registro de comida"}?`)) return;
    repository.saveNutritionEntry({ ...entry, deleted: true, updatedAt: new Date().toISOString() });
    render();
  }

  function appendEntry(container, entry) {
    const row = document.createElement("div");
    row.className = "nutrition-entry";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    const mealText = Object.keys(entry.parts || {}).length ? [describeParts(entry.parts), entry.note].filter(Boolean).join(" · ") : entry.text;
    title.textContent = `${entry.time || "—"} · ${entry.kind === "water" ? `${entry.amountMl} ml agua` : mealText}`;
    body.append(title);
    if (entry.kind === "meal") {
      const storedMetrics = ["caloriesKcal", "proteinG", "carbsG", "fatG"].some(key => entry[key] !== null);
      const metrics = nutritionEntryWithEstimate(entry);
      if (["caloriesKcal", "proteinG", "carbsG", "fatG"].some(key => metrics[key] != null)) {
        const parts = [["caloriesKcal", "kcal"], ["proteinG", "g proteína"], ["carbsG", "g carbohidratos"], ["fatG", "g grasas"]]
          .filter(([key]) => metrics[key] !== null && metrics[key] !== undefined).map(([key, unit]) => `${metrics[key]} ${unit}`);
        const small = document.createElement("small");
        small.textContent = `${metrics.estimateSource === "generic" ? "≈ " : ""}${parts.join(" · ")}${!storedMetrics ? " · estimación nueva; abre Editar para guardarla" : ""}`;
        body.append(small);
      }
    }
    row.append(body);
    if (entry.kind === "meal") {
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Editar";
      edit.addEventListener("click", () => openMeal(entry.slotId, entry)); row.append(edit);
    }
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Quitar";
    remove.addEventListener("click", () => deleteEntry(entry)); row.append(remove);
    container.append(row);
  }

  function render() {
    byId("nutritionDate").value = selectedDate;
    const strip = byId("nutritionWeekStrip"); strip.replaceChildren();
    weekDays(selectedDate).forEach((dateISO, index) => {
      const button = document.createElement("button"); button.type = "button";
      button.classList.toggle("active", dateISO === selectedDate);
      const count = repository.listNutritionEntries(dateISO).filter(entry => !entry.deleted && entry.kind === "meal").length;
      button.innerHTML = `<span>${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][index]}</span><strong>${Number(dateISO.slice(-2))}</strong><small>${count ? `${count} comida${count === 1 ? "" : "s"}` : "—"}</small>`;
      button.addEventListener("click", () => { selectedDate = dateISO; render(); });
      strip.append(button);
    });
    const allEntries = repository.listNutritionEntries(selectedDate).filter(entry => !entry.deleted);
    const planMode = allEntries.find(entry => entry.kind === "plan")?.planMode || "default";
    const plan = nutritionPlanForDate(selectedDate, planMode);
    byId("nutritionDayMode").value = planMode;
    byId("nutritionDayTitle").textContent = plan.name;
    byId("nutritionDayDescription").textContent = plan.detail;
    byId("nutritionProteinTarget").textContent = "Guía del plan: 100–120 g de proteína/día";
    byId("nutritionWaterTarget").textContent = `Guía de agua: ${(plan.waterMinMl / 1000).toLocaleString("es-CL")}–${(plan.waterMaxMl / 1000).toLocaleString("es-CL")} L`;
    byId("nutritionHydrationTip").textContent = plan.hydration;
    const context = byId("nutritionActivityContext"); context.replaceChildren();
    const activities = repository.list().filter(item => item.dateISO === selectedDate);
    const primaryActivities = activities.filter(isMainDayRecord);
    const complements = activities.filter(isComplementaryActivity);
    const mainActivity = primaryActivities.find(item => item.category === "tennis")
      || primaryActivities.find(item => item.category === "physical")
      || primaryActivities.find(item => item.category === "cardio")
      || primaryActivities.find(item => item.category === "rest");
    const activityLine = document.createElement("p");
    activityLine.textContent = primaryActivities.length
      ? `Actividad principal registrada: ${primaryActivities.map(recordTitle).join(" · ")}.${complements.length ? ` Además, ${complements.length} sesión${complements.length === 1 ? "" : "es"} complementaria${complements.length === 1 ? "" : "s"}.` : ""}`
      : complements.length ? `${complements.length} sesión${complements.length === 1 ? "" : "es"} complementaria${complements.length === 1 ? "" : "s"} registrada${complements.length === 1 ? "" : "s"}. La actividad principal del día sigue pendiente.`
      : "Aún no hay una actividad registrada en TGTrain este día.";
    context.append(activityLine);
    const wearable = getWearableData();
    const dayData = (wearable.days || []).find(item => item.dateISO === selectedDate);
    const bandLine = document.createElement("p");
    const bandParts = [];
    if (dayData && Number.isFinite(Number(dayData.steps))) bandParts.push(`${Number(dayData.steps).toLocaleString("es-CL")} pasos`);
    if (dayData && Number(dayData.sleepMinutes) > 0) bandParts.push(`${Math.floor(dayData.sleepMinutes / 60)} h ${String(dayData.sleepMinutes % 60).padStart(2, "0")} min de sueño`);
    bandLine.textContent = bandParts.length ? `Pulsera: ${bandParts.join(" · ")}.` : "Pulsera: sin pasos o sueño compartidos para este día.";
    context.append(bandLine);
    const linked = activities.filter(item => item.wearableSnapshot);
    if (linked.length) {
      const line = document.createElement("p");
      line.textContent = linked.map(item => {
        const band = item.wearableSnapshot;
        const metrics = [Number.isFinite(Number(band.heartRateAvgBpm)) && band.heartRateAvgBpm !== null ? `${Math.round(band.heartRateAvgBpm)} lpm media` : "",
          Number.isFinite(Number(band.activeCaloriesKcal)) && band.activeCaloriesKcal !== null ? `${Math.round(band.activeCaloriesKcal)} kcal activas estimadas` : ""].filter(Boolean);
        return `${recordTitle(item)}: ${metrics.length ? metrics.join(" · ") : "sin pulso ni kcal compartidos"}`;
      }).join(". ") + ".";
      context.append(line);
    }
    const caveat = document.createElement("small");
    caveat.textContent = "Estos datos de la pulsera son contexto: no se descuentan de las comidas ni cambian por sí solos tu pauta de alimentación o hidratación.";
    context.append(caveat);
    const day = new Date(`${selectedDate}T12:00:00Z`).getUTCDay();
    const expected = ["recovery", "physical", "tennis", "physical", "tennis", "physical", "other"][day];
    const actual = mainActivity?.category === "rest" ? "recovery"
      : mainActivity?.category === "cardio" ? "other"
        : ["physical", "tennis"].includes(mainActivity?.category) ? mainActivity.category : "";
    if (actual && actual !== expected && planMode === "default") {
      const hint = document.createElement("div"); hint.className = "nutrition-plan-adjust";
      const message = document.createElement("span");
      message.textContent = "Tu actividad real cambió respecto a la semana base. Puedes ajustar la guía, sin alterar lo que ya registraste.";
      const change = document.createElement("button"); change.type = "button"; change.textContent = "Usar guía para hoy";
      change.addEventListener("click", () => {
        const id = `nutrition-plan-${selectedDate}`; const now = new Date().toISOString();
        repository.saveNutritionEntry({ id, dateISO: selectedDate, kind: "plan", planMode: actual, createdAt: now, updatedAt: now });
        render();
      });
      hint.append(message, change); context.append(hint);
    }
    const entries = allEntries.filter(entry => entry.kind !== "plan");
    const totals = nutritionDayTotals(entries.map(nutritionEntryWithEstimate));
    const summary = byId("nutritionSummary");
    summary.replaceChildren();
    for (const [value, title] of [[totals.meals, "Comidas"], [`${(totals.waterMl / 1000).toLocaleString("es-CL")} L`, "Agua anotada"],
      [totals.proteinKnownMeals ? `${Math.round(totals.proteinG)} g` : "—", `Proteína estimada/anotada${totals.proteinKnownMeals < totals.meals ? " (parcial)" : ""}`],
      [totals.caloriesKnownMeals ? Math.round(totals.caloriesKcal) : "—", `kcal estimadas/anotadas${totals.caloriesKnownMeals < totals.meals ? " (parcial)" : ""}`]]) {
      const tile = document.createElement("div"); const strong = document.createElement("strong"); strong.textContent = value;
      tile.append(strong, label(title)); summary.append(tile);
    }
    const slots = byId("nutritionSlots"); slots.replaceChildren();
    plan.slots.forEach(item => {
      const card = document.createElement("article"); card.className = "nutrition-slot";
      const heading = document.createElement("div"); heading.className = "nutrition-slot-heading";
      const title = document.createElement("h3"); title.textContent = item.title;
      heading.append(label(item.time), title); card.append(heading);
      if (item.tip) { const tip = document.createElement("p"); tip.textContent = item.tip; card.append(tip); }
      const add = document.createElement("button"); add.type = "button"; add.className = "nutrition-build-button";
      add.textContent = `+ Armar ${item.title.toLowerCase()} por ingredientes`;
      add.addEventListener("click", () => openMeal(item.id)); card.append(add);
      if (item.options.length) {
        const guide = document.createElement("details"); guide.className = "nutrition-plan-suggestions";
        const summary = document.createElement("summary"); summary.textContent = "Ver ideas de tu planificación";
        const list = document.createElement("ul");
        item.options.forEach(option => { const line = document.createElement("li"); line.textContent = option; list.append(line); });
        guide.append(summary, list); card.append(guide);
      }
      entries.filter(entry => entry.kind === "meal" && entry.slotId === item.id).forEach(entry => appendEntry(card, entry));
      slots.append(card);
    });
    const visibleSlotIds = new Set(plan.slots.map(item => item.id));
    const extras = entries.filter(entry => entry.kind === "meal" && !visibleSlotIds.has(entry.slotId));
    if (extras.length) {
      const card = document.createElement("article"); card.className = "nutrition-slot";
      const title = document.createElement("h3"); title.textContent = "Otras comidas registradas"; card.append(title);
      extras.forEach(entry => appendEntry(card, entry)); slots.append(card);
    }
    const waters = entries.filter(entry => entry.kind === "water");
    if (waters.length) {
      const card = document.createElement("article"); card.className = "nutrition-slot nutrition-water-log";
      const title = document.createElement("h3"); title.textContent = "Agua registrada"; card.append(title);
      waters.forEach(entry => appendEntry(card, entry)); slots.append(card);
    }
  }

  function initialize() {
    byId("nutritionPreviousDay").addEventListener("click", () => { selectedDate = addDaysISO(selectedDate, -1); render(); });
    byId("nutritionNextDay").addEventListener("click", () => { selectedDate = addDaysISO(selectedDate, 1); render(); });
    byId("nutritionDate").addEventListener("change", event => { if (event.target.value) { selectedDate = event.target.value; render(); } });
    byId("nutritionDayMode").addEventListener("change", event => {
      const id = `nutrition-plan-${selectedDate}`;
      const previous = repository.getNutritionEntry(id);
      repository.saveNutritionEntry({ id, dateISO: selectedDate, kind: "plan", planMode: event.target.value,
        createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
      render();
    });
    document.querySelectorAll("[data-water-ml]").forEach(button => button.addEventListener("click", () => addWater(button.dataset.waterMl)));
    byId("nutritionCustomWater").addEventListener("click", () => {
      const value = window.prompt("¿Cuántos ml de agua bebiste?", "300"); if (value !== null) addWater(value);
    });
    byId("nutritionExtraMeal").addEventListener("click", () => openMeal());
    byId("nutritionIngredientSearch").addEventListener("input", renderIngredientChoices);
    for (const id of ["nutritionMealCalories", "nutritionMealProtein", "nutritionMealCarbs", "nutritionMealFat"])
      byId(id).addEventListener("input", () => { estimateSource = "manual"; });
    byId("nutritionEntryClose").addEventListener("click", () => dialog.close());
    byId("nutritionEntryForm").addEventListener("submit", saveMeal);
    render();
  }

  return { initialize, render };
}
