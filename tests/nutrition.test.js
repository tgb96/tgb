import test from "node:test";
import assert from "node:assert/strict";
import { nutritionDayTotals, nutritionModeForPlannedSession, nutritionPlanForDate, normalizeNutritionEntries, plannedActivityTime, plannedNutritionContext } from "../assets/js/nutrition.js";
import { describeParts, estimateParts, foodCatalog, foodsForSlot, isSelectableFood, knownPartsSubtotal, nutritionEntryWithEstimate, summarizeParts } from "../assets/js/nutrition-presets.js";
import { createRepository } from "../assets/js/storage.js";

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test("guía de tenis, físico y escenarios de sábado conserva las alternativas del entrenador", () => {
  const tuesday = nutritionPlanForDate("2026-09-22");
  assert.equal(tuesday.waterMaxMl, 3000);
  assert.ok(tuesday.slots.some(slot => slot.id === "post" && slot.time.includes("22:15")));
  assert.ok(nutritionPlanForDate("2026-09-21").slots.some(slot => slot.id === "pre"));
  assert.equal(nutritionPlanForDate("2026-09-26").name, "Sin partido · trekking o cardio");
  assert.equal(nutritionPlanForDate("2026-09-26", "late").name, "Partido en la tarde");
  assert.doesNotMatch(nutritionPlanForDate("2026-09-26", "early").detail, /ejemplo|no un partido programado/);
  assert.ok(nutritionPlanForDate("2026-09-21").slots.find(slot => slot.id === "breakfast").options.includes("Pan integral con jamón y queso"));
  assert.ok(nutritionPlanForDate("2026-09-22").slots.find(slot => slot.id === "morning").options.includes("Pan integral pequeño con jamón y queso"));
  for (const mode of ["default", "physical", "tennis", "recovery", "match", "early", "late", "other", "tennisLight", "trekking", "cardioSoft"]) {
    assert.doesNotMatch(JSON.stringify(nutritionPlanForDate("2026-09-26", mode)), /arepa|atún|avena|miel|kiwi/i);
  }
});

test("la nutrición sigue la actividad y la hora de la planificación deportiva", () => {
  const match = time => ({ startTime: time, primaryOptionId: "match", options: [{ id: "match", title: "Partido de escalerilla", category: "tennis", prefill: { tennisTypeId: "match" } }] });
  assert.equal(plannedActivityTime(match("13:45")), "13:45");
  assert.equal(nutritionModeForPlannedSession(match("13:45")), "early");
  assert.equal(nutritionModeForPlannedSession(match("17:15")), "late");
  assert.equal(nutritionModeForPlannedSession(match("")), "match");
  assert.deepEqual(plannedNutritionContext(match("13:45")), { mode: "early", title: "Partido de escalerilla", summary: undefined, time: "13:45", category: "tennis", isMatch: true });
  assert.equal(nutritionModeForPlannedSession({ primaryOptionId: "rest", options: [{ id: "rest", category: "rest" }] }), "recovery");
  assert.equal(nutritionModeForPlannedSession({ primaryOptionId: "trek", options: [{ id: "trek", category: "cardio", prefill: { cardioTypeId: "trekking" } }] }), "trekking");
});

test("los rangos de kcal del entrenador dependen del día y del escenario real", () => {
  const target = (date, mode) => {
    const { caloriesMinKcal, caloriesMaxKcal } = nutritionPlanForDate(date, mode);
    return [caloriesMinKcal, caloriesMaxKcal];
  };
  assert.deepEqual(target("2026-09-21"), [2200, 2400]);
  assert.deepEqual(target("2026-09-22"), [2400, 2600]);
  assert.deepEqual(target("2026-09-23"), [2100, 2300]);
  assert.deepEqual(target("2026-09-24"), [2400, 2600]);
  assert.deepEqual(target("2026-09-25"), [2200, 2400]);
  assert.deepEqual(target("2026-09-26", "early"), [2500, 2700]);
  assert.deepEqual(target("2026-09-26", "late"), [2500, 2700]);
  assert.deepEqual(target("2026-09-26", "tennisLight"), [2300, 2500]);
  assert.deepEqual(target("2026-09-26", "trekking"), [2400, 2700]);
  assert.deepEqual(target("2026-09-26", "recovery"), [2000, 2200]);
  assert.deepEqual(target("2026-09-27"), [2000, 2200]);
  assert.deepEqual(target("2026-09-23", "physical"), [2100, 2300]);
  assert.deepEqual(target("2026-09-22", "physical"), [2200, 2400]);
  assert.deepEqual(target("2026-09-22", "cardioSoft"), [2000, 2200]);
  assert.equal(Object.values(normalizeNutritionEntries([{ id: "scenario", dateISO: "2026-09-26", kind: "plan", planMode: "trekking" }]))[0].planMode, "trekking");
});

