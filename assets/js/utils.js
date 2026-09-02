import {
  cardioTypeById,
  categoryById,
  dayNamesFull,
  physicalRoutineById,
  restTypes,
  trekkingRoutes,
  TZ
} from "./data.js?v=21";

export function getChileParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

export function getChileDateISO(now = new Date()) {
  const parts = getChileParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatLongDate(dateISO = getChileDateISO()) {
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const text = new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatShortDate(dateISO) {
  const [year, month, day] = dateISO.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "numeric", month: "short" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)))
    .replace(".", "");
}

export function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function dayIndexFromISO(iso) {
  if (!isValidISODate(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDaysISO(iso, amount) {
  if (!isValidISODate(iso)) throw new Error("Fecha inválida");
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function mondayForISO(iso) {
  const day = dayIndexFromISO(iso);
  if (day === null) throw new Error("Fecha inválida");
  return addDaysISO(iso, day === 0 ? -6 : 1 - day);
}

export function isoWeekInfo(dateISO) {
  if (!isValidISODate(dateISO)) throw new Error("Fecha inválida");
  const [year, month, day] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isoDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - isoDay);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNumber = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const startISO = mondayForISO(dateISO);
  const endISO = addDaysISO(startISO, 6);
  return {
    key: `${weekYear}-W${String(weekNumber).padStart(2, "0")}`,
    weekNumber,
    weekYear,
    startISO,
    endISO
  };
}

export function weekDays(dateISO = getChileDateISO()) {
  const start = mondayForISO(dateISO);
  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

function optionalNumber(value, { min = 0 } = {}) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : null;
}

function legacyCategory(record) {
  if (record?.category) return record.category;
  if (record?.activity === "Físico") return "physical";
  if (record?.activity === "Cardio") return "cardio";
  if (record?.activity === "Tenis") return "tennis";
  return "other";
}

function legacyRoutine(record) {
  if (record?.routineName) return record.routineName;
  if (record?.physicalRoutine) return `Físico ${record.physicalRoutine}`;
  return record?.plannedRoutine || "";
}

function legacyCardio(record) {
  if (record?.cardioTypeName) return record.cardioTypeName;
  return record?.cardioType || "";
}

export function normalizeRecord(record) {
  const dateISO = String(record?.dateISO || "");
  const dayIndex = dayIndexFromISO(dateISO);
  const category = legacyCategory(record);
  const categoryInfo = categoryById(category);
  const sensations = String(record?.sensations || [record?.feeling, record?.notes].filter(Boolean).join(" · ") || "").slice(0, 5000);
  const rawMinutes = optionalNumber(record?.durationMinutes, { min: 0 });
  const rawSeconds = optionalNumber(record?.durationSeconds, { min: 0 });
  const durationSeconds = rawSeconds === "" ? (typeof rawMinutes === "number" ? Math.round(rawMinutes * 60) : rawMinutes) : rawSeconds;
  const durationMinutes = rawMinutes === "" ? (typeof durationSeconds === "number" ? durationSeconds / 60 : durationSeconds) : rawMinutes;
  return {
    id: String(record?.id || ""),
    dateISO,
    day: dayIndex === null ? String(record?.day || "") : dayNamesFull[dayIndex],
    category,
    categoryName: String(record?.categoryName || categoryInfo?.shortName || record?.activity || "Otro"),
    routineId: String(record?.routineId || ""),
    routineName: String(legacyRoutine(record)),
    cardioTypeId: String(record?.cardioTypeId || ""),
    cardioTypeName: String(legacyCardio(record)),
    restTypeId: String(record?.restTypeId || ""),
    restDetail: String(record?.restDetail || "").slice(0, 2000),
    location: String(record?.location || "").slice(0, 300),
    surface: String(record?.surface || "").slice(0, 100),
    trekkingRoute: String(record?.trekkingRoute || "").slice(0, 200),
    distanceKm: optionalNumber(record?.distanceKm ?? record?.kms, { min: 0 }),
    elevationGainM: optionalNumber(record?.elevationGainM ?? record?.elevationMeters, { min: 0 }),
    ascentDurationSeconds: optionalNumber(record?.ascentDurationSeconds, { min: 0 }),
    durationMinutes,
    durationSeconds,
    durationPrecision: ["minutes", "hm", "hms"].includes(record?.durationPrecision) ? record.durationPrecision : "minutes",
    calories: optionalNumber(record?.calories, { min: 0 }),
    sensations,
    routineCompletedSets: optionalNumber(record?.routineCompletedSets, { min: 0 }),
    routinePlannedSets: optionalNumber(record?.routinePlannedSets, { min: 0 }),
    routineCompletedExercises: optionalNumber(record?.routineCompletedExercises, { min: 0 }),
    routineStartedExercises: optionalNumber(record?.routineStartedExercises, { min: 0 }),
    routineTotalExercises: optionalNumber(record?.routineTotalExercises, { min: 0 }),
    routineTotalReps: optionalNumber(record?.routineTotalReps, { min: 0 }),
    routineVolumeKg: optionalNumber(record?.routineVolumeKg, { min: 0 }),
    routineStartedAt: String(record?.routineStartedAt || ""),
    routineEndedAt: String(record?.routineEndedAt || ""),
    createdAt: String(record?.createdAt || ""),
    updatedAt: String(record?.updatedAt || "")
  };
}

export function validateRecord(record) {
  const normalized = normalizeRecord(record);
  const errors = [];
  if (!isValidISODate(normalized.dateISO)) errors.push("Selecciona una fecha válida.");
  if (!categoryById(normalized.category)) errors.push("Selecciona un tipo de entrenamiento.");
  if (normalized.category !== "rest" && (normalized.durationMinutes === "" || normalized.durationMinutes === null || normalized.durationMinutes <= 0)) errors.push("Ingresa una duración mayor que cero.");
  if (normalized.category !== "rest" && (normalized.calories === "" || normalized.calories === null)) errors.push("Ingresa las calorías quemadas.");

  if (normalized.category === "physical") {
    if (!physicalRoutineById(normalized.routineId) && !normalized.routineName) errors.push("Selecciona una rutina física.");
  }
  if (normalized.category === "cardio") {
    const cardio = cardioTypeById(normalized.cardioTypeId);
    if (!cardio) errors.push("Selecciona un tipo de cardio.");
    if (cardio?.id === "trekking" && !normalized.location.trim()) errors.push("Ingresa el cerro o lugar del trekking.");
    if (cardio?.id === "trekking" && (normalized.distanceKm === "" || normalized.distanceKm === null)) errors.push("Ingresa la distancia del trekking.");
    if (cardio?.id === "trekking" && (normalized.elevationGainM === "" || normalized.elevationGainM === null)) errors.push("Ingresa el desnivel del trekking.");
    if (cardio?.id === "trekking" && (normalized.ascentDurationSeconds === "" || normalized.ascentDurationSeconds === null || normalized.ascentDurationSeconds <= 0)) errors.push("Ingresa el tiempo de subida.");
    if (cardio?.id === "trekking" && (trekkingRoutes[normalized.location] || []).length && !(trekkingRoutes[normalized.location] || []).includes(normalized.trekkingRoute)) errors.push("Selecciona la ruta del trekking.");
  }
  if (normalized.category === "tennis") {
    if (!normalized.location.trim()) errors.push("Ingresa el lugar de la sesión de tenis.");
    if (!normalized.surface.trim()) errors.push("Selecciona la superficie.");
  }
  if (normalized.category === "rest") {
    if (!restTypes.some(type => type.id === normalized.restTypeId)) errors.push("Selecciona el tipo de descanso.");
    if (normalized.restTypeId === "discomfort" && !normalized.restDetail.trim()) errors.push("Describe la molestia que te impidió entrenar.");
  }
  if (normalized.distanceKm === null) errors.push("La distancia debe ser un número igual o mayor que cero.");
  if (normalized.elevationGainM === null) errors.push("El desnivel debe ser un número igual o mayor que cero.");
  if (normalized.ascentDurationSeconds === null) errors.push("El tiempo de subida debe ser válido.");
  return { valid: errors.length === 0, errors, record: normalized };
}

export function recordTitle(record) {
  const normalized = normalizeRecord(record);
  if (normalized.category === "rest") return normalized.restTypeId === "discomfort" ? "Descanso por molestia" : "Día de descanso";
  if (normalized.category === "physical") return normalized.routineName || "Entrenamiento físico";
  if (normalized.category === "cardio") return normalized.cardioTypeName || "Cardio";
  if (normalized.category === "tennis") return normalized.location ? `Tenis · ${normalized.location}` : "Tenis";
  return normalized.categoryName || "Entrenamiento";
}

export function recordDetails(record) {
  const normalized = normalizeRecord(record);
  if (normalized.category === "rest") return normalized.restTypeId === "discomfort"
    ? `Molestia: ${normalized.restDetail || "Sin detalle"}`
    : "Recuperación planificada";
  const details = [formatDuration(normalized), `${normalized.calories === "" ? "—" : normalized.calories} kcal`];
  if (normalized.trekkingRoute) details.push(normalized.trekkingRoute);
  if (normalized.ascentDurationSeconds !== "") details.push(`Subida ${formatDuration({ durationSeconds: normalized.ascentDurationSeconds, durationMinutes: normalized.ascentDurationSeconds / 60, durationPrecision: "hms" })}`);
  if (normalized.distanceKm !== "") details.push(formatDistance(normalized.distanceKm));
  if (normalized.elevationGainM !== "") details.push(`${normalized.elevationGainM} m desnivel`);
  if (normalized.surface) details.push(normalized.surface);
  if (normalized.category === "physical" && normalized.routinePlannedSets !== "") {
    details.push(`${normalized.routineCompletedSets}/${normalized.routinePlannedSets} series`);
    details.push(`${Number(normalized.routineVolumeKg || 0).toLocaleString("es-CL")} kg volumen`);
  }
  return details.join(" · ");
}

export function formatDistance(distanceKm) {
  const totalMeters = Math.max(0, Math.round((Number(distanceKm) || 0) * 1000));
  const kilometers = Math.floor(totalMeters / 1000);
  const meters = totalMeters % 1000;
  return `${String(kilometers).padStart(2, "0")}:${String(meters).padStart(3, "0")} (km:m)`;
}

export function formatDuration(record) {
  const normalized = record?.durationPrecision ? record : normalizeRecord(record);
  if (normalized.durationMinutes === "" || normalized.durationMinutes === null) return "—";
  if (normalized.durationPrecision === "minutes") return `${Math.round(normalized.durationMinutes)} min`;
  const totalSeconds = Math.round(Number(normalized.durationSeconds) || (Number(normalized.durationMinutes) * 60));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];
  if (hours) parts.push(`${hours} h`);
  parts.push(`${String(minutes).padStart(hours ? 2 : 1, "0")} min`);
  if (normalized.durationPrecision === "hms") parts.push(`${String(seconds).padStart(2, "0")} s`);
  return parts.join(" ");
}

export function groupRecordsByWeek(records) {
  const groups = new Map();
  for (const record of records.map(normalizeRecord).filter(item => isValidISODate(item.dateISO))) {
    const week = isoWeekInfo(record.dateISO);
    if (!groups.has(week.key)) groups.set(week.key, { ...week, records: [] });
    groups.get(week.key).records.push(record);
  }
  return [...groups.values()]
    .map(group => ({ ...group, records: group.records.sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.createdAt.localeCompare(b.createdAt)) }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function trekkingBestTimes(records) {
  const groups = new Map();
  records.map(normalizeRecord)
    .filter(record => record.category === "cardio" && record.cardioTypeId === "trekking" && record.location.trim())
    .forEach(record => {
      const ascentSeconds = Number(record.ascentDurationSeconds) || 0;
      const totalSeconds = Number(record.durationSeconds) || Math.round((Number(record.durationMinutes) || 0) * 60);
      const rankingSeconds = ascentSeconds > 0 ? ascentSeconds : totalSeconds;
      if (rankingSeconds <= 0) return;
      const needsRoute = (trekkingRoutes[record.location] || []).length > 0;
      const route = record.trekkingRoute || (needsRoute ? "Sin ruta especificada" : "");
      const key = `${record.location}::${route}`;
      if (!groups.has(key)) groups.set(key, { key, location: record.location, route, attempts: [] });
      groups.get(key).attempts.push({ ...record, rankingSeconds, usesTotalDuration: ascentSeconds <= 0 });
    });
  return [...groups.values()]
    .map(group => ({
      ...group,
      attempts: group.attempts.sort((a, b) => a.rankingSeconds - b.rankingSeconds || b.dateISO.localeCompare(a.dateISO))
    }))
    .sort((a, b) => a.location.localeCompare(b.location, "es") || a.route.localeCompare(b.route, "es"));
}

export function weeklyReport(records, week) {
  const normalized = records.map(normalizeRecord).filter(record => record.dateISO >= week.startISO && record.dateISO <= week.endISO);
  const trainings = normalized.filter(record => record.category !== "rest");
  const restDays = normalized.filter(record => record.category === "rest");
  const totalMinutes = normalized.reduce((sum, record) => sum + (Number(record.durationMinutes) || 0), 0);
  const totalCalories = normalized.reduce((sum, record) => sum + (Number(record.calories) || 0), 0);
  const totalDistance = normalized.reduce((sum, record) => sum + (Number(record.distanceKm) || 0), 0);
  const totalElevation = normalized.reduce((sum, record) => sum + (Number(record.elevationGainM) || 0), 0);
  const categoryCounts = normalized.reduce((counts, record) => {
    counts[record.categoryName] = (counts[record.categoryName] || 0) + 1;
    return counts;
  }, {});

  let report = `REGISTRO TGB — SEMANA ${week.weekNumber} DE ${week.weekYear}\n`;
  report += `Periodo: ${week.startISO} a ${week.endISO} (lunes a domingo)\n\n`;
  report += "RESUMEN\n";
  report += `- Entrenamientos: ${trainings.length}\n`;
  report += `- Días de descanso registrados: ${restDays.length}\n`;
  report += `- Tiempo total: ${Math.round(totalMinutes)} min\n`;
  report += `- Calorías registradas: ${totalCalories} kcal\n`;
  report += `- Distancia registrada: ${formatDistance(totalDistance)}\n`;
  report += `- Desnivel registrado: ${totalElevation} m\n`;
  for (const [category, count] of Object.entries(categoryCounts)) report += `- ${category}: ${count}\n`;

  report += "\nDETALLE DE LA SEMANA\n";
  for (const dateISO of weekDays(week.startISO)) {
    const dayRecords = normalized.filter(record => record.dateISO === dateISO);
    const dayName = dayNamesFull[dayIndexFromISO(dateISO)];
    report += `\n${dayName.toUpperCase()} ${dateISO}\n`;
    if (!dayRecords.length) {
      report += "Sin entrenamiento registrado.\n";
      continue;
    }
    dayRecords.forEach((record, index) => {
      report += `${index + 1}. ${recordTitle(record)}\n`;
      report += `   Tipo: ${record.categoryName}\n`;
      if (record.category !== "rest") {
        report += `   Duración: ${formatDuration(record)}\n`;
        report += `   Calorías: ${record.calories} kcal\n`;
      }
      if (record.category === "rest" && record.restTypeId === "discomfort") report += `   Molestia: ${record.restDetail}\n`;
      if (record.distanceKm !== "") report += `   Distancia: ${formatDistance(record.distanceKm)}\n`;
      if (record.elevationGainM !== "") report += `   Desnivel: ${record.elevationGainM} m\n`;
      if (record.location) report += `   Lugar: ${record.location}\n`;
      if (record.trekkingRoute) report += `   Ruta: ${record.trekkingRoute}\n`;
      if (record.ascentDurationSeconds !== "") report += `   Tiempo de subida: ${formatDuration({ durationSeconds: record.ascentDurationSeconds, durationMinutes: record.ascentDurationSeconds / 60, durationPrecision: "hms" })}\n`;
      if (record.surface) report += `   Superficie: ${record.surface}\n`;
      if (record.category === "physical" && record.routinePlannedSets !== "") {
        report += `   Series: ${record.routineCompletedSets}/${record.routinePlannedSets}\n`;
        report += `   Ejercicios trabajados: ${record.routineStartedExercises}/${record.routineTotalExercises}\n`;
        report += `   Ejercicios completados: ${record.routineCompletedExercises}/${record.routineTotalExercises}\n`;
        report += `   Repeticiones contabilizadas: ${record.routineTotalReps}\n`;
        report += `   Volumen estimado: ${Number(record.routineVolumeKg || 0).toLocaleString("es-CL")} kg\n`;
      }
      if (record.sensations) report += `   Sensaciones: ${record.sensations}\n`;
    });
  }
  return report;
}

function csvCell(value) {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function recordsToCSV(records) {
  const columns = [
    ["fecha", "dateISO"], ["día", "day"], ["categoría", "categoryName"], ["rutina", "routineName"],
    ["cardio", "cardioTypeName"], ["tipo_descanso", "restTypeId"], ["detalle_molestia", "restDetail"],
    ["lugar", "location"], ["ruta_trekking", "trekkingRoute"], ["superficie", "surface"],
    ["distancia_km", "distanceKm"], ["desnivel_m", "elevationGainM"], ["tiempo_subida_seg", "ascentDurationSeconds"], ["duración_min", "durationMinutes"], ["duración_seg", "durationSeconds"],
    ["precisión_duración", "durationPrecision"], ["calorías", "calories"],
    ["series_completadas", "routineCompletedSets"], ["series_planificadas", "routinePlannedSets"],
    ["ejercicios_completados", "routineCompletedExercises"], ["ejercicios_iniciados", "routineStartedExercises"],
    ["ejercicios_totales", "routineTotalExercises"], ["repeticiones", "routineTotalReps"],
    ["volumen_kg", "routineVolumeKg"], ["inicio_rutina", "routineStartedAt"], ["fin_rutina", "routineEndedAt"],
    ["sensaciones", "sensations"]
  ];
  const rows = [columns.map(([header]) => csvCell(header)).join(",")];
  for (const record of records.map(normalizeRecord)) rows.push(columns.map(([, key]) => csvCell(record[key])).join(","));
  return `\uFEFF${rows.join("\r\n")}`;
}
