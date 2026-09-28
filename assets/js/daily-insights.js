const dateValue = value => Date.parse(`${value}T12:00:00Z`);
const daysBetween = (from, to) => Math.round((dateValue(to) - dateValue(from)) / 86400000);
const durationMinutes = record => Math.round((Number(record?.durationSeconds) || Number(record?.durationMinutes) * 60 || 0) / 60);
const painScore = record => Math.max(Number(record?.routinePain) || 0, Number(record?.guidedPainScore) || 0);

export function dailyBrief({ dateISO, planTitle = "", records = [], wearableDays = [], nutritionEntries = [] } = {}) {
  const recent = records.filter(record => {
    const age = daysBetween(record.dateISO, dateISO);
    return age >= 0 && age <= 3 && !["warmup", "stretching"].includes(record.category);
  });
  const todayRecords = recent.filter(record => record.dateISO === dateISO);
  const recentLoadMinutes = recent.reduce((total, record) => total + durationMinutes(record), 0);
  const highestPain = recent.reduce((value, record) => Math.max(value, painScore(record)), 0);
  const sleep = wearableDays.filter(day => {
    const age = daysBetween(day.dateISO, dateISO);
    return age >= 0 && age <= 1 && Number(day.sleepMinutes) > 0;
  }).sort((a, b) => String(b.dateISO).localeCompare(String(a.dateISO)))[0] || null;
  const todayNutrition = nutritionEntries.filter(entry => entry.dateISO === dateISO && !entry.deleted);
  const meals = todayNutrition.filter(entry => entry.kind === "meal").length;
  const waterMl = todayNutrition.filter(entry => entry.kind === "water")
    .reduce((total, entry) => total + (Number(entry.amountMl) || 0), 0);

  let tone = "neutral";
  let label = "Contexto parcial";
  let title = planTitle ? `Hoy: ${planTitle}` : "Organiza tu día de entrenamiento";
  const signals = [];

  if (highestPain >= 5) {
    tone = "recover";
    label = "Priorizar recuperación";
    signals.push(`Se registró dolor ${highestPain}/10 recientemente; conviene revisar la sesión antes de cargar.`);
  } else if (highestPain >= 3) {
    tone = "caution";
    label = "Entrenar con cautela";
    signals.push(`La molestia reciente llegó a ${highestPain}/10; evita progresar carga sin reevaluarla.`);
  }

  if (sleep) {
    const minutes = Number(sleep.sleepMinutes);
    const formatted = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
    signals.push(`Sueño compartido por la pulsera: ${formatted}.`);
    if (minutes < 360 && tone !== "recover") {
      tone = "caution";
      label = "Regular la exigencia";
    } else if (minutes >= 420 && tone === "neutral") {
      tone = "ready";
      label = "Sin alertas registradas";
    }
  } else {
    signals.push("La pulsera todavía no compartió sueño reciente; la recuperación queda parcialmente evaluada.");
  }

  if (recentLoadMinutes) signals.push(`${recentLoadMinutes} min de actividad principal registrados en los últimos 4 días.`);
  if (todayRecords.length) signals.push(`${todayRecords.length} actividad${todayRecords.length === 1 ? "" : "es"} principal${todayRecords.length === 1 ? "" : "es"} registrada${todayRecords.length === 1 ? "" : "s"} hoy.`);
  if (meals || waterMl) signals.push(`Nutrición de hoy: ${meals} comida${meals === 1 ? "" : "s"} y ${(waterMl / 1000).toLocaleString("es-CL")} L de agua anotados.`);

  const summary = tone === "recover"
    ? "Tus propios registros indican que la recuperación debe pesar más que completar el plan exactamente."
    : tone === "caution"
      ? "Puedes mantener el objetivo del día, ajustando volumen o intensidad según tus sensaciones reales."
      : tone === "ready"
        ? "No aparecen alertas en los datos disponibles. Usa igualmente tus sensaciones al comenzar."
        : "TGTrain combinará el plan con lo que registres hoy; faltan datos para afirmar cómo está tu recuperación.";

  return { tone, label, title, summary, signals: signals.slice(0, 3), meals, waterMl, hasTodayActivity: todayRecords.length > 0 };
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
