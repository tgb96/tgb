import { nutritionDayTotals, nutritionPlanForDate } from "./nutrition.js?v=66";
import { addDaysISO, getChileDateISO, weekDays } from "./utils.js?v=65";

const byId = id => document.getElementById(id);
const newId = () => `nutrition-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const localTime = () => new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
const numberValue = id => byId(id).value === "" ? null : Number(byId(id).value);
const label = text => { const element = document.createElement("span"); element.textContent = text; return element; };

export function createNutritionUI(repository, { showToast = () => {} } = {}) {
  let selectedDate = getChileDateISO();
  let editingId = "";
  let selectedSlot = "other";
  const dialog = byId("nutritionEntryDialog");

  function openMeal(slotId = "other", suggestion = "", entry = null) {
    selectedSlot = slotId;
    editingId = entry?.id || "";
    byId("nutritionEntryTitle").textContent = entry ? "Editar comida registrada" : "Registrar lo que comiste";
    byId("nutritionEntryMessage").classList.add("hidden");
    byId("nutritionMealTime").value = entry?.time || localTime();
    byId("nutritionMealText").value = entry?.text || suggestion;
    for (const [field, key] of [["nutritionMealCalories", "caloriesKcal"], ["nutritionMealProtein", "proteinG"], ["nutritionMealCarbs", "carbsG"], ["nutritionMealFat", "fatG"]]) {
      byId(field).value = entry?.[key] ?? "";
    }
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
