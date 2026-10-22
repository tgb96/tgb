import { strongestRecoveryImpact } from "./recovery-context.js?v=100";

const dateValue = value => Date.parse(`${value}T12:00:00Z`);
const daysBetween = (from, to) => Math.round((dateValue(to) - dateValue(from)) / 86400000);
const durationMinutes = record => Math.round((Number(record?.durationSeconds) || Number(record?.durationMinutes) * 60 || 0) / 60);
const painScore = record => Math.max(Number(record?.routinePain) || 0, Number(record?.guidedPainScore) || 0);

export function dailyBrief({ dateISO, planTitle = "", planCategory = "", matchWithinDays = null, records = [], wearableDays = [], nutritionEntries = [], recoveryContexts = [] } = {}) {
  const recent = records.filter(record => {
    const age = daysBetween(record.dateISO, dateISO);
    return age >= 0 && age <= 3 && !["warmup", "stretching"].includes(record.category);
  });
  const todayRecords = recent.filter(record => record.dateISO === dateISO);
  const recentLoadMinutes = recent.reduce((total, record) => total + durationMinutes(record), 0);
  const recentMainSessions = recent.filter(record => !["rest", "warmup", "stretching"].includes(record.category));
  const demandingSessions = recentMainSessions.filter(record => Number(record.routineEffort) >= 8 || durationMinutes(record) >= 90);
  const highestPain = recent.reduce((value, record) => Math.max(value, painScore(record)), 0);
  const sleep = wearableDays.filter(day => {
    const age = daysBetween(day.dateISO, dateISO);
    return age >= 0 && age <= 1 && Number(day.sleepMinutes) > 0;
  }).sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))[0] || null;
  const todayNutrition = nutritionEntries.filter(entry => entry.dateISO === dateISO && !entry.deleted);
  const meals = todayNutrition.filter(entry => entry.kind === "meal").length;
  const waterMl = todayNutrition.filter(entry => entry.kind === "water")
    .reduce((total, entry) => total + (Number(entry.amountMl) || 0), 0);
  const recovery = strongestRecoveryImpact(recoveryContexts, dateISO);

  let tone = "neutral";
  let label = "Contexto parcial";
  let title = "Mantén el plan previsto";
  const signals = [];

  if (highestPain >= 5) {
    tone = "recover";
    label = "Priorizar recuperación";
    title = "Cambia carga por recuperación";
    signals.push(`Se registró dolor ${highestPain}/10 recientemente; conviene revisar la sesión antes de cargar.`);
  } else if (highestPain >= 3) {
    tone = "caution";
    label = "Entrenar con cautela";
    title = "Reduce la exigencia de hoy";
    signals.push(`La molestia reciente llegó a ${highestPain}/10; evita progresar carga sin reevaluarla.`);
  }

  if (sleep) {
    const minutes = Number(sleep.sleepMinutes);
    const formatted = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
    signals.push(`Sueño compartido por la pulsera: ${formatted}.`);
    if (minutes < 300 && tone !== "recover") {
      tone = "recover";
      label = "Priorizar recuperación";
      title = "Recupera antes de exigir más";
    } else if (minutes < 360 && tone !== "recover") {
      tone = "caution";
      label = "Regular la exigencia";
      title = "Reduce la exigencia de hoy";
    } else if (minutes >= 420 && tone === "neutral") {
      tone = "ready";
      label = "Sin alertas registradas";
    }
  } else {
    signals.push("La pulsera todavía no compartió sueño reciente; la recuperación queda parcialmente evaluada.");
  }

  if (tone !== "recover" && (recentLoadMinutes >= 240 || demandingSessions.length >= 3)) {
    tone = "caution";
    label = "Carga reciente alta";
    title = "Conserva el objetivo y baja volumen";
  }
  if (recovery && highestPain < 5) {
    if (recovery.adaptation === "recover") {
      tone = "recover";
      label = recovery.label;
      title = recovery.title;
    } else if (tone !== "recover") {
      tone = "caution";
      label = recovery.label;
      title = recovery.title;
    }
    signals.unshift(recovery.signal);
  }
  if (matchWithinDays !== null && matchWithinDays >= 0 && matchWithinDays <= 2 && ["neutral", "ready"].includes(tone)) {
    tone = "neutral";
    label = "Proteger el próximo partido";
    title = "Mantén frescura para competir";
  }
  if (planTitle) signals.unshift(`Plan previsto: ${planTitle}.`);
  if (recentLoadMinutes) signals.push(`${recentLoadMinutes} min de actividad principal registrados en los últimos 4 días.`);
  if (todayRecords.length) signals.push(`${todayRecords.length} actividad${todayRecords.length === 1 ? "" : "es"} principal${todayRecords.length === 1 ? "" : "es"} registrada${todayRecords.length === 1 ? "" : "s"} hoy.`);
  if (meals || waterMl) signals.push(`Nutrición de hoy: ${meals} comida${meals === 1 ? "" : "s"} y ${(waterMl / 1000).toLocaleString("es-CL")} L de agua anotados.`);

  const summary = recovery && highestPain < 5
    ? recovery.summary
    : tone === "recover"
    ? "No progreses cargas hoy. Prefiere descanso, movilidad suave o una alternativa sin dolor y vuelve a evaluar tus sensaciones."
    : tone === "caution"
      ? planCategory === "physical"
        ? "Mantén los ejercicios, pero evita subir peso y reduce una serie en los movimientos principales si la fatiga aparece en el calentamiento."
        : planCategory === "tennis"
          ? "Mantén el trabajo técnico, acorta los bloques exigentes y evita perseguir intensidad si las piernas no responden bien."
          : "Conserva el objetivo del día, pero reduce duración o intensidad y no añadas carga extra."
      : tone === "ready"
        ? "No aparecen alertas en los datos disponibles. Realiza el plan y decide cualquier progresión solo después de comprobar la técnica."
        : "Mantén el plan previsto y usa el calentamiento para confirmar la carga; los datos disponibles no justifican aumentarla automáticamente.";

  return {
    tone, label, title, summary, signals: signals.slice(0, 3), meals, waterMl,
    hasTodayActivity: todayRecords.length > 0,
    adaptation: tone === "recover" ? "recover" : tone === "caution" ? "reduce" : "maintain",
    recentLoadMinutes,
    demandingSessions: demandingSessions.length,
    recoveryContext: recovery
  };
}

