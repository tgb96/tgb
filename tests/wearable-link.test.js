import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateWearableSessions, normalizeWearableSnapshot, refreshedWearableLink, wearableAutolinks, wearableCandidates, wearableComparison, wearableInbox, wearableSummaryText } from "../assets/js/wearable-link.js";
import { groupRecordsByWeek, normalizeRecord, recordsToCSV, weeklyReport } from "../assets/js/utils.js";
import { createRepository } from "../assets/js/storage.js";

const manual = {
  id: "training-1", dateISO: "2026-09-22", category: "physical", routineId: "day-1",
  routineName: "Día 1", durationMinutes: 60, durationSeconds: 3600, calories: 300,
  routineStartedAt: "2026-09-22T14:00:00.000Z", routineEndedAt: "2026-09-22T15:00:00.000Z"
};
const band = {
  id: "band-1", dateISO: "2026-09-22", title: "Entrenamiento físico",
  startTime: "2026-09-22T14:02:00.000Z", endTime: "2026-09-22T15:03:00.000Z",
  durationSeconds: 3660, caloriesKcal: 245, heartRateAvgBpm: 126.4,
  heartRateMaxBpm: 158, heartRateMinBpm: 81, heartRateSampleCount: 110,
  originPackage: "com.xiaomi.wearable"
};

test("propone la sesión por horario, pero no la vincula automáticamente ni permite duplicarla", () => {
  const other = { ...band, id: "band-2", startTime: "2026-09-22T19:00:00.000Z", endTime: "2026-09-22T20:00:00.000Z" };
  const candidates = wearableCandidates(manual, [other, band], [manual]);
  assert.equal(candidates[0].session.id, "band-1");
  assert.match(candidates[0].match.reason, /Horario/);
  assert.equal(manual.wearableSessionId, undefined);
  assert.deepEqual(wearableCandidates(manual, [band], [manual, { ...manual, id: "training-2", wearableSessionId: "band-1" }]), []);
  assert.deepEqual(wearableCandidates({ ...manual, category: "rest" }, [band], []), []);
});

test("un registro sin horario solo ofrece la misma fecha para confirmación manual", () => {
  const dated = { ...manual, routineStartedAt: "", routineEndedAt: "" };
  const candidates = wearableCandidates(dated, [band, { ...band, id: "tomorrow", dateISO: "2026-09-23" }]);
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].match.reason, /Mismo día/);
});

test("la bandeja de la pulsera separa coincidencias recomendadas, ambiguas y sin registro", () => {
  const exact = wearableInbox([band], [manual]);
  assert.equal(exact[0].state, "recommended");
  assert.equal(exact[0].recommended.record.id, manual.id);
  const ambiguous = wearableInbox([band], [
    { ...manual, id: "a", routineStartedAt: "", routineEndedAt: "" },
    { ...manual, id: "b", routineStartedAt: "", routineEndedAt: "" }
  ]);
  assert.equal(ambiguous[0].state, "ambiguous");
  const unmatched = wearableInbox([{ ...band, dateISO: "2026-09-25", startTime: "2026-09-25T14:00:00Z", endTime: "2026-09-25T15:00:00Z" }], [manual]);
  assert.equal(unmatched[0].state, "unmatched");
});

test("fusiona copias de Mi Fitness y Strava y conserva la sesión con más métricas", () => {
  const physicalCopy = {
    ...band, id: "physical-copy", title: "Entrenamiento físico", dateISO: "2026-10-31",
    startTime: "2026-10-31T15:59:00Z", endTime: "2026-10-31T18:19:00Z",
    durationSeconds: 8400, caloriesKcal: null, originPackage: "com.strava"
  };
  const tennisCopy = {
    ...band, id: "tennis-copy", title: "Tenis", dateISO: "2026-10-31",
    startTime: "2026-10-31T14:59:00Z", endTime: "2026-10-31T17:19:00Z",
    rawStartTime: "2026-10-31T15:59:00Z", rawEndTime: "2026-10-31T18:19:00Z",
    clockAdjustmentMinutes: -60, durationSeconds: 8400, caloriesKcal: 1284,
    originPackage: "com.xiaomi.wearable"
  };
  const unique = deduplicateWearableSessions([physicalCopy, tennisCopy]);
  assert.equal(unique.length, 1);
  assert.equal(unique[0].id, "tennis-copy");

  const match = {
    ...manual, id: "match-31", dateISO: "2026-10-31", category: "tennis",
    durationSeconds: 8400, durationMinutes: 140, routineStartedAt: "", routineEndedAt: ""
  };
  const inbox = wearableInbox([physicalCopy, tennisCopy], [match]);
  assert.equal(inbox.length, 1);
  assert.equal(inbox[0].session.id, "tennis-copy");
  assert.equal(inbox[0].recommended.record.id, "match-31");
});

