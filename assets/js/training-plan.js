import {
  cardioTypeById,
  physicalRoutineById,
  restTypes,
  tennisTypeById
} from "./data.js?v=53";
import { isValidISODate, isoWeekInfo } from "./utils.js?v=53";

const text = (value, max = 500) => String(value || "").trim().slice(0, max);
const list = (value, maxItems = 20, maxLength = 500) => Array.isArray(value)
  ? value.slice(0, maxItems).map(item => text(item, maxLength)).filter(Boolean)
  : [];

function slug(value, fallback = "plan") {
  const normalized = text(value, 200)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return normalized || fallback;
}

function normalizeExerciseSettings(value, routine) {
  const allowed = new Set(routine?.exercises?.map(exercise => exercise.id) || []);
  const entries = Array.isArray(value)
    ? value.map(item => [item?.exerciseId, item])
    : Object.entries(value || {});
  const settings = {};
  const omitted = [];
  entries.forEach(([exerciseId, raw]) => {
    const id = text(exerciseId, 100);
    if (!allowed.has(id)) return;
    if (raw?.omit) {
      omitted.push(id);
      return;
    }
    const sets = Math.min(10, Math.max(1, Number.parseInt(raw?.sets, 10) || 1));
    const target = text(raw?.target, 100);
    const numericWeight = raw?.weightKg === "" || raw?.weightKg === null || raw?.weightKg === undefined
      ? ""
      : Number(raw.weightKg);
    settings[id] = {
      sets,
      target: target || routine.exercises.find(exercise => exercise.id === id)?.target || "",
      weightKg: Number.isFinite(numericWeight) && numericWeight >= 0 ? numericWeight : ""
    };
  });
  return { settings, omitExerciseIds: omitted };
}

function normalizeOption(raw, index, sessionId) {
  const category = ["physical", "cardio", "tennis", "rest"].includes(raw?.category) ? raw.category : "rest";
  const title = text(raw?.title, 200) || "Actividad planificada";
  const id = text(raw?.id, 100) || `${sessionId}-o${index + 1}-${slug(title, String(index + 1))}`;
  const rawPrefill = raw?.prefill || {};
  const routineId = text(raw?.routineId || rawPrefill.routineId, 100);
  const routine = physicalRoutineById(routineId);
  const exerciseSettings = normalizeExerciseSettings(raw?.exerciseSettings || rawPrefill.settings, routine);
  const cardioTypeId = text(raw?.cardioTypeId || rawPrefill.cardioTypeId, 100);
  const tennisTypeId = text(raw?.tennisTypeId || rawPrefill.tennisTypeId, 100);
  const restTypeId = text(raw?.restTypeId || rawPrefill.restTypeId, 100);
  const distance = raw?.distanceKm ?? rawPrefill.distanceKm ?? "";
  const distanceKm = distance === "" || distance === null ? "" : Number(distance);
  const prefill = {
    routineId: routine?.id || "",
    settings: exerciseSettings.settings,
    omitExerciseIds: [...new Set([
      ...exerciseSettings.omitExerciseIds,
      ...(Array.isArray(rawPrefill.omitExerciseIds) ? rawPrefill.omitExerciseIds.filter(idValue => routine?.exercises?.some(exercise => exercise.id === idValue)) : [])
    ])],
    cardioTypeId: cardioTypeById(cardioTypeId)?.id || "",
    tennisTypeId: tennisTypeById(tennisTypeId)?.id || "",
    restTypeId: restTypes.some(type => type.id === restTypeId) ? restTypeId : category === "rest" ? "planned" : "",
    distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : ""
  };
  if (category === "physical" && !prefill.routineId) return null;
  if (category === "cardio" && !prefill.cardioTypeId) return null;
  if (category === "tennis" && !prefill.tennisTypeId) prefill.tennisTypeId = "group-training";
  return {
    id,
    title,
    category,
    summary: text(raw?.summary, 300) || title,
    details: list(raw?.details, 20, 500),
    prefill
  };
}

