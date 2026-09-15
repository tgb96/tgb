// Relaciona actividades reales con el plan sin alterar distancia, duración o sensaciones.
export function recordMatchesPlanOption(record, option) {
  if (!record || !option || record.category !== option.category) return false;
  const prefill = option.prefill || {};
  if (record.category === "physical") return Boolean(prefill.routineId) && record.routineId === prefill.routineId;
  if (record.category === "cardio") return Boolean(prefill.cardioTypeId) && record.cardioTypeId === prefill.cardioTypeId;
  if (record.category === "tennis") return !prefill.tennisTypeId || record.tennisTypeId === prefill.tennisTypeId;
  if (record.category === "rest") return !prefill.restTypeId || record.restTypeId === prefill.restTypeId;
  return false;
}

export function plannedMatchForRecord(record, block) {
  for (const week of block?.weeks || []) {
    for (const session of week.sessions || []) {
      if (session.dateISO !== record?.dateISO) continue;
      if (record.planSessionId && (record.planBlockId !== block.id || record.planSessionId !== session.id)) continue;
      const option = (session.options || []).find(item => item.id === record.planOptionId && recordMatchesPlanOption(record, item))
        || (session.options || []).find(item => item.id === session.primaryOptionId && recordMatchesPlanOption(record, item))
        || (session.options || []).find(item => recordMatchesPlanOption(record, item));
      if (option) return { week, session, option };
    }
  }
  return null;
}

// Una actividad distinta también es contexto del día, no cumplimiento automático.
// No elige arbitrariamente entre varias sesiones posibles ni cambia planes anteriores.
export function plannedContextForRecord(record, block) {
  const exact = plannedMatchForRecord(record, block);
  if (exact) return { ...exact, exact: true };
  if (record?.planBlockId && record.planBlockId !== block?.id) return null;
  const candidates = (block?.weeks || []).flatMap(week => (week.sessions || [])
    .filter(session => session.dateISO === record?.dateISO && (!record.planSessionId || record.planSessionId === session.id))
    .map(session => ({ week, session })));
  const sameCategory = candidates.filter(({ session }) => session.options?.some(option => option.category === record.category));
  const eligible = sameCategory.length ? sameCategory : candidates;
  if (eligible.length !== 1) return null;
  const { week, session } = eligible[0];
  const option = session.options?.find(item => item.id === session.primaryOptionId) || session.options?.[0];
  return option ? { week, session, option, exact: false } : null;
}

export function planAssessment(record, match) {
  if (!record) return { status: "pending", label: "Plan", reason: "" };
  const assessment = record.routineAiAnalysis?.planComparison;
  const labels = { completed: "Cumplido", partial: "Parcial", adapted: "Adaptado", recovery: "Recuperación", different: "Otra actividad", unknown: "Por evaluar" };
  if (labels[assessment?.status]) return { ...assessment, label: labels[assessment.status] };
  if (!match) return { status: "unknown", label: "Sin plan relacionado", reason: "" };
  if (record.category === "rest" && match.option.category !== "rest") return { status: "recovery", label: "Descanso", reason: "Descanso registrado en lugar del entrenamiento. La guía evaluará su relación con la recuperación." };
  if (!recordMatchesPlanOption(record, match.option)) return { status: "different", label: "Otra actividad", reason: "Actividad relacionada con el día; falta evaluar si cubre el objetivo del plan." };
  const target = match.option.prefill || {};
  if (record.category === "cardio" && Number(target.distanceKm) > 0 && Number(record.distanceKm) !== Number(target.distanceKm)) return { status: "adapted", label: "Distancia adaptada", reason: `${record.distanceKm || 0} km realizados frente a ${target.distanceKm} km previstos. Más distancia no implica mejor cumplimiento.` };
  if (record.category === "physical" && Number(record.routineCompletedSets) < Number(record.routinePlannedSets)) return { status: "partial", label: "Rutina parcial", reason: "Se registró una ejecución parcial; la guía comparará los ejercicios con el objetivo original." };
  return { status: "unknown", label: "Registrado", reason: "Actividad prevista registrada. La guía evaluará cargas, intensidad, sensaciones y objetivo antes de afirmar cumplimiento total." };
}

export function comparableActivity(record, other) {
  if (record.category !== other.category) return false;
  if (record.category === "physical") return record.routineId ? record.routineId === other.routineId : record.routineName === other.routineName;
  if (record.category === "cardio") {
    if (record.cardioTypeId !== other.cardioTypeId) return false;
    if (record.cardioTypeId === "running") return Math.round(Number(record.distanceKm) * 1000) === Math.round(Number(other.distanceKm) * 1000);
    if (record.cardioTypeId === "trekking") return record.location === other.location && record.trekkingRoute === other.trekkingRoute;
  }
  return true;
}
