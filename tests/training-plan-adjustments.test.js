import test from "node:test";
import assert from "node:assert/strict";
import { withCoachPlanAdjustments, withMatchCalendar } from "../assets/js/coach-plan.js";
import { applyQuickPlanDraft, normalizeTrainingBlock, quickPlanDraft } from "../assets/js/training-plan.js";

const option = (id, title, category = "tennis") => ({
  id,
  title,
  category,
  summary: title,
  prefill: category === "tennis" ? { tennisTypeId: "group-training" } : { restTypeId: "planned" }
});

test("la normalización conserva cada semana ISO incluso después de guardar dos veces", () => {
  const raw = {
    id: "plan-octubre",
    title: "Plan de octubre",
    weeks: [
      { weekKey: "2026-W43", sessions: [{ dateISO: "2026-10-22", primaryOptionId: "tennis", options: [option("tennis", "Entrenamiento grupal")] }] },
      { weekKey: "2026-W44", sessions: [{ dateISO: "2026-10-26", primaryOptionId: "physical", options: [{ ...option("physical", "Piernas", "physical"), routineId: "legs" }] }] }
    ]
  };
  const once = normalizeTrainingBlock(raw);
  const twice = normalizeTrainingBlock(once);
  assert.deepEqual(once.weeks.map(week => week.weekKey), ["2026-W43", "2026-W44"]);
  assert.deepEqual(twice.weeks.map(week => week.weekKey), ["2026-W43", "2026-W44"]);
  assert.equal(twice.weeks.flatMap(week => week.sessions).length, 2);
});

test("un ajuste aplicado en la conversación reemplaza el día del calendario", () => {
  const block = normalizeTrainingBlock({
    id: "plan-semanal",
    title: "Plan semanal",
    weeks: [{ weekKey: "2026-W43", sessions: [{ dateISO: "2026-10-22", primaryOptionId: "tennis", options: [option("tennis", "Entrenamiento grupal")] }] }]
  });
  const adjusted = withCoachPlanAdjustments(block, [{
    id: "question-weather",
    adjustmentStatus: "applied",
    appliedAt: "2026-10-21T23:00:00.000Z",
    appliedOptionId: "coach-weather",
    planAdjustment: {
      targetDateISO: "2026-10-22",
      title: "Descanso por clima",
      reason: "Cancha cerrada por lluvia",
      category: "rest",
      summary: "Recuperación",
      details: ["Movilidad opcional"],
      restTypeId: "weather",
      exerciseSettings: []
    }
  }]);
  const thursday = adjusted.weeks[0].sessions[0];
  assert.equal(thursday.primaryOptionId, "coach-weather");
  assert.equal(thursday.options.find(item => item.id === thursday.primaryOptionId).title, "Descanso por clima");
});

test("la alternativa cubierta más reciente conserva una rutina física reducida", () => {
  const block = normalizeTrainingBlock({
    id: "plan-semanal",
    title: "Plan semanal",
    weeks: [{ weekKey: "2026-W43", sessions: [{ dateISO: "2026-10-22", primaryOptionId: "tennis", options: [option("tennis", "Entrenamiento grupal")] }] }]
  });
  const adjusted = withCoachPlanAdjustments(block, [{
    id: "question-indoor",
    adjustmentStatus: "applied",
    appliedAt: "2026-10-22T10:00:00.000Z",
    planAdjustment: {
      targetDateISO: "2026-10-22",
      title: "Físico suave bajo techo",
      reason: "Llueve, pero hay implementos disponibles",
      category: "physical",
      summary: "Core y técnica sin fatigar las piernas",
      details: [],
      routineId: "full-body",
      exerciseSettings: [
        { exerciseId: "front-plank", sets: 2, target: "30 seg", weightKg: null, omit: false },
        { exerciseId: "split-step-short", sets: 1, target: "20 seg", weightKg: null, omit: true }
      ]
    }
  }]);
  const session = adjusted.weeks[0].sessions[0];
  const selected = session.options.find(item => item.id === session.primaryOptionId);
  assert.equal(selected.prefill.routineId, "full-body");
  assert.equal(selected.prefill.settings["front-plank"].sets, 2);
  assert.deepEqual(selected.prefill.omitExerciseIds, ["split-step-short"]);
});

test("un partido futuro amplía el plan y conserva su hora aunque el sábado aún no exista", () => {
  const block = normalizeTrainingBlock({
    id: "plan-octubre",
    title: "Plan de octubre",
    weeks: [{ weekKey: "2026-W44", sessions: [{ dateISO: "2026-10-30", primaryOptionId: "physical", options: [{ ...option("physical", "Potencia", "physical"), routineId: "agility" }] }] }]
  });
  const adjusted = withCoachPlanAdjustments(block, [{
    id: "question-interclubes",
    adjustmentStatus: "applied",
    appliedAt: "2026-11-02T21:00:00.000Z",
    planAdjustment: {
      targetDateISO: "2026-11-07",
      startTime: "14:30",
      title: "Partido de interclubes",
      reason: "Partido confirmado",
      category: "tennis",
      summary: "Competencia",
      details: [],
      tennisTypeId: "match",
      exerciseSettings: []
    }
  }]);
  const session = adjusted.weeks.flatMap(week => week.sessions).find(item => item.dateISO === "2026-11-07");
  assert.ok(session);
  assert.equal(session.startTime, "14:30");
  assert.equal(session.options.find(item => item.id === session.primaryOptionId).title, "Partido de interclubes");
  assert.equal(adjusted.endISO, "2026-11-08");
});

