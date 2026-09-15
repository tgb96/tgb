import { firebaseConfig, firebaseConfigured } from "./firebase-config.js?v=35";
import { cardioTypes, physicalRoutines, restTypes, tennisTypes } from "./data.js?v=53";

const FIREBASE_VERSION = "12.18.0";
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
const MODEL_NAME = "gemini-3.5-flash-lite";
const ALLOWED_UID = "X37HE24wq5bzbmU2tpowWZ4S7io1";
const RECAPTCHA_ENTERPRISE_SITE_KEY = "6LepnbotAAAAAGO5otmQYn725glRtwS-5aoh5-g9";
export const COACH_PROFILE_VERSION = "tennis-v1";
export const DEFAULT_COACH_EQUIPMENT = [
  "Mancuernas ajustables con una capacidad máxima de 40 kg.",
  "Kettlebell de 8 kg.",
  "Kettlebell de 4,5 kg.",
  "Bicicleta estática.",
  "Espacio para shadow tennis, split step, desplazamientos y pliometría."
].join("\n");

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

const progressionChangeSchema = {
  type: "object",
  properties: {
    exerciseId: stringSchema,
    exerciseName: stringSchema,
    action: { type: "string", enum: ["increase", "maintain", "reduce", "substitute"] },
    currentSets: { type: "integer" },
    proposedSets: { type: "integer" },
    currentTarget: stringSchema,
    proposedTarget: stringSchema,
    currentWeightKg: nullableNumberSchema,
    proposedWeightKg: nullableNumberSchema,
    reason: stringSchema
  },
  required: ["exerciseId", "exerciseName", "action", "currentSets", "proposedSets", "currentTarget", "proposedTarget", "currentWeightKg", "proposedWeightKg", "reason"]
};

const analysisSchema = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["progress", "maintain", "reduce", "recover"] },
    headline: stringSchema,
    summary: stringSchema,
    highlights: { type: "array", items: stringSchema, maxItems: 6 },
    progress: { type: "array", items: stringSchema, maxItems: 6 },
    nextSession: { type: "array", items: stringSchema, maxItems: 6 },
    cautions: { type: "array", items: stringSchema, maxItems: 6 },
    changes: { type: "array", items: progressionChangeSchema, maxItems: 12 },
    goal: stringSchema
  },
  required: ["decision", "headline", "summary", "highlights", "progress", "nextSession", "cautions", "changes", "goal"]
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

    async analyzeRoutine(record, recentRecords = [], planDetails = [], context = {}) {
      const instructions = [
        "Eres la IA entrenadora personal de TGTrain, especializada en rendimiento físico para tenis.",
        "Comenta cualquier actividad recibida: entrenamiento físico, cardio, trote, trekking, pádel, tenis o descanso. La ruta de registro no cambia el análisis.",
        "Lee todas las sensaciones y comentarios del registro actual. Explica qué implican para el avance, la recuperación y la siguiente sesión. Si falta RPE, dolor, técnica o energía, no los inventes ni asumas que están bien.",
        "Compara el resultado real con currentPlan cuando exista, incluso si se registró desde Registrar. Distingue entre objetivo planificado y actividad realizada; no afirmes cumplimiento total solo porque coincida el tipo de actividad.",
        "En trote analiza distancia, duración y ritmo calculado, compara solo marcas de la misma distancia y considera cansancio, molestias, terreno y comentarios. Respetar un máximo de distancia o intensidad indicado por el plan; no perseguir un récord a costa de la recuperación para tenis.",
        "Para cardio, tenis y descanso changes debe ser una lista vacía. Da recomendaciones concretas en nextSession y goal, sin proponer series, cargas ni ejercicios inventados. Las reglas físicas del perfil se adaptan a la categoría actual; las precauciones personales siempre se respetan.",
        "Tu prioridad es mejorar desplazamientos, split step, frenadas, recuperación al centro, fuerza funcional, potencia limpia, estabilidad y tolerancia a la carga de tenis; no optimices para hipertrofia por sí sola.",
        "Analiza solo los datos entregados. No inventes cargas, repeticiones, dolor, calendario, equipamiento ni récords.",
        "Elige exactamente una decisión general: progress, maintain, reduce o recover.",
        "Propón cambios solo para exerciseId presentes en la sesión actual. Los valores deben ser concretos y aplicables en TGTrain.",
        "En una sesión aumenta como máximo una variable principal. No subas simultáneamente carga, repeticiones y series. El volumen total no debe subir más de 5–10% respecto de una sesión comparable.",
        "Carga: aumenta como máximo 1–2 kg cuando esa configuración exista. Repeticiones: +1–2 por serie. Series: +1 serie en un solo ejercicio. Planchas/carries: +5–10 segundos. Desplazamientos: +5 segundos. Nunca agregues carga a pliometría.",
        "Solo progresa si se completó al menos 90%, la técnica y energía fueron adecuadas, el esfuerzo fue controlado, el dolor fue 0–2/10 y no hay tenis o partido exigente en las próximas 48 horas.",
        "Con esfuerzo alto, mala técnica, poca energía o rutina parcial, mantén o reduce. Con dolor 3–4/10 no progreses y reduce 20–30%. Con dolor 5/10 o más, o molestia repetida, prioriza recuperar y recomienda detener el ejercicio problemático y consultar si persiste.",
        "Para piernas prioriza técnica, estabilidad, rango, repeticiones, tempo y al final carga. Para tren superior protege el lado de raqueta y no aumentes más de un empuje y una tracción. Para potencia prioriza calidad, descansos y aterrizaje. Para core aumenta tiempo o control antes que carga.",
        "El perfil privado del usuario prevalece sobre las reglas generales. El inventario entregado es el único equipamiento permitido.",
        "changes debe contener solo ajustes relevantes. Si recomiendas mantener sin cambios, puede quedar vacío. Nunca apliques nada: la aplicación pedirá confirmación al usuario.",
        "No diagnostiques lesiones ni presentes una recomendación como orden médica. Responde en español chileno neutro."
      ].join("\n");
      const analysis = await generateJson({
        schema: analysisSchema,
        maxOutputTokens: 4000,
        instructions,
        input: JSON.stringify({
          coachProfileVersion: COACH_PROFILE_VERSION,
          privateCoachProfile: String(context.coachProfile?.profileText || "").slice(0, 40000),
          availableEquipment: String(context.coachProfile?.equipment || DEFAULT_COACH_EQUIPMENT).slice(0, 5000),
          current: record,
          previousComparableActivities: recentRecords.slice(-8),
          currentPlan: context.currentPlan || null,
          recentTrainingLoad: Array.isArray(context.recentTrainingLoad) ? context.recentTrainingLoad.slice(-20) : [],
          next48Hours: Array.isArray(context.next48Hours) ? context.next48Hours.slice(0, 6) : [],
          planDetails: planDetails.slice(0, 20)
        })
      });
      return { analysis: { ...analysis, profileVersion: COACH_PROFILE_VERSION }, model: MODEL_NAME };
    }
  };
}