function normalizeSession(raw, index, blockId) {
  const dateISO = text(raw?.dateISO, 10);
  if (!isValidISODate(dateISO)) return null;
  const sessionId = text(raw?.id, 100) || `${blockId}-${dateISO}-${index + 1}`;
  const options = (Array.isArray(raw?.options) ? raw.options : [])
    .slice(0, 6)
    .map((option, optionIndex) => normalizeOption(option, optionIndex, sessionId))
    .filter(Boolean);
  if (!options.length) return null;
  const requestedPrimary = text(raw?.primaryOptionId, 100);
  return {
    id: sessionId,
    dateISO,
    objective: text(raw?.objective, 500) || options[0].summary,
    primaryOptionId: options.some(option => option.id === requestedPrimary) ? requestedPrimary : options[0].id,
    options
  };
}

export function normalizeTrainingBlock(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rawWeeks = Array.isArray(raw.weeks) ? raw.weeks.slice(0, 12) : [];
  const provisionalId = text(raw.id, 120) || slug(raw.title, "plan-importado");
  const sessions = rawWeeks.flatMap((week, weekIndex) => (Array.isArray(week?.sessions) ? week.sessions : [])
    .slice(0, 14)
    .map((session, sessionIndex) => normalizeSession(session, (weekIndex * 14) + sessionIndex, provisionalId))
    .filter(Boolean));
  if (!sessions.length) return null;
  sessions.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  const uniqueSessions = [...new Map(sessions.map(session => [session.dateISO, session])).values()];
  const startISO = uniqueSessions[0].dateISO;
  const endISO = uniqueSessions.at(-1).dateISO;
  const id = text(raw.id, 120) || `${slug(raw.title, "plan-importado")}-${startISO}`;
  const weekMetadata = new Map(rawWeeks.map(week => [text(week?.weekKey, 20), week]));
  const grouped = new Map();
  uniqueSessions.forEach(session => {
    const info = isoWeekInfo(session.dateISO);
    if (!grouped.has(info.weekKey)) grouped.set(info.weekKey, { info, sessions: [] });
    grouped.get(info.weekKey).sessions.push(session);
  });
  const weeks = [...grouped.entries()].map(([weekKey, value], index) => {
    const metadata = weekMetadata.get(weekKey) || rawWeeks[index] || {};
    return {
      weekKey,
      number: value.info.weekNumber,
      startISO: value.info.startISO,
      endISO: value.info.endISO,
      label: text(metadata.label, 300) || `Semana ${value.info.weekNumber}`,
      context: text(metadata.context, 1000),
      objective: text(metadata.objective, 1000),
      sessions: value.sessions
    };
  });
  return {
    id,
    title: text(raw.title, 300) || "Plan de entrenamiento",
    subtitle: text(raw.subtitle, 500),
    startISO,
    endISO,
    source: text(raw.source, 200) || "Importado con IA",
    rules: list(raw.rules, 30, 1000),
    priority: list(raw.priority, 10, 200),
    weeks,
    createdAt: text(raw.createdAt, 40) || new Date().toISOString(),
    updatedAt: text(raw.updatedAt, 40) || new Date().toISOString()
  };
}

export function normalizeTrainingBlocks(value) {
  const blocks = Array.isArray(value) ? value : Object.values(value || {});
  return Object.fromEntries(blocks.flatMap(block => {
    const normalized = normalizeTrainingBlock(block);
    return normalized ? [[normalized.id, normalized]] : [];
  }));
}

export function newestTrainingBlock(blocks) {
  return [...blocks].sort((a, b) => {
    const updated = String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    return updated || b.startISO.localeCompare(a.startISO);
  })[0] || null;
}

export function summarizeTrainingBlock(block) {
  const sessions = block?.weeks?.flatMap(week => week.sessions) || [];
  const counts = sessions.reduce((result, session) => {
    const category = session.options.find(option => option.id === session.primaryOptionId)?.category || session.options[0]?.category;
    if (category) result[category] = (result[category] || 0) + 1;
    return result;
  }, {});
  return { weeks: block?.weeks?.length || 0, sessions: sessions.length, counts };
}
