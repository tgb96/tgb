import { firebaseConfig, firebaseConfigured } from "./firebase-config.js?v=35";
import { cardioTypes, physicalRoutines, restTypes, tennisTypes } from "./data.js?v=43";

const FIREBASE_VERSION = "12.18.0";
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

function friendlyError(error) {
  const code = String(error?.code || "");
  if (code.includes("unauthenticated")) return "Inicia sesión con Google para usar GPT.";
  if (code.includes("permission-denied")) return "Tu cuenta todavía no está autorizada para usar GPT en TGTrain.";
  if (code.includes("resource-exhausted")) return "Se alcanzó el límite temporal de análisis. Inténtalo más tarde.";
  if (code.includes("deadline-exceeded")) return "GPT tardó demasiado en responder. Vuelve a intentarlo.";
  if (code.includes("not-found") || code.includes("internal")) return "La función inteligente todavía no está disponible o no pudo responder.";
  return error?.message || "No fue posible completar el análisis con GPT.";
}

export function createAiClient() {
  let modules = null;
  let functions = null;

  async function initialize() {
    if (functions) return functions;
    if (!firebaseConfigured) throw new Error("Primero configura la conexión de TGTrain con Firebase.");
    const [appModule, authModule, functionsModule] = await Promise.all([
      import(`${FIREBASE_BASE}/firebase-app.js`),
      import(`${FIREBASE_BASE}/firebase-auth.js`),
      import(`${FIREBASE_BASE}/firebase-functions.js`)
    ]);
    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
    modules = { authModule, functionsModule };
    functions = functionsModule.getFunctions(app, "us-central1");
    return functions;
  }

  async function call(name, payload) {
    try {
      await initialize();
      const auth = modules.authModule.getAuth();
      if (!auth.currentUser) throw Object.assign(new Error("Inicia sesión con Google para usar GPT."), { code: "unauthenticated" });
      const callable = modules.functionsModule.httpsCallable(functions, name, { timeout: 120000 });
      const result = await callable(payload);
      return result.data;
    } catch (error) {
      throw new Error(friendlyError(error));
    }
  }

  return {
    importTrainingPlan(planText, currentDate = "") {
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
      return call("importTrainingPlan", { planText, catalog, currentDate, locale: "es-CL", timezone: "America/Santiago" });
    },
    analyzeRoutine(record, recentRecords = [], planDetails = []) {
      return call("analyzeRoutine", { record, recentRecords, planDetails, locale: "es-CL" });
    }
  };
}
