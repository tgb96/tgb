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
    rawStartTime: String(value.rawStartTime || ""),
    rawEndTime: String(value.rawEndTime || ""),
    clockAdjustmentMinutes: numberOrNull(value.clockAdjustmentMinutes) === null
      ? 0 : Math.max(-120, Math.min(120, Number(value.clockAdjustmentMinutes))),
    clockAdjustmentReason: String(value.clockAdjustmentReason || "").slice(0, 100),
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

function wearableSessionQuality(session) {
  if (!session) return -1;
  const title = String(session.title || "").toLowerCase();
  let score = /entrenamiento detectado|^entrenamiento$/.test(title) ? 0 : 3;
  if (numberOrNull(session.caloriesKcal) !== null || numberOrNull(session.activeCaloriesKcal) !== null) score += 5;
  if (numberOrNull(session.heartRateAvgBpm) !== null) score += 4;
  if (numberOrNull(session.heartRateMaxBpm) !== null) score += 2;
  if (numberOrNull(session.distanceMeters) !== null) score += 2;
  if (session.rawStartTime) score += 1;
  if (numberOrNull(session.clockAdjustmentMinutes)) score += 1;
  if (/xiaomi|mifitness/i.test(String(session.originPackage || ""))) score += 2;
  return score;
}

function startInstants(session) {
  return [session?.startTime, session?.rawStartTime]
    .map(value => Date.parse(value || ""))
    .filter(Number.isFinite);
}

export function wearableSessionAllowed(session) {
  return !/strava/i.test(String(session?.originPackage || ""));
}

function wearableActivityKey(value) {
  const dateISO = String(value?.dateISO || "");
  if (!dateISO) return "";
  if (value?.category === "tennis") return `${dateISO}|tennis`;
  if (value?.category === "physical") return `${dateISO}|physical`;
  if (value?.category === "cardio") {
    const subtype = String(value.cardioTypeId || "cardio").replace(/^bike-.*/, "bike");
    return `${dateISO}|cardio:${subtype}`;
  }
  const title = String(value?.title || "").toLowerCase();
  if (/tenis/.test(title)) return `${dateISO}|tennis`;
  if (/físico|fisico|fuerza|pesas/.test(title)) return `${dateISO}|physical`;
  if (/trote|correr/.test(title)) return `${dateISO}|cardio:running`;
  if (/bicicleta/.test(title)) return `${dateISO}|cardio:bike`;
  if (/trekking|senderismo/.test(title)) return `${dateISO}|cardio:trekking`;
  if (/caminata/.test(title)) return `${dateISO}|cardio:walking`;
  return "";
}

