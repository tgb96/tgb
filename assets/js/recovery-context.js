const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALCOHOL_LEVELS = new Set(["low", "moderate", "high", "unknown"]);
const SYMPTOM_LEVELS = new Set(["none", "mild", "strong", "unknown"]);

const validDate = value => ISO_DATE.test(String(value || ""))
  && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

function addDaysISO(dateISO, days) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function wallClockMillis(dateISO, time = "12:00") {
  return Date.parse(`${dateISO}T${CLOCK_TIME.test(time) ? time : "12:00"}:00Z`);
}

function recoveryHoursFor({ alcoholAmount, symptoms, eventDateISO, endDateISO, endTime }) {
  const hour = CLOCK_TIME.test(endTime) ? Number(endTime.slice(0, 2)) : null;
  const endedNextMorning = endDateISO > eventDateISO && hour !== null && hour <= 9;
  const endedVeryLate = endedNextMorning && hour >= 3;
  if (symptoms === "strong" || alcoholAmount === "high") return 48;
  if (alcoholAmount === "moderate") return endedVeryLate ? 48 : 36;
  if (alcoholAmount === "low") return endedVeryLate ? 36 : 24;
  return endedVeryLate ? 48 : 36;
}

export function normalizeRecoveryContext(value) {
  if (!value || typeof value !== "object" || value.kind !== "alcohol") return null;
  const eventDateISO = String(value.eventDateISO || "");
  if (!validDate(eventDateISO)) return null;
  const proposedEndDate = String(value.endDateISO || eventDateISO);
  const endDateISO = validDate(proposedEndDate)
    && proposedEndDate >= eventDateISO
    && proposedEndDate <= addDaysISO(eventDateISO, 1)
    ? proposedEndDate : eventDateISO;
  const endTime = CLOCK_TIME.test(String(value.endTime || "")) ? String(value.endTime) : "";
  const alcoholAmount = ALCOHOL_LEVELS.has(value.alcoholAmount) ? value.alcoholAmount : "unknown";
  const symptoms = SYMPTOM_LEVELS.has(value.symptoms) ? value.symptoms : "unknown";
  const recoveryHours = recoveryHoursFor({ alcoholAmount, symptoms, eventDateISO, endDateISO, endTime });
  const recoveryStart = wallClockMillis(endDateISO, endTime || "12:00");
  const recoveryEndsAt = new Date(recoveryStart + recoveryHours * 60 * 60 * 1000).toISOString().replace(".000Z", "");
  return {
    kind: "alcohol",
    eventDateISO,
    endDateISO,
    endTime,
    alcoholAmount,
    symptoms,
    summary: String(value.summary || "Salida nocturna informada al entrenador.").trim().slice(0, 500),
    recoveryHours,
    recoveryEndsAt
  };
}

const amountLabel = value => ({ low: "poco alcohol", moderate: "consumo moderado", high: "consumo alto", unknown: "cantidad no precisada" })[value] || "cantidad no precisada";

export function recoveryImpactForDate(value, dateISO) {
  const context = normalizeRecoveryContext(value);
  if (!context || !validDate(dateISO)) return null;
  const start = wallClockMillis(context.endDateISO, context.endTime || "12:00");
  const target = wallClockMillis(dateISO, "12:00");
  const elapsedHours = (target - start) / (60 * 60 * 1000);
  if (elapsedHours < 0 || elapsedHours >= context.recoveryHours) return null;
  const endHour = context.endTime ? Number(context.endTime.slice(0, 2)) : null;
  const lateNight = context.endDateISO > context.eventDateISO && endHour !== null && endHour >= 3;
  const recover = context.symptoms === "strong"
    || (elapsedHours < 24 && (context.alcoholAmount === "high" || lateNight));
  return {
    ...context,
    elapsedHours,
    adaptation: recover ? "recover" : "reduce",
    label: recover ? "Recuperación tras salida" : "Entrenar más suave",
    title: recover ? "Prioriza recuperarte antes de exigir" : "Baja la exigencia de la sesión",
    signal: `Salida informada: ${amountLabel(context.alcoholAmount)}${context.endTime ? `, terminó a las ${context.endTime}` : ""}. Contexto activo por ${context.recoveryHours} h.`,
    summary: recover
      ? "No progreses cargas. Si aún tienes malestar, mareos, náuseas o una hidratación claramente insuficiente, descansa; si te sientes normal, limita la sesión a movilidad o trabajo muy suave."
      : "Evita progresar cargas y reduce volumen o intensidad. Usa el calentamiento y tus sensaciones para decidir si continúas, hidrátate con regularidad y prioriza comidas y sueño normales."
  };
}

export function strongestRecoveryImpact(contexts = [], dateISO) {
  const impacts = contexts.map(value => recoveryImpactForDate(value, dateISO)).filter(Boolean);
  return impacts.sort((left, right) => {
    const severity = { recover: 2, reduce: 1 };
    return (severity[right.adaptation] - severity[left.adaptation])
      || String(right.endDateISO).localeCompare(String(left.endDateISO));
  })[0] || null;
}

export function recoveryContextsFromQuestions(questions = []) {
  return questions.map(item => normalizeRecoveryContext(item?.recoveryContext)).filter(Boolean);
}
