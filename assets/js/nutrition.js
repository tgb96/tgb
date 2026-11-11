// Guía orientativa para Tomás: distribuye energía y líquidos según la demanda real del día.
const slot = (id, time, title, options, tip = "") => ({ id, time, title, options, tip });
const breakfast = (options = ["2–3 huevos + pan + fruta", "Yogurt alto en proteína + granola + fruta"], time = "08:00–08:30") =>
  slot("breakfast", time, "Desayuno", [...new Set([...options,
    "Pan integral con jamón y queso", "Yogur + fruta", "Protein+ + pan con jamón, queso o huevo"])]);
const morning = (options = ["Yogurt alto en proteína + fruta", "Protein+ + fruta"]) =>
  slot("morning", "11:00–12:00", "Merienda de mañana", [...new Set([...options,
    "Fruta + 20–30 g de frutos secos", "Pan integral pequeño con jamón y queso", "Fruta + yogurt alto en proteína"])]);
const lunch = (options = ["Pollo o carne + arroz, papas o fideos + verduras"], time = "14:00") =>
  slot("lunch", time, "Almuerzo", options, "Guía de tu plan: aprox. 150–200 g de proteína cruda, 1 taza de arroz/fideos cocidos o 1–2 papas, más verduras.");
const afternoon = (options = ["Fruta + yogurt alto en proteína", "Pan pequeño con huevo, jamón o queso"], time = "17:00–18:00", title = "Merienda de tarde") =>
  slot("afternoon", time, title, options);
const dinner = (options = ["Proteína + carbohidrato + verduras"], time = "20:00", title = "Cena") =>
  slot("dinner", time, title, options);

const physical = (name, detail, extras = {}) => ({
  name, detail,
  fuelFocus: extras.fuelFocus || "Carbohidrato moderado antes y después; proteína repartida durante el día.",
  waterMinMl: extras.waterMinMl ?? 2200, waterMaxMl: extras.waterMaxMl ?? 2800,
  caloriesMinKcal: extras.caloriesMinKcal ?? 2150, caloriesMaxKcal: extras.caloriesMaxKcal ?? 2350,
  slots: [
    breakfast(extras.breakfast), morning(), lunch(extras.lunch),
    slot("pre", "16:45–17:30", "Merienda de tarde · antes del físico", extras.pre || ["Pan + huevo, jamón o queso + fruta", "Yogurt alto en proteína + granola + plátano"]),
    dinner(extras.dinner)
  ],
  hydration: extras.hydration || "Reparte agua desde la mañana; suma 500–750 ml alrededor del entrenamiento y ajusta por sed y calor."
});

const physicalPlans = {
  physical: physical("Entrenamiento físico", "Pauta general cuando la rutina no tiene un foco específico."),
  physicalLegs: physical("Día 1 · Piernas + glúteos + core", "Más combustible alrededor de la sesión para sostener la fuerza y recuperar piernas.", {
    fuelFocus: "Carbohidrato medio-alto en almuerzo y merienda preentreno; proteína en comida y cena.",
    caloriesMinKcal: 2200, caloriesMaxKcal: 2400, waterMinMl: 2300, waterMaxMl: 3000
  }),
  physicalUpper: physical("Día 2 · Tren superior + estabilidad", "Demanda energética moderada: conserva proteína sin sobredimensionar el carbohidrato.", {
    fuelFocus: "Carbohidrato moderado; proteína distribuida para recuperación de hombro, espalda y brazo.",
    caloriesMinKcal: 2100, caloriesMaxKcal: 2300, waterMinMl: 2100, waterMaxMl: 2700,
    dinner: ["Tortilla de 2–3 huevos + pan + tomate", "Pollo o carne + arroz o papas + ensalada"]
  }),
  physicalPower: physical("Día 3 · Potencia + desplazamientos", "La calidad explosiva necesita energía disponible, sin llegar pesado ni acumular fatiga.", {
    fuelFocus: "Carbohidrato medio-alto antes de la sesión y recuperación completa después; evita entrenar con hambre.",
    caloriesMinKcal: 2250, caloriesMaxKcal: 2450, waterMinMl: 2300, waterMaxMl: 3000,
    dinner: ["Pollo o carne + arroz, papas o fideos + verduras"],
    hydration: "Reparte agua durante el día y toma 500–750 ml alrededor del físico. Si compites al día siguiente, llega hidratado sin forzarte a beber de más."
  })
};

