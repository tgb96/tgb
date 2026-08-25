import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDuration,
  groupRecordsByWeek,
  isoWeekInfo,
  normalizeRecord,
  recordsToCSV,
  validateRecord,
  weekDays,
  weeklyReport
} from "../assets/js/utils.js";

const physicalRecord = {
  id: "physical-1",
  dateISO: "2026-08-24",
  category: "physical",
  categoryName: "Físico",
  routineId: "legs",
  routineName: "Fuerza de piernas",
  durationMinutes: 60,
  calories: 420,
  sensations: "Buena energía"
};

test("el 24 de agosto de 2026 pertenece a la semana ISO 35", () => {
  assert.deepEqual(isoWeekInfo("2026-08-24"), {
    key: "2026-W35",
    weekNumber: 35,
    weekYear: 2026,
    startISO: "2026-08-24",
    endISO: "2026-08-30"
  });
  assert.deepEqual(weekDays("2026-08-26"), [
    "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30"
  ]);
});

test("las semanas respetan el año ISO en cambios de año", () => {
  assert.equal(isoWeekInfo("2027-01-01").key, "2026-W53");
});

test("valida los tres tipos de entrenamiento y los campos especiales", () => {
  assert.equal(validateRecord(physicalRecord).valid, true);
  assert.equal(validateRecord({
    ...physicalRecord,
    id: "trekking-1",
    category: "cardio",
    categoryName: "Cardio",
    routineId: "",
    routineName: "",
    cardioTypeId: "trekking",
    cardioTypeName: "Trekking",
    location: "Cerro Manquehue",
    distanceKm: 8.5
  }).valid, true);
  assert.equal(validateRecord({
    ...physicalRecord,
    category: "cardio",
    routineId: "",
    routineName: "",
    cardioTypeId: "trekking",
    location: "",
    distanceKm: ""
  }).valid, false);
  assert.equal(validateRecord({
    ...physicalRecord,
    category: "tennis",
    routineId: "",
    routineName: "",
    location: "Club",
    surface: "Arcilla"
  }).valid, true);
});

test("migra registros anteriores al nuevo modelo sin perder su contenido", () => {
  const migrated = normalizeRecord({
    id: "old-1",
    dateISO: "2026-08-20",
    activity: "Físico",
    physicalRoutine: "A",
    durationMinutes: "55",
    calories: "300",
    feeling: "Bien",
    notes: "Sin molestias"
  });
  assert.equal(migrated.category, "physical");
  assert.equal(migrated.routineName, "Físico A");
  assert.equal(migrated.durationMinutes, 55);
  assert.equal(migrated.durationSeconds, 3300);
  assert.equal(migrated.sensations, "Bien · Sin molestias");
});

test("formatea duraciones exactas para trote, trekking y tenis", () => {
  assert.equal(formatDuration({ durationMinutes: 62.5, durationSeconds: 3750, durationPrecision: "hms" }), "1 h 02 min 30 s");
  assert.equal(formatDuration({ durationMinutes: 135, durationSeconds: 8100, durationPrecision: "hm" }), "2 h 15 min");
  assert.equal(formatDuration({ durationMinutes: 60, durationSeconds: 3600, durationPrecision: "minutes" }), "60 min");
});

test("agrupa por semana y genera el informe completo de lunes a domingo", () => {
  const tennis = {
    ...physicalRecord,
    id: "tennis-1",
    dateISO: "2026-08-26",
    category: "tennis",
    categoryName: "Tenis",
    routineId: "",
    routineName: "",
    location: "Club Open",
    surface: "Arcilla",
    durationMinutes: 90,
    calories: 650
  };
  const groups = groupRecordsByWeek([physicalRecord, tennis]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].weekNumber, 35);
  const report = weeklyReport([physicalRecord, tennis], groups[0]);
  assert.match(report, /SEMANA 35 DE 2026/);
  assert.match(report, /Tiempo total: 150 min/);
  assert.match(report, /LUNES 2026-08-24/);
  assert.match(report, /DOMINGO 2026-08-30/);
  assert.match(report, /Sin entrenamiento registrado/);
});

test("CSV conserva los campos nuevos y neutraliza fórmulas", () => {
  const csv = recordsToCSV([{ ...physicalRecord, sensations: "=SUM(A1:A2)" }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Fuerza de piernas/);
  assert.match(csv, /'=SUM/);
});
