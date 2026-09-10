import test from "node:test";
import assert from "node:assert/strict";
import {
  coachUpdateReport,
  formatDistance,
  formatDuration,
  groupRecordsByWeek,
  isoWeekInfo,
  normalizeRecord,
  physicalBestRecords,
  physicalRoutineDurationAverages,
  recordDetails,
  recordsToCSV,
  runningBestTimes,
  routineExerciseLine,
  trekkingBestTimes,
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

test("valida entrenamientos, descansos y campos especiales", () => {
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
    distanceKm: 8.5,
    elevationGainM: 650,
    ascentDurationSeconds: 4100
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
    tennisTypeId: "match",
    tennisTypeName: "Partido",
    location: "Club",
    surface: "Arcilla"
  }).valid, true);
});

test("registra descanso planificado o por molestia con detalle obligatorio", () => {
  assert.equal(validateRecord({
    id: "rest-1",
    dateISO: "2026-08-25",
    category: "rest",
    categoryName: "Descanso",
    restTypeId: "planned"
  }).valid, true);
  assert.equal(validateRecord({
    id: "rest-2",
    dateISO: "2026-08-26",
    category: "rest",
    categoryName: "Descanso",
    restTypeId: "discomfort",
    restDetail: "Molestia leve en la rodilla derecha"
  }).valid, true);
  assert.equal(validateRecord({
    id: "rest-3",
    dateISO: "2026-08-27",
    category: "rest",
    categoryName: "Descanso",
    restTypeId: "discomfort",
    restDetail: ""
  }).valid, false);
});

test("ordena las mejores subidas por cerro y ruta", () => {
  const base = {
    ...physicalRecord,
    category: "cardio",
    categoryName: "Cardio",
    routineId: "",
    routineName: "",
    cardioTypeId: "trekking",
    cardioTypeName: "Trekking",
    location: "Cerro La Región",
    trekkingRoute: "Los Fresnos",
    distanceKm: 5,
    elevationGainM: 500
  };
  const groups = trekkingBestTimes([
    { ...base, id: "slow", dateISO: "2026-08-20", ascentDurationSeconds: 4200 },
    { ...base, id: "fast", dateISO: "2026-08-27", ascentDurationSeconds: 3600 }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].route, "Los Fresnos");
  assert.deepEqual(groups[0].attempts.map(record => record.id), ["fast", "slow"]);
});

test("ordena los mejores tiempos de trote por distancia", () => {
  const base = {
    ...physicalRecord,
    category: "cardio",
    categoryName: "Cardio",
    routineId: "",
    routineName: "",
    cardioTypeId: "running",
    cardioTypeName: "Trote",
    distanceKm: 5,
    durationPrecision: "hms"
  };
  const groups = runningBestTimes([
    { ...base, id: "five-slow", dateISO: "2026-08-20", durationSeconds: 2100 },
    { ...base, id: "five-fast", dateISO: "2026-08-27", durationSeconds: 1800 },
    { ...base, id: "three", distanceKm: 3, durationSeconds: 1200 }
  ]);
  assert.deepEqual(groups.map(group => group.label), ["3K", "5K"]);
  assert.deepEqual(groups[1].attempts.map(record => record.id), ["five-fast", "five-slow"]);
});

test("ordena los récords físicos de abdominales y volumen", () => {
  const records = [
    { ...physicalRecord, id: "first", routineAbsCount: 40, routineVolumeKg: 1200 },
    { ...physicalRecord, id: "second", dateISO: "2026-08-27", routineAbsCount: 55, routineVolumeKg: 1100 },
    { ...physicalRecord, id: "third", dateISO: "2026-08-28", routineAbsCount: 45, routineVolumeKg: 1500 }
  ];
  const rankings = physicalBestRecords(records);
  assert.deepEqual(rankings.abdominals.map(record => record.id), ["second", "third", "first"]);
  assert.deepEqual(rankings.volume.map(record => record.id), ["third", "first", "second"]);
});