test("Inicio cambia lo previsto y coordina el escenario nutricional", () => {
  const block = normalizeTrainingBlock({
    id: "plan-noviembre",
    title: "Plan de noviembre",
    weeks: [{ weekKey: "2026-W46", sessions: [{ dateISO: "2026-11-10", primaryOptionId: "tennis", options: [option("tennis", "Entrenamiento grupal")] }] }]
  });
  const restDraft = quickPlanDraft({ dateISO: "2026-11-10", scenario: "rest" });
  const adjusted = normalizeTrainingBlock(applyQuickPlanDraft(block, "2026-11-10", restDraft, "2026-11-10T20:00:00.000Z"));
  const session = adjusted.weeks[0].sessions[0];
  assert.equal(restDraft.nutritionMode, "recovery");
  assert.equal(session.options.find(item => item.id === session.primaryOptionId).prefill.restTypeId, "planned");
  const matchDraft = quickPlanDraft({ dateISO: "2026-11-14", scenario: "match", matchPeriod: "night", opponent: "Nicolás", startTime: "20:30" });
  const withMatch = normalizeTrainingBlock(applyQuickPlanDraft(adjusted, "2026-11-14", matchDraft, "2026-11-10T20:05:00.000Z"));
  const match = withMatch.weeks.flatMap(week => week.sessions).find(item => item.dateISO === "2026-11-14");
  assert.equal(matchDraft.nutritionMode, "late");
  assert.equal(match.startTime, "20:30");
  assert.equal(match.options.find(item => item.id === match.primaryOptionId).title, "Partido vs. Nicolás");
});

test("el editor rápido ofrece rutinas físicas concretas y no solo una categoría genérica", () => {
  const legs = quickPlanDraft({ dateISO: "2026-11-11", scenario: "physical", routineId: "legs" });
  const upper = quickPlanDraft({ dateISO: "2026-11-11", scenario: "physical", routineId: "upper" });
  const power = quickPlanDraft({ dateISO: "2026-11-11", scenario: "physical", routineId: "agility" });
  assert.equal(legs.nutritionMode, "physicalLegs");
  assert.equal(upper.nutritionMode, "physicalUpper");
  assert.equal(power.nutritionMode, "physicalPower");
  assert.equal(power.option.prefill.routineId, "agility");
});

test("Inicio define actividad e intensidad del cardio y entrega el modo correcto a nutrición", () => {
  const low = quickPlanDraft({ dateISO: "2026-11-12", scenario: "cardio", cardioTypeId: "walking", cardioIntensity: "low" });
  const moderate = quickPlanDraft({ dateISO: "2026-11-12", scenario: "cardio", cardioTypeId: "stationary-bike", cardioIntensity: "moderate" });
  const high = quickPlanDraft({ dateISO: "2026-11-12", scenario: "cardio", cardioTypeId: "running", cardioIntensity: "high" });
  assert.equal(low.nutritionMode, "cardioSoft");
  assert.equal(moderate.nutritionMode, "cardio");
  assert.equal(high.nutritionMode, "cardioHigh");
  assert.equal(high.option.title, "Cardio · Trote");
  const block = normalizeTrainingBlock({ id: "cardio-plan", title: "Cardio", weeks: [{ weekKey: "2026-W46", sessions: [{ dateISO: "2026-11-12", primaryOptionId: high.option.id, options: [high.option] }] }] });
  const option = block.weeks[0].sessions[0].options[0];
  assert.equal(option.prefill.cardioTypeId, "running");
  assert.equal(option.prefill.cardioIntensity, "high");
});

test("un cambio manual en Inicio prevalece sobre un partido importado al volver a cargar", () => {
  const block = normalizeTrainingBlock({
    id: "plan-noviembre",
    title: "Plan de noviembre",
    weeks: [{
      weekKey: "2026-W46",
      startISO: "2026-11-09",
      endISO: "2026-11-15",
      sessions: [{ dateISO: "2026-11-14", primaryOptionId: "tennis", options: [option("tennis", "Entrenamiento grupal")] }]
    }]
  });
  const restDraft = quickPlanDraft({ dateISO: "2026-11-14", scenario: "rest" });
  const saved = normalizeTrainingBlock(applyQuickPlanDraft(block, "2026-11-14", restDraft, "2026-11-10T20:00:00.000Z"));
  const restored = withMatchCalendar(saved, [{
    id: "match-14",
    weekKey: "2026-W46",
    dateISO: "2026-11-14",
    startTime: "14:30",
    endTime: "16:00",
    court: 1,
    category: "A",
    opponent: "Nicolás Collao",
    status: "scheduled"
  }]);
  const session = restored.weeks.flatMap(week => week.sessions).find(item => item.dateISO === "2026-11-14");
  const primary = session.options.find(item => item.id === session.primaryOptionId);
  assert.equal(primary.title, "Día de descanso");
  assert.equal(primary.manualOverride, true);
  assert.equal(session.options.some(item => item.title === "Partido vs. Nicolás Collao"), true);
});
