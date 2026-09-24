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
  assert.match(repository.backup(), /"schemaVersion": 14/);
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
  repository.saveCoachQuestion({ id: "q-1", question: "¿Cómo ajusto mañana?", answer: "Descansa si persiste el dolor.", createdAt, updatedAt: "2026-09-23T12:01:00.000Z" });
  assert.equal(repository.listCoachQuestions().length, 1);
  assert.match(repository.backup(), /Descansa si persiste el dolor/);
  assert.equal(createRepository(storage).listCoachQuestions()[0].answer, "Descansa si persiste el dolor.");
  assert.equal(repository.applyCloudCoachQuestion({ id: "q-1", question: "¿Cómo ajusto mañana?", answer: "Respuesta anterior", createdAt, updatedAt: createdAt }), false);
  const restored = createRepository(new FakeStorage());
  restored.importMerge(repository.backup());
  assert.equal(restored.listCoachQuestions()[0].answer, "Descansa si persiste el dolor.");
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