const recovery = {
  name: "Día de descanso / recuperación", detail: "Mantén comidas normales y regulares; no necesitas una comida postentrenamiento.",
  fuelFocus: "Proteína y verduras en las comidas principales; carbohidrato moderado según hambre y actividad cotidiana.",
  waterMinMl: 2000, waterMaxMl: 2500, caloriesMinKcal: 2000, caloriesMaxKcal: 2200,
  slots: [
    breakfast(["Huevos, yogurt o Protein+ + pan o fruta"]),
    morning(["Fruta + yogurt", "Fruta + frutos secos"]),
    lunch(["Proteína + carbohidrato moderado + verduras"]),
    afternoon(),
    dinner(["Proteína + verduras + carbohidrato moderado"])
  ],
  hydration: "Agua repartida durante el día, guiándote también por la sed y la temperatura. No necesitas electrolitos por defecto."
};

const softCardio = {
  name: "Cardio", detail: "Intensidad suave: conserva la estructura normal de comidas y ajusta solo si aparece hambre real.",
  fuelFocus: "Carbohidrato moderado; una merienda normal suele bastar para una sesión suave y corta.",
  waterMinMl: 2100, waterMaxMl: 2700, caloriesMinKcal: 2100, caloriesMaxKcal: 2300,
  slots: [breakfast(), morning(), lunch(), afternoon(["Fruta + yogurt alto en proteína", "Pan pequeño + huevo, jamón o queso"], "16:30–18:00", "Merienda de tarde · antes o después del cardio"), dinner()],
  hydration: "Para una sesión suave de menos de 60–90 min suele bastar agua; aumenta según calor, sudor y duración."
};

const moderateCardio = {
  name: "Cardio", detail: "Intensidad moderada: asegura energía antes y una comida normal de recuperación después.",
  fuelFocus: "Carbohidrato moderado antes de la sesión y proteína repartida durante el día.",
  waterMinMl: 2300, waterMaxMl: 3000, caloriesMinKcal: 2200, caloriesMaxKcal: 2450,
  slots: [breakfast(), morning(), lunch(),
    afternoon(["Fruta + yogurt alto en proteína", "Pan + huevo, jamón o queso", "Plátano o barra simple"], "60–90 min antes", "Merienda de tarde · antes del cardio"),
    dinner(["Proteína + arroz, papas o fideos + verduras"], "Después del cardio", "Comida postcardio")],
  hydration: "Reparte agua durante el día y suma 500–750 ml alrededor de la sesión; ajusta por calor, sudor y duración."
};

const highCardio = {
  name: "Cardio", detail: "Intensidad exigente: llega con combustible disponible y recupera carbohidratos, proteína y líquidos al terminar.",
  fuelFocus: "Carbohidrato medio-alto antes y después; evita iniciar con hambre y no omitas la recuperación.",
  waterMinMl: 2500, waterMaxMl: 3300, caloriesMinKcal: 2350, caloriesMaxKcal: 2600,
  slots: [breakfast(), morning(), lunch(),
    slot("pre", "60–90 min antes", "Merienda de tarde · antes del cardio", ["Pan + huevo, jamón o queso + fruta", "Yogurt alto en proteína + granola + plátano"]),
    slot("during", "Durante", "Hidratación", ["Agua", "Electrolitos según calor y sudor", "Carbohidrato simple si supera 60–90 min"], "La comida durante no es obligatoria en sesiones más breves."),
    dinner(["Proteína + arroz, papas o fideos + verduras"], "Dentro de 1–2 h", "Comida postcardio")],
  hydration: "Llega hidratado y lleva agua; usa electrolitos según duración, calor y sudoración."
};

