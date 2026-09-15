import test from "node:test";
import assert from "node:assert/strict";
import { comparableActivity, plannedMatchForRecord, plannedContextForRecord, planAssessment } from "../assets/js/coach-tracking.js";
import { coachTrainingBlock } from "../assets/js/coach-plan.js";

const run = { category: "cardio", cardioTypeId: "running", distanceKm: 5, dateISO: "2026-09-15", sensations: "Comentarios completos" };

test("relaciona el trote manual de 5K con el plan del mismo día sin modificarlo", () => {
  const before = JSON.stringify(run);
  const match = plannedMatchForRecord(run, coachTrainingBlock);
  assert.ok(match);
  assert.equal(match.session.dateISO, run.dateISO);
  assert.equal(match.option.prefill.cardioTypeId, "running");
  assert.equal(JSON.stringify(run), before);
});

test("no relaciona una actividad diferente ni un registro de otra fecha", () => {
  assert.equal(plannedMatchForRecord({ ...run, cardioTypeId: "padel" }, coachTrainingBlock), null);
  assert.equal(plannedMatchForRecord({ ...run, dateISO: "2026-12-15" }, coachTrainingBlock), null);
});

test("identifica una desviación de distancia como la misma sesión, sin reemplazar el resultado real", () => {
  const actual = { ...run, distanceKm: 3 };
  assert.ok(plannedMatchForRecord(actual, coachTrainingBlock));
  assert.equal(actual.distanceKm, 3);
});

test("no reasigna registros que ya pertenecen a otro plan", () => {
  assert.equal(plannedMatchForRecord({ ...run, planBlockId: "otro", planSessionId: "otra-sesion" }, coachTrainingBlock), null);
});

test("compara trotes por distancia y trekkings por cerro y ruta", () => {
  assert.equal(comparableActivity(run, { ...run, distanceKm: 5 }), true);
  assert.equal(comparableActivity(run, { ...run, distanceKm: 3 }), false);
  assert.equal(comparableActivity(run, { ...run, cardioTypeId: "walking" }), false);
  const hike = { category: "cardio", cardioTypeId: "trekking", location: "Cerro La Región", trekkingRoute: "Los Fresnos" };
  assert.equal(comparableActivity(hike, { ...hike, trekkingRoute: "Ruta 7 Canchas" }), false);
});

test("relaciona otra actividad y descanso sin declararlos cumplidos", () => {
  for (const record of [{ ...run, cardioTypeId: "padel" }, { ...run, category: "rest", restTypeId: "discomfort" }]) {
    const before = JSON.stringify(record);
    const match = plannedContextForRecord(record, coachTrainingBlock);
    assert.ok(match);
    assert.equal(match.exact, false);
    assert.notEqual(planAssessment(record, match).status, "completed");
    assert.equal(JSON.stringify(record), before);
  }
});

test("distancia menor o mayor queda adaptada, no cumplida automáticamente", () => {
  const block = { id: "test", weeks: [{ sessions: [{ id: "s", dateISO: run.dateISO, options: [{ category: "cardio", prefill: { cardioTypeId: "running", distanceKm: 5 } }] }] }] };
  for (const distanceKm of [3, 10]) {
    const record = { ...run, distanceKm };
    assert.equal(planAssessment(record, plannedContextForRecord(record, block)).status, "adapted");
  }
  assert.equal(planAssessment(run, plannedContextForRecord(run, block)).status, "unknown");
});

test("respeta evaluación de la guía y no pierde la relación al guardar sus metadatos", () => {
  const record = { ...run, cardioTypeId: "padel", planBlockId: coachTrainingBlock.id, planSessionId: plannedContextForRecord(run, coachTrainingBlock).session.id,
    routineAiAnalysis: { planComparison: { status: "adapted", reason: "Otra forma de trabajar el objetivo" } } };
  assert.ok(plannedContextForRecord(record, coachTrainingBlock));
  assert.equal(planAssessment(record, plannedContextForRecord(record, coachTrainingBlock)).label, "Adaptado");
  assert.equal(plannedContextForRecord({ ...record, planBlockId: "otro" }, coachTrainingBlock), null);
});

test("no asigna otra actividad a una sesión arbitraria si hay varias posibles", () => {
  const block = { id: "b", weeks: [{ sessions: ["a", "b"].map(id => ({ id, dateISO: run.dateISO, options: [{ category: "physical", prefill: { routineId: id } }] })) }] };
  assert.equal(plannedContextForRecord(run, block), null);
});
