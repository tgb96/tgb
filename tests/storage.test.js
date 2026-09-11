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
  assert.match(repository.backup(), /"schemaVersion": 10/);
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
