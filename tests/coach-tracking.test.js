import test from "node:test";
import assert from "node:assert/strict";
import { comparableActivity, dayPlanOverview, plannedMatchForRecord, plannedContextForRecord, planAssessment } from "../assets/js/coach-tracking.js";
import { coachTrainingBlock } from "../assets/js/coach-plan.js";
import { normalizeRecord } from "../assets/js/utils.js";

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

test("solo respeta la evaluación de la guía si corresponde a esta versión del plan", () => {
  const record = { ...run, cardioTypeId: "padel", planBlockId: coachTrainingBlock.id, planSessionId: plannedContextForRecord(run, coachTrainingBlock).session.id,
    routineAiAnalysis: { summary: "Se adaptó la actividad.", planComparison: { status: "adapted", reason: "Otra forma de trabajar el objetivo" } } };
  const match = plannedContextForRecord(record, coachTrainingBlock);
  assert.ok(match);
  assert.equal(planAssessment(record, match, coachTrainingBlock).label, "Otra actividad");
  const current = { ...record, routineAiAnalysis: { ...record.routineAiAnalysis, planContext: {
    blockId: coachTrainingBlock.id, blockUpdatedAt: coachTrainingBlock.updatedAt || "", sessionId: match.session.id, optionId: match.option.id
  } } };
  assert.equal(planAssessment(current, match, coachTrainingBlock).label, "Adaptado");
  assert.deepEqual(normalizeRecord(current).routineAiAnalysis.planContext, current.routineAiAnalysis.planContext);
  assert.equal(planAssessment(current, match, { ...coachTrainingBlock, updatedAt: "2026-09-22T12:00:00.000Z" }).label, "Otra actividad");
  assert.equal(plannedContextForRecord({ ...record, planBlockId: "otro" }, coachTrainingBlock), null);
});

test("Inicio describe registros y cambios de plan sin afirmar cumplimiento ni pedir evaluación", () => {
  const session = coachTrainingBlock.weeks[1].sessions.find(item => item.dateISO === "2026-09-22");
  assert.equal(dayPlanOverview(session, []).label, "Previsto");
  assert.equal(dayPlanOverview(session, [{ category: "rest", restTypeId: "planned" }]).label, "Descanso registrado");
  assert.equal(dayPlanOverview(session, [{ category: "physical", routineId: "legs" }]).label, "Cambio de plan");
  const option = session.options[0];
  assert.equal(dayPlanOverview(session, [{ category: option.category, cardioTypeId: option.prefill.cardioTypeId }]).label, "Registrado");
});

test("un descanso nunca se muestra como cumplido por un análisis antiguo", () => {
  const record = { category: "rest", restTypeId: "planned", dateISO: "2026-09-22", routineAiAnalysis: { planComparison: { status: "completed" } } };
  const match = plannedContextForRecord(record, coachTrainingBlock);
  assert.equal(planAssessment(record, match, coachTrainingBlock).status, "recovery");
});

test("no asigna otra actividad a una sesión arbitraria si hay varias posibles", () => {
  const block = { id: "b", weeks: [{ sessions: ["a", "b"].map(id => ({ id, dateISO: run.dateISO, options: [{ category: "physical", prefill: { routineId: id } }] })) }] };
  assert.equal(plannedContextForRecord(run, block), null);
});

test("relaciona una sesión física propia del plan sin confundirla con una rutina base", async () => {
  const { normalizeTrainingBlock, weekDisplayTitle } = await import("../assets/js/training-plan.js");
  const block = normalizeTrainingBlock({ title: "Plan propio", weeks: [{ weekKey: "2026-W39", context: "Partido de tenis el sábado", sessions: [{
    dateISO: "2026-09-22", options: [{ title: "Activación de cancha", category: "physical", details: ["Dos series de desplazamientos laterales" ] }]
  }] }] });
  const option = block.weeks[0].sessions[0].options[0];
  assert.equal(option.prefill.routineId, "");
  assert.deepEqual(option.details, ["Dos series de desplazamientos laterales"]);
  assert.equal(weekDisplayTitle(block.weeks[0]), "Semana de partido");
  const actual = { category: "physical", routineId: "", routineName: "Activación de cancha", dateISO: "2026-09-22" };
  assert.equal(plannedMatchForRecord(actual, block)?.option.id, option.id);
  assert.equal(planAssessment(actual, plannedContextForRecord(actual, block)).status, "unknown");
});