function groupByActivity(items) {
  const groups = new Map();
  for (const item of items) {
    const key = wearableActivityKey(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return groups;
}

export function wearableSessionsEquivalent(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id && left.id === right.id) return true;
  const leftSeconds = numberOrNull(left.durationSeconds);
  const rightSeconds = numberOrNull(right.durationSeconds);
  if (leftSeconds === null || rightSeconds === null || leftSeconds <= 0 || rightSeconds <= 0) return false;
  const durationTolerance = Math.max(180, Math.max(leftSeconds, rightSeconds) * 0.04);
  if (Math.abs(leftSeconds - rightSeconds) > durationTolerance) return false;
  const startsClose = startInstants(left).some(leftStart => startInstants(right)
    .some(rightStart => Math.abs(leftStart - rightStart) <= 5 * 60_000));
  if (!startsClose) return false;
  const leftDate = String(left.dateISO || "");
  const rightDate = String(right.dateISO || "");
  return !leftDate || !rightDate || leftDate === rightDate
    || Math.abs((Date.parse(`${leftDate}T12:00:00Z`) || 0) - (Date.parse(`${rightDate}T12:00:00Z`) || 0)) <= 24 * 60 * 60_000;
}

export function deduplicateWearableSessions(sessions = []) {
  const preferred = [...sessions].filter(session => session?.id && wearableSessionAllowed(session))
    .sort((left, right) => wearableSessionQuality(right) - wearableSessionQuality(left)
      || String(right.syncedAt || "").localeCompare(String(left.syncedAt || ""))
      || String(left.id).localeCompare(String(right.id)));
  const unique = [];
  for (const session of preferred) {
    if (!unique.some(saved => wearableSessionsEquivalent(saved, session))) unique.push(session);
  }
  return unique;
}

export function wearableAutolinks(sessions = [], records = []) {
  const liveSessions = deduplicateWearableSessions(sessions).filter(session => {
    const linkedElsewhere = records.some(record => record.wearableSnapshot
      && wearableSessionAllowed(record.wearableSnapshot)
      && (record.wearableSessionId === session.id || wearableSessionsEquivalent(record.wearableSnapshot, session)));
    return !linkedElsewhere && wearableActivityKey(session);
  });
  const sessionGroups = groupByActivity(liveSessions);
  const recordGroups = groupByActivity(records.filter(record => record.category !== "rest"
    && (!record.wearableSessionId || !wearableSessionAllowed(record.wearableSnapshot))
    && wearableActivityKey(record)));
  const links = [];
  for (const [key, groupedSessions] of sessionGroups) {
    const groupedRecords = recordGroups.get(key) || [];
    if (groupedSessions.length !== 1 || groupedRecords.length !== 1) continue;
    const session = groupedSessions[0];
    const record = groupedRecords[0];
    const match = wearableMatch(record, session);
    if (!match) continue;
    links.push({ record, session, match });
  }
  return links;
}

export function refreshedWearableLink(record, sessions = []) {
  const current = normalizeWearableSnapshot(record?.wearableSnapshot);
  if (!current || !record?.wearableSessionId) return null;
  const equivalents = sessions.filter(session => session?.id && wearableSessionAllowed(session)
    && (session.id === record.wearableSessionId || wearableSessionsEquivalent(session, current)));
  if (!equivalents.length) return null;
  const best = equivalents.sort((left, right) => wearableSessionQuality(right) - wearableSessionQuality(left)
    || Number(right.id === record.wearableSessionId) - Number(left.id === record.wearableSessionId)
    || String(left.id).localeCompare(String(right.id)))[0];
  const bestSnapshot = normalizeWearableSnapshot(best);
  if (!bestSnapshot) return null;
  const changedId = best.id !== record.wearableSessionId;
  if (changedId && wearableSessionQuality(best) <= wearableSessionQuality(current)) return null;
  if (!changedId && JSON.stringify(bestSnapshot) === JSON.stringify(current)) return null;
  return { sessionId: best.id, snapshot: bestSnapshot };
}

export function wearableMatch(record, session) {
  if (!record || record.category === "rest" || !session?.id) return null;
  const own = recordWindow(record);
  const band = sessionWindow(session);
  const overlaps = own && band && [0, -60, 60].some(minutes => {
    const shift = minutes * 60_000;
    return Math.min(own.end, band.end + shift) > Math.max(own.start, band.start + shift);
  });
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
  if (sameType && recordedSeconds > 0 && bandSeconds > 0 && durationDifference <= 0.15) {
    score += 30;
    reason = "Mismo día, tipo y duración muy similar";
  }
  let timeAdjustmentMinutes = numberOrNull(session.clockAdjustmentMinutes) || 0;
  if (own && band) {
    const shorter = Math.min(own.end - own.start, band.end - band.start);
    const alignments = [0, -60, 60].map(minutes => {
      const shift = minutes * 60_000;
      const overlap = Math.max(0, Math.min(own.end, band.end + shift) - Math.max(own.start, band.start + shift));
      return { minutes, overlap, startDifference: Math.abs(own.start - (band.start + shift)) };
    }).sort((a, b) => b.overlap - a.overlap || a.startDifference - b.startDifference);
    const best = alignments[0];
    if (best.overlap / shorter >= 0.5) {
      score += 100 + Math.round(40 * best.overlap / shorter);
      timeAdjustmentMinutes = best.minutes || timeAdjustmentMinutes;
      reason = best.minutes
        ? "Horario coincidente corrigiendo desfase de 1 h de Mi Fitness"
        : "Horario coincidente";
    } else if (best.startDifference <= 10 * 60_000) {
      score += 65;
      timeAdjustmentMinutes = best.minutes || timeAdjustmentMinutes;
      reason = best.minutes
        ? "Inicio cercano corrigiendo desfase de 1 h de Mi Fitness"
        : "Inicio cercano; revisa el término";
    } else {
      score -= 30;
      reason = "Horarios distintos; revisa antes de vincular";
    }
  } else if (record.activityStartTime && band && session.dateISO === record.dateISO) {
    const bandLocal = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(band.start));
    const [recordHour, recordMinute] = record.activityStartTime.split(":").map(Number);
    const [bandHour, bandMinute] = bandLocal.split(":").map(Number);
    const minuteDistance = (left, right) => {
      const raw = Math.abs(left - right);
      return Math.min(raw, 1440 - raw);
    };
    const manualMinutes = recordHour * 60 + recordMinute;
    const bandMinutes = bandHour * 60 + bandMinute;
    const best = [0, -60, 60].map(minutes => ({ minutes, difference: minuteDistance(manualMinutes, (bandMinutes + minutes + 1440) % 1440) }))
      .sort((a, b) => a.difference - b.difference)[0];
    const difference = best.difference;
    if (difference <= 10) {
      score += 85;
      timeAdjustmentMinutes = best.minutes || timeAdjustmentMinutes;
      reason = best.minutes ? "Hora coincidente corrigiendo desfase de 1 h de Mi Fitness" : "Hora de inicio muy cercana";
    }
    else if (difference <= 30) {
      score += 45;
      timeAdjustmentMinutes = best.minutes || timeAdjustmentMinutes;
      reason = best.minutes ? "Hora cercana corrigiendo desfase de 1 h de Mi Fitness" : "Hora de inicio cercana";
    }
    else if (difference > 120) { score -= 25; reason = "Hora de inicio distinta; revisa antes de vincular"; }
  }
  return { score, reason, timeAdjustmentMinutes };
}

