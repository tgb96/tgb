import test from "node:test";
import assert from "node:assert/strict";
import { nutritionDayTotals, nutritionPlanForDate, normalizeNutritionEntries } from "../assets/js/nutrition.js";
import { describeParts, estimateParts, foodCatalog, foodsForSlot, isSelectableFood, knownPartsSubtotal, nutritionEntryWithEstimate } from "../assets/js/nutrition-presets.js";
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
  assert.equal(nutritionPlanForDate("2026-09-26", "late").name, "Escenario: partido tarde (ej. 17:15)");
  assert.match(nutritionPlanForDate("2026-09-26", "early").detail, /no un partido programado/);
  assert.ok(nutritionPlanForDate("2026-09-21").slots.find(slot => slot.id === "breakfast").options.includes("Pan integral con jamón y queso"));
  assert.ok(nutritionPlanForDate("2026-09-22").slots.find(slot => slot.id === "morning").options.includes("Pan integral pequeño con jamón y queso"));
  for (const mode of ["default", "physical", "tennis", "recovery", "early", "late", "other", "tennisLight", "trekking", "cardioSoft"]) {
    assert.doesNotMatch(JSON.stringify(nutritionPlanForDate("2026-09-26", mode)), /arepa|atún|avena|miel|kiwi/i);
  }
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
  assert.ok(Object.values(foodCatalog).every(food => food.portion));
  assert.ok(Object.values(foodCatalog).every(food => Number.isFinite(food.kcal)));
  assert.equal(Object.values(foodCatalog).filter(food => food.source === "label").length, 1);
  assert.equal(foodCatalog.avocado.portion, "1 porción normal · aprox. 50 g");
  assert.equal(foodCatalog.arepa, undefined);
  assert.equal(foodCatalog.tuna, undefined);
  assert.deepEqual(estimateParts({ integralBread: 3 }), { caloriesKcal: 219, proteinG: 11.3, carbsG: 36.9, fatG: 2.9 });
  assert.deepEqual(estimateParts({ integralBread: 3, avocado: 2, cheeseSlice: 1, hamSlice: 1, butter: 1, applePortion: 1 }),
    { caloriesKcal: 559, proteinG: 22.5, carbsG: 56.8, fatG: 29.4 });
  assert.equal(knownPartsSubtotal({ integralBread: 3, avocado: 2 }).caloriesKcal, 379);
  assert.equal(estimateParts({ integralBread: 3, futureFood: 1 }), null);
  assert.match(describeParts({ integralBread: 3, avocado: 2 }), /3 × pan integral/);
  assert.ok(foodsForSlot("breakfast").some(food => food.id === "yogurtPlain"));
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
