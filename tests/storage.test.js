import test from "node:test";
import assert from "node:assert/strict";
import { createRepository, DATA_KEY, parseBackup } from "../assets/js/storage.js";

class FakeStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

function record(index = 0) {
  return {
    id: `record-${index}`,
    dateISO: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
    activity: "Físico",
    physicalRoutine: "A",
    durationMinutes: 60,
    calories: 300,
    kms: "",
    fatigue: 3,
    thumbPain: 0,
    legPain: 0,
    feeling: "Me sentí bien",
    notes: ""
  };
}

test("migra el historial anterior sin recortarlo a 300 registros", () => {
  const legacy = Array.from({ length: 305 }, (_, index) => record(index));
  const storage = new FakeStorage({ history: JSON.stringify(legacy) });
  const repository = createRepository(storage);
  assert.equal(repository.list().length, 305);
  assert.ok(storage.getItem(DATA_KEY));
});

test("actualiza, elimina y respalda registros", () => {
  const storage = new FakeStorage();
  const repository = createRepository(storage);
  repository.upsert(record(1));
  repository.upsert({ ...record(1), durationMinutes: 75 });
  assert.equal(repository.list().length, 1);
  assert.equal(repository.get("record-1").durationMinutes, 75);
  assert.match(repository.backup(), /"schemaVersion": 2/);
  assert.equal(repository.remove("record-1"), true);
  assert.equal(repository.list().length, 0);
});

test("importa respaldos combinando identificadores", () => {
  const repository = createRepository(new FakeStorage());
  repository.upsert(record(1));
  const count = repository.importMerge(JSON.stringify({ records: [{ ...record(1), durationMinutes: 90 }, record(2)] }));
  assert.equal(count, 2);
  assert.equal(repository.list().length, 2);
  assert.equal(repository.get("record-1").durationMinutes, 90);
});

test("rechaza respaldos con registros inválidos", () => {
  assert.throws(() => parseBackup(JSON.stringify({ records: [{ ...record(1), fatigue: 50 }] })), /inválido/);
  assert.throws(() => parseBackup("{}"), /respaldo TGB válido/);
});