export function wearableCandidates(record, sessions, records = []) {
  const used = new Set(records.filter(item => item.id !== record.id && item.wearableSessionId)
    .map(item => item.wearableSessionId));
  const linkedSnapshots = records.filter(item => item.id !== record.id && item.wearableSnapshot)
    .map(item => item.wearableSnapshot);
  return deduplicateWearableSessions(sessions).filter(session => !used.has(session.id)
      && !linkedSnapshots.some(snapshot => wearableSessionsEquivalent(session, snapshot)))
    .map(session => ({ session, match: wearableMatch(record, session) }))
    .filter(item => item.match)
    .sort((a, b) => b.match.score - a.match.score || String(a.session.startTime).localeCompare(String(b.session.startTime)))
    .slice(0, 8);
}

export function wearableInbox(sessions = [], records = []) {
  const linked = new Set(records.map(record => record.wearableSessionId).filter(Boolean));
  const linkedSnapshots = records.map(record => record.wearableSnapshot).filter(Boolean);
  const availableRecords = records.filter(record => !record.wearableSessionId && record.category !== "rest");
  return deduplicateWearableSessions(sessions)
    .filter(session => session?.id && session.startTime && session.endTime && !linked.has(session.id)
      && !linkedSnapshots.some(snapshot => wearableSessionsEquivalent(session, snapshot)))
    .map(session => {
      const candidates = availableRecords.map(record => ({ record, match: wearableMatch(record, session) }))
        .filter(item => item.match)
        .sort((a, b) => b.match.score - a.match.score);
      const best = candidates[0] || null;
      const margin = best && candidates[1] ? best.match.score - candidates[1].match.score : Infinity;
      const state = best && best.match.score >= 60 && margin >= 25 ? "recommended"
        : candidates.length ? "ambiguous" : "unmatched";
      return { session, candidates, recommended: state === "recommended" ? best : null, state };
    })
    .sort((a, b) => String(b.session.startTime).localeCompare(String(a.session.startTime)));
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
