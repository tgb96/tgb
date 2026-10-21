import test from "node:test";
import assert from "node:assert/strict";
import { buildProgressionEvidence, fallbackProgressionChanges, sanitizeProgressionChanges } from "../assets/js/progression.js";

const session = (overrides = {}) => ({
  category: "physical",
  routineId: "upper",
  dateISO: "2026-10-21",
  plannedSets: 3,
  completedSets: 3,
  effortRpe: 6,
  painScore: 0,
  technique: "solid",
  repsInReserve: 4,
  exercises: [{
    id: "row",
    name: "Remo con mancuerna",
    phase: "Fuerza",
    target: "10 reps",
    weightKg: 8,
    plannedSets: 3,
    completedSets: 3
  }],
  ...overrides
});

const weightChange = overrides => ({
  exerciseId: "row",
  exerciseName: "Remo con mancuerna",
  action: "increase",
  currentSets: 3,
  proposedSets: 3,
  currentTarget: "10 reps",
  proposedTarget: "10 reps",
  currentWeightKg: 8,
  proposedWeightKg: 9,
  reason: "La ejecución dejó margen.",
  ...overrides
});

test("habilita una progresión pequeña cuando la sesión deja reserva y mantiene la técnica", () => {
  const evidence = buildProgressionEvidence(session());
  assert.equal(evidence.readiness, "progress");
  assert.equal(evidence.exercises[0].eligibleForIncrease, true);
  const accepted = sanitizeProgressionChanges([weightChange()], evidence);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].proposedWeightKg, 9);
});

test("genera una propuesta conservadora si la IA decide progresar sin entregar cifras", () => {
  const evidence = buildProgressionEvidence(session());
  const fallback = fallbackProgressionChanges(evidence);
  assert.equal(fallback.length, 1);
  assert.equal(fallback[0].exerciseId, "row");
  assert.equal(fallback[0].proposedWeightKg, 9);
  assert.equal(fallback[0].proposedSets, 3);
  assert.equal(fallback[0].proposedTarget, "10 reps");
});

test("mantiene la carga cuando faltan series, el esfuerzo es alto o no quedan repeticiones", () => {
  for (const current of [
    session({ completedSets: 2 }),
    session({ effortRpe: 8 }),
    session({ repsInReserve: 1 })
  ]) {
    const evidence = buildProgressionEvidence(current);
    assert.equal(evidence.readiness, "maintain");
    assert.deepEqual(sanitizeProgressionChanges([weightChange()], evidence), []);
  }
});

test("dolor o deterioro técnico bloquean subidas y permiten una reducción prudente", () => {
  const evidence = buildProgressionEvidence(session({ painScore: 4 }));
  assert.equal(evidence.readiness, "reduce");
  assert.deepEqual(sanitizeProgressionChanges([weightChange()], evidence), []);
  const accepted = sanitizeProgressionChanges([weightChange({ action: "reduce", proposedWeightKg: 6 })], evidence);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].proposedWeightKg, 6);

  assert.equal(buildProgressionEvidence(session({ technique: "declined" })).readiness, "reduce");
  assert.equal(buildProgressionEvidence(session({ painScore: 6 })).readiness, "recover");
});

test("rechaza saltos de carga, dos variables y progresión automática en ejercicios explosivos", () => {
  const evidence = buildProgressionEvidence(session());
  assert.deepEqual(sanitizeProgressionChanges([weightChange({ proposedWeightKg: 12 })], evidence), []);
  assert.deepEqual(sanitizeProgressionChanges([weightChange({ proposedSets: 4, proposedWeightKg: 10 })], evidence), []);

  const power = session({
    exercises: [{
      id: "skater-jump",
      name: "Saltos skater",
      phase: "Potencia",
      target: "8 reps",
      weightKg: 4,
      plannedSets: 3,
      completedSets: 3
    }]
  });
  const powerEvidence = buildProgressionEvidence(power);
  assert.equal(powerEvidence.exercises[0].automaticProgressionBlocked, true);
  assert.equal(powerEvidence.exercises[0].eligibleForIncrease, false);
});

