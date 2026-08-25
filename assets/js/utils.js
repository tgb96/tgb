import { activityTypes, dayNamesFull, routines, TZ } from "./data.js";

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

export function getChileDateText(now = new Date()) {
  const parts = getChileParts(now);
  const weekday = parts.weekday.charAt(0).toUpperCase() + parts.weekday.slice(1);
  return `${weekday}, ${parts.day}/${parts.month}/${parts.year} · Santiago de Chile`;
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

export function isoForWeekDay(dayIndex, anchorISO = getChileDateISO()) {
  const monday = mondayForISO(anchorISO);
  return addDaysISO(monday, dayIndex === 0 ? 6 : dayIndex - 1);
}

export function doneKeyForDate(dateISO) {
  return `done-${dateISO}`;
}

export function legacyDoneKey(dateISO) {
  return `done-${dateISO}-${dayIndexFromISO(dateISO)}`;
}

export function sessionKeyForDate(dateISO) {
  return `session-${dateISO}`;
}

export function legacySessionKey(dateISO) {
  return `session-${dateISO}-${dayIndexFromISO(dateISO)}`;
}

export function exerciseSetKey(dateISO, exerciseIndex, setNumber) {
  return `routine-${dateISO}-ex-${exerciseIndex}-set-${setNumber}`;
}

export function legacyExerciseSetKey(dateISO, exerciseIndex, setNumber) {
  return `routine-${dateISO}-${dayIndexFromISO(dateISO)}-ex-${exerciseIndex}-set-${setNumber}`;
}

export function parseDurationSeconds(meta) {
  const text = String(meta).toLowerCase().replace(",", ".");
  const minuteMatch = text.match(/(\d+)(?:\s*-\s*\d+)?\s*min/);
  if (minuteMatch) return Number(minuteMatch[1]) * 60;
  const secondMatch = text.match(/(\d+)(?:\s*-\s*\d+)?\s*s/);
  if (secondMatch) return Number(secondMatch[1]);
  return null;
}

export function formatMMSS(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

export function formatHHMMSS(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

function optionalNumber(value, { min = 0, max = Number.POSITIVE_INFINITY, integer = false } = {}) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) return null;
  return parsed;
}

export function normalizeRecord(record) {
  const dateISO = String(record?.dateISO || "");
  const dayIndex = dayIndexFromISO(dateISO);
  const activity = activityTypes.includes(record?.activity) ? record.activity : String(record?.activity || "Otro");
  const normalized = {
    id: String(record?.id || ""),
    dateISO,
    day: dayIndex === null ? String(record?.day || "") : dayNamesFull[dayIndex],
    plannedRoutine: dayIndex === null ? String(record?.plannedRoutine || "") : String(record?.plannedRoutine || routines[dayIndex].name),
    plannedType: dayIndex === null ? String(record?.plannedType || "") : String(record?.plannedType || routines[dayIndex].type),
    type: "Registro de actividad",
    activity,
    physicalRoutine: String(record?.physicalRoutine || ""),
    cardioType: String(record?.cardioType || ""),
    kms: optionalNumber(record?.kms, { min: 0 }),
    durationMinutes: optionalNumber(record?.durationMinutes, { min: 0 }),
    calories: optionalNumber(record?.calories, { min: 0 }),
    fatigue: optionalNumber(record?.fatigue, { min: 0, max: 10 }),
    thumbPain: optionalNumber(record?.thumbPain, { min: 0, max: 10 }),
    legPain: optionalNumber(record?.legPain, { min: 0, max: 10 }),
    feeling: String(record?.feeling || "Normal"),
    notes: String(record?.notes || "").slice(0, 5000),
    createdAt: String(record?.createdAt || ""),
    updatedAt: String(record?.updatedAt || "")
  };
  return normalized;
}

export function validateRecord(record) {
  const normalized = normalizeRecord(record);
  const errors = [];
  if (!isValidISODate(normalized.dateISO)) errors.push("Selecciona una fecha válida.");
  if (!activityTypes.includes(normalized.activity)) errors.push("Selecciona una actividad válida.");
  if (normalized.durationMinutes === null) errors.push("La duración debe ser un número igual o mayor que cero.");
  if (normalized.calories === null) errors.push("Las calorías deben ser un número igual o mayor que cero.");
  if (normalized.kms === null) errors.push("Los kilómetros deben ser un número igual o mayor que cero.");
  for (const [key, label] of [["fatigue", "fatiga"], ["thumbPain", "dolor de pulgar"], ["legPain", "dolor de rodilla/Aquiles"]]) {
    if (normalized[key] === "" || normalized[key] === null) errors.push(`El valor de ${label} debe estar entre 0 y 10.`);
  }
  return { valid: errors.length === 0, errors, record: normalized };
}

export function metricText(value, fallback = "no registrado") {
  return value === "" || value === null || value === undefined ? fallback : String(value);
}

export function averageMetric(records, key) {
  const values = records
    .map(record => record[key])
    .filter(value => value !== "" && value !== null && value !== undefined)
    .map(Number)
    .filter(Number.isFinite);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function reportForPeriod(records, days, endISO) {
  const startISO = addDaysISO(endISO, -days + 1);
  const selected = records
    .map(normalizeRecord)
    .filter(record => record.dateISO >= startISO && record.dateISO <= endISO)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const sum = key => selected.reduce((total, record) => total + (Number(record[key]) || 0), 0);
  const activityCount = selected.reduce((counts, record) => {
    counts[record.activity || "Sin actividad"] = (counts[record.activity || "Sin actividad"] || 0) + 1;
    return counts;
  }, {});
  const average = key => {
    const value = averageMetric(selected, key);
    return value === null ? "sin datos" : value.toFixed(1);
  };

  let report = `INFORME TGB - ÚLTIMOS ${days} DÍAS\n`;
  report += `Periodo: ${startISO} a ${endISO}\n`;
  report += "Zona horaria: Santiago de Chile\n\n";
  report += "RESUMEN GENERAL\n";
  report += `- Registros totales: ${selected.length}\n`;
  report += `- Tiempo total registrado: ${sum("durationMinutes")} min\n`;
  report += `- Calorías registradas: ${sum("calories")} kcal\n`;
  report += `- Kilómetros registrados: ${sum("kms").toFixed(2)} km\n`;
  report += `- Fatiga promedio: ${average("fatigue")}/10\n`;
  report += `- Dolor pulgar promedio: ${average("thumbPain")}/10\n`;
  report += `- Dolor rodilla/Aquiles promedio: ${average("legPain")}/10\n\n`;
  report += "ACTIVIDADES REALIZADAS\n";
  for (const [activity, count] of Object.entries(activityCount)) report += `- ${activity}: ${count} registro(s)\n`;
  report += "\nDETALLE DÍA A DÍA\n";
  if (!selected.length) report += "Sin registros en este periodo.\n";
  for (const record of selected) {
    report += `\n${record.dateISO} - ${record.day}\n`;
    report += `Plan del día: ${record.plannedRoutine || "-"} (${record.plannedType || "-"})\n`;
    report += `Actividad real: ${record.activity || "-"}\n`;
    if (record.physicalRoutine) report += `Físico realizado: ${record.physicalRoutine}\n`;
    if (record.cardioType) report += `Tipo cardio: ${record.cardioType}\n`;
    if (record.kms !== "") report += `Kilómetros: ${record.kms}\n`;
    report += `Tiempo: ${metricText(record.durationMinutes)} min\n`;
    report += `Calorías: ${metricText(record.calories, "no registradas")}\n`;
    report += `Fatiga: ${metricText(record.fatigue, "-")}/10\n`;
    report += `Pulgar derecho: ${metricText(record.thumbPain, "-")}/10\n`;
    report += `Rodilla/Aquiles: ${metricText(record.legPain, "-")}/10\n`;
    report += `Sensación: ${record.feeling || "-"}\n`;
    if (record.notes) report += `Notas: ${record.notes}\n`;
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
    ["fecha", "dateISO"], ["día", "day"], ["plan", "plannedRoutine"], ["actividad", "activity"],
    ["rutina_física", "physicalRoutine"], ["cardio", "cardioType"], ["kilómetros", "kms"],
    ["duración_min", "durationMinutes"], ["calorías", "calories"], ["fatiga", "fatigue"],
    ["dolor_pulgar", "thumbPain"], ["dolor_rodilla_aquiles", "legPain"], ["sensación", "feeling"], ["notas", "notes"]
  ];
  const rows = [columns.map(([header]) => csvCell(header)).join(",")];
  for (const record of records.map(normalizeRecord)) rows.push(columns.map(([, key]) => csvCell(record[key])).join(","));
  return `\uFEFF${rows.join("\r\n")}`;
}

export function advanceIntervalState(inputState, now = Date.now()) {
  const state = { ...inputState };
  let completed = false;
  let transitions = 0;
  while (state.running && now >= state.deadline && transitions < 10000) {
    transitions += 1;
    if (state.mode === "single") {
      state.running = false;
      completed = true;
      break;
    }
    if (state.phase === "work" && state.rest > 0) {
      state.phase = "rest";
      state.deadline += state.rest * 1000;
      continue;
    }
    if (state.totalRounds !== 0 && state.currentRound >= state.totalRounds) {
      state.running = false;
      completed = true;
      break;
    }
    state.currentRound += 1;
    state.phase = "work";
    state.deadline += state.work * 1000;
  }
  if (transitions === 10000 && state.running) state.deadline = now + state.work * 1000;
  return { state, completed, transitions };
}

export function remainingSeconds(state, now = Date.now()) {
  return state.running ? Math.max(0, Math.ceil((state.deadline - now) / 1000)) : 0;
}