test("oculta una copia duplicada de una actividad ya vinculada y enriquece el vínculo", () => {
  const linkedCopy = {
    ...band, id: "physical-copy", title: "Entrenamiento físico", dateISO: "2026-10-31",
    startTime: "2026-10-31T15:59:00Z", endTime: "2026-10-31T18:19:00Z",
    durationSeconds: 8400, caloriesKcal: null, originPackage: "com.strava"
  };
  const richerCopy = {
    ...band, id: "tennis-copy", title: "Tenis", dateISO: "2026-10-31",
    startTime: "2026-10-31T14:59:00Z", endTime: "2026-10-31T17:19:00Z",
    rawStartTime: "2026-10-31T15:59:00Z", rawEndTime: "2026-10-31T18:19:00Z",
    clockAdjustmentMinutes: -60, durationSeconds: 8400, caloriesKcal: 1284,
    originPackage: "com.xiaomi.wearable"
  };
  const record = {
    ...manual, id: "match-31", dateISO: "2026-10-31", category: "tennis",
    wearableSessionId: linkedCopy.id, wearableSnapshot: normalizeWearableSnapshot(linkedCopy)
  };
  assert.equal(wearableInbox([linkedCopy, richerCopy], [record]).length, 0);
  const refresh = refreshedWearableLink(record, [linkedCopy, richerCopy]);
  assert.equal(refresh.sessionId, "tennis-copy");
  assert.equal(refresh.snapshot.activeCaloriesKcal, 1284);
});

test("ignora sesiones reflejadas por Strava y vincula internamente la única sesión de Mi Fitness del día", () => {
  const strava = {
    ...band, id: "strava-copy", dateISO: "2026-10-31", title: "Entrenamiento físico",
    startTime: "2026-10-31T15:59:00Z", endTime: "2026-10-31T18:19:00Z",
    durationSeconds: 8400, originPackage: "com.strava"
  };
  const tennis = {
    ...band, id: "mi-tennis", dateISO: "2026-10-31", title: "Tenis",
    startTime: "2026-10-31T14:59:00Z", endTime: "2026-10-31T17:19:00Z",
    durationSeconds: 8400, caloriesKcal: 1284, originPackage: "com.xiaomi.wearable"
  };
  const match = {
    ...manual, id: "match-31", dateISO: "2026-10-31", category: "tennis",
    wearableSessionId: strava.id, wearableSnapshot: normalizeWearableSnapshot(strava)
  };
  assert.deepEqual(deduplicateWearableSessions([strava]), []);
  const links = wearableAutolinks([strava, tennis], [match]);
  assert.equal(links.length, 1);
  assert.equal(links[0].record.id, "match-31");
  assert.equal(links[0].session.id, "mi-tennis");
});

test("la hora manual de inicio prioriza la sesión correcta de la pulsera", () => {
  const running = { ...manual, category: "cardio", cardioTypeId: "running", routineStartedAt: "", routineEndedAt: "",
    activityStartTime: "11:05", durationSeconds: 1800 };
  const morning = { ...band, id: "morning", title: "Trote", startTime: "2026-09-22T14:04:00Z",
    endTime: "2026-09-22T14:34:00Z", durationSeconds: 1800 };
  const evening = { ...band, id: "evening", title: "Trote", startTime: "2026-09-22T22:00:00Z",
    endTime: "2026-09-22T22:30:00Z", durationSeconds: 1800 };
  const candidates = wearableCandidates(running, [evening, morning]);
  assert.equal(candidates[0].session.id, "morning");
  assert.match(candidates[0].match.reason, /inicio muy cercana/);
});

