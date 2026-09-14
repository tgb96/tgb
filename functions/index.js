import { logger, setGlobalOptions } from "firebase-functions/v2";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";

setGlobalOptions({ region: "us-central1", maxInstances: 2, timeoutSeconds: 120, memory: "256MiB" });

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const TGTRAIN_ALLOWED_UID = defineSecret("TGTRAIN_ALLOWED_UID");
const OPENAI_MODEL = defineString("OPENAI_MODEL", { default: "gpt-5.6-luna" });
const usageWindows = new Map();

const planSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "source", "rules", "priority", "weeks"],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    source: { type: "string" },
    rules: { type: "array", items: { type: "string" }, maxItems: 30 },
    priority: { type: "array", items: { type: "string" }, maxItems: 10 },
    weeks: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["weekKey", "label", "context", "objective", "sessions"],
        properties: {
          weekKey: { type: "string" },
          label: { type: "string" },
          context: { type: "string" },
          objective: { type: "string" },
          sessions: {
            type: "array",
            minItems: 1,
            maxItems: 14,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "dateISO", "objective", "primaryOptionId", "options"],
              properties: {
                id: { type: "string" },
                dateISO: { type: "string" },
                objective: { type: "string" },
                primaryOptionId: { type: "string" },
                options: {
                  type: "array",
                  minItems: 1,
                  maxItems: 6,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["id", "title", "category", "summary", "details", "routineId", "cardioTypeId", "tennisTypeId", "restTypeId", "distanceKm", "exerciseSettings"],
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      category: { type: "string", enum: ["physical", "cardio", "tennis", "rest"] },
                      summary: { type: "string" },
                      details: { type: "array", items: { type: "string" }, maxItems: 20 },
                      routineId: { type: "string" },
                      cardioTypeId: { type: "string" },
                      tennisTypeId: { type: "string" },
                      restTypeId: { type: "string" },
                      distanceKm: { type: ["number", "null"] },
                      exerciseSettings: {
                        type: "array",
                        maxItems: 100,
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["exerciseId", "sets", "target", "weightKg", "omit"],
                          properties: {
                            exerciseId: { type: "string" },
                            sets: { type: "integer", minimum: 1, maximum: 10 },
                            target: { type: "string" },
                            weightKg: { type: ["number", "null"], minimum: 0 },
                            omit: { type: "boolean" }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "highlights", "progress", "nextSession", "cautions"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    highlights: { type: "array", items: { type: "string" }, maxItems: 6 },
    progress: { type: "array", items: { type: "string" }, maxItems: 6 },
    nextSession: { type: "array", items: { type: "string" }, maxItems: 6 },
    cautions: { type: "array", items: { type: "string" }, maxItems: 6 }
  }
};

function authorize(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Debes iniciar sesión con Google.");
  const allowedUid = TGTRAIN_ALLOWED_UID.value().trim();
  if (!allowedUid || request.auth.uid !== allowedUid) throw new HttpsError("permission-denied", "Esta cuenta no está autorizada.");
  const now = Date.now();
  const current = usageWindows.get(request.auth.uid);
  const windowState = !current || now - current.startedAt > 60 * 60 * 1000
    ? { startedAt: now, count: 0 }
    : current;
  windowState.count += 1;
  usageWindows.set(request.auth.uid, windowState);
  if (windowState.count > 20) throw new HttpsError("resource-exhausted", "Límite temporal alcanzado.");
}

function outputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || []).flatMap(item => item?.content || [])
    .filter(item => item?.type === "output_text")
    .map(item => item.text || "")
    .join("");
}

async function structuredResponse({ instructions, input, schema, schemaName, maxOutputTokens }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL.value(),
      instructions,
      input,
      store: false,
      max_output_tokens: maxOutputTokens,
      text: { format: { type: "json_schema", name: schemaName, strict: true, schema } }
    })
  });
  if (!response.ok) {
    logger.error("OpenAI request failed", { status: response.status, requestId: response.headers.get("x-request-id") || "" });
    throw new HttpsError("internal", "El análisis inteligente no pudo responder.");
  }
  const payload = await response.json();
  const json = outputText(payload);
  if (!json) throw new HttpsError("internal", "GPT no devolvió un resultado utilizable.");
  try {
    return { value: JSON.parse(json), model: payload.model || OPENAI_MODEL.value() };
  } catch {
    throw new HttpsError("internal", "GPT devolvió una respuesta incompleta.");
  }
}