export function rollingFourWeekSummary(records = [], nutritionEntries = [], wearableDays = [], dateISO) {
  const inWindow = value => {
    const age = daysBetween(value, dateISO);
    return age >= 0 && age < 28;
  };
  const training = records.filter(record => inWindow(record.dateISO) && !["warmup", "stretching", "rest"].includes(record.category));
  const nutrition = nutritionEntries.filter(entry => inWindow(entry.dateISO) && !entry.deleted);
  const sleep = wearableDays.filter(day => inWindow(day.dateISO) && Number(day.sleepMinutes) > 0);
  const activeDates = new Set(training.map(record => record.dateISO));
  const tennis = training.filter(record => record.category === "tennis");
  const physical = training.filter(record => record.category === "physical");
  const painRecords = records.filter(record => inWindow(record.dateISO) && painScore(record) > 0);
  return {
    sessions: training.length,
    activeDays: activeDates.size,
    minutes: training.reduce((total, record) => total + durationMinutes(record), 0),
    tennisSessions: tennis.length,
    physicalSessions: physical.length,
    nutritionDays: new Set(nutrition.filter(entry => entry.kind === "meal").map(entry => entry.dateISO)).size,
    sleepDays: sleep.length,
    averageSleepMinutes: sleep.length ? Math.round(sleep.reduce((total, day) => total + Number(day.sleepMinutes), 0) / sleep.length) : 0,
    painDays: new Set(painRecords.map(record => record.dateISO)).size
  };
}