const tennis = {
  name: "Tenis · entrenamiento grupal", detail: "Llega con energía, evita pesadez antes de entrar a cancha y recupera al terminar tarde.",
  fuelFocus: "Carbohidrato alto desde el almuerzo hasta el pretenis; proteína y carbohidrato en la cena postentrenamiento.",
  waterMinMl: 2500, waterMaxMl: 3200, caloriesMinKcal: 2400, caloriesMaxKcal: 2600,
  slots: [
    breakfast(["Yogurt alto en proteína + granola + fruta", "2 huevos + pan + fruta"]),
    morning(["Fruta + 20–30 g de frutos secos", "Protein+ o yogurt alto en proteína"]),
    lunch(["Carne o pollo + arroz, fideos o papas + verduras"]),
    slot("pre", "17:30–18:30", "Merienda de tarde · pretenis", ["Pan + huevo, jamón o queso + fruta", "Yogurt alto en proteína + granola + plátano", "Plato chico de arroz, papas o fideos + pollo"]),
    slot("snack", "19:30–20:00", "Snack opcional", ["Plátano", "Barra de cereal simple", "Fruta", "Galletas de agua"], "Solo si tienes hambre o baja energía."),
    slot("during", "Durante el tenis", "Hidratación en cancha", ["Agua", "Agua con electrolitos si hace calor o sudas mucho", "Carbohidrato simple si la sesión se alarga o es muy intensa"], "No es una comida obligatoria."),
    slot("post", "22:15–22:45", "Cena posttenis", ["Protein+ + sándwich simple", "Yogurt alto en proteína + granola + fruta", "Huevo + pan + tomate", "Pollo + porción moderada de arroz o papas"])
  ],
  hydration: "Llega hidratado y lleva 750 ml–1 L a cancha; ajusta por calor, sudor, intensidad y duración."
};

const tennisLight = {
  name: "Tenis suave sin partido", detail: "Sesión técnica o amistosa de menor carga que el grupal nocturno.",
  fuelFocus: "Carbohidrato moderado antes y después; añade snack solo si la sesión se alarga o llegas con hambre.",
  waterMinMl: 2300, waterMaxMl: 3000, caloriesMinKcal: 2250, caloriesMaxKcal: 2450,
  slots: [breakfast(), morning(), lunch(), afternoon(["Fruta + yogurt", "Pan + huevo, jamón o queso", "Plátano o barra simple"], "60–90 min antes", "Merienda pretenis"),
    slot("during", "Durante", "Hidratación en cancha", ["Agua", "Electrolitos solo si hace calor, sudas mucho o la sesión se prolonga"]),
    dinner(["Proteína + carbohidrato moderado + verduras"], "Después del tenis", "Comida posttenis")],
  hydration: "Lleva agua a cancha; 500–750 ml suele cubrir una sesión suave, pero ajusta por condiciones y sudor."
};

const trekking = {
  name: "Trekking", detail: "La duración, el desnivel y el clima determinan la demanda: prepara, abastece durante y recupera después.",
  fuelFocus: "Ajusta el carbohidrato antes y durante según la duración; combina carbohidrato y proteína al terminar.",
  waterMinMl: 2500, waterMaxMl: 3500, caloriesMinKcal: 2500, caloriesMaxKcal: 2800,
  slots: [
    breakfast(["Huevos + pan + fruta", "Yogurt alto en proteína + granola + fruta"], "2–3 h antes"),
    slot("pre", "30–60 min antes", "Colación previa opcional", ["Plátano", "Barra de cereal simple", "Pan pequeño"], "Úsala si desayunaste temprano o partes con hambre."),
    slot("during", "Durante", "Comida para la ruta", ["Agua", "Fruta o barra simple", "Sándwich pequeño en recorridos largos", "Electrolitos si hace calor o sudas mucho"], "En recorridos de más de 60–90 min conviene llevar una fuente de carbohidrato."),
    slot("post", "Dentro de 1–2 h", "Comida postrekking", ["Pollo, carne o huevos + arroz, papas o fideos + verduras", "Yogurt alto en proteína + fruta y pan si aún falta para la comida principal"]),
    dinner(["Proteína + verduras + carbohidrato según la duración del trekking"])
  ],
  hydration: "Lleva agua suficiente para la ruta y ajusta por duración, calor y sudor; en recorridos largos o calurosos considera electrolitos."
};

