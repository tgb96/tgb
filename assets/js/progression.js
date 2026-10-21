const asNumber = value => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const completionRate = record => {
  const planned = asNumber(record?.plannedSets ?? record?.routinePlannedSets) || 0;
  const completed = asNumber(record?.completedSets ?? record?.routineCompletedSets) || 0;
  return planned > 0 ? completed / planned : 0;
};

const exerciseComplete = exercise => Number(exercise?.plannedSets) > 0
  && Number(exercise?.completedSets) >= Number(exercise?.plannedSets);

const sameConfiguration = (left, right) => String(left?.target || "") === String(right?.target || "")
  && asNumber(left?.weightKg) === asNumber(right?.weightKg)
  && Number(left?.plannedSets) === Number(right?.plannedSets);

const blocksAutomaticProgression = exercise => /calentamiento|potencia/i.test(String(exercise?.phase || ""))
  || /jump|salto|split-step|skater/i.test(`${exercise?.id || ""} ${exercise?.name || ""}`);

const exerciseKind = exercise => {
  if (asNumber(exercise?.weightKg) > 0 && !/core/i.test(String(exercise?.phase || ""))) return "load";
  if (/seg|min/i.test(String(exercise?.target || ""))) return "time";
  return "repetitions";
};

const exerciseFeedback = (exercise, record) => ({
  technique: String(exercise?.technique || record?.technique || record?.routineTechnique || ""),
  repsInReserve: asNumber(exercise?.repsInReserve ?? record?.repsInReserve ?? record?.routineRepsInReserve)
});

const targetNumber = target => {
  const match = String(target || "").match(/\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(",", ".")) : null;
};

const replaceFirstTargetNumber = (target, value) => String(target || "").replace(/\d+(?:[.,]\d+)?/, String(value).replace(".", ","));

function increasedTarget(target) {
  const source = String(target || "");
  const increment = /\bseg/i.test(source) ? 5 : 1;
  return source.replace(/\d+(?:[.,]\d+)?/g, match => {
    const value = Number(match.replace(",", "."));
    return Number.isInteger(value + increment) ? String(value + increment) : String(value + increment).replace(".", ",");
  });
}

const qualityForProgression = record => completionRate(record) >= 0.9
  && asNumber(record?.painScore ?? record?.routinePain) !== null
  && asNumber(record?.painScore ?? record?.routinePain) <= 2
  && asNumber(record?.effortRpe ?? record?.routineEffort) !== null
  && asNumber(record?.effortRpe ?? record?.routineEffort) <= 7
  && !["declined", "poor"].includes(record?.technique ?? record?.routineTechnique);

const exerciseQualityForProgression = (record, exercise) => {
  const feedback = exerciseFeedback(exercise, record);
  return qualityForProgression(record) && exerciseComplete(exercise)
    && !["declined", "poor"].includes(feedback.technique)
    && (feedback.repsInReserve === null || feedback.repsInReserve >= 2);
};

function recommendedIncrease(exercise, repeatedSuccesses) {
  const progression = exercise?.progression;
  const currentSets = Number(exercise?.plannedSets) || 0;
  const currentTarget = String(exercise?.target || "");
  const currentWeightKg = asNumber(exercise?.weightKg);
  const base = {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    action: "increase",
    currentSets,
    proposedSets: currentSets,
    currentTarget,
    proposedTarget: currentTarget,
    currentWeightKg,
    proposedWeightKg: currentWeightKg
  };
  if (progression?.type === "double") {
    const current = targetNumber(currentTarget);
    const minimum = asNumber(progression.minTarget);
    const maximum = asNumber(progression.maxTarget);
    if (current !== null && maximum !== null && current < maximum) return {
      ...base,
      proposedTarget: replaceFirstTargetNumber(currentTarget, Math.min(maximum, current + 1)),
      progressionStep: "repetitions",
      reason: `Primero sube una repetición dentro del rango ${minimum}–${maximum}; el peso se mantiene.`
    };
    if (current !== null && maximum !== null && current >= maximum && currentWeightKg !== null && repeatedSuccesses >= 1) {
      const step = asNumber(progression.loadStepKg) || 1;
      return {
        ...base,
        proposedTarget: replaceFirstTargetNumber(currentTarget, minimum ?? current),
        proposedWeightKg: Math.round((currentWeightKg + step) * 100) / 100,
        progressionStep: "load-reset",
        reason: `Consolidaste el máximo del rango en dos sesiones: sube ${step.toLocaleString("es-CL")} kg y vuelve a ${minimum} repeticiones.`
      };
    }
    return null;
  }
  const kind = exerciseKind(exercise);
  if (kind === "load" && currentWeightKg !== null && currentWeightKg < 40) return {
    ...base,
    proposedWeightKg: currentWeightKg + 1,
    progressionStep: "load",
    reason: "Sube 1 kg y vuelve a evaluar técnica y repeticiones en reserva."
  };
  if (/\d/.test(currentTarget)) return {
    ...base,
    proposedTarget: increasedTarget(currentTarget),
    progressionStep: kind === "time" ? "time" : "repetitions",
    reason: kind === "time" ? "Añade un intervalo breve manteniendo la calidad." : "Añade una repetición manteniendo la carga y la técnica."
  };
  if (currentSets > 0 && currentSets < 10) return {
    ...base,
    proposedSets: currentSets + 1,
    progressionStep: "sets",
    reason: "Añade una serie y no cambies las demás variables."
  };
  return null;
}