test("calcula la duración promedio de cada rutina física", () => {
  const averages = physicalRoutineDurationAverages([
    { ...physicalRecord, id: "avg-1", durationMinutes: 45 },
    { ...physicalRecord, id: "avg-2", durationMinutes: 56 },
    { ...physicalRecord, id: "ignored-cardio", category: "cardio", durationMinutes: 100 },
    { ...physicalRecord, id: "upper-1", routineId: "upper", routineName: "Tren superior", durationMinutes: 61 }
  ]);
  assert.deepEqual(averages.get("legs"), { minutes: 51, sessions: 2 });
  assert.deepEqual(averages.get("upper"), { minutes: 61, sessions: 1 });
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

test("conserva el balance de una rutina registrada desde el seguimiento", () => {
  const record = normalizeRecord({
    ...physicalRecord,
    durationSeconds: 3675,
    durationPrecision: "hms",
    routineCompletedSets: 24,
    routinePlannedSets: 28,
    routineCompletedExercises: 7,
    routineStartedExercises: 9,
    routineTotalExercises: 9,
    routineTotalReps: 210,
    routineVolumeKg: 1680,
    routineAbsCount: 60,
    routineExercises: [{
      id: "unilateral-loaded-squat",
      name: "Sentadilla con carga unilateral",
      phase: "Fuerza principal",
      target: "10",
      weightKg: 8,
      plannedSets: 4,
      completedSets: 3,
      completedSetNumbers: [1, 2, 4],
      totalReps: 30,
      volumeKg: 240
    }],
    routineStartedAt: "2026-08-24T20:00:00.000Z",
    routineEndedAt: "2026-08-24T21:01:15.000Z"
  });
  assert.equal(record.routineCompletedSets, 24);
  assert.equal(record.routineVolumeKg, 1680);
  assert.equal(record.routineStartedExercises, 9);
  assert.equal(record.routineAbsCount, 60);
  assert.equal(record.routineExercises[0].completedSetNumbers.join(","), "1,2,4");
  assert.match(routineExerciseLine(record.routineExercises[0]), /3\/4 series realizadas/);
  assert.match(routineExerciseLine(record.routineExercises[0]), /240 kg de volumen/);
  assert.match(recordDetails(record), /24\/28 series/);
  assert.match(recordDetails(record), /1\.680 kg volumen/);
  assert.match(recordDetails(record), /60 abdominales/);
  const report = weeklyReport([record], isoWeekInfo(record.dateISO));
  assert.match(report, /Ejercicios, cargas y repeticiones realizadas/);
  assert.match(report, /Sentadilla con carga unilateral/);
  assert.match(report, /series marcadas: 1, 2, 4/);
  assert.match(report, /Abdominales finales: 60/);
});

test("formatea duraciones exactas para trote, trekking y tenis", () => {
  assert.equal(formatDuration({ durationMinutes: 62.5, durationSeconds: 3750, durationPrecision: "hms" }), "1 h 02 min 30 s");
  assert.equal(formatDuration({ durationMinutes: 135, durationSeconds: 8100, durationPrecision: "hm" }), "2 h 15 min");
  assert.equal(formatDuration({ durationMinutes: 60, durationSeconds: 3600, durationPrecision: "minutes" }), "60 min");
});

test("formatea la distancia como marca de carrera legible", () => {
  assert.equal(formatDistance(5), "5K");
  assert.equal(formatDistance(10), "10K");
  assert.equal(formatDistance(8.5), "8,5 km");
  assert.equal(formatDistance(12.045), "12,045 km");
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
    tennisTypeId: "friendly-hitting",
    tennisTypeName: "Peloteo amistoso",
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
  assert.match(report, /Tipo de tenis: Peloteo amistoso/);
  assert.match(report, /Sin entrenamiento registrado/);
});

test("el informe del entrenador incluye solo registros nuevos o modificados", () => {
  const alreadySent = { ...physicalRecord, id: "sent", coachSentAt: "2026-09-08T20:00:00.000Z" };
  const newRunning = {
    ...physicalRecord,
    id: "running-new",
    dateISO: "2026-09-08",
    category: "cardio",
    categoryName: "Cardio",
    routineId: "",
    routineName: "",
    cardioTypeId: "running",
    cardioTypeName: "Trote",
    durationMinutes: 30,
    durationSeconds: 1800,
    durationPrecision: "hms",
    distanceKm: 5,
    calories: 250,
    coachSentAt: ""
  };
  const report = coachUpdateReport([alreadySent, newRunning], "2026-09-09");
  assert.match(report, /ACTUALIZACIÓN TGTRAIN PARA MI ENTRENADOR/);
  assert.match(report, /Registros nuevos: 1/);
  assert.match(report, /Trote/);
  assert.match(report, /Distancia: 5K/);
  assert.doesNotMatch(report, /Fuerza de piernas/);
  assert.equal(coachUpdateReport([alreadySent], "2026-09-09"), "");
});

test("CSV conserva los campos nuevos, el detalle de ejercicios y neutraliza fórmulas", () => {
  const csv = recordsToCSV([{ ...physicalRecord, sensations: "=SUM(A1:A2)", routineExercises: [{
    name: "Remo a una mano", target: "10", weightKg: 8, plannedSets: 3, completedSets: 3,
    completedSetNumbers: [1, 2, 3], totalReps: 30, volumeKg: 240
  }] }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /Fuerza de piernas/);
  assert.match(csv, /tipo_tenis/);
  assert.match(csv, /detalle_ejercicios/);
  assert.match(csv, /abdominales_finales/);
  assert.match(csv, /enviado_entrenador/);
  assert.match(csv, /Remo a una mano/);
  assert.match(csv, /'=SUM/);
});
