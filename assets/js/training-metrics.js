export function durationModeFor(category, cardioTypeId) {
  return category === "cardio" && cardioTypeId !== "running" ? "hm" : "hms";
}

export function activityTiming(record) {
  const present = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const seconds = present(record.durationSeconds) ? Number(record.durationSeconds)
    : present(record.durationMinutes) ? Number(record.durationMinutes) * 60 : null;
  const durationSeconds = seconds === null ? null : Math.max(0, Math.round(seconds));
  const distanceKm = Number(record.distanceKm);
  const pace = record.category === "cardio" && record.cardioTypeId === "running" && distanceKm > 0 && durationSeconds > 0
    ? Math.round(durationSeconds / distanceKm) : null;
  const pad = value => String(value).padStart(2, "0");
  return {
    durationSeconds,
    durationMinutes: durationSeconds === null ? null : durationSeconds / 60,
    durationHms: durationSeconds === null ? null : `${pad(Math.floor(durationSeconds / 3600))}:${pad(Math.floor(durationSeconds % 3600 / 60))}:${pad(durationSeconds % 60)}`,
    averagePaceSecondsPerKm: pace,
    averagePaceFormatted: pace === null ? null : `${Math.floor(pace / 60)}:${pad(pace % 60)} min/km`
  };
}

// Valida ritmos citados en el texto antes de guardar la respuesta del modelo.
// No intenta validar toda la interpretación deportiva ni cifras sin unidad de ritmo.
export function validateAnalysisPaces(analysis, sourceActivities) {
  const known = new Set(sourceActivities.map(activityTiming).map(item => item.averagePaceSecondsPerKm).filter(item => item !== null));
  if (!known.size) return;
  const texts = [];
  const collect = value => {
    if (typeof value === "string") texts.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(analysis);
  const patterns = [/(\d{1,3}):(\d{2})\s*(?:min(?:utos)?\s*)?(?:\/\s*km|por\s+(?:km|kil[oó]metro))/gi,
    /(\d{1,3})\s*min(?:utos)?\s*(\d{1,2})\s*(?:s|seg(?:undos)?)\s*(?:\/\s*km|por\s+(?:km|kil[oó]metro))/gi];
  for (const text of texts) for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const pace = Number(match[1]) * 60 + Number(match[2]);
      if (Number(match[2]) > 59 || !known.has(pace)) throw new Error(`La IA citó un ritmo no respaldado (${match[1]}:${match[2]} min/km). Debe usar los ritmos calculados de los registros, sin inventarlos.`);
    }
  }
}
