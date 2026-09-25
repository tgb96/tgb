import { isValidISODate, normalizeRecord, validateRecord } from "./utils.js?v=67";
import { normalizeTrainingBlocks } from "./training-plan.js?v=68";
import { normalizeNutritionEntries, nutritionModes } from "./nutrition.js?v=87";
import { describeParts, nutritionEntryWithEstimate } from "./nutrition-presets.js?v=78";

export const DATA_KEY = "tgb-data-v3";
export const PREVIOUS_DATA_KEY = "tgb-data-v2";
export const LEGACY_HISTORY_KEY = "history";
export const SCHEMA_VERSION = 15;

function parseJSON(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ensureIds(records) {
  const seen = new Set();
  return records.map((record, index) => {
    const normalized = normalizeRecord(record);
    let id = normalized.id || `imported-${normalized.dateISO || "unknown"}-${index}`;
    while (seen.has(id)) id = `${id}-${index}`;
    seen.add(id);
    return { ...normalized, id };
  });
}

function normalizePlans(value) {
  const plans = Array.isArray(value) ? value : Object.values(value || {});
  return Object.fromEntries(plans.flatMap(plan => {
    const weekKey = String(plan?.weekKey || plan?.id || "");
    if (!/^\d{4}-W\d{2}$/.test(weekKey)) return [];
    const days = Object.fromEntries(Object.entries(plan?.days || {}).flatMap(([dateISO, item]) => {
      if (!isValidISODate(dateISO) || !item?.activityId) return [];
      return [[dateISO, {
        activityId: String(item.activityId).slice(0, 100),
        label: String(item.label || "Actividad planificada").slice(0, 300)
      }]];
    }));
    return [[weekKey, {
      id: weekKey,
      weekKey,
      days,
      updatedAt: String(plan?.updatedAt || "")
    }]];
  }));
}

export function normalizeCoachProfile(value) {
  if (!value || typeof value !== "object") return null;
  const profileText = String(value.profileText || "").trim().slice(0, 40000);
  const equipment = String(value.equipment || "").trim().slice(0, 5000);
  if (!profileText && !equipment) return null;
  return {
    id: "coach-profile",
    profileText,
    equipment,
    version: String(value.version || "tennis-v1").slice(0, 40),
    updatedAt: String(value.updatedAt || "")
  };
}

export function normalizeCoachQuestions(value) {
  const questions = Array.isArray(value) ? value : Object.values(value || {});
  return Object.fromEntries(questions.flatMap(item => {
    const id = String(item?.id || "").slice(0, 120);
    const question = String(item?.question || "").trim().slice(0, 1000);
    if (!id || !question) return [];
    const rawAdjustment = item?.planAdjustment;
    const targetDateISO = String(rawAdjustment?.targetDateISO || "");
    const category = ["physical", "cardio", "tennis", "rest"].includes(rawAdjustment?.category) ? rawAdjustment.category : "";
    const planAdjustment = isValidISODate(targetDateISO) && category ? {
      targetDateISO,
      title: String(rawAdjustment?.title || "Ajuste propuesto").trim().slice(0, 200),
      reason: String(rawAdjustment?.reason || "").trim().slice(0, 1000),
      category,
      summary: String(rawAdjustment?.summary || rawAdjustment?.title || "").trim().slice(0, 300),
      details: (Array.isArray(rawAdjustment?.details) ? rawAdjustment.details : []).slice(0, 12)
        .map(value => String(value || "").trim().slice(0, 500)).filter(Boolean),
      routineId: String(rawAdjustment?.routineId || "").slice(0, 100),
      cardioTypeId: String(rawAdjustment?.cardioTypeId || "").slice(0, 100),
      tennisTypeId: String(rawAdjustment?.tennisTypeId || "").slice(0, 100),
      restTypeId: String(rawAdjustment?.restTypeId || "").slice(0, 100),
      nutritionMode: nutritionModes.includes(rawAdjustment?.nutritionMode) ? rawAdjustment.nutritionMode : "default",
      nutritionReason: String(rawAdjustment?.nutritionReason || "").trim().slice(0, 1000)
    } : null;
    return [[id, {
      id,
      question,
      answer: String(item?.answer || "").trim().slice(0, 6000),
      deleted: Boolean(item?.deleted),
      source: item?.source === "voice" ? "voice" : "text",
      planAdjustment,
      adjustmentStatus: ["pending", "applied", "dismissed"].includes(item?.adjustmentStatus)
        ? item.adjustmentStatus : planAdjustment ? "pending" : "",
      appliedOptionId: String(item?.appliedOptionId || "").slice(0, 120),
      originalOptionId: String(item?.originalOptionId || "").slice(0, 120),
      appliedAt: String(item?.appliedAt || ""),
      createdAt: String(item?.createdAt || ""),
      updatedAt: String(item?.updatedAt || item?.createdAt || "")
    }]];
  }));
}

export function loadData(storage) {
  const current = parseJSON(storage.getItem(DATA_KEY), null);
  if (current && Array.isArray(current.records)) return {
    schemaVersion: SCHEMA_VERSION,
    records: ensureIds(current.records),
    plans: normalizePlans(current.plans),
    trainingBlocks: normalizeTrainingBlocks(current.trainingBlocks),
    coachProfile: normalizeCoachProfile(current.coachProfile),
    coachQuestions: normalizeCoachQuestions(current.coachQuestions),
    nutritionEntries: normalizeNutritionEntries(current.nutritionEntries),
    migrated: false,
    sourceKey: DATA_KEY
  };

  const previous = parseJSON(storage.getItem(PREVIOUS_DATA_KEY), null);
  if (previous && Array.isArray(previous.records)) return { schemaVersion: SCHEMA_VERSION, records: ensureIds(previous.records), plans: {}, trainingBlocks: {}, coachProfile: null, coachQuestions: {}, nutritionEntries: {}, migrated: true, sourceKey: PREVIOUS_DATA_KEY };

  const legacy = parseJSON(storage.getItem(LEGACY_HISTORY_KEY), []);
  return { schemaVersion: SCHEMA_VERSION, records: ensureIds(Array.isArray(legacy) ? legacy : []), plans: {}, trainingBlocks: {}, coachProfile: null, coachQuestions: {}, nutritionEntries: {}, migrated: true, sourceKey: LEGACY_HISTORY_KEY };
}

export function saveData(storage, data) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    records: ensureIds(data.records || []),
    plans: normalizePlans(data.plans),
    trainingBlocks: normalizeTrainingBlocks(data.trainingBlocks),
    coachProfile: normalizeCoachProfile(data.coachProfile),
    coachQuestions: normalizeCoachQuestions(data.coachQuestions),
    nutritionEntries: normalizeNutritionEntries(data.nutritionEntries)
  };
  try {
    storage.setItem(DATA_KEY, JSON.stringify(payload));
  } catch (error) {
    const wrapped = new Error("No fue posible guardar. Descarga un respaldo y libera espacio del navegador.");
    wrapped.cause = error;
    throw wrapped;
  }
  return payload;
}