test("los ingredientes se suman por unidad con etiqueta o porciones promedio", () => {
  assert.equal(foodCatalog.integralBread.kcal, 73);
  assert.deepEqual(estimateParts({ semiIntegralArtisanBread: 2 }), { caloriesKcal: 224, proteinG: 8, carbsG: 42, fatG: 3 });
  assert.equal(foodCatalog.semiIntegralArtisanBread.portion, "1 rebanada · aprox. 45 g");
  assert.ok(Object.values(foodCatalog).every(food => food.portion));
  assert.ok(Object.values(foodCatalog).every(food => Number.isFinite(food.kcal)));
  assert.equal(Object.values(foodCatalog).filter(food => food.source === "label").length, 1);
  assert.equal(foodCatalog.avocado.portion, "1 porción normal · aprox. 50 g");
  assert.deepEqual(
    { name: foodCatalog.rice.name, portion: foodCatalog.rice.portion, kcal: foodCatalog.rice.kcal, proteinG: foodCatalog.rice.proteinG, carbsG: foodCatalog.rice.carbsG, fatG: foodCatalog.rice.fatG, source: foodCatalog.rice.source },
    { name: "Arroz blanco", portion: "1 porción habitual · 151 g", kcal: 196, proteinG: 4.1, carbsG: 42.5, fatG: 0.4, source: "measured" }
  );
  assert.equal(foodCatalog.arepa, undefined);
  assert.equal(foodCatalog.tuna, undefined);
  assert.deepEqual(estimateParts({ integralBread: 3 }), { caloriesKcal: 219, proteinG: 11.3, carbsG: 36.9, fatG: 2.9 });
  assert.deepEqual(estimateParts({ integralBread: 3, avocado: 2, cheeseSlice: 1, hamSlice: 1, butter: 1, applePortion: 1 }),
    { caloriesKcal: 559, proteinG: 22.5, carbsG: 56.8, fatG: 29.4 });
  assert.equal(knownPartsSubtotal({ integralBread: 3, avocado: 2 }).caloriesKcal, 379);
  assert.equal(estimateParts({ integralBread: 3, futureFood: 1 }), null);
  assert.match(describeParts({ integralBread: 3, avocado: 2 }), /3 × pan integral/);
  assert.equal(summarizeParts({ integralBread: 3, avocado: 2, cheeseSlice: 1, hamSlice: 1, butter: 1, applePortion: 1 }),
    "3 rebanadas de pan integral con palta, queso, jamón y mantequilla · ½ manzana");
  assert.ok(foodsForSlot("breakfast").some(food => food.id === "yogurtPlain"));
  assert.ok(foodsForSlot("breakfast").some(food => food.id === "semiIntegralArtisanBread"));
  assert.ok(foodsForSlot("lunch").some(food => food.id === "bolognese"));
  assert.ok(foodsForSlot("breakfast", "pescado").some(food => food.id === "fish"));
  assert.ok(!foodsForSlot("lunch").some(food => food.name.includes("Atún")));
  for (const id of ["oats", "honey", "kiwi"]) {
    assert.equal(isSelectableFood(id), false);
    assert.ok(!foodsForSlot("breakfast").some(food => food.id === id));
    assert.ok(!foodsForSlot("breakfast", foodCatalog[id].name).some(food => food.id === id));
    assert.ok(!foodsForSlot("lunch", foodCatalog[id].name).some(food => food.id === id));
  }
  assert.deepEqual(estimateParts({ kiwi: 1, oats: 1, honey: 1 }),
    { caloriesKcal: 106, proteinG: 2.5, carbsG: 23.3, fatG: 1.1 });
});

test("una comida ya guardada recibe la estimación visible sin modificar el registro original", () => {
  const entry = Object.values(normalizeNutritionEntries([{
    id: "existing", dateISO: "2026-09-24", kind: "meal", text: "Desayuno", parts: {
      integralBread: 3, avocado: 2, cheeseSlice: 1, hamSlice: 1, butter: 1, applePortion: 1
    }
  }]))[0];
  const shown = nutritionEntryWithEstimate(entry);
  assert.equal(entry.caloriesKcal, null);
  assert.equal(shown.caloriesKcal, 559);
  assert.equal(shown.estimateSource, "generic");
  assert.equal(nutritionDayTotals([shown]).caloriesKcal, 559);
  assert.equal(nutritionEntryWithEstimate({ ...entry, caloriesKcal: 510, estimateSource: "manual" }).caloriesKcal, 510);
});

