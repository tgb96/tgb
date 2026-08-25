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
  assert.match(repository.backup(), /"schemaVersion": 4/);
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