const matchBase = {
  fuelFocus: "Carbohidrato alto antes y durante si el partido se prolonga; proteína y carbohidrato para recuperar al terminar.",
  waterMinMl: 2500, waterMaxMl: 3500, caloriesMinKcal: 2500, caloriesMaxKcal: 2750,
  hydration: "Llega hidratado y lleva 750 ml–1 L a cancha; usa electrolitos según calor y sudor, sin obligarte a beber más de lo tolerable."
};
const matchPlans = {
  match: {
    ...matchBase, name: "Día de partido", detail: "Como falta la hora, la pauta usa tiempos relativos al inicio del partido.",
    slots: [breakfast(undefined, "Al comenzar el día"), morning(),
      slot("pre", "2–3 h antes", "Comida prepartido", ["Arroz, papas, fideos o pan + proteína liviana", "Yogurt alto en proteína + granola + fruta"]),
      slot("snack", "30–60 min antes", "Snack opcional", ["Plátano", "Barra simple", "Galletas de agua"], "Solo si tienes hambre o necesitas energía."),
      slot("during", "Durante", "En el partido", ["Agua", "Electrolitos según calor y sudor", "30–60 g de carbohidrato por hora si se prolonga y lo toleras"]),
      slot("post", "Dentro de 1–2 h", "Comida postpartido", ["Proteína + carbohidrato + verduras"])]
  },
  early: {
    ...matchBase, name: "Partido temprano", detail: "Desayuno completo, comida previa fácil de digerir y recuperación sin saltarte el resto del día.",
    slots: [
      breakfast(["Huevos + pan + fruta", "Yogurt alto en proteína + granola + fruta"], "08:00–09:00"),
      slot("pre", "2–3 h antes", "Comida prepartido", ["Pan, arroz, papas o fideos + proteína liviana", "Yogurt alto en proteína + granola + fruta"]),
      slot("snack", "30–60 min antes", "Snack opcional", ["Plátano", "Barra simple", "Galletas de agua"]),
      slot("during", "Durante", "En el partido", ["Agua", "Electrolitos según calor y sudor", "Carbohidrato simple si supera 75–90 min"]),
      slot("post", "Dentro de 1–2 h", "Almuerzo postpartido", ["Pollo o carne + arroz, papas o fideos + verduras"]),
      afternoon(), dinner(["Proteína + verduras + carbohidrato según hambre"])
    ]
  },
  late: {
    ...matchBase, name: "Partido en la tarde", detail: "Sostén energía durante el día y llega liviano, sin transformar el almuerzo en una comida pesada.",
    slots: [breakfast(undefined, "08:00–08:30"), morning(), lunch(["Pollo o carne magra + arroz, papas o fideos + verduras cocidas o toleradas"], "3–4 h antes"),
      slot("pre", "60–90 min antes", "Snack prepartido", ["Plátano", "Barra simple", "Pan pequeño", "Yogurt"]),
      slot("during", "Durante", "En el partido", ["Agua", "Electrolitos según calor y sudor", "Carbohidrato simple si se prolonga"]),
      slot("post", "Dentro de 1–2 h", "Cena postpartido", ["Proteína + carbohidrato + verduras"])
    ]
  }
};

const other = {
  name: "Día normal / otra actividad", detail: "Pauta neutra cuando la actividad no encaja en los escenarios deportivos específicos.",
  fuelFocus: "Comidas regulares, proteína distribuida y carbohidrato moderado según hambre y movimiento del día.",
  waterMinMl: 2000, waterMaxMl: 2500, caloriesMinKcal: 2100, caloriesMaxKcal: 2300,
  slots: [breakfast(), morning(), lunch(), afternoon(), dinner(["Cena con proteína + verduras + carbohidrato según apetito"])],
  hydration: "Agua repartida durante el día; ajusta por sed, temperatura y cualquier actividad no planificada."
};

const week = [recovery, physicalPlans.physicalLegs, tennis, physicalPlans.physicalUpper, tennis, physicalPlans.physicalPower, other];

export const nutritionModes = ["default", "physical", "physicalLegs", "physicalUpper", "physicalPower", "tennis", "recovery", "match", "early", "late", "other", "tennisLight", "trekking", "cardioSoft", "cardio", "cardioHigh"];

function primaryPlannedOption(session) {
  return session?.options?.find(option => option.id === session.primaryOptionId) || session?.options?.[0] || null;
}

