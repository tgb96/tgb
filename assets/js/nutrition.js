// Guía entregada por el entrenador de Tomás. Es una plantilla, no una medición.
const slot = (id, time, title, options, tip = "") => ({ id, time, title, options, tip });
const breakfast = (options = ["2–3 huevos + pan + fruta", "Yogurt alto en proteína + granola + fruta"], time = "08:00–08:30") =>
  slot("breakfast", time, "Desayuno", [...new Set([...options,
    "Pan integral con jamón y queso", "Avena + leche + fruta", "Protein+ + pan con jamón, queso o huevo"])]);
const morning = (options = ["Yogurt alto en proteína + fruta", "Protein+ + fruta"]) =>
  slot("morning", "11:00–12:00", "Merienda de mañana", [...new Set([...options,
    "Fruta + 20–30 g de frutos secos", "Pan integral pequeño con jamón y queso", "Fruta + yogurt alto en proteína"])]);
const lunch = (options = ["Pollo o carne + arroz, papas o fideos + verduras"]) =>
  slot("lunch", "14:00", "Almuerzo", options, "Guía de tu plan: aprox. 150–200 g de proteína cruda, 1 taza de arroz/fideos cocidos o 1–2 papas, más verduras.");
const dinner = (options = ["Proteína + carbohidrato + verduras"]) =>
  slot("dinner", "20:00", "Cena", options);

const physical = (name, detail, extras = {}) => ({
  name, detail, waterMinMl: 2000, waterMaxMl: 2500,
  slots: [
    breakfast(extras.breakfast), morning(), lunch(extras.lunch),
    slot("pre", "16:45–17:30", "Merienda de tarde · antes del físico", ["Pan + huevo, jamón o queso + fruta", "Yogurt alto en proteína + granola + plátano"]),
    dinner(extras.dinner)
  ],
  hydration: extras.hydration || "Mañana 500 ml · mediodía/tarde 1 L · durante el físico 500–750 ml · noche 500 ml."
});

const tennis = {
  name: "Día de tenis", detail: "Llegar con energía sin sentirse pesado; recuperar después.", waterMinMl: 2500, waterMaxMl: 3000,
  slots: [
    breakfast(["Yogurt alto en proteína + granola + fruta", "2 huevos + pan + fruta"]),
    morning(["Fruta + 20–30 g de frutos secos", "Protein+ o yogurt alto en proteína"]),
    lunch(["Carne o pollo + arroz, fideos o papas + verduras"]),
    slot("pre", "17:30–18:30", "Merienda de tarde · pre-tenis", ["Pan + huevo, jamón o queso + fruta", "Yogurt alto en proteína + granola + plátano", "Plato chico de arroz, papas o fideos + pollo"]),
    slot("snack", "19:30–20:00", "Snack opcional", ["Plátano", "Barra de cereal simple", "Fruta", "Galletas de agua con miel o mermelada"], "Solo si tienes hambre o baja energía."),
    slot("post", "22:15–22:45", "Cena post-tenis", ["Protein+ + sándwich simple", "Yogurt alto en proteína + granola + fruta", "Huevo + pan + tomate", "Pollo + porción moderada de arroz o papas"])
  ],
  hydration: "Mañana 500 ml · hasta almuerzo 500 ml · tarde 750 ml · durante tenis 750 ml–1 L · después 300–500 ml."
};

const saturdayPlans = {
  early: {
    name: "Escenario: partido temprano (ej. 13:45)", detail: "Es solo un ejemplo del plan del entrenador, no un partido programado. Ajusta los horarios reales si lo eliges.", waterMinMl: 2500, waterMaxMl: 3000,
    slots: [
      breakfast(["Huevos + pan + fruta", "Yogurt alto en proteína + granola + fruta"], "08:30–09:30"),
      slot("pre", "11:45–12:30", "Prepartido", ["Plátano", "Pan con miel o mermelada", "Barra simple"]),
      slot("during", "Durante", "En el partido", ["Agua y electrolitos según tu plan", "Si dura más de 75–90 min: plátano o barra simple"]),
      slot("post", "Después", "Comida postpartido", ["Proteína + carbohidrato + verduras"])
    ], hydration: "Tu plan propone aprox. 1 L con electrolitos durante el partido; ajusta según condiciones y tolerancia."
  },
  late: {
    name: "Escenario: partido tarde (ej. 17:15)", detail: "Es solo un ejemplo del plan del entrenador, no un partido programado. Ajusta los horarios reales si lo eliges.", waterMinMl: 2500, waterMaxMl: 3000,
    slots: [breakfast(undefined, "08:30"), morning(), lunch(),
      slot("pre", "16:00", "Snack prepartido", ["Plátano", "Barra simple", "Pan con miel o mermelada", "Yogurt"]),
      slot("during", "Durante", "En el partido", ["Agua y electrolitos según tu plan"]),
      dinner(["Proteína + carbohidrato moderado"])
    ], hydration: "Tu plan propone aprox. 1 L con electrolitos durante el partido; ajusta según condiciones y tolerancia."
  },
  other: {
    name: "Sin partido · trekking o cardio", detail: "Comidas habituales y más atención al agua si caminas mucho.", waterMinMl: 2500, waterMaxMl: 3000,
    slots: [breakfast(), morning(), lunch(), dinner(["Cena con proteína + verduras + carbohidrato según apetito"])],
    hydration: "Si hay trekking largo o mucho calor, tu plan contempla más agua y electrolitos."
  }
};