export function buildProgressionEvidence(current, previousRecords = []) {
  if (!current || current.category !== "physical" || !current.routineId) return null;
  const comparable = previousRecords
    .filter(item => item?.category === "physical" && item.routineId === current.routineId && item.dateISO <= current.dateISO)
    .sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))
    .slice(0, 6);
  const completedPercent = Math.round(completionRate(current) * 100);
  const effort = asNumber(current.effortRpe ?? current.routineEffort);
  const pain = asNumber(current.painScore ?? current.routinePain);
  const technique = String((current.technique ?? current.routineTechnique) || "");
  const repsInReserve = asNumber(current.repsInReserve ?? current.routineRepsInReserve);
  const recentForFatigue = [current, ...comparable].slice(0, 3);
  const fatigueHits = recentForFatigue.filter(record => completionRate(record) < 0.8
    || asNumber(record?.painScore ?? record?.routinePain) >= 3
    || asNumber(record?.effortRpe ?? record?.routineEffort) >= 8
    || ["declined", "poor"].includes(record?.technique ?? record?.routineTechnique)).length;
  const deloadRecommended = recentForFatigue.length >= 2 && fatigueHits >= 2;
  let readiness = "observe";
  let reason = "Falta repetir la configuración o registrar mejor la calidad de la última serie.";
  if (pain !== null && pain >= 5) {
    readiness = "recover";
    reason = "El dolor informado impide progresar la carga y requiere priorizar recuperación.";
  } else if (deloadRecommended) {
    readiness = "reduce";
    reason = "Dos o más sesiones recientes muestran fatiga, dolor, esfuerzo alto o una caída de ejecución; conviene una sesión de descarga antes de volver a progresar.";
  } else if ((pain !== null && pain >= 3) || technique === "declined") {
    readiness = "reduce";
    reason = technique === "declined" ? "La técnica se deterioró al final de la sesión." : "El dolor informado aconseja reducir antes de progresar.";
  } else if (completedPercent < 90 || (effort !== null && effort >= 8) || (repsInReserve !== null && repsInReserve <= 1)) {
    readiness = "maintain";
    reason = completedPercent < 90 ? "Primero conviene consolidar al menos el 90% de las series." : "La sesión ya fue suficientemente exigente con la configuración actual.";
  } else if (qualityForProgression(current) && technique === "solid" && repsInReserve !== null && repsInReserve >= 3) {
    readiness = "progress";
    reason = "Completaste la sesión con técnica sólida, esfuerzo controlado y al menos tres repeticiones en reserva.";
  } else if (qualityForProgression(current) && comparable.some(item => qualityForProgression(item))) {
    readiness = "progress";
    reason = "Hay al menos dos ejecuciones comparables bien toleradas para valorar una progresión pequeña.";
  } else if (qualityForProgression(current)) {
    readiness = "maintain";
    reason = "La sesión fue bien tolerada; conviene repetirla una vez antes de subir una variable.";
  }

  const exercises = (current.exercises || []).map(exercise => {
    const history = comparable.flatMap(record => {
      const previous = (record.exercises || []).find(item => item.id === exercise.id);
      return previous ? [{ record, exercise: previous }] : [];
    });
    const repeatedSuccesses = history.filter(item => sameConfiguration(exercise, item.exercise)
      && exerciseQualityForProgression(item.record, item.exercise)).length;
    const sameConfigurationAttempts = 1 + history.filter(item => sameConfiguration(exercise, item.exercise)).length;
    const feedback = exerciseFeedback(exercise, current);
    const stalled = sameConfigurationAttempts >= 3 && !exerciseQualityForProgression(current, exercise);
    const baseEligible = readiness === "progress" && exerciseComplete(exercise) && !blocksAutomaticProgression(exercise)
      && !["declined", "poor"].includes(feedback.technique)
      && (feedback.repsInReserve !== null ? feedback.repsInReserve >= 3 : repeatedSuccesses >= 1);
    const recommendation = baseEligible ? recommendedIncrease(exercise, repeatedSuccesses) : null;
    return {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      phase: exercise.phase,
      currentSets: Number(exercise.plannedSets) || 0,
      currentTarget: String(exercise.target || ""),
      currentWeightKg: asNumber(exercise.weightKg),
      completedSets: Number(exercise.completedSets) || 0,
      progressionKind: exerciseKind(exercise),
      repeatedSuccessfulSessions: repeatedSuccesses,
      sameConfigurationAttempts,
      stalled,
      stagnationReason: stalled ? "La misma configuración se repitió al menos tres veces sin una ejecución actual suficientemente sólida para progresar." : "",
      technique: feedback.technique,
      repsInReserve: feedback.repsInReserve,
      eligibleForIncrease: Boolean(recommendation),
      automaticProgressionBlocked: blocksAutomaticProgression(exercise),
      recommendedChange: recommendation
    };
  });

  return {
    readiness,
    reason,
    comparableSessions: comparable.length,
    completedPercent,
    effortRpe: effort,
    painScore: pain,
    technique,
    repsInReserve,
    fatigueHits,
    deloadRecommended,
    exercises
  };
}

