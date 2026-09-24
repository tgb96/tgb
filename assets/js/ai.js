import { firebaseConfig, firebaseConfigured } from "./firebase-config.js?v=35";
import { cardioTypes, physicalRoutines, restTypes, tennisTypes } from "./data.js?v=63";
import { activityTiming, validateAnalysisPaces } from "./training-metrics.js?v=63";

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
                    required: ["title", "category"]
                  }
                }
              },
              required: ["dateISO", "options"]
            }
          }
        },
        required: ["weekKey", "sessions"]
      }
    }
  },
  required: ["title", "weeks"]
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
    goal: stringSchema,
    planComparison: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["completed", "partial", "adapted", "recovery", "different", "unknown"] },
        reason: stringSchema
      },
      required: ["status", "reason"]
    },
    encouragement: stringSchema
  },
  required: ["decision", "headline", "summary", "highlights", "progress", "nextSession", "cautions", "changes", "goal", "planComparison", "encouragement"]
};

function friendlyError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");
  if (code.includes("unauthenticated")) return "Inicia sesión con Google para usar el análisis inteligente.";
  if (code.includes("permission") || code.includes("app-check")) return "La protección gratuita de la IA todavía no está activada para este dispositivo.";
  if (code.includes("quota") || code.includes("resource-exhausted") || code.includes("429")) return "Se alcanzó el límite gratuito temporal. Inténtalo más tarde.";
  if (code.includes("fetch-error") && (message.includes("high demand") || message.includes("[500"))) return "Gemini está temporalmente saturado. Inténtalo nuevamente en unos minutos.";
  if (code.includes("not-found") || message.includes("not found")) return "El análisis inteligente todavía no está habilitado en Firebase.";
  if (code.includes("invalid-json")) return "La respuesta de Gemini quedó incompleta. Vuelve a intentarlo; TGTrain solicitará automáticamente una versión compacta del plan.";
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
      const wrapped = new Error(friendlyError(error));
      wrapped.code = error instanceof SyntaxError ? "invalid-json" : String(error?.code || "");
      if (error instanceof SyntaxError) wrapped.message = friendlyError({ code: "invalid-json", message: error.message });
      throw wrapped;
    }
  }

  return {
    async transcribeAudio(audioBlob) {
      try {
        if (!audioBlob || audioBlob.size < 100 || audioBlob.size > 4 * 1024 * 1024) {
          throw new Error("La grabación está vacía o es demasiado larga. Intenta una pregunta breve.");
        }
        const mimeType = String(audioBlob.type || "").split(";")[0];
        if (!["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"].includes(mimeType)) {
          throw new Error("El formato de audio de este navegador no es compatible. Usa el micrófono del teclado para dictar.");
        }
        await initialize();
        const user = modules.authModule.getAuth().currentUser;
        if (!user) throw Object.assign(new Error("Inicia sesión con Google para transcribir la pregunta."), { code: "unauthenticated" });
        if (user.uid !== ALLOWED_UID) throw Object.assign(new Error("Esta función está disponible únicamente para el propietario de TGTrain."), { code: "permission-denied" });
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
          reader.onerror = () => reject(new Error("No se pudo leer la grabación."));
          reader.readAsDataURL(audioBlob);
        });
        if (!data) throw new Error("No se pudo preparar la grabación.");
        const model = modules.aiModule.getGenerativeModel(ai, {
          model: MODEL_NAME,
          systemInstruction: "Transcribe fielmente el habla en español. Devuelve solo las palabras pronunciadas, sin explicaciones ni responder la pregunta.",
          generationConfig: { maxOutputTokens: 500, temperature: 0 }
        });
        const result = await model.generateContent([
          "Transcribe esta pregunta en español chileno. Devuelve únicamente la transcripción literal.",
          { inlineData: { data, mimeType } }
        ]);
        const transcript = String(result.response.text() || "").trim().replace(/^['\"“”]+|['\"“”]+$/g, "").slice(0, 1000);
        if (!transcript) throw new Error("No se reconoció ninguna frase. Intenta hablar un poco más cerca del micrófono.");
        return transcript;
      } catch (error) {
        throw new Error(friendlyError(error));
      }
    },
    async askCoach(question, context = {}) {
      const instructions = [
        "Eres la guía personal de TGTrain, enfocada en mejorar el rendimiento para tenis con el perfil y las limitaciones del usuario.",
        "Responde la pregunta concreta en español claro y cercano, usando solo los registros, plan y perfil entregados como datos; distingue hechos, inferencias e información que falta.",
        "Considera las sensaciones, molestias, recuperación y carga. Si hay dolor, no animes a entrenar con dolor ni prometas curarlo. No diagnostiques lesiones; recomienda consultar a un profesional si el dolor es importante, persiste o empeora.",
        "Los datos wearable solo corresponden a una actividad si aparece wearable vinculada a ella. Las kcal activas y LPM de pulsera son estimaciones; no las sumes a las kcal manuales ni deduzcas mejora o lesión por una sola lectura. El sueño y los pasos son contexto, no causas demostradas.",
        "No modifiques registros, rutinas ni planificación. La respuesta es una orientación, no una orden médica. Si el usuario pide cambiar el plan, explica la propuesta y que debe confirmarla por separado.",
        "Sé específico, breve y práctico. Termina con una nota positiva sobria vinculada al tenis o a la recuperación cuando corresponda. No inventes marcas, cargas, ritmos ni fechas."
      ].join("\n");
      const response = await generateJson({
        instructions,
        input: JSON.stringify({ question: String(question || "").trim().slice(0, 1000), context }),
        schema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
        maxOutputTokens: 900
      });
      const answer = String(response.answer || "").trim();
      if (!answer) throw new Error("La guía no pudo preparar una respuesta. Inténtalo otra vez.");
      return { answer, model: MODEL_NAME };
    },
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
        "Para entrenamiento físico usa routineId y exerciseId del catálogo solo si realmente corresponde a una de esas rutinas. Si es una sesión distinta, omite routineId y conserva sus ejercicios, series, repeticiones, cargas y límites en details. Nunca la reemplaces por una rutina parecida.",
        "Para cardio, tenis y descanso usa exclusivamente los identificadores del catálogo. Los campos que no correspondan deben ir vacíos, las distancias desconocidas deben ser null y las listas pueden quedar vacías.",
        "Escribe todo en español claro. No incluyas explicaciones fuera del JSON.",
        "La salida debe ser compacta: título máximo 100 caracteres; subtitle 180; máximo 10 rules y 6 priority; label 80, context y objective 180; summary 140; máximo 5 details de 140 caracteres por opción. Excepción: si la sesión física no corresponde a ninguna rutina del catálogo, conserva sus ejercicios, series, repeticiones y cargas en hasta 12 details de 180 caracteres para que pueda realizarse fielmente.",
        "No repitas reglas generales dentro de semanas, sesiones ni opciones. Pon cada regla transversal una sola vez en rules y conserva en details únicamente la indicación específica necesaria para ejecutar ese día.",
        "Cada semana debe tener un label corto y distintivo según su propósito real, por ejemplo 'Semana de partido', 'Semana de recuperación' o 'Semana de fortalecimiento'. No uses 'Semana 39' como único label.",
        "Omite por completo los campos opcionales que no correspondan. No escribas cadenas vacías, null ni listas vacías salvo options, sessions y weeks. En exerciseSettings incluye solo ejercicios que el plan modifica u omite; no copies la rutina base completa."
      ].join("\n");
      const request = {
        schema: planSchema,
        useResponseSchema: false,
        maxOutputTokens: 20000,
        instructions,
        input: `FECHA ACTUAL EN CHILE: ${currentDate || "no indicada"}\n\nCATÁLOGO VÁLIDO DE TGTRAIN:\n${JSON.stringify(catalog)}\n\nPLAN DEL ENTRENADOR:\n${String(planText || "").slice(0, 50000)}`
      };
      let block;
      try {
        block = await generateJson(request);
      } catch (error) {
        if (error.code !== "invalid-json") throw error;
        block = await generateJson({
          ...request,
          maxOutputTokens: 16000,
          instructions: `${instructions}\nREINTENTO COMPACTO OBLIGATORIO: la respuesta anterior quedó truncada. Reduce aún más el texto sin perder fechas, actividad, alternativas, cargas, series, repeticiones ni límites: máximo 8 reglas, 4 detalles por opción y una frase breve por resumen/objetivo. No repitas información y finaliza el JSON completo.`
        });
      }
      return { block, model: MODEL_NAME };
    },

    async analyzeRoutine(record, recentRecords = [], planDetails = [], context = {}) {
      const withTiming = item => ({ ...item, ...activityTiming(item) });
      const current = withTiming(record);
      const previousComparableActivities = recentRecords.slice(-8).map(withTiming);
      const sameDayActivities = (context.currentPlan?.sameDayActivities || []).map(withTiming);
      const instructions = [
        "Eres la IA entrenadora personal de TGTrain, especializada en rendimiento físico para tenis.",
        "Comenta cualquier actividad recibida: entrenamiento físico, cardio, trote, trekking, pádel, tenis o descanso. La ruta de registro no cambia el análisis.",
        "Lee todas las sensaciones y comentarios del registro actual. Explica qué implican para el avance, la recuperación y la siguiente sesión. Si falta RPE, dolor, técnica o energía, no los inventes ni asumas que están bien.",
        "Si hay wearable vinculado, integra solo sus LPM y kcal activas disponibles con el volumen, series, duración y sensaciones del registro manual. Cita la fuente y distingue kcal activas estimadas de kcal anotadas; jamás las sumes. Si faltan muestras de LPM, dilo sin inventar media ni máxima. No inventes zonas cardíacas ni FC máxima personal.",
        "Compara tendencias de LPM solo entre actividades realmente comparables y con datos suficientes; la FC en fuerza depende también de descansos y condiciones del día. Usa sueño y pasos como contexto de recuperación, no como prueba causal ni diagnóstico. El dolor y las molestias reportadas prevalecen sobre una métrica favorable de la pulsera.",
        "Compara el resultado real con currentPlan cuando exista, incluso si se registró desde Registrar. Distingue entre objetivo planificado y actividad realizada; no afirmes cumplimiento total solo porque coincida el tipo de actividad.",
        "Devuelve planComparison: completed solo si la actividad actual cubre el objetivo previsto con evidencia suficiente; partial si falta parte; adapted si se cambió la rutina, distancia, intensidad o carga y se explica su relación con el objetivo; recovery para descanso sustitutivo; different si no cubre el objetivo; unknown si no hay plan o faltan datos. No confundir descansar con incumplir: puede ser una adaptación responsable, sin afirmar que era el descanso planificado.",
        "En planComparison.reason compara explícitamente plan y realidad: lo que sí se cubrió, qué cambió y qué queda pendiente o no se puede determinar. Considera alternativas y sameDayActivities, sin atribuir sus resultados a la actividad actual ni duplicarlos. Para otra rutina evalúa grupos musculares, habilidades de tenis y recuperación; explica si cubre el objetivo de otra forma, parcialmente o no. Más completa, más carga o más kilómetros no significa automáticamente mejor ni autorizado por el plan.",
        "Para rutina física compara las cargas, series, objetivos de repeticiones/segundos y series realmente completadas por ejercicio con target.settings y las omisiones previstas. Si el plan no especifica una carga, no inventes una carga planificada ni la sustituyas por la sesión actual. Para describir aumentos o reducciones usa también ejecuciones anteriores comparables. No modifiques automáticamente el calendario ni el objetivo original.",
        "En trote analiza distancia, duración y ritmo calculado, compara solo marcas de la misma distancia y considera cansancio, molestias, terreno y comentarios. Respetar un máximo de distancia o intensidad indicado por el plan; no perseguir un récord a costa de la recuperación para tenis.",
        "Los datos de tiempo y ritmo son cálculos de la aplicación: durationSeconds son segundos TOTALES, durationHms es HH:MM:SS y averagePaceFormatted es MINUTOS:SEGUNDOS por kilómetro. Copia exactamente averagePaceFormatted al citar un ritmo; no vuelvas a convertir averagePaceSecondsPerKm ni interpretes un decimal de minutos como segundos. Ejemplo: 5 km en 00:30:56 son 1856 segundos y 6:11 min/km redondeado, NO 3:12. No redondees 30:56 a 31 minutos al describir el registro exacto. No inventes ritmos numéricos previstos ni cites otros ritmos que no estén calculados en las actividades entregadas.",
        "Ritmo conversable es una indicación de intensidad percibida, no un ritmo numérico fijo. Sin una referencia explícita no afirmes que el ritmo por km fue superior al plan; puedes señalar que el usuario reportó esfuerzo alto o molestias, distinguiendo su percepción del ritmo calculado. Si hubo pausas, durationSeconds representa el tiempo que registró el usuario; no inventes tiempo en movimiento, duración de las pausas ni ritmo sin pausas.",
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
        "No diagnostiques lesiones ni presentes una recomendación como orden médica. Responde en español chileno neutro.",
        "Termina el comentario con encouragement: una o dos frases positivas, sobrias y específicas, conectadas con el trabajo registrado y su posible aporte al tenis (resistencia entre puntos, desplazamientos o estabilidad) o a la resistencia cotidiana. No uses elogios exagerados, promesas ni frases vacías. Si hubo molestias, reconoce como avance observarlas y ajustar responsablemente, no el hecho de entrenar con dolor. Nunca digas que un trote doloroso fortalece o cura la rodilla; la mejora depende de una carga tolerable y de atender las molestias. El perfil privado puede orientar el contenido, pero este cierre prudente es obligatorio."
      ].join("\n");
      const request = {
        schema: analysisSchema,
        maxOutputTokens: 4000,
        instructions,
        input: JSON.stringify({
          coachProfileVersion: COACH_PROFILE_VERSION,
          privateCoachProfile: String(context.coachProfile?.profileText || "").slice(0, 40000),
          availableEquipment: String(context.coachProfile?.equipment || DEFAULT_COACH_EQUIPMENT).slice(0, 5000),
          current,
          previousComparableActivities,
          currentPlan: context.currentPlan ? { ...context.currentPlan, sameDayActivities } : null,
          recentTrainingLoad: Array.isArray(context.recentTrainingLoad) ? context.recentTrainingLoad.slice(-20) : [],
          wearableContext: context.wearableContext || null,
          next48Hours: Array.isArray(context.next48Hours) ? context.next48Hours.slice(0, 6) : [],
          planDetails: planDetails.slice(0, 20)
        })
      };
      let analysis = await generateJson(request);
      const sourceActivities = [current, ...previousComparableActivities, ...sameDayActivities];
      try {
        validateAnalysisPaces(analysis, sourceActivities);
      } catch (error) {
        analysis = await generateJson({ ...request, instructions: `${instructions}\nCORRECCIÓN OBLIGATORIA: ${error.message} Ritmo actual exacto: ${current.averagePaceFormatted}. Tiempo actual exacto: ${current.durationHms}.` });
        validateAnalysisPaces(analysis, sourceActivities);
      }
      return { analysis: { ...analysis, profileVersion: COACH_PROFILE_VERSION }, model: MODEL_NAME };
    }
  };
}