test("solo acepta un cambio por ejercicio y dos cambios por sesión", () => {
  const current = session({
    plannedSets: 9,
    completedSets: 9,
    exercises: ["row", "press", "curl"].map((id, index) => ({
      id,
      name: id,
      phase: "Fuerza",
      target: "10 reps",
      weightKg: 8 + index,
      plannedSets: 3,
      completedSets: 3
    }))
  });
  const evidence = buildProgressionEvidence(current);
  const changes = current.exercises.flatMap(exercise => [
    weightChange({ exerciseId: exercise.id, exerciseName: exercise.name, currentWeightKg: exercise.weightKg, proposedWeightKg: exercise.weightKg + 1 }),
    weightChange({ exerciseId: exercise.id, exerciseName: exercise.name, currentWeightKg: exercise.weightKg, proposedWeightKg: exercise.weightKg + 2 })
  ]);
  const accepted = sanitizeProgressionChanges(changes, evidence);
  assert.equal(accepted.length, 2);
  assert.equal(new Set(accepted.map(change => change.exerciseId)).size, 2);
});

test("la doble progresión sube repeticiones antes de aumentar la carga", () => {
  const current = session({
    exercises: [{
      ...session().exercises[0],
      target: "10 reps",
      progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }
    }]
  });
  const evidence = buildProgressionEvidence(current);
  const recommendation = evidence.exercises[0].recommendedChange;
  assert.equal(recommendation.progressionStep, "repetitions");
  assert.equal(recommendation.proposedTarget, "11 reps");
  assert.equal(recommendation.proposedWeightKg, 8);
  assert.equal(sanitizeProgressionChanges([recommendation], evidence).length, 1);
});

test("tras consolidar el máximo sube la carga y vuelve al inicio del rango", () => {
  const exercise = {
    ...session().exercises[0],
    target: "12 reps",
    progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }
  };
  const previous = session({ dateISO: "2026-10-14", exercises: [{ ...exercise }] });
  const evidence = buildProgressionEvidence(session({ exercises: [exercise] }), [previous]);
  const recommendation = evidence.exercises[0].recommendedChange;
  assert.equal(recommendation.progressionStep, "load-reset");
  assert.equal(recommendation.proposedWeightKg, 9);
  assert.equal(recommendation.proposedTarget, "8 reps");
  const accepted = sanitizeProgressionChanges([recommendation], evidence);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].progressionStep, "load-reset");
});

test("en el máximo del rango espera una segunda sesión exitosa antes de subir peso", () => {
  const evidence = buildProgressionEvidence(session({
    exercises: [{
      ...session().exercises[0],
      target: "12 reps",
      progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }
    }]
  }));
  assert.equal(evidence.exercises[0].eligibleForIncrease, false);
  assert.equal(evidence.exercises[0].recommendedChange, null);
});

test("la evaluación específica de un ejercicio prevalece sobre la sesión general", () => {
  const evidence = buildProgressionEvidence(session({
    exercises: [{
      ...session().exercises[0],
      technique: "solid",
      repsInReserve: 1
    }]
  }));
  assert.equal(evidence.readiness, "progress");
  assert.equal(evidence.exercises[0].eligibleForIncrease, false);
});

test("recomienda descarga cuando dos sesiones recientes acumulan señales de fatiga", () => {
  const current = session({ effortRpe: 8, repsInReserve: 1 });
  const previous = session({ dateISO: "2026-10-14", painScore: 3, effortRpe: 8 });
  const evidence = buildProgressionEvidence(current, [previous]);
  assert.equal(evidence.deloadRecommended, true);
  assert.equal(evidence.readiness, "reduce");
  assert.match(evidence.reason, /descarga/i);
});

test("marca estancamiento tras tres intentos iguales sin calidad suficiente", () => {
  const current = session({ effortRpe: 8, repsInReserve: 1 });
  const previous = [
    session({ dateISO: "2026-10-14", effortRpe: 8, repsInReserve: 1 }),
    session({ dateISO: "2026-10-07", effortRpe: 8, repsInReserve: 1 })
  ];
  const evidence = buildProgressionEvidence(current, previous);
  assert.equal(evidence.exercises[0].sameConfigurationAttempts, 3);
  assert.equal(evidence.exercises[0].stalled, true);
});
