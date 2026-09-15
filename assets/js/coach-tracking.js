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
