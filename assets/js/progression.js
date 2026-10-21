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

const qualityForProgression = record => completionRate(record) >= 0.9
  && asNumber(record?.painScore ?? record?.routinePain) !== null
  && asNumber(record?.painScore ?? record?.routinePain) <= 2
  && asNumber(record?.effortRpe ?? record?.routineEffort) !== null
  && asNumber(record?.effortRpe ?? record?.routineEffort) <= 7
  && !["declined", "poor"].includes(record?.technique ?? record?.routineTechnique);

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
  let readiness = "observe";
  let reason = "Falta repetir la configuración o registrar mejor la calidad de la última serie.";
  if (pain !== null && pain >= 5) {
    readiness = "recover";
    reason = "El dolor informado impide progresar la carga y requiere priorizar recuperación.";
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
      && exerciseComplete(item.exercise) && qualityForProgression(item.record)).length;
    const eligible = readiness === "progress" && exerciseComplete(exercise) && !blocksAutomaticProgression(exercise)
      && (repsInReserve !== null ? repsInReserve >= 3 : repeatedSuccesses >= 1);
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
      eligibleForIncrease: eligible,
      automaticProgressionBlocked: blocksAutomaticProgression(exercise)
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
    if ([weightChanged, setsChanged, targetChanged].filter(Boolean).length !== 1) continue;
    if (weightChanged) {
      if (currentWeight === null || proposedWeight === null || rule.progressionKind !== "load" || rule.automaticProgressionBlocked || /core/i.test(rule.phase || "")) continue;
      const delta = proposedWeight - currentWeight;
      if (change.action === "increase" ? delta <= 0 || delta > 2 : delta >= 0 || Math.abs(delta) > Math.max(2, currentWeight * 0.3)) continue;
    }
    if (setsChanged) {
      const delta = proposedSets - rule.currentSets;
      if (change.action === "increase" ? delta !== 1 : delta >= 0 || Math.abs(delta) > 2) continue;
    }
    if (targetChanged && !changedTargetsAreSafe(rule.currentTarget, proposedTarget, change.action)) continue;
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
      reason: String(change.reason || evidence.reason).slice(0, 1000)
    });
  }
  return accepted;
}

function increasedTarget(target) {
  const source = String(target || "");
  const increment = /\bseg/i.test(source) ? 5 : 1;
  return source.replace(/\d+(?:[.,]\d+)?/g, match => {
    const value = Number(match.replace(",", "."));
    return Number.isInteger(value + increment) ? String(value + increment) : String(value + increment).replace(".", ",");
  });
}

export function fallbackProgressionChanges(evidence = null) {
  if (evidence?.readiness !== "progress") return [];
  const eligible = (evidence.exercises || []).filter(exercise => exercise.eligibleForIncrease);
  const exercise = eligible.find(item => item.progressionKind === "load" && item.currentWeightKg !== null && item.currentWeightKg < 40)
    || eligible.find(item => /\d/.test(item.currentTarget || ""))
    || eligible.find(item => item.currentSets > 0 && item.currentSets < 10);
  if (!exercise) return [];
  const proposed = {
    exerciseId: exercise.exerciseId,
    exerciseName: exercise.exerciseName,
    action: "increase",
    currentSets: exercise.currentSets,
    proposedSets: exercise.currentSets,
    currentTarget: exercise.currentTarget,
    proposedTarget: exercise.currentTarget,
    currentWeightKg: exercise.currentWeightKg,
    proposedWeightKg: exercise.currentWeightKg,
    reason: `${evidence.reason} Se propone cambiar una sola variable y volver a evaluar la técnica y la reserva.`
  };
  if (exercise.progressionKind === "load") proposed.proposedWeightKg = exercise.currentWeightKg + 1;
  else if (/\d/.test(exercise.currentTarget || "")) proposed.proposedTarget = increasedTarget(exercise.currentTarget);
  else proposed.proposedSets += 1;
  return sanitizeProgressionChanges([proposed], evidence);
}