const week = [
  { name: "Recuperación y cardio suave", detail: "Comer normal y recuperar.", waterMinMl: 2000, waterMaxMl: 2500,
    slots: [breakfast(["Huevos, yogurt o Protein+ + pan, avena o fruta"]), morning(["Fruta + yogurt", "Fruta + frutos secos"]), lunch(["Proteína + carbohidrato moderado + verduras"]),
      slot("post", "Después del cardio", "Si fue trekking largo", ["Protein+ o yogurt + fruta"], "Si el cardio fue suave, basta con la comida normal."),
      dinner(["Proteína + verduras + carbohidrato moderado"])],
    hydration: "Si haces trekking largo, tu plan sugiere 2,5–3 L y considerar electrolitos." },
  physical("Día 1 · fuerza de piernas", "Energía para piernas y recuperación."),
  tennis,
  physical("Día 2 · tren superior", "Estabilidad sin llegar con hambre ni pesado.", { dinner: ["Tortilla de 2–3 huevos + pan + tomate", "Pollo o carne + arroz o papas + ensalada"] }),
  tennis,
  physical("Día 3 · potencia", "Preparar el sábado si hay partido.", { dinner: ["Pollo o carne + arroz, papas o fideos + verduras"],
    hydration: "Si hay partido el sábado, tu plan agrega aprox. 500 ml en la tarde/noche. Durante el físico: 500–750 ml." }),
  saturdayPlans.other
];

export const nutritionModes = ["default", "physical", "tennis", "recovery", "early", "late", "other"];

export function nutritionPlanForDate(dateISO, mode = "default") {
  const day = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  if (!Number.isFinite(day)) return null;
  if (mode === "physical") return physical("Día de entrenamiento físico", "Comer antes y recuperar después.");
  if (mode === "tennis") return tennis;
  if (mode === "recovery") return week[0];
  if (mode === "early" || mode === "late" || mode === "other") return saturdayPlans[mode];
  return day === 6 ? saturdayPlans.other : week[day];
}

export function normalizeNutritionEntries(value) {
  const entries = Array.isArray(value) ? value : Object.values(value || {});
  return Object.fromEntries(entries.flatMap(item => {
    const id = String(item?.id || "").slice(0, 120);
    const dateISO = String(item?.dateISO || "");
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return [];
    const parsedDate = new Date(`${dateISO}T12:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateISO) return [];
    const kind = ["meal", "water", "plan"].includes(item?.kind) ? item.kind : "meal";
    const planMode = kind === "plan" ? String(item?.planMode || "default") : "";
    if (kind === "plan" && !nutritionModes.includes(planMode)) return [];
    const amountMl = kind === "water" ? Number(item?.amountMl) : 0;
    if (kind === "water" && (!Number.isInteger(amountMl) || amountMl < 1 || amountMl > 3000)) return [];
    const text = String(item?.text || "").trim().slice(0, 1000);
    if (kind === "meal" && !text) return [];
    const parts = Object.fromEntries(Object.entries(item?.parts && typeof item.parts === "object" && !Array.isArray(item.parts) ? item.parts : {})
      .filter(([id, count]) => /^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(id) && Number.isInteger(count) && count >= 1 && count <= 99)
      .slice(0, 50));
    const optional = key => item?.[key] === "" || item?.[key] == null ? null : Number(item[key]);
    const metrics = Object.fromEntries(["caloriesKcal", "proteinG", "carbsG", "fatG"].map(key => [key, kind === "meal" ? optional(key) : null]));
    if (Object.values(metrics).some(n => n !== null && (!Number.isFinite(n) || n < 0 || n > 10000))) return [];
    return [[id, { id, dateISO, kind, slotId: kind === "meal" ? String(item?.slotId || "other").slice(0, 40) : "",
      time: String(item?.time || "").slice(0, 5), text, note: kind === "meal" ? String(item?.note || "").trim().slice(0, 1000) : "",
      parts: kind === "meal" ? parts : {}, estimateSource: kind === "meal" && ["label", "generic", "manual"].includes(item?.estimateSource) ? item.estimateSource : "",
      amountMl, planMode, ...metrics,
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
