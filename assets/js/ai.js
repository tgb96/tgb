import { firebaseConfig, firebaseConfigured } from "./firebase-config.js?v=35";
import { cardioTypes, physicalRoutines, restTypes, tennisTypes } from "./data.js?v=50";

const FIREBASE_VERSION = "12.18.0";
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const MODEL_NAME = "gemini-3.5-flash-lite";
const ALLOWED_UID = "X37HE24wq5bzbmU2tpowWZ4S7io1";
const RECAPTCHA_ENTERPRISE_SITE_KEY = "6LepnbotAAAAAGO5otmQYn725glRtwS-5aoh5-g9";

const stringSchema = { type: "string" };
const nullableNumberSchema = { type: "number", nullable: true };

const exerciseSettingSchema = {
  type: "object",
  properties: {
    exerciseId: stringSchema,
    sets: { type: "integer" },
    target: stringSchema,
    weightKg: nullableNumberSchema,
    omit: { type: "boolean" }
  },
  required: ["exerciseId", "sets", "target", "weightKg", "omit"]
};

const planSchema = {
  type: "object",
  properties: {
    title: stringSchema,
    subtitle: stringSchema,
    source: stringSchema,
    rules: { type: "array", items: stringSchema, maxItems: 30 },
    priority: { type: "array", items: stringSchema, maxItems: 10 },
    weeks: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          weekKey: stringSchema,
          label: stringSchema,
          context: stringSchema,
          objective: stringSchema,
          sessions: {
            type: "array",
            maxItems: 14,
            items: {
              type: "object",
              properties: {
                id: stringSchema,
                dateISO: stringSchema,
                objective: stringSchema,
                primaryOptionId: stringSchema,
                options: {
                  type: "array",
                  maxItems: 6,
                  items: {
                    type: "object",
                    properties: {
                      id: stringSchema,
                      title: stringSchema,
                      category: { type: "string", enum: ["physical", "cardio", "tennis", "rest"] },
                      summary: stringSchema,
                      details: { type: "array", items: stringSchema, maxItems: 20 },
                      routineId: stringSchema,
                      cardioTypeId: stringSchema,
                      tennisTypeId: stringSchema,
                      restTypeId: stringSchema,
                      distanceKm: nullableNumberSchema,
                      exerciseSettings: { type: "array", items: exerciseSettingSchema, maxItems: 100 }
                    },
                    required: ["id", "title", "category", "summary", "details", "routineId", "cardioTypeId", "tennisTypeId", "restTypeId", "distanceKm", "exerciseSettings"]
                  }
                }
              },
              required: ["id", "dateISO", "objective", "primaryOptionId", "options"]
            }
          }
        },
        required: ["weekKey", "label", "context", "objective", "sessions"]
      }
    }
  },
  required: ["title", "subtitle", "source", "rules", "priority", "weeks"]
};

const analysisSchema = {
  type: "object",
  properties: {
    headline: stringSchema,
    summary: stringSchema,
    highlights: { type: "array", items: stringSchema, maxItems: 6 },
    progress: { type: "array", items: stringSchema, maxItems: 6 },
    nextSession: { type: "array", items: stringSchema, maxItems: 6 },
    cautions: { type: "array", items: stringSchema, maxItems: 6 }
  },
  required: ["headline", "summary", "highlights", "progress", "nextSession", "cautions"]
};

function friendlyError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");
  if (code.includes("unauthenticated")) return "Inicia sesión con Google para usar el análisis inteligente.";
  if (code.includes("permission") || code.includes("app-check")) return "La protección gratuita de la IA todavía no está activada para este dispositivo.";
  if (code.includes("quota") || code.includes("resource-exhausted") || code.includes("429")) return "Se alcanzó el límite gratuito temporal. Inténtalo más tarde.";
  if (code.includes("fetch-error") && (message.includes("high demand") || message.includes("[500"))) return "Gemini está temporalmente saturado. Inténtalo nuevamente en unos minutos.";
  if (code.includes("not-found") || message.includes("not found")) return "El análisis inteligente todavía no está habilitado en Firebase.";
  return message || "No fue posible completar el análisis inteligente.";
}

