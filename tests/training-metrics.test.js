import test from "node:test";
import assert from "node:assert/strict";
import { activityTiming, durationModeFor, validateAnalysisPaces } from "../assets/js/training-metrics.js";

const run = { category: "cardio", cardioTypeId: "running", distanceKm: 5, durationSeconds: 1856, durationMinutes: 31 };

test("5K en 30:56 entrega tiempo exacto y ritmo 6:11 a la IA", () => {
  const timing = activityTiming(run);
  assert.equal(timing.durationSeconds, 1856);
  assert.equal(timing.durationMinutes, 30 + 56 / 60);
  assert.equal(timing.durationHms, "00:30:56");
  assert.equal(timing.averagePaceSecondsPerKm, 371);
  assert.equal(timing.averagePaceFormatted, "6:11 min/km");
});

test("interpreta correctamente minutos antiguos, horas y datos ausentes", () => {
  assert.equal(activityTiming({ ...run, durationSeconds: "", durationMinutes: 31 }).averagePaceFormatted, "6:12 min/km");
  assert.equal(activityTiming({ ...run, durationSeconds: 3601 }).durationHms, "01:00:01");
  assert.equal(activityTiming({ category: "rest" }).durationSeconds, null);
  assert.equal(activityTiming({ ...run, distanceKm: 0 }).averagePaceFormatted, null);
});

test("solo el trote recupera los segundos entre las modalidades de cardio", () => {
  assert.equal(durationModeFor("cardio", "running"), "hms");
  for (const type of ["padel", "walking", "trekking", "stationary-bike"]) assert.equal(durationModeFor("cardio", type), "hm");
  assert.equal(durationModeFor("tennis"), "hms");
});

test("rechaza ritmo inventado antes de guardarlo y acepta el cálculo real", () => {
  assert.throws(() => validateAnalysisPaces({ summary: "Ritmo 3:12 min/km de promedio" }, [run]), /no respaldado/);
  assert.throws(() => validateAnalysisPaces({ progress: ["Ritmo 3 min 12 s/km"] }, [run]), /no respaldado/);
  assert.doesNotThrow(() => validateAnalysisPaces({ summary: "Ritmo 6:11 min/km" }, [run]));
  assert.doesNotThrow(() => validateAnalysisPaces({ nextSession: ["30 segundos de descanso"] }, [run]));
});
