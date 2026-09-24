const numberOrNull = value => value === "" || value === null || value === undefined || !Number.isFinite(Number(value))
  ? null : Number(value);

export function normalizeWearableSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  const sessionId = String(value.id || "").slice(0, 120);
  if (!sessionId) return null;
  const numeric = key => {
    const parsed = numberOrNull(value[key]);
    return parsed !== null && parsed >= 0 ? parsed : null;
  };
  return {
    id: sessionId,
    title: String(value.title || "Entrenamiento detectado").slice(0, 120),
    dateISO: String(value.dateISO || "").slice(0, 10),
    startTime: String(value.startTime || ""),
    endTime: String(value.endTime || ""),
    durationSeconds: numeric("durationSeconds"),
    activeCaloriesKcal: numeric("caloriesKcal") ?? numeric("activeCaloriesKcal"),
    distanceMeters: numeric("distanceMeters"),
    heartRateAvgBpm: numeric("heartRateAvgBpm"),
    heartRateMaxBpm: numeric("heartRateMaxBpm"),
    heartRateMinBpm: numeric("heartRateMinBpm"),
    heartRateSampleCount: numeric("heartRateSampleCount"),
    originPackage: String(value.originPackage || "").slice(0, 200)
  };
}

function recordWindow(record) {
  const start = Date.parse(record.routineStartedAt || record.guidedStartedAt || "");
  const end = Date.parse(record.routineEndedAt || record.guidedEndedAt || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

function sessionWindow(session) {
  const start = Date.parse(session.startTime || "");
  const end = Date.parse(session.endTime || "");
  return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
}

export function wearableMatch(record, session) {
  if (!record || record.category === "rest" || !session?.id) return null;
  const own = recordWindow(record);
  const band = sessionWindow(session);
  const overlaps = own && band && Math.min(own.end, band.end) > Math.max(own.start, band.start);
  if (session.dateISO !== record.dateISO && !overlaps) return null;
  const recordedSeconds = numberOrNull(record.durationSeconds) ?? (numberOrNull(record.durationMinutes) || 0) * 60;
  const bandSeconds = numberOrNull(session.durationSeconds) || 0;
  // Una sesión de tenis de 90 min no debe aparecer como pulsera del calentamiento de 10 min.
  if (["warmup", "stretching"].includes(record.category) && recordedSeconds > 0 && bandSeconds > recordedSeconds * 1.75) return null;
  const durationDifference = recordedSeconds > 0 && bandSeconds > 0
    ? Math.abs(recordedSeconds - bandSeconds) / Math.max(recordedSeconds, bandSeconds) : 1;
  const title = String(session.title || "").toLowerCase();
  const sameType = record.category === "physical" ? /físico|fuerza|pesas/.test(title)
    : record.category === "tennis" ? /tenis/.test(title)
      : record.category === "warmup" ? /calentamiento|warm.?up/.test(title)
        : record.category === "stretching" ? /estiramiento|stretch|movilidad/.test(title)
      : record.cardioTypeId === "running" ? /trote|correr/.test(title)
        : record.cardioTypeId === "trekking" ? /trekking|senderismo/.test(title)
          : record.cardioTypeId?.startsWith("bik") ? /bicicleta/.test(title) : false;
  let score = (sameType ? 20 : 0) + Math.round((1 - durationDifference) * 20);
  let reason = "Mismo día; confirma que sea la misma actividad";
  if (own && band) {
    const overlap = Math.max(0, Math.min(own.end, band.end) - Math.max(own.start, band.start));
    const shorter = Math.min(own.end - own.start, band.end - band.start);
    if (overlap / shorter >= 0.5) {
      score += 100 + Math.round(40 * overlap / shorter);
      reason = "Horario coincidente";
    } else if (Math.abs(own.start - band.start) <= 10 * 60_000) {
      score += 65;
      reason = "Inicio cercano; revisa el término";
    } else {
      score -= 30;
      reason = "Horarios distintos; revisa antes de vincular";
    }
  } else if (record.activityStartTime && band && session.dateISO === record.dateISO) {
    const bandLocal = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(band.start));
    const [recordHour, recordMinute] = record.activityStartTime.split(":").map(Number);
    const [bandHour, bandMinute] = bandLocal.split(":").map(Number);
    const rawDifference = Math.abs((recordHour * 60 + recordMinute) - (bandHour * 60 + bandMinute));
    const difference = Math.min(rawDifference, 1440 - rawDifference);
    if (difference <= 10) { score += 85; reason = "Hora de inicio muy cercana"; }
    else if (difference <= 30) { score += 45; reason = "Hora de inicio cercana"; }
    else if (difference > 120) { score -= 25; reason = "Hora de inicio distinta; revisa antes de vincular"; }
  }
  return { score, reason };
}

export function wearableCandidates(record, sessions, records = []) {
  const used = new Set(records.filter(item => item.id !== record.id && item.wearableSessionId)
    .map(item => item.wearableSessionId));
  return (sessions || []).filter(session => !used.has(session.id))
    .map(session => ({ session, match: wearableMatch(record, session) }))
    .filter(item => item.match)
    .sort((a, b) => b.match.score - a.match.score || String(a.session.startTime).localeCompare(String(b.session.startTime)))
    .slice(0, 8);
}

export function wearableSummaryText(snapshot) {
  const data = normalizeWearableSnapshot(snapshot);
  if (!data) return "";
  const parts = [];
  if (data.durationSeconds !== null) parts.push(`${Math.round(data.durationSeconds / 60)} min`);
  if (data.distanceMeters !== null && data.distanceMeters > 0) parts.push(`${(data.distanceMeters / 1000).toLocaleString("es-CL", { maximumFractionDigits: 2 })} km`);
  if (data.heartRateAvgBpm !== null) parts.push(`FC media ${Math.round(data.heartRateAvgBpm)} lpm`);
  if (data.heartRateMaxBpm !== null) parts.push(`máxima ${Math.round(data.heartRateMaxBpm)} lpm`);
  if (data.activeCaloriesKcal !== null) parts.push(`${Math.round(data.activeCaloriesKcal)} kcal activas estimadas`);
  if (data.heartRateAvgBpm === null && data.heartRateMaxBpm === null)
    parts.push("sin LPM compartidas por Health Connect");
  return parts.join(" · ");
}

export function wearableComparison(record, records = []) {
  if (!record?.wearableSnapshot) return "";
  const comparable = item => {
    if (!item.wearableSnapshot || item.id === record.id || item.dateISO > record.dateISO) return false;
    if (record.category === "physical") return item.category === "physical" && item.routineId && item.routineId === record.routineId;
    if (record.category === "cardio" && record.cardioTypeId === "running")
      return item.category === "cardio" && item.cardioTypeId === "running" && Math.abs(Number(item.distanceKm) - Number(record.distanceKm)) < 0.01;
    return false;
  };
  const previous = records.filter(comparable).sort((a, b) => String(b.routineStartedAt || b.createdAt || b.dateISO)
    .localeCompare(String(a.routineStartedAt || a.createdAt || a.dateISO)))[0];
  if (!previous) return "";
  const differences = [];
  if (record.category === "physical") {
    const currentVolume = numberOrNull(record.routineVolumeKg);
    const previousVolume = numberOrNull(previous.routineVolumeKg);
    if (currentVolume !== null && previousVolume !== null)
      differences.push(`volumen ${currentVolume - previousVolume >= 0 ? "+" : ""}${Math.round(currentVolume - previousVolume)} kg`);
  }
  if (record.category === "cardio") {
    const currentSeconds = numberOrNull(record.durationSeconds);
    const previousSeconds = numberOrNull(previous.durationSeconds);
    if (currentSeconds !== null && previousSeconds !== null)
      differences.push(`tiempo ${currentSeconds - previousSeconds >= 0 ? "+" : ""}${Math.round(currentSeconds - previousSeconds)} s`);
  }
  const currentBpm = numberOrNull(record.wearableSnapshot.heartRateAvgBpm);
  const previousBpm = numberOrNull(previous.wearableSnapshot.heartRateAvgBpm);
  if (currentBpm !== null && previousBpm !== null)
    differences.push(`FC media ${currentBpm - previousBpm >= 0 ? "+" : ""}${Math.round(currentBpm - previousBpm)} lpm`);
  return differences.length ? `Frente a la última sesión comparable: ${differences.join(" · ")}. Son mediciones orientativas; considera también descansos, terreno, esfuerzo y molestias.` : "";
}