export function plannedActivityTime(session) {
  const option = primaryPlannedOption(session);
  const explicit = String(session?.startTime || option?.startTime || "").trim();
  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(explicit)) return explicit;
  const source = [option?.title, option?.summary, session?.objective, ...(option?.details || [])].join(" ");
  return source.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0]?.padStart(5, "0") || "";
}

export function nutritionModeForPhysicalRoutine(routineId) {
  const id = String(routineId || "");
  if (id === "legs") return "physicalLegs";
  if (["upper", "right-upper-maintenance"].includes(id)) return "physicalUpper";
  if (["agility", "indoor-power", "deceleration-direction"].includes(id)) return "physicalPower";
  if (id === "mobility-recovery") return "recovery";
  return "physical";
}

export function nutritionModeForPlannedSession(session) {
  const option = primaryPlannedOption(session);
  if (!option) return "";
  if (option.category === "rest") return "recovery";
  if (option.category === "physical") return nutritionModeForPhysicalRoutine(option.prefill?.routineId);
  if (option.category === "cardio") {
    if (option.prefill?.cardioTypeId === "trekking") return "trekking";
    if (option.prefill?.cardioIntensity === "high") return "cardioHigh";
    if (option.prefill?.cardioIntensity === "low") return "cardioSoft";
    return "cardio";
  }
  if (option.category !== "tennis") return "";
  if (option.prefill?.tennisTypeId !== "match") return new Date(`${session.dateISO}T12:00:00Z`).getUTCDay() === 6 ? "tennisLight" : "tennis";
  const time = plannedActivityTime(session);
  if (!time) return "match";
  return Number(time.slice(0, 2)) < 16 ? "early" : "late";
}

export function plannedNutritionContext(session) {
  const option = primaryPlannedOption(session);
  if (!option) return null;
  return { mode: nutritionModeForPlannedSession(session), title: option.title, summary: option.summary, time: plannedActivityTime(session), category: option.category,
    isMatch: option.category === "tennis" && option.prefill?.tennisTypeId === "match" };
}

export function nutritionPlanForDate(dateISO, mode = "default") {
  const day = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  if (!Number.isFinite(day)) return null;
  if (physicalPlans[mode]) return physicalPlans[mode];
  if (mode === "tennis") return tennis;
  if (mode === "recovery") return recovery;
  if (mode === "cardioSoft") return softCardio;
  if (mode === "cardio") return moderateCardio;
  if (mode === "cardioHigh") return highCardio;
  if (mode === "tennisLight") return tennisLight;
  if (mode === "trekking") return trekking;
  if (["match", "early", "late"].includes(mode)) return matchPlans[mode];
  if (mode === "other") return other;
  return week[day];
}