export const importTrainingPlan = onCall({ secrets: [OPENAI_API_KEY, TGTRAIN_ALLOWED_UID] }, async request => {
  authorize(request);
  const planText = String(request.data?.planText || "").trim();
  const catalog = request.data?.catalog;
  if (planText.length < 100 || planText.length > 50000) throw new HttpsError("invalid-argument", "La planificación debe tener entre 100 y 50.000 caracteres.");
  const catalogText = JSON.stringify(catalog || {});
  const currentDate = String(request.data?.currentDate || "").slice(0, 10);
  if (catalogText.length > 50000) throw new HttpsError("invalid-argument", "El catálogo recibido es demasiado grande.");
  const result = await structuredResponse({
    schema: planSchema,
    schemaName: "tgtrain_training_plan",
    maxOutputTokens: 20000,
    instructions: [
      "Eres el importador de planificaciones de TGTrain, una aplicación personal de entrenamiento.",
      "Convierte fielmente el texto del entrenador en un calendario estructurado; no inventes entrenamientos ausentes.",
      "Usa fechas YYYY-MM-DD y semanas ISO YYYY-WNN. Conserva alternativas dentro de options y deja como primaria la primera o la indicada explícitamente.",
      "Para entrenamiento físico usa exclusivamente routineId y exerciseId existentes en el catálogo. Si el texto no modifica un ejercicio, omítelo de exerciseSettings.",
      "Para cardio, tenis y descanso usa exclusivamente los identificadores del catálogo. Los campos que no correspondan deben ir vacíos, las distancias desconocidas deben ser null y las listas pueden quedar vacías.",
      "Escribe todo en español claro. No incluyas explicaciones fuera del JSON."
    ].join("\n"),
    input: `FECHA ACTUAL EN CHILE: ${currentDate || "no indicada"}\n\nCATÁLOGO VÁLIDO DE TGTRAIN:\n${catalogText}\n\nPLAN DEL ENTRENADOR:\n${planText}`
  });
  return { block: result.value, model: result.model };
});

export const analyzeRoutine = onCall({ secrets: [OPENAI_API_KEY, TGTRAIN_ALLOWED_UID] }, async request => {
  authorize(request);
  const record = request.data?.record;
  const recentRecords = Array.isArray(request.data?.recentRecords) ? request.data.recentRecords.slice(-8) : [];
  const planDetails = Array.isArray(request.data?.planDetails) ? request.data.planDetails.slice(0, 20) : [];
  const input = JSON.stringify({ current: record, previousSameRoutine: recentRecords, planDetails });
  if (!record || input.length > 150000) throw new HttpsError("invalid-argument", "El entrenamiento recibido no es válido.");
  const result = await structuredResponse({
    schema: analysisSchema,
    schemaName: "tgtrain_routine_analysis",
    maxOutputTokens: 1800,
    instructions: [
      "Eres el analista de entrenamiento personal de TGTrain.",
      "Analiza solo los datos entregados y compara únicamente con sesiones anteriores de la misma rutina.",
      "Distingue datos objetivos de interpretaciones. No inventes cargas, repeticiones, molestias ni récords.",
      "Entrega una síntesis breve, alentadora y útil, con recomendaciones prudentes para la próxima sesión.",
      "No diagnostiques lesiones. Si las sensaciones mencionan dolor o una molestia relevante, incluye una cautela conservadora y sugiere detener o consultar a un profesional si persiste o empeora.",
      "No cambies registros ni afirmes que una recomendación es una orden médica. Responde en español chileno neutro."
    ].join("\n"),
    input
  });
  return { analysis: result.value, model: result.model };
});
