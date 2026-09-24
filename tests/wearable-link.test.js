import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWearableSnapshot, wearableCandidates, wearableComparison, wearableSummaryText } from "../assets/js/wearable-link.js";
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
