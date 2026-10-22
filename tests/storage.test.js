import test from "node:test";
import assert from "node:assert/strict";
import { createRepository, DATA_KEY, PREVIOUS_DATA_KEY } from "../assets/js/storage.js";

class FakeStorage {
  constructor(initial = {}) { this.values = new Map(Object.entries(initial)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function record(index = 1) {
  return {
    id: `record-${index}`,
    dateISO: "2026-08-24",
    category: "physical",
    categoryName: "Físico",
    routineId: "legs",
    routineName: "Fuerza de piernas",
    durationMinutes: 60,
    calories: 400,
    sensations: "Bien"
  };
}

test("migra automáticamente los datos v2 y elimina la copia anterior después de guardarlos", () => {
  const storage = new FakeStorage({ [PREVIOUS_DATA_KEY]: JSON.stringify({ schemaVersion: 2, records: [{
    id: "old",
    dateISO: "2026-08-20",
    activity: "Tenis",
    durationMinutes: 80,
    calories: 500,
    fatigue: 2,
    thumbPain: 0,
    legPain: 0
  }] }) });
  const repository = createRepository(storage);
  assert.equal(repository.list()[0].category, "tennis");
  assert.ok(storage.getItem(DATA_KEY));
  assert.equal(storage.getItem(PREVIOUS_DATA_KEY), null);
});

test("conserva más de 300 registros durante la migración antigua", () => {
  const legacy = Array.from({ length: 305 }, (_, index) => ({ ...record(index), activity: "Físico", category: undefined }));
  const repository = createRepository(new FakeStorage({ history: JSON.stringify(legacy) }));
  assert.equal(repository.list().length, 305);
});

test("crea, actualiza, elimina y respalda entrenamientos", () => {
  const repository = createRepository(new FakeStorage());
  repository.upsert(record(1));
  repository.upsert({ ...record(1), durationMinutes: 75 });
  assert.equal(repository.list().length, 1);
  assert.equal(repository.get("record-1").durationMinutes, 75);
  assert.match(repository.backup(), /"schemaVersion": 17/);
  assert.equal(repository.remove("record-1"), true);
  assert.equal(repository.list().length, 0);
});

test("combina respaldos anteriores con el historial actual", () => {
  const repository = createRepository(new FakeStorage());
  repository.upsert(record(1));
  const count = repository.importMerge(JSON.stringify({ schemaVersion: 2, records: [{
    id: "old-tennis",
    dateISO: "2026-08-21",
    activity: "Tenis",
    durationMinutes: 90,
    calories: 600
  }] }));
  assert.equal(count, 1);
  assert.equal(repository.list().length, 2);
});

test("notifica cambios locales y aplica cambios de la nube sin duplicarlos", () => {
  const repository = createRepository(new FakeStorage());
  const changes = [];
  const unsubscribe = repository.subscribe(change => changes.push(change));
  repository.upsert(record(1));
  repository.upsert({ ...record(1), durationMinutes: 75, updatedAt: "2026-09-08T12:00:00.000Z" });
  assert.equal(changes.filter(change => change.type === "upsert").length, 2);
  assert.equal(repository.applyCloudRecord({ ...record(1), durationMinutes: 90, updatedAt: "2026-09-08T13:00:00.000Z" }), true);
  assert.equal(repository.get("record-1").durationMinutes, 90);
  assert.equal(changes.length, 2);
  assert.equal(repository.applyCloudDeletion("record-1", "2026-09-08T14:00:00.000Z"), true);
  assert.equal(repository.get("record-1"), null);
  unsubscribe();
});

test("guarda estimaciones faltantes una sola vez sin sobrescribir cifras manuales", () => {
  const repository = createRepository(new FakeStorage());
  const old = "2026-09-24T09:00:00.000Z";
  repository.saveNutritionEntry({ id: "breakfast", dateISO: "2026-09-24", kind: "meal", text: "Desayuno", parts: {
    integralBread: 3, avocado: 2, cheeseSlice: 1, hamSlice: 1, butter: 1, applePortion: 1
  }, createdAt: old, updatedAt: old });
  repository.saveNutritionEntry({ id: "corrected", dateISO: "2026-09-24", kind: "meal", text: "Desayuno corregido", parts: {
    integralBread: 3, avocado: 2
  }, caloriesKcal: 410, estimateSource: "manual", createdAt: old, updatedAt: old });
  const changes = [];
  repository.subscribe(change => changes.push(change));
  assert.equal(repository.fillMissingNutritionEstimates().length, 1);
  assert.equal(repository.getNutritionEntry("breakfast").caloriesKcal, 545);
  assert.equal(repository.getNutritionEntry("breakfast").estimateSource, "generic");
  assert.match(repository.getNutritionEntry("breakfast").text, /porción normal/);
  assert.equal(repository.getNutritionEntry("corrected").caloriesKcal, 410);
  assert.equal(repository.fillMissingNutritionEstimates().length, 0);
  assert.equal(changes.filter(change => change.type === "nutrition-upsert").length, 1);
  assert.match(repository.backup(), /"caloriesKcal": 545/);
});

test("guarda el plan semanal, lo respalda y acepta actualizaciones de la nube", () => {
  const repository = createRepository(new FakeStorage());
  const changes = [];
  repository.subscribe(change => changes.push(change));
  repository.saveWeekPlan({
    weekKey: "2026-W35",
    days: { "2026-08-24": { activityId: "physical:legs", label: "Día 1 · Piernas" } },
    updatedAt: "2026-08-20T12:00:00.000Z"
  });
  assert.equal(repository.getWeekPlan("2026-W35").days["2026-08-24"].activityId, "physical:legs");
  assert.equal(changes.at(-1).type, "plan-upsert");
  assert.match(repository.backup(), /"plans"/);
  assert.equal(repository.applyCloudPlan({
    weekKey: "2026-W35",
    days: { "2026-08-25": { activityId: "tennis", label: "Tenis" } },
    updatedAt: "2026-08-21T12:00:00.000Z"
  }), true);
  assert.equal(repository.getWeekPlan("2026-W35").days["2026-08-25"].activityId, "tennis");
});

test("guarda y respalda bloques completos importados para el entrenador", () => {
  const repository = createRepository(new FakeStorage());
  const changes = [];
  repository.subscribe(change => changes.push(change));
  const saved = repository.saveTrainingBlock({
    id: "bloque-octubre",
    title: "Bloque octubre",
    weeks: [{
      weekKey: "2026-W42",
      label: "Adaptación",
      sessions: [{
        dateISO: "2026-10-12",
        objective: "Fuerza controlada",
        options: [{ id: "legs", title: "Día 1", category: "physical", routineId: "legs" }]
      }]
    }]
  });
  assert.equal(saved.id, "bloque-octubre");
  assert.equal(repository.listTrainingBlocks().length, 1);
  assert.equal(changes.at(-1).type, "training-block-upsert");
  assert.match(repository.backup(), /bloque-octubre/);
});

test("guarda, respalda y sincroniza el perfil privado del entrenador", () => {
  const repository = createRepository(new FakeStorage());
  const changes = [];
  repository.subscribe(change => changes.push(change));
  repository.saveCoachProfile({
    profileText: "Objetivo: rendimiento para tenis.",
    equipment: "Mancuernas ajustables hasta 40 kg.\nKettlebell de 4,5 kg.",
    version: "tennis-v1",
    updatedAt: "2026-09-14T18:00:00.000Z"
  });
  assert.match(repository.getCoachProfile().equipment, /4,5 kg/);
  assert.equal(changes.at(-1).type, "coach-profile-upsert");
  assert.match(repository.backup(), /Objetivo: rendimiento para tenis/);
  assert.equal(repository.applyCloudCoachProfile({
    profileText: "Perfil actualizado.",
    equipment: "Mancuernas ajustables hasta 40 kg.",
    updatedAt: "2026-09-14T19:00:00.000Z"
  }), true);
  assert.equal(repository.getCoachProfile().profileText, "Perfil actualizado.");
});

test("guarda preguntas de la guía, permite reintentar y las incluye en el respaldo", () => {
  const storage = new FakeStorage();
  const repository = createRepository(storage);
  const createdAt = "2026-09-23T12:00:00.000Z";
  repository.saveCoachQuestion({ id: "q-1", question: "¿Cómo ajusto mañana?", createdAt, updatedAt: createdAt });
  assert.equal(repository.listCoachQuestions()[0].answer, "");
  repository.saveCoachQuestion({ id: "q-1", question: "¿Cómo ajusto mañana?", answer: "Cambia el partido por un peloteo suave.",
    planAdjustment: { targetDateISO: "2026-09-26", title: "Peloteo amistoso suave", reason: "Cancha de partido no disponible", category: "tennis",
      summary: "Mantener contacto con la pelota sin carga de partido", details: ["Intensidad suave"], tennisTypeId: "friendly-hitting", nutritionMode: "tennisLight", nutritionReason: "Menor exigencia que un partido" },
    adjustmentStatus: "pending", createdAt, updatedAt: "2026-09-23T12:01:00.000Z" });
  assert.equal(repository.listCoachQuestions().length, 1);
  assert.match(repository.backup(), /Peloteo amistoso suave/);
  assert.equal(createRepository(storage).listCoachQuestions()[0].planAdjustment.tennisTypeId, "friendly-hitting");
  assert.equal(repository.applyCloudCoachQuestion({ id: "q-1", question: "¿Cómo ajusto mañana?", answer: "Respuesta anterior", createdAt, updatedAt: createdAt }), false);
  const restored = createRepository(new FakeStorage());
  restored.importMerge(repository.backup());
  assert.equal(restored.listCoachQuestions()[0].planAdjustment.nutritionMode, "tennisLight");
});

test("conserva el contexto de recuperación informado al entrenador", () => {
  const storage = new FakeStorage();
  const repository = createRepository(storage);
  repository.saveCoachQuestion({
    id: "q-recovery",
    question: "El sábado tomé harto hasta las cinco de la mañana",
    answer: "Bajaremos la exigencia durante la recuperación.",
    recoveryContext: {
      kind: "alcohol", eventDateISO: "2026-10-24", endDateISO: "2026-10-25", endTime: "05:00",
      alcoholAmount: "high", symptoms: "unknown", summary: "Salida larga informada."
    },
    createdAt: "2026-10-25T12:00:00Z",
    updatedAt: "2026-10-25T12:00:00Z"
  });
  const saved = createRepository(storage).listCoachQuestions()[0].recoveryContext;
  assert.equal(saved.recoveryHours, 48);
  assert.equal(saved.endDateISO, "2026-10-25");
  assert.match(repository.backup(), /recoveryContext/);
});

test("limpiar preguntas deja marcas de borrado para que no reaparezcan desde la nube", () => {
  const repository = createRepository(new FakeStorage());
  repository.saveCoachQuestion({ id: "q-1", question: "¿Cómo voy?", createdAt: "2026-09-23T12:00:00.000Z" });
  assert.equal(repository.clearCoachQuestions(), 1);
  assert.equal(repository.listCoachQuestions().length, 0);
  assert.equal(repository.listCoachQuestions({ includeDeleted: true })[0].deleted, true);
  assert.equal(repository.applyCloudCoachQuestion({ id: "q-1", question: "¿Cómo voy?", updatedAt: "2026-09-23T12:00:00.000Z" }), false);
  assert.equal(repository.listCoachQuestions().length, 0);
  assert.equal(repository.clearCoachQuestions(), 0);
});

test("conserva la auditoría necesaria para deshacer un ajuste del plan", () => {
  const storage = new FakeStorage();
  const repository = createRepository(storage);
  repository.saveCoachQuestion({
    id: "q-undo", question: "Cambia el partido", answer: "Propongo una sesión suave.",
    planAdjustment: { targetDateISO: "2026-10-24", title: "Peloteo suave", category: "tennis" },
    adjustmentStatus: "reverted", appliedOptionId: "ai-option", originalOptionId: "calendar-match",
    originalNutritionMode: "match", appliedAt: "2026-10-21T10:00:00Z", revertedAt: "2026-10-21T10:05:00Z",
    createdAt: "2026-10-21T09:55:00Z", updatedAt: "2026-10-21T10:05:00Z"
  });
  const saved = createRepository(storage).listCoachQuestions()[0];
  assert.equal(saved.adjustmentStatus, "reverted");
  assert.equal(saved.originalOptionId, "calendar-match");
  assert.equal(saved.originalNutritionMode, "match");
  assert.match(saved.revertedAt, /10:05/);
});

test("conserva la reducción de ejercicios propuesta para una alternativa cubierta", () => {
  const storage = new FakeStorage();
  const repository = createRepository(storage);
  repository.saveCoachQuestion({
    id: "q-indoor", question: "¿Qué hago si llueve?", answer: "Propongo físico suave bajo techo.",
    planAdjustment: {
      targetDateISO: "2026-10-22", title: "Físico suave bajo techo", category: "physical", routineId: "full-body",
      exerciseSettings: [
        { exerciseId: "front-plank", sets: 2, target: "30 seg", weightKg: "", omit: false },
        { exerciseId: "split-step-short", sets: 1, target: "20 seg", weightKg: "", omit: true }
      ]
    },
    adjustmentStatus: "pending", createdAt: "2026-10-22T09:00:00Z", updatedAt: "2026-10-22T09:00:00Z"
  });
  const settings = createRepository(storage).listCoachQuestions()[0].planAdjustment.exerciseSettings;
  assert.equal(settings[0].sets, 2);
  assert.equal(settings[0].weightKg, null);
  assert.equal(settings[1].omit, true);
});

test("conserva una corrección de registro propuesta por la guía y su versión anterior", () => {
  const storage = new FakeStorage();
  const repository = createRepository(storage);
  repository.saveCoachQuestion({
    id: "q-record", question: "El descanso fue por lluvia", answer: "Puedo corregir el motivo.",
    recordAdjustment: {
      targetRecordId: "rest-20", targetDateISO: "2026-10-20", expectedUpdatedAt: "2026-10-20T22:00:00Z",
      title: "Descanso por lluvia", reason: "Se suspendió la actividad por clima", restTypeId: "weather",
      restDetail: "No se pudo entrenar por lluvia", sensationsAppend: "", routineEffort: "", routinePain: "",
      routinePainDetail: "", activityStartTime: ""
    },
    recordAdjustmentStatus: "applied",
    recordAdjustmentOriginal: { restTypeId: "planned", restDetail: "", sensations: "", routineEffort: "", routinePain: "", routinePainDetail: "", activityStartTime: "", routineAiAnalysis: null },
    recordAdjustmentAppliedAt: "2026-10-21T12:00:00Z",
    recordAdjustmentAppliedRecordUpdatedAt: "2026-10-21T12:00:00Z",
    createdAt: "2026-10-21T11:55:00Z", updatedAt: "2026-10-21T12:00:00Z"
  });
  const saved = createRepository(storage).listCoachQuestions()[0];
  assert.equal(saved.recordAdjustment.restTypeId, "weather");
  assert.equal(saved.recordAdjustmentStatus, "applied");
  assert.equal(saved.recordAdjustmentOriginal.restTypeId, "planned");
  assert.match(saved.recordAdjustmentAppliedRecordUpdatedAt, /12:00/);
});