export function normalizeNutritionEntries(value) {
  const entries = Array.isArray(value) ? value : Object.values(value || {});
  const insightKinds = ["nutrition-analysis", "monthly-summary", "daily-coach", "weekly-review"];
  const supplementIds = ["creatine", "centrum-men", "omega-3", "minoxidil"];
  return Object.fromEntries(entries.flatMap(item => {
    const id = String(item?.id || "").slice(0, 120);
    const dateISO = String(item?.dateISO || "");
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return [];
    const parsedDate = new Date(`${dateISO}T12:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateISO) return [];
    const kind = ["meal", "water", "plan", "supplement", ...insightKinds].includes(item?.kind) ? item.kind : "meal";
    const planMode = kind === "plan" ? String(item?.planMode || "default") : "";
    if (kind === "plan" && !nutritionModes.includes(planMode)) return [];
    const amountMl = kind === "water" ? Number(item?.amountMl) : 0;
    if (kind === "water" && (!Number.isInteger(amountMl) || amountMl < 1 || amountMl > 3000)) return [];
    const supplementId = kind === "supplement" && supplementIds.includes(item?.supplementId) ? item.supplementId : "";
    if (kind === "supplement" && !supplementId) return [];
    const text = String(item?.text || "").trim().slice(0, 1000);
    if (kind === "meal" && !text) return [];
    if (insightKinds.includes(kind) && !String(item?.summary || "").trim()) return [];
    const parts = Object.fromEntries(Object.entries(item?.parts && typeof item.parts === "object" && !Array.isArray(item.parts) ? item.parts : {})
      .filter(([id, count]) => /^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(id) && Number.isFinite(Number(count)) && Number(count) >= 0.5 && Number(count) <= 99 && Number.isInteger(Number(count) * 2))
      .map(([id, count]) => [id, Number(count)])
      .slice(0, 50));
    const optional = key => item?.[key] === "" || item?.[key] == null ? null : Number(item[key]);
    const metrics = Object.fromEntries(["caloriesKcal", "proteinG", "carbsG", "fatG"].map(key => [key, kind === "meal" ? optional(key) : null]));
    if (Object.values(metrics).some(n => n !== null && (!Number.isFinite(n) || n < 0 || n > 10000))) return [];
    const sections = insightKinds.includes(kind)
      ? (Array.isArray(item?.sections) ? item.sections : []).slice(0, 6).map(section => ({
          title: String(section?.title || "").trim().slice(0, 120),
          items: (Array.isArray(section?.items) ? section.items : []).slice(0, 8)
            .map(value => String(value || "").trim().slice(0, 500)).filter(Boolean)
        })).filter(section => section.title && section.items.length)
      : [];
    const rawStats = item?.stats && typeof item.stats === "object" && !Array.isArray(item.stats) ? item.stats : {};
    const stats = Object.fromEntries(Object.entries(rawStats).slice(0, 30).flatMap(([key, value]) => {
      if (!/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key)) return [];
      if (typeof value === "number" && Number.isFinite(value)) return [[key, value]];
      if (typeof value === "string") return [[key, value.slice(0, 200)]];
      return [];
    }));
    return [[id, { id, dateISO, kind, slotId: kind === "meal" ? String(item?.slotId || "other").slice(0, 40) : "",
      time: String(item?.time || "").slice(0, 5), text, note: kind === "meal" ? String(item?.note || "").trim().slice(0, 1000) : "",
      parts: kind === "meal" ? parts : {}, estimateSource: kind === "meal" && ["label", "generic", "manual", "ai-photo", "ai-description", "ai-photo-description"].includes(item?.estimateSource) ? item.estimateSource : "",
      amountMl, planMode, ...metrics,
      supplementId,
      supplementName: kind === "supplement" ? String(item?.supplementName || "").trim().slice(0, 100) : "",
      doseLabel: kind === "supplement" ? String(item?.doseLabel || "").trim().slice(0, 100) : "",
      title: insightKinds.includes(kind) ? String(item?.title || "Comentario del entrenador").trim().slice(0, 200) : "",
      summary: insightKinds.includes(kind) ? String(item?.summary || "").trim().slice(0, 3000) : "",
      sections,
      encouragement: insightKinds.includes(kind) ? String(item?.encouragement || "").trim().slice(0, 1000) : "",
      stats,
      periodStartISO: String(item?.periodStartISO || "").slice(0, 10), periodEndISO: String(item?.periodEndISO || "").slice(0, 10),
      sourceUpdatedAt: String(item?.sourceUpdatedAt || ""), generatedAt: String(item?.generatedAt || ""), model: String(item?.model || "").slice(0, 100),
      deleted: Boolean(item?.deleted), createdAt: String(item?.createdAt || ""), updatedAt: String(item?.updatedAt || item?.createdAt || "") }]];
  }));
}

export function nutritionDayTotals(entries) {
  const live = entries.filter(item => !item.deleted);
  const meals = live.filter(item => item.kind === "meal");
  const sum = key => meals.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  return { meals: meals.length, waterMl: live.filter(item => item.kind === "water").reduce((n, item) => n + item.amountMl, 0),
    caloriesKcal: sum("caloriesKcal"), proteinG: sum("proteinG"), carbsG: sum("carbsG"), fatG: sum("fatG"),
    caloriesKnownMeals: meals.filter(item => item.caloriesKcal !== null).length,
    proteinKnownMeals: meals.filter(item => item.proteinG !== null).length,
    mealsWithMacros: meals.filter(item => item.proteinG !== null || item.caloriesKcal !== null || item.carbsG !== null || item.fatG !== null).length };
}
