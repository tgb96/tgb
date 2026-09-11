import { isValidISODate, normalizeRecord, validateRecord } from "./utils.js?v=41";

export const DATA_KEY = "tgb-data-v3";
export const PREVIOUS_DATA_KEY = "tgb-data-v2";
export const LEGACY_HISTORY_KEY = "history";
export const SCHEMA_VERSION = 10;

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

export function loadData(storage) {
  const current = parseJSON(storage.getItem(DATA_KEY), null);
  if (current && Array.isArray(current.records)) return {
    schemaVersion: SCHEMA_VERSION,
    records: ensureIds(current.records),
    plans: normalizePlans(current.plans),
    migrated: false,
    sourceKey: DATA_KEY
  };

  const previous = parseJSON(storage.getItem(PREVIOUS_DATA_KEY), null);
  if (previous && Array.isArray(previous.records)) return { schemaVersion: SCHEMA_VERSION, records: ensureIds(previous.records), plans: {}, migrated: true, sourceKey: PREVIOUS_DATA_KEY };

  const legacy = parseJSON(storage.getItem(LEGACY_HISTORY_KEY), []);
  return { schemaVersion: SCHEMA_VERSION, records: ensureIds(Array.isArray(legacy) ? legacy : []), plans: {}, migrated: true, sourceKey: LEGACY_HISTORY_KEY };
}

export function saveData(storage, data) {
  const payload = { schemaVersion: SCHEMA_VERSION, records: ensureIds(data.records || []), plans: normalizePlans(data.plans) };
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

  const persist = ({ records = state.records, plans = state.plans } = {}) => {
    state = { ...saveData(storage, { records, plans }), migrated: false, sourceKey: DATA_KEY };
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
      const merged = new Map(state.records.map(record => [record.id, record]));
      incoming.forEach(record => merged.set(record.id, record));
      const plans = { ...state.plans };
      const appliedPlans = [];
      Object.values(incomingPlans).forEach(plan => {
        const current = plans[plan.weekKey];
        if (!current || recordTimestamp(plan) >= recordTimestamp(current)) {
          plans[plan.weekKey] = plan;
          appliedPlans.push(plan);
        }
      });
      persist({ records: [...merged.values()], plans });
      incoming.forEach(record => notify({ type: "upsert", record }));
      appliedPlans.forEach(plan => notify({ type: "plan-upsert", plan }));
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
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    backup() {
      return JSON.stringify({ app: "TGTrain", schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), records: this.list(), plans: state.plans }, null, 2);
    }
  };
}
