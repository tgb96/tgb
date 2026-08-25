import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceIntervalState,
  averageMetric,
  doneKeyForDate,
  isoForWeekDay,
  recordsToCSV,
  reportForPeriod,
  sessionKeyForDate,
  validateRecord
} from "../assets/js/utils.js";

const baseRecord = {
  id: "record-1",
  dateISO: "2026-08-20",
  activity: "Tenis",
  durationMinutes: 0,
  calories: 0,
  kms: "",
  fatigue: 0,
  thumbPain: 0,
  legPain: 0,
  feeling: "Normal",
  notes: ""
};

test("las claves y fechas usan la fecha exacta, incluso para registros pasados", () => {
  assert.equal(isoForWeekDay(1, "2026-08-24"), "2026-08-24");
  assert.equal(isoForWeekDay(0, "2026-08-24"), "2026-08-30");
  assert.equal(doneKeyForDate("2026-07-06"), "done-2026-07-06");
  assert.equal(sessionKeyForDate("2026-07-06"), "session-2026-07-06");
});

test("cero es un valor válido y no se confunde con un dato vacío", () => {
  const result = validateRecord(baseRecord);
  assert.equal(result.valid, true);
  assert.equal(averageMetric([baseRecord, { ...baseRecord, fatigue: "" }], "fatigue"), 0);
  const report = reportForPeriod([baseRecord], 7, "2026-08-24");
  assert.match(report, /Fatiga: 0\/10/);
  assert.match(report, /Tiempo: 0 min/);
});

test("rechaza valores de bienestar fuera de 0 a 10", () => {
  const result = validateRecord({ ...baseRecord, fatigue: 11 });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /fatiga/);
});

test("CSV neutraliza fórmulas y conserva notas entre comillas", () => {
  const csv = recordsToCSV([{ ...baseRecord, notes: "=HYPERLINK(\"x\")" }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.ok(csv.startsWith("\uFEFF"));
});

test("el timer avanza por descanso y rondas usando plazos reales", () => {
  let state = {
    running: true,
    phase: "work",
    currentRound: 1,
    totalRounds: 2,
    work: 30,
    rest: 10,
    mode: "interval",
    deadline: 1000
  };
  ({ state } = advanceIntervalState(state, 1000));
  assert.equal(state.phase, "rest");
  assert.equal(state.deadline, 11000);
  ({ state } = advanceIntervalState(state, 11000));
  assert.equal(state.phase, "work");
  assert.equal(state.currentRound, 2);
  assert.equal(state.deadline, 41000);
  ({ state } = advanceIntervalState(state, 51000));
  assert.equal(state.running, false);
});
