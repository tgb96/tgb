import { nutritionDayTotals, nutritionPlanForDate } from "./nutrition.js?v=68";
import { estimatePreset, foodCatalog, presetsForSlot } from "./nutrition-presets.js?v=68";
import { addDaysISO, getChileDateISO, recordTitle, weekDays } from "./utils.js?v=67";

const byId = id => document.getElementById(id);
const newId = () => `nutrition-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const localTime = () => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const numberValue = id => byId(id).value === "" ? null : Number(byId(id).value);
const label = text => { const element = document.createElement("span"); element.textContent = text; return element; };
const estimateLine = value => `≈ ${value.caloriesKcal} kcal · proteína ${value.proteinG} g · carbos ${value.carbsG} g · grasas ${value.fatG} g`;

export function createNutritionUI(repository, { showToast = () => {}, getWearableData = () => ({ days: [], sessions: [] }) } = {}) {
  let selectedDate = getChileDateISO();
  let editingId = "";
  let selectedSlot = "other";
  const dialog = byId("nutritionEntryDialog");

  function openMeal(slotId = "other", suggestion = "", entry = null, estimate = null) {
    selectedSlot = slotId;
    editingId = entry?.id || "";
    byId("nutritionEntryTitle").textContent = entry ? "Editar comida registrada" : "Registrar lo que comiste";
    byId("nutritionEntryMessage").classList.add("hidden");
    byId("nutritionMealTime").value = entry?.time || localTime();
    byId("nutritionMealText").value = entry?.text || suggestion;
    for (const [field, key] of [["nutritionMealCalories", "caloriesKcal"], ["nutritionMealProtein", "proteinG"], ["nutritionMealCarbs", "carbsG"], ["nutritionMealFat", "fatG"]]) {
      byId(field).value = entry?.[key] ?? estimate?.[key] ?? "";
    }
    byId("nutritionMacrosDetails").open = Boolean(estimate || (entry && ["caloriesKcal", "proteinG", "carbsG", "fatG"].some(key => entry[key] !== null)));
    byId("nutritionEstimateNote").textContent = estimate
      ? "Valores orientativos para la porción descrita. Si cambias cantidad, marca o preparación, corrige también los números antes de guardar."
      : "Puedes anotar kcal y macros si conoces las cantidades. Si no, déjalos en blanco.";
    dialog.showModal();
    byId("nutritionMealText").focus();
  }

  function saveMeal(event) {
    event.preventDefault();
    const text = byId("nutritionMealText").value.trim();
    if (!text) {
      byId("nutritionEntryMessage").textContent = "Describe lo que realmente comiste y, si puedes, la cantidad.";
      byId("nutritionEntryMessage").classList.remove("hidden");
      return;
    }
    const previous = editingId ? repository.getNutritionEntry(editingId) : null;
    try {
      repository.saveNutritionEntry({ id: editingId || newId(), dateISO: selectedDate, kind: "meal", slotId: selectedSlot,
        time: byId("nutritionMealTime").value, text,
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
    title.textContent = `${entry.time || "—"} · ${entry.kind === "water" ? `${entry.amountMl} ml agua` : entry.text}`;
    body.append(title);
    if (entry.kind === "meal") {
      const parts = [["caloriesKcal", "kcal"], ["proteinG", "g proteína"], ["carbsG", "g carbohidratos"], ["fatG", "g grasas"]]
        .filter(([key]) => entry[key] !== null).map(([key, unit]) => `${entry[key]} ${unit}`);
      if (parts.length) { const small = document.createElement("small"); small.textContent = parts.join(" · "); body.append(small); }
    }
    row.append(body);
    if (entry.kind === "meal") {
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Editar";
      edit.addEventListener("click", () => openMeal(entry.slotId, "", entry)); row.append(edit);
    }
    const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Quitar";
    remove.addEventListener("click", () => deleteEntry(entry)); row.append(remove);
    container.append(row);
  }

  function renderFoodCatalog() {
    const list = byId("nutritionFoodCatalogList"); list.replaceChildren();
    Object.values(foodCatalog).forEach(food => {
      const button = document.createElement("button"); button.type = "button";
      const name = document.createElement("strong"); name.textContent = `${food.name} · ${food.portion}`;
      const estimate = { caloriesKcal: food.kcal, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
      const metrics = document.createElement("small"); metrics.textContent = estimateLine(estimate);
      button.append(name, metrics);
      button.addEventListener("click", () => openMeal("other", `${food.name} · ${food.portion}`, null, estimate));
      list.append(button);
    });
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
    const mainActivity = activities.find(item => item.category === "tennis")
      || activities.find(item => item.category === "physical")
      || activities.find(item => item.category === "cardio")
      || activities.find(item => item.category === "rest");
    const activityLine = document.createElement("p");
    activityLine.textContent = activities.length
      ? `Registrado en TGTrain: ${activities.slice(0, 4).map(recordTitle).join(" · ")}${activities.length > 4 ? ` y ${activities.length - 4} más` : ""}.`
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
    const totals = nutritionDayTotals(entries);
    const summary = byId("nutritionSummary");
    summary.replaceChildren();
    for (const [value, title] of [[totals.meals, "Comidas"], [`${(totals.waterMl / 1000).toLocaleString("es-CL")} L`, "Agua anotada"],
      [totals.proteinKnownMeals ? `${Math.round(totals.proteinG)} g` : "—", `Proteína anotada${totals.proteinKnownMeals < totals.meals ? " (parcial)" : ""}`],
      [totals.caloriesKnownMeals ? Math.round(totals.caloriesKcal) : "—", `kcal anotadas${totals.caloriesKnownMeals < totals.meals ? " (parcial)" : ""}`]]) {
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
      const options = document.createElement("div"); options.className = "nutrition-options";
      item.options.forEach(option => {
        const button = document.createElement("button"); button.type = "button"; button.textContent = `${option}  ＋`;
        button.setAttribute("aria-label", `Registrar: ${option}`);
        button.addEventListener("click", () => openMeal(item.id, option)); options.append(button);
      });
      card.append(options);
      const presets = presetsForSlot(item.id);
      if (presets.length) {
        const examples = document.createElement("details"); examples.className = "nutrition-preset-options";
        examples.open = ["breakfast", "morning"].includes(item.id);
        const summary = document.createElement("summary"); summary.textContent = `Ejemplos con porción y nutrientes aproximados (${presets.length})`;
        examples.append(summary);
        const list = document.createElement("div"); list.className = "nutrition-preset-list";
        presets.forEach(preset => {
          const estimate = estimatePreset(preset);
          const button = document.createElement("button"); button.type = "button";
          const title = document.createElement("strong"); title.textContent = preset.title;
          const metrics = document.createElement("small"); metrics.textContent = estimateLine(estimate);
          button.append(title, metrics);
          button.addEventListener("click", () => openMeal(item.id, preset.title, null, estimate));
          list.append(button);
        });
        examples.append(list); card.append(examples);
      }
      const other = document.createElement("button"); other.type = "button"; other.className = "nutrition-other-button";
      other.textContent = "+ Anotar algo diferente"; other.addEventListener("click", () => openMeal(item.id)); card.append(other);
      entries.filter(entry => entry.kind === "meal" && entry.slotId === item.id).forEach(entry => appendEntry(card, entry));
      slots.append(card);
    });
    const extras = entries.filter(entry => entry.slotId === "other" && entry.kind === "meal");
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
    renderFoodCatalog();
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
    byId("nutritionEntryClose").addEventListener("click", () => dialog.close());
    byId("nutritionEntryForm").addEventListener("submit", saveMeal);
    render();
  }

  return { initialize, render };
}