test("nutrientes sin dato quedan desconocidos y no se inventan al sumar", () => {
  const entries = Object.values(normalizeNutritionEntries([
    { id: "a", dateISO: "2026-09-22", kind: "meal", text: "Huevo y pan", proteinG: 15 },
    { id: "b", dateISO: "2026-09-22", kind: "meal", text: "Almuerzo sin etiqueta" },
    { id: "c", dateISO: "2026-09-22", kind: "water", amountMl: 500 },
    { id: "d", dateISO: "2026-09-22", kind: "plan", planMode: "physical" }
  ]));
  const totals = nutritionDayTotals(entries);
  assert.equal(totals.meals, 2);
  assert.equal(totals.mealsWithMacros, 1);
  assert.equal(totals.proteinG, 15);
  assert.equal(totals.caloriesKnownMeals, 0);
  assert.equal(totals.proteinKnownMeals, 1);
  assert.equal(totals.waterMl, 500);
  assert.equal(entries.find(item => item.id === "b").proteinG, null);
});

test("conserva comentarios nutricionales y resúmenes mensuales sin sumarlos como comidas", () => {
  const entries = Object.values(normalizeNutritionEntries([
    {
      id: "nutrition-analysis-2026-09-25", dateISO: "2026-09-25", kind: "nutrition-analysis",
      title: "Comentario nutricional", summary: "Registro parcial pero bien encaminado.",
      sections: [{ title: "Lo positivo", items: ["Incluiste proteína."] }], encouragement: "Sigue registrando.",
      stats: { meals: 3, proteinG: 90 }, generatedAt: "2026-09-25T20:00:00.000Z"
    },
    {
      id: "monthly-summary-2026-08", dateISO: "2026-08-31", kind: "monthly-summary",
      title: "Resumen de agosto", summary: "Mes constante.", periodStartISO: "2026-08-01", periodEndISO: "2026-08-31",
      sections: [{ title: "Entrenamiento", items: ["Hubo 12 sesiones."] }], stats: { sessions: 12 }
    }
  ]));
  assert.equal(entries.length, 2);
  assert.equal(entries[0].sections[0].items[0], "Incluiste proteína.");
  assert.equal(entries[1].stats.sessions, 12);
  assert.equal(nutritionDayTotals(entries).meals, 0);
});

test("comidas, agua, cambio de plan y eliminaciones viajan en respaldo", () => {
  const repository = createRepository(memoryStorage());
  const dateISO = "2026-09-23";
  const createdAt = "2026-09-23T14:00:00.000Z";
  repository.saveNutritionEntry({ id: "meal-1", dateISO, kind: "meal", slotId: "lunch", text: "2 × arroz · pollo", note: "Sin aceite", parts: { rice: 2, chicken: 1 }, proteinG: 30, estimateSource: "manual", createdAt, updatedAt: createdAt });
  repository.saveNutritionEntry({ id: "water-1", dateISO, kind: "water", amountMl: 250, createdAt, updatedAt: createdAt });
  repository.saveNutritionEntry({ id: `nutrition-plan-${dateISO}`, dateISO, kind: "plan", planMode: "recovery", createdAt, updatedAt: createdAt });
  const backup = repository.backup();
  const restored = createRepository(memoryStorage());
  restored.importMerge(backup);
  assert.equal(restored.listNutritionEntries(dateISO).length, 3);
  assert.equal(restored.getNutritionEntry("meal-1").proteinG, 30);
  assert.deepEqual(restored.getNutritionEntry("meal-1").parts, { rice: 2, chicken: 1 });
  assert.equal(restored.getNutritionEntry("meal-1").note, "Sin aceite");
  assert.equal(restored.getNutritionEntry("meal-1").estimateSource, "manual");
  assert.equal(restored.getNutritionEntry(`nutrition-plan-${dateISO}`).planMode, "recovery");
  restored.saveNutritionEntry({ ...restored.getNutritionEntry("meal-1"), deleted: true, updatedAt: "2026-09-23T15:00:00.000Z" });
  assert.equal(nutritionDayTotals(restored.listNutritionEntries(dateISO)).meals, 0);
});