export function createAiClient() {
  let modules = null;
  let ai = null;

  async function initialize() {
    if (ai) return ai;
    if (!firebaseConfigured) throw new Error("Primero configura la conexión de TGTrain con Firebase.");
    const [appModule, authModule, appCheckModule, aiModule] = await Promise.all([
      import(`${FIREBASE_BASE}/firebase-app.js`),
      import(`${FIREBASE_BASE}/firebase-auth.js`),
      import(`${FIREBASE_BASE}/firebase-app-check.js`),
      import(`${FIREBASE_BASE}/firebase-ai.js`)
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
    modules = { authModule, aiModule };
    appCheckModule.initializeAppCheck(app, {
      provider: new appCheckModule.ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    ai = aiModule.getAI(app, { backend: new aiModule.GoogleAIBackend() });
    return ai;
  }

  async function generateJson({ instructions, input, schema, maxOutputTokens, useResponseSchema = true }) {
    try {
      await initialize();
      const auth = modules.authModule.getAuth();
      if (!auth.currentUser) throw Object.assign(new Error("Inicia sesión con Google para usar el análisis inteligente."), { code: "unauthenticated" });
      if (auth.currentUser.uid !== ALLOWED_UID) throw Object.assign(new Error("Esta función está disponible únicamente para el propietario de TGTrain."), { code: "permission-denied" });
      const model = modules.aiModule.getGenerativeModel(ai, {
        model: MODEL_NAME,
        systemInstruction: instructions,
        generationConfig: {
          responseMimeType: "application/json",
          ...(useResponseSchema ? { responseSchema: schema } : {}),
          maxOutputTokens,
          temperature: 0.2
        }
      });
      const schemaGuide = useResponseSchema ? "" : `\n\nFORMATO JSON OBLIGATORIO:\n${JSON.stringify(schema)}`;
      const result = await model.generateContent(`${input}${schemaGuide}`);
      const text = result.response.text();
      if (!text) throw new Error("La IA no devolvió un resultado utilizable.");
      return JSON.parse(text);
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  return {
    async importTrainingPlan(planText, currentDate = "") {
      const catalog = {
        routines: physicalRoutines.map(routine => ({
          id: routine.id,
          name: routine.name,
          focus: routine.focus,
          exercises: routine.exercises.map(exercise => ({ id: exercise.id, name: exercise.name, target: exercise.target }))
        })),
        cardio: cardioTypes.map(type => ({ id: type.id, name: type.name })),
        tennis: tennisTypes.map(type => ({ id: type.id, name: type.name })),
        rest: restTypes.map(type => ({ id: type.id, name: type.name }))
      };
      const instructions = [
        "Eres el importador de planificaciones de TGTrain, una aplicación personal de entrenamiento.",
        "Convierte fielmente el texto del entrenador en un calendario estructurado; no inventes entrenamientos ausentes.",
        "Usa fechas YYYY-MM-DD y semanas ISO YYYY-WNN. Conserva alternativas dentro de options y deja como primaria la primera o la indicada explícitamente.",
        "Para entrenamiento físico usa exclusivamente routineId y exerciseId existentes en el catálogo. Si el texto no modifica un ejercicio, omítelo de exerciseSettings.",
        "Para cardio, tenis y descanso usa exclusivamente los identificadores del catálogo. Los campos que no correspondan deben ir vacíos, las distancias desconocidas deben ser null y las listas pueden quedar vacías.",
        "Escribe todo en español claro. No incluyas explicaciones fuera del JSON."
      ].join("\n");
      const block = await generateJson({
        schema: planSchema,
        useResponseSchema: false,
        maxOutputTokens: 20000,
        instructions,
        input: `FECHA ACTUAL EN CHILE: ${currentDate || "no indicada"}\n\nCATÁLOGO VÁLIDO DE TGTRAIN:\n${JSON.stringify(catalog)}\n\nPLAN DEL ENTRENADOR:\n${String(planText || "").slice(0, 50000)}`
      });
      return { block, model: MODEL_NAME };
    },

    async analyzeRoutine(record, recentRecords = [], planDetails = []) {
      const instructions = [
        "Eres el analista de entrenamiento personal de TGTrain.",
        "Analiza solo los datos entregados y compara únicamente con sesiones anteriores de la misma rutina.",
        "Distingue datos objetivos de interpretaciones. No inventes cargas, repeticiones, molestias ni récords.",
        "Entrega una síntesis breve, alentadora y útil, con recomendaciones prudentes para la próxima sesión.",
        "No diagnostiques lesiones. Si las sensaciones mencionan dolor o una molestia relevante, incluye una cautela conservadora y sugiere detener o consultar a un profesional si persiste o empeora.",
        "No cambies registros ni afirmes que una recomendación es una orden médica. Responde en español chileno neutro."
      ].join("\n");
      const analysis = await generateJson({
        schema: analysisSchema,
        maxOutputTokens: 1800,
        instructions,
        input: JSON.stringify({ current: record, previousSameRoutine: recentRecords.slice(-8), planDetails: planDetails.slice(0, 20) })
      });
      return { analysis, model: MODEL_NAME };
    }
  };
}
