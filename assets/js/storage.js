import { normalizeRecord, validateRecord } from "./utils.js";

export const DATA_KEY = "tgb-data-v2";
export const LEGACY_HISTORY_KEY = "history";
export const SCHEMA_VERSION = 2;

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

export function loadData(storage) {
  const current = parseJSON(storage.getItem(DATA_KEY), null);
  if (current && Array.isArray(current.records)) {
    return { schemaVersion: SCHEMA_VERSION, records: ensureIds(current.records), migrated: false };
  }
  const legacy = parseJSON(storage.getItem(LEGACY_HISTORY_KEY), []);
  return { schemaVersion: SCHEMA_VERSION, records: ensureIds(Array.isArray(legacy) ? legacy : []), migrated: true };
}

export function saveData(storage, data) {
  const payload = { schemaVersion: SCHEMA_VERSION, records: ensureIds(data.records || []) };
  try {
    storage.setItem(DATA_KEY, JSON.stringify(payload));
  } catch (error) {
    const wrapped = new Error("No fue posible guardar. Exporta un respaldo y libera espacio del navegador.");
    wrapped.cause = error;
    throw wrapped;
  }
  return payload;
}

export function parseBackup(jsonText) {
  const parsed = parseJSON(jsonText, null);
  const records = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(records)) throw new Error("El archivo no contiene un respaldo TGB válido.");
  if (records.length > 10000) throw new Error("El respaldo supera el máximo de 10.000 registros por importación.");
  const invalidSource = records.find(record => !validateRecord(record).valid);
  if (invalidSource) throw new Error(`El respaldo contiene un registro inválido (${invalidSource.dateISO || "sin fecha"}).`);
  const normalized = ensureIds(records);
  return normalized;
}

export function createRepository(storage) {
  let state = loadData(storage);
  if (state.migrated) {
    try {
      state = { ...saveData(storage, state), migrated: true };
      storage.removeItem(LEGACY_HISTORY_KEY);
    } catch {
      // El historial antiguo permanece disponible en memoria y puede exportarse.
      state = { ...state, migrated: true };
    }
  }

  const persist = records => {
    state = { ...saveData(storage, { records }), migrated: false };
    return state.records;
  };

  return {
    wasMigrated: Boolean(state.migrated),
    list() {
      return [...state.records].sort((a, b) => b.dateISO.localeCompare(a.dateISO) || String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    get(id) {
      return state.records.find(record => record.id === String(id)) || null;
    },
    upsert(record) {
      const result = validateRecord(record);
      if (!result.valid) throw new Error(result.errors.join(" "));
      const next = { ...result.record };
      const index = state.records.findIndex(item => item.id === next.id);
      const records = [...state.records];
      if (index >= 0) records[index] = next;
      else records.push(next);
      persist(records);
      return next;
    },
    remove(id) {
      const next = state.records.filter(record => record.id !== String(id));
      if (next.length === state.records.length) return false;
      persist(next);
      return true;
    },
    importMerge(jsonText) {
      const incoming = parseBackup(jsonText);
      const merged = new Map(state.records.map(record => [record.id, record]));
      for (const record of incoming) merged.set(record.id, record);
      persist([...merged.values()]);
      return incoming.length;
    },
    backup() {
      return JSON.stringify({
        app: "TGB",
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        records: this.list()
      }, null, 2);
    }
  };
}