test("tolera y explica el desfase de una hora de Mi Fitness tras el cambio horario", () => {
  const timed = { ...manual, routineStartedAt: "2026-09-22T22:12:00Z", routineEndedAt: "2026-09-22T22:44:00Z" };
  const staleClock = { ...band, startTime: "2026-09-22T23:12:00Z", endTime: "2026-09-22T23:44:00Z", durationSeconds: 1920 };
  const candidate = wearableCandidates(timed, [staleClock])[0];
  assert.equal(candidate.session.id, band.id);
  assert.equal(candidate.match.timeAdjustmentMinutes, -60);
  assert.match(candidate.match.reason, /desfase de 1 h/);
  const snapshot = normalizeWearableSnapshot({ ...staleClock, clockAdjustmentMinutes: -60, clockAdjustmentReason: "mi_fitness_future_end_after_dst" });
  assert.equal(snapshot.clockAdjustmentMinutes, -60);
  assert.equal(snapshot.clockAdjustmentReason, "mi_fitness_future_end_after_dst");
});

test("no aplica corrección cuando los horarios ya coinciden", () => {
  const candidate = wearableCandidates(manual, [band])[0];
  assert.equal(candidate.match.timeAdjustmentMinutes, 0);
  assert.equal(candidate.match.reason, "Horario coincidente");
});

test("una sesión completa de tenis no se ofrece para un calentamiento breve", () => {
  const warmup = { ...manual, category: "warmup", routineStartedAt: "", routineEndedAt: "",
    guidedStartedAt: "2026-09-22T14:00:00Z", guidedEndedAt: "2026-09-22T14:10:00Z",
    durationSeconds: 600 };
  const tennis = { ...band, title: "Tenis", durationSeconds: 3600 };
  assert.deepEqual(wearableCandidates(warmup, [tennis]), []);
});

test("una rutina que cruza medianoche admite la sesión con horario superpuesto", () => {
  const late = { ...manual, dateISO: "2026-09-22", routineStartedAt: "2026-09-23T02:45:00Z", routineEndedAt: "2026-09-23T03:25:00Z" };
  const overnight = { ...band, dateISO: "2026-09-23", startTime: "2026-09-23T02:47:00Z", endTime: "2026-09-23T03:26:00Z" };
  assert.equal(wearableCandidates(late, [overnight])[0].session.id, band.id);
});

test("el vínculo conserva LPM y kcal activas aparte de las anotadas, incluso en exportaciones", () => {
  const snapshot = normalizeWearableSnapshot(band);
  const record = normalizeRecord({ ...manual, wearableSessionId: band.id, wearableSnapshot: snapshot, wearableLinkedAt: "2026-09-23T00:00:00Z" });
  assert.equal(record.calories, 300);
  assert.equal(record.wearableSnapshot.activeCaloriesKcal, 245);
  assert.equal(record.wearableSnapshot.heartRateAvgBpm, 126.4);
  assert.match(wearableSummaryText(snapshot), /126 lpm/);
  const week = groupRecordsByWeek([record])[0];
  const report = weeklyReport([record], week);
  assert.match(report, /Pulsera vinculada/);
  assert.match(report, /245 kcal activas estimadas/);
  assert.match(recordsToCSV([record]), /pulsera_fc_media_lpm/);
  assert.match(recordsToCSV([record]), /126,4|126\.4/);
});

test("un entrenamiento sin muestras no inventa pulsaciones", () => {
  const snapshot = normalizeWearableSnapshot({ ...band, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateSampleCount: 0 });
  assert.equal(snapshot.heartRateAvgBpm, null);
  assert.match(wearableSummaryText(snapshot), /sin LPM/);
});

test("compara la misma rutina sin afirmar que un pulso menor pruebe mejora", () => {
  const previous = normalizeRecord({ ...manual, id: "earlier", dateISO: "2026-09-15", routineVolumeKg: 1000, wearableSessionId: "old-band", wearableSnapshot: normalizeWearableSnapshot({ ...band, id: "old-band", heartRateAvgBpm: 135 }) });
  const current = normalizeRecord({ ...manual, routineVolumeKg: 1100, wearableSessionId: band.id, wearableSnapshot: normalizeWearableSnapshot(band) });
  const text = wearableComparison(current, [previous, current]);
  assert.match(text, /volumen \+100 kg/);
  assert.match(text, /FC media -9 lpm/);
  assert.match(text, /orientativas/);
});

test("el respaldo local conserva el vínculo confirmado", () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const repository = createRepository(storage);
  repository.upsert({ ...manual, wearableSessionId: band.id, wearableSnapshot: normalizeWearableSnapshot(band) });
  const restored = createRepository(storage).get(manual.id);
  assert.equal(restored.wearableSessionId, band.id);
  assert.equal(restored.wearableSnapshot.heartRateMaxBpm, 158);
});
