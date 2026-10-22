import test from "node:test";
import assert from "node:assert/strict";
import { withCoachPlanAdjustments } from "../assets/js/coach-plan.js";
import { normalizeTrainingBlock } from "../assets/js/training-plan.js";

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
