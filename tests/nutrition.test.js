import test from "node:test";
import assert from "node:assert/strict";
import { nutritionDayTotals, nutritionPlanForDate, normalizeNutritionEntries } from "../assets/js/nutrition.js";
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
  assert.equal(nutritionPlanForDate("2026-09-26", "late").name, "Partido a las 17:15");
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
  repository.saveNutritionEntry({ id: "meal-1", dateISO, kind: "meal", slotId: "lunch", text: "Arroz y pollo", proteinG: 30, createdAt, updatedAt: createdAt });
  repository.saveNutritionEntry({ id: "water-1", dateISO, kind: "water", amountMl: 250, createdAt, updatedAt: createdAt });
  repository.saveNutritionEntry({ id: `nutrition-plan-${dateISO}`, dateISO, kind: "plan", planMode: "recovery", createdAt, updatedAt: createdAt });
  const backup = repository.backup();
  const restored = createRepository(memoryStorage());
  restored.importMerge(backup);
  assert.equal(restored.listNutritionEntries(dateISO).length, 3);
  assert.equal(restored.getNutritionEntry("meal-1").proteinG, 30);
  assert.equal(restored.getNutritionEntry(`nutrition-plan-${dateISO}`).planMode, "recovery");
  restored.saveNutritionEntry({ ...restored.getNutritionEntry("meal-1"), deleted: true, updatedAt: "2026-09-23T15:00:00.000Z" });
  assert.equal(nutritionDayTotals(restored.listNutritionEntries(dateISO)).meals, 0);
});
