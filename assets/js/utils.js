import {
  cardioTypeById,
  categoryById,
  dayNamesFull,
  physicalRoutineById,
  TZ
} from "./data.js";

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
    location: String(record?.location || "").slice(0, 300),
    surface: String(record?.surface || "").slice(0, 100),
    distanceKm: optionalNumber(record?.distanceKm ?? record?.kms, { min: 0 }),
    durationMinutes,
    durationSeconds,
    durationPrecision: ["minutes", "hm", "hms"].includes(record?.durationPrecision) ? record.durationPrecision : "minutes",
    calories: optionalNumber(record?.calories, { min: 0 }),
    sensations,
    createdAt: String(record?.createdAt || ""),
    updatedAt: String(record?.updatedAt || "")
  };
}

export function validateRecord(record) {
  const normalized = normalizeRecord(record);
  const errors = [];
  if (!isValidISODate(normalized.dateISO)) errors.push("Selecciona una fecha válida.");
  if (!categoryById(normalized.category)) errors.push("Selecciona un tipo de entrenamiento.");
  if (normalized.durationMinutes === "" || normalized.durationMinutes === null || normalized.durationMinutes <= 0) errors.push("Ingresa una duración mayor que cero.");
  if (normalized.calories === "" || normalized.calories === null) errors.push("Ingresa las calorías quemadas.");

  if (normalized.category === "physical") {
    if (!physicalRoutineById(normalized.routineId) && !normalized.routineName) errors.push("Selecciona una rutina física.");
  }
  if (normalized.category === "cardio") {
    const cardio = cardioTypeById(normalized.cardioTypeId);
    if (!cardio) errors.push("Selecciona un tipo de cardio.");
    if (cardio?.id === "trekking" && !normalized.location.trim()) errors.push("Ingresa el cerro o lugar del trekking.");
    if (cardio?.id === "trekking" && (normalized.distanceKm === "" || normalized.distanceKm === null)) errors.push("Ingresa la distancia del trekking.");
  }
  if (normalized.category === "tennis") {
    if (!normalized.location.trim()) errors.push("Ingresa el lugar de la sesión de tenis.");
    if (!normalized.surface.trim()) errors.push("Selecciona la superficie.");
  }
  if (normalized.distanceKm === null) errors.push("La distancia debe ser un número igual o mayor que cero.");
  return { valid: errors.length === 0, errors, record: normalized };
}

export function recordTitle(record) {
  const normalized = normalizeRecord(record);
  if (normalized.category === "physical") return normalized.routineName || "Entrenamiento físico";
  if (normalized.category === "cardio") return normalized.cardioTypeName || "Cardio";
  if (normalized.category === "tennis") return normalized.location ? `Tenis · ${normalized.location}` : "Tenis";
  return normalized.categoryName || "Entrenamiento";
}

export function recordDetails(record) {
  const normalized = normalizeRecord(record);
  const details = [formatDuration(normalized), `${normalized.calories === "" ? "—" : normalized.calories} kcal`];
  if (normalized.distanceKm !== "") details.push(`${normalized.distanceKm} km`);
  if (normalized.surface) details.push(normalized.surface);
  return details.join(" · ");
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

export function weeklyReport(records, week) {
  const normalized = records.map(normalizeRecord).filter(record => record.dateISO >= week.startISO && record.dateISO <= week.endISO);
  const totalMinutes = normalized.reduce((sum, record) => sum + (Number(record.durationMinutes) || 0), 0);
  const totalCalories = normalized.reduce((sum, record) => sum + (Number(record.calories) || 0), 0);
  const totalDistance = normalized.reduce((sum, record) => sum + (Number(record.distanceKm) || 0), 0);
  const categoryCounts = normalized.reduce((counts, record) => {
    counts[record.categoryName] = (counts[record.categoryName] || 0) + 1;
    return counts;
  }, {});

  let report = `REGISTRO TGB — SEMANA ${week.weekNumber} DE ${week.weekYear}\n`;
  report += `Periodo: ${week.startISO} a ${week.endISO} (lunes a domingo)\n\n`;
  report += "RESUMEN\n";
  report += `- Entrenamientos: ${normalized.length}\n`;
  report += `- Tiempo total: ${Math.round(totalMinutes)} min\n`;
  report += `- Calorías registradas: ${totalCalories} kcal\n`;
  report += `- Distancia registrada: ${totalDistance.toFixed(2)} km\n`;
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
      report += `   Duración: ${formatDuration(record)}\n`;
      report += `   Calorías: ${record.calories} kcal\n`;
      if (record.distanceKm !== "") report += `   Distancia: ${record.distanceKm} km\n`;
      if (record.location) report += `   Lugar: ${record.location}\n`;
      if (record.surface) report += `   Superficie: ${record.surface}\n`;
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
    ["cardio", "cardioTypeName"], ["lugar", "location"], ["superficie", "surface"],
    ["distancia_km", "distanceKm"], ["duración_min", "durationMinutes"], ["duración_seg", "durationSeconds"],
    ["precisión_duración", "durationPrecision"], ["calorías", "calories"], ["sensaciones", "sensations"]
  ];
  const rows = [columns.map(([header]) => csvCell(header)).join(",")];
  for (const record of records.map(normalizeRecord)) rows.push(columns.map(([, key]) => csvCell(record[key])).join(","));
  return `\uFEFF${rows.join("\r\n")}`;
}