function changedTargetsAreSafe(currentTarget, proposedTarget, action) {
  const current = String(currentTarget || "");
  const proposed = String(proposedTarget || "");
  const currentNumbers = [...current.matchAll(/\d+(?:[.,]\d+)?/g)].map(match => Number(match[0].replace(",", ".")));
  const proposedNumbers = [...proposed.matchAll(/\d+(?:[.,]\d+)?/g)].map(match => Number(match[0].replace(",", ".")));
  if (!currentNumbers.length || currentNumbers.length !== proposedNumbers.length) return false;
  const limit = /seg/i.test(current) ? 10 : /min/i.test(current) ? 1 : 2;
  return currentNumbers.every((value, index) => {
    const delta = proposedNumbers[index] - value;
    return action === "increase" ? delta >= 0 && delta <= limit : delta <= 0 && Math.abs(delta) <= Math.max(limit, value * 0.3);
  }) && proposedNumbers.some((value, index) => value !== currentNumbers[index]);
}

export function sanitizeProgressionChanges(changes = [], evidence = null) {
  if (!evidence || !Array.isArray(changes)) return [];
  const rules = new Map((evidence.exercises || []).map(item => [item.exerciseId, item]));
  const accepted = [];
  const usedExercises = new Set();
  for (const change of changes) {
    if (accepted.length >= 2 || !["increase", "reduce"].includes(change?.action)) continue;
    const rule = rules.get(change.exerciseId);
    if (!rule || usedExercises.has(change.exerciseId)) continue;
    if (change.action === "increase" && (!rule.eligibleForIncrease || evidence.readiness !== "progress")) continue;
    if (change.action === "reduce" && !["reduce", "recover"].includes(evidence.readiness)) continue;
    const currentWeight = rule.currentWeightKg;
    const proposedWeight = asNumber(change.proposedWeightKg);
    const proposedSets = Math.min(10, Math.max(1, Number.parseInt(change.proposedSets, 10) || rule.currentSets));
    const proposedTarget = String(change.proposedTarget || rule.currentTarget).trim().slice(0, 40) || rule.currentTarget;
    const weightChanged = currentWeight !== proposedWeight;
    const setsChanged = rule.currentSets !== proposedSets;
    const targetChanged = rule.currentTarget !== proposedTarget;
    const changedCount = [weightChanged, setsChanged, targetChanged].filter(Boolean).length;
    const recommendation = rule.recommendedChange;
    const followsRecommendation = change.action === "increase" && recommendation
      && proposedSets === recommendation.proposedSets
      && proposedTarget === recommendation.proposedTarget
      && proposedWeight === recommendation.proposedWeightKg;
    if (change.action === "increase" && recommendation && !followsRecommendation) continue;
    if (changedCount !== 1 && !(followsRecommendation && recommendation.progressionStep === "load-reset" && changedCount === 2)) continue;
    if (weightChanged) {
      if (currentWeight === null || proposedWeight === null || rule.progressionKind !== "load" || rule.automaticProgressionBlocked || /core/i.test(rule.phase || "")) continue;
      const delta = proposedWeight - currentWeight;
      if (change.action === "increase" ? delta <= 0 || delta > 2 : delta >= 0 || Math.abs(delta) > Math.max(2, currentWeight * 0.3)) continue;
    }
    if (setsChanged) {
      const delta = proposedSets - rule.currentSets;
      if (change.action === "increase" ? delta !== 1 : delta >= 0 || Math.abs(delta) > 2) continue;
    }
    if (targetChanged && !(followsRecommendation && recommendation.progressionStep === "load-reset")
      && !changedTargetsAreSafe(rule.currentTarget, proposedTarget, change.action)) continue;
    usedExercises.add(change.exerciseId);
    accepted.push({
      ...change,
      exerciseName: rule.exerciseName,
      currentSets: rule.currentSets,
      proposedSets,
      currentTarget: rule.currentTarget,
      proposedTarget,
      currentWeightKg: currentWeight,
      proposedWeightKg: proposedWeight,
      progressionStep: recommendation?.progressionStep || String(change.progressionStep || "").slice(0, 40),
      reason: String(recommendation?.reason || change.reason || evidence.reason).slice(0, 1000)
    });
  }
  return accepted;
}

export function fallbackProgressionChanges(evidence = null) {
  if (evidence?.readiness !== "progress") return [];
  const proposed = (evidence.exercises || []).find(exercise => exercise.eligibleForIncrease && exercise.recommendedChange)?.recommendedChange;
  return proposed ? sanitizeProgressionChanges([{ ...proposed, reason: proposed.reason || evidence.reason }], evidence) : [];
}