export function parseBackup(jsonText) {
  const parsed = parseJSON(jsonText, null);
  const records = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(records)) throw new Error("El archivo no contiene un respaldo TGTrain válido.");
  if (records.length > 10000) throw new Error("El respaldo supera el máximo de 10.000 registros.");
  const normalized = ensureIds(records);
  if (normalized.some(record => !isValidISODate(record.dateISO))) throw new Error("El respaldo contiene uno o más registros sin fecha válida.");
  return normalized;
}

export function createRepository(storage) {
  let state = loadData(storage);
  const listeners = new Set();
  if (state.migrated) {
    try {
      const sourceKey = state.sourceKey;
      state = { ...saveData(storage, state), migrated: true, sourceKey: DATA_KEY };
      if (sourceKey && sourceKey !== DATA_KEY) storage.removeItem(sourceKey);
    } catch {
      state = { ...state, migrated: true };
    }
  }

  const persist = ({ records = state.records, plans = state.plans, trainingBlocks = state.trainingBlocks, coachProfile = state.coachProfile, coachQuestions = state.coachQuestions, nutritionEntries = state.nutritionEntries } = {}) => {
    state = { ...saveData(storage, { records, plans, trainingBlocks, coachProfile, coachQuestions, nutritionEntries }), migrated: false, sourceKey: DATA_KEY };
    return state;
  };

  const notify = change => {
    listeners.forEach(listener => {
      try { listener(change); } catch { /* La copia local nunca debe depender de la nube. */ }
    });
  };

  const recordTimestamp = record => Date.parse(record?.updatedAt || record?.createdAt || "") || 0;

  return {
    wasMigrated: Boolean(state.migrated),
    list() {
      return [...state.records].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    get(id) {
      return state.records.find(record => record.id === String(id)) || null;
    },
    upsert(record, { silent = false } = {}) {
      const result = validateRecord(record);
      if (!result.valid) throw new Error(result.errors.join(" "));
      const next = { ...result.record };
      const index = state.records.findIndex(item => item.id === next.id);
      const records = [...state.records];
      if (index >= 0) records[index] = next;
      else records.push(next);
      persist({ records });
      if (!silent) notify({ type: "upsert", record: next });
      return next;
    },
    remove(id, { silent = false, deletedAt = new Date().toISOString() } = {}) {
      const records = state.records.filter(record => record.id !== String(id));
      if (records.length === state.records.length) return false;
      persist({ records });
      if (!silent) notify({ type: "remove", id: String(id), deletedAt });
      return true;
    },
    importMerge(jsonText) {
      const incoming = parseBackup(jsonText);
      const backup = parseJSON(jsonText, null);
      const incomingPlans = normalizePlans(backup?.plans);
      const incomingBlocks = normalizeTrainingBlocks(backup?.trainingBlocks);
      const incomingProfile = normalizeCoachProfile(backup?.coachProfile);
      const incomingQuestions = normalizeCoachQuestions(backup?.coachQuestions);
      const incomingNutrition = normalizeNutritionEntries(backup?.nutritionEntries);
      const merged = new Map(state.records.map(record => [record.id, record]));
      incoming.forEach(record => merged.set(record.id, record));
      const plans = { ...state.plans };
      const appliedPlans = [];
      const trainingBlocks = { ...state.trainingBlocks };
      const appliedBlocks = [];
      Object.values(incomingPlans).forEach(plan => {
        const current = plans[plan.weekKey];
        if (!current || recordTimestamp(plan) >= recordTimestamp(current)) {
          plans[plan.weekKey] = plan;
          appliedPlans.push(plan);
        }
      });
      Object.values(incomingBlocks).forEach(block => {
        const current = trainingBlocks[block.id];
        if (!current || recordTimestamp(block) >= recordTimestamp(current)) {
          trainingBlocks[block.id] = block;
          appliedBlocks.push(block);
        }
      });
      const coachProfile = incomingProfile && (!state.coachProfile || recordTimestamp(incomingProfile) >= recordTimestamp(state.coachProfile))
        ? incomingProfile
        : state.coachProfile;
      const coachQuestions = { ...state.coachQuestions };
      const appliedQuestions = [];
      Object.values(incomingQuestions).forEach(question => {
        if (!coachQuestions[question.id] || recordTimestamp(question) >= recordTimestamp(coachQuestions[question.id])) {
          coachQuestions[question.id] = question;
          appliedQuestions.push(question);
        }
      });
      const nutritionEntries = { ...state.nutritionEntries };
      const appliedNutrition = [];
      Object.values(incomingNutrition).forEach(entry => {
        const current = nutritionEntries[entry.id];
        if (!current || recordTimestamp(entry) >= recordTimestamp(current)) {
          nutritionEntries[entry.id] = entry;
          appliedNutrition.push(entry);
        }
      });
      persist({ records: [...merged.values()], plans, trainingBlocks, coachProfile, coachQuestions, nutritionEntries });
      incoming.forEach(record => notify({ type: "upsert", record }));
      appliedPlans.forEach(plan => notify({ type: "plan-upsert", plan }));
      appliedBlocks.forEach(block => notify({ type: "training-block-upsert", block }));
      if (incomingProfile && coachProfile === incomingProfile) notify({ type: "coach-profile-upsert", profile: incomingProfile });
      appliedQuestions.forEach(question => notify({ type: "coach-question-upsert", question }));
      appliedNutrition.forEach(entry => notify({ type: "nutrition-upsert", entry }));
      return incoming.length;
    },
    applyCloudRecord(record) {
      const next = ensureIds([record])[0];
      const current = state.records.find(item => item.id === next.id);
      if (current && recordTimestamp(current) > recordTimestamp(next)) return false;
      const records = state.records.filter(item => item.id !== next.id);
      records.push(next);
      persist({ records });
      return true;
    },
    applyCloudDeletion(id, deletedAt) {
      const current = state.records.find(item => item.id === String(id));
      if (!current || recordTimestamp(current) > (Date.parse(deletedAt || "") || 0)) return false;
      persist({ records: state.records.filter(item => item.id !== String(id)) });
      return true;
    },
    listPlans() {
      return Object.values(state.plans).sort((a, b) => b.weekKey.localeCompare(a.weekKey));
    },
    getWeekPlan(weekKey) {
      return state.plans[String(weekKey)] || null;
    },
    saveWeekPlan(plan, { silent = false } = {}) {
      const normalized = normalizePlans([plan]);
      const next = normalized[String(plan?.weekKey || plan?.id || "")];
      if (!next) throw new Error("El plan semanal no es válido.");
      const plans = { ...state.plans, [next.weekKey]: next };
      persist({ plans });
      if (!silent) notify({ type: "plan-upsert", plan: next });
      return next;
    },
    applyCloudPlan(plan) {
      const normalized = normalizePlans([plan]);
      const next = normalized[String(plan?.weekKey || plan?.id || "")];
      if (!next) return false;
      const current = state.plans[next.weekKey];
      if (current && recordTimestamp(current) > recordTimestamp(next)) return false;
      persist({ plans: { ...state.plans, [next.weekKey]: next } });
      return true;
    },
    listTrainingBlocks() {
      return Object.values(state.trainingBlocks).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    },
    getTrainingBlock(id) {
      return state.trainingBlocks[String(id)] || null;
    },
    saveTrainingBlock(block, { silent = false } = {}) {
      const normalized = normalizeTrainingBlocks([block]);
      const next = Object.values(normalized)[0];
      if (!next) throw new Error("La planificación importada no es válida.");
      persist({ trainingBlocks: { ...state.trainingBlocks, [next.id]: next } });
      if (!silent) notify({ type: "training-block-upsert", block: next });
      return next;
    },
    applyCloudTrainingBlock(block) {
      const normalized = normalizeTrainingBlocks([block]);
      const next = Object.values(normalized)[0];
      if (!next) return false;
      const current = state.trainingBlocks[next.id];
      if (current && recordTimestamp(current) > recordTimestamp(next)) return false;
      persist({ trainingBlocks: { ...state.trainingBlocks, [next.id]: next } });
      return true;
    },
    getCoachProfile() {
      return state.coachProfile ? { ...state.coachProfile } : null;
    },
    saveCoachProfile(profile, { silent = false } = {}) {
      const next = normalizeCoachProfile(profile);
      if (!next) throw new Error("Completa el perfil o el equipamiento del entrenador.");
      persist({ coachProfile: next });
      if (!silent) notify({ type: "coach-profile-upsert", profile: next });
      return next;
    },
    applyCloudCoachProfile(profile) {
      const next = normalizeCoachProfile(profile);
      if (!next) return false;
      if (state.coachProfile && recordTimestamp(state.coachProfile) > recordTimestamp(next)) return false;
      persist({ coachProfile: next });
      return true;
    },
    listCoachQuestions({ includeDeleted = false } = {}) {
      return Object.values(state.coachQuestions).filter(item => includeDeleted || !item.deleted)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    clearCoachQuestions() {
      const live = this.listCoachQuestions();
      if (!live.length) return 0;
      const updatedAt = new Date().toISOString();
      const coachQuestions = { ...state.coachQuestions };
      for (const question of live) coachQuestions[question.id] = { ...question, deleted: true, updatedAt };
      persist({ coachQuestions });
      for (const question of live) notify({ type: "coach-question-upsert", question: coachQuestions[question.id] });
      return live.length;
    },
    saveCoachQuestion(question, { silent = false } = {}) {
      const next = Object.values(normalizeCoachQuestions([question]))[0];
      if (!next) throw new Error("Escribe una pregunta para la guía.");
      persist({ coachQuestions: { ...state.coachQuestions, [next.id]: next } });
      if (!silent) notify({ type: "coach-question-upsert", question: next });
      return next;
    },
    applyCloudCoachQuestion(question) {
      const next = Object.values(normalizeCoachQuestions([question]))[0];
      if (!next) return false;
      const current = state.coachQuestions[next.id];
      if (current && recordTimestamp(current) >= recordTimestamp(next)) return false;
      persist({ coachQuestions: { ...state.coachQuestions, [next.id]: next } });
      return true;
    },
    listNutritionEntries(dateISO = "") {
      return Object.values(state.nutritionEntries).filter(item => !dateISO || item.dateISO === dateISO)
        .sort((a, b) => String(a.time || a.createdAt).localeCompare(String(b.time || b.createdAt)));
    },
    getNutritionEntry(id) {
      return state.nutritionEntries[String(id)] || null;
    },
    fillMissingNutritionEstimates() {
      const nutritionEntries = { ...state.nutritionEntries };
      const updated = [];
      for (const entry of Object.values(nutritionEntries)) {
        if (entry.deleted) continue;
        const estimated = nutritionEntryWithEstimate(entry);
        if (estimated === entry) continue;
        const text = [describeParts(entry.parts), entry.note].filter(Boolean).join(" · ").slice(0, 1000);
        const updatedAt = new Date(Math.max(Date.now(), (Date.parse(entry.updatedAt) || 0) + 1)).toISOString();
        const next = { ...estimated, text: text || entry.text, updatedAt };
        nutritionEntries[entry.id] = next;
        updated.push(next);
      }
      if (!updated.length) return [];
      persist({ nutritionEntries });
      updated.forEach(entry => notify({ type: "nutrition-upsert", entry }));
      return updated;
    },
    saveNutritionEntry(entry, { silent = false } = {}) {
      const next = Object.values(normalizeNutritionEntries([entry]))[0];
      if (!next) throw new Error("Completa la fecha y lo que comiste, o indica la cantidad de agua.");
      persist({ nutritionEntries: { ...state.nutritionEntries, [next.id]: next } });
      if (!silent) notify({ type: "nutrition-upsert", entry: next });
      return next;
    },
    applyCloudNutritionEntry(entry) {
      const next = Object.values(normalizeNutritionEntries([entry]))[0];
      if (!next) return false;
      const current = state.nutritionEntries[next.id];
      if (current && recordTimestamp(current) >= recordTimestamp(next)) return false;
      persist({ nutritionEntries: { ...state.nutritionEntries, [next.id]: next } });
      return true;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    backup() {
      return JSON.stringify({ app: "TGTrain", schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), records: this.list(), plans: state.plans, trainingBlocks: state.trainingBlocks, coachProfile: state.coachProfile, coachQuestions: state.coachQuestions, nutritionEntries: state.nutritionEntries }, null, 2);
    }
  };
}
