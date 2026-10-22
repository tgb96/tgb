import test from "node:test";
import assert from "node:assert/strict";
import { dailyBrief, rollingFourWeekSummary } from "../assets/js/daily-insights.js";

test("el centro diario prioriza dolor reciente sobre métricas favorables", () => {
  const brief = dailyBrief({
    dateISO: "2026-09-28",
    planTitle: "Tren superior",
    planCategory: "physical",
    records: [{ dateISO: "2026-09-27", category: "tennis", durationMinutes: 90, routinePain: 6 }],
    wearableDays: [{ dateISO: "2026-09-28", sleepMinutes: 480 }],
    nutritionEntries: []
  });
  assert.equal(brief.tone, "recover");
  assert.equal(brief.adaptation, "recover");
  assert.match(brief.title, /recuperación/i);
  assert.match(brief.signals.join(" "), /Tren superior/);
  assert.match(brief.signals.join(" "), /dolor 6\/10/);
});

test("el centro diario reduce volumen cuando se acumulan sesiones exigentes", () => {
  const brief = dailyBrief({
    dateISO: "2026-09-28",
    planTitle: "Día 2 · Tren superior",
    planCategory: "physical",
    records: [
      { dateISO: "2026-09-26", category: "tennis", durationMinutes: 100 },
      { dateISO: "2026-09-27", category: "physical", durationMinutes: 80, routineEffort: 8 },
      { dateISO: "2026-09-28", category: "tennis", durationMinutes: 70 }
    ],
    wearableDays: [{ dateISO: "2026-09-28", sleepMinutes: 430 }]
  });
  assert.equal(brief.adaptation, "reduce");
  assert.match(brief.summary, /reduce una serie/i);
  assert.equal(brief.recentLoadMinutes, 250);
});

test("protege el partido cercano aunque todavía falten datos de sueño", () => {
  const brief = dailyBrief({
    dateISO: "2026-10-23",
    planTitle: "Activación prepartido",
    planCategory: "physical",
    matchWithinDays: 1,
    records: [],
    wearableDays: []
  });
  assert.equal(brief.label, "Proteger el próximo partido");
  assert.match(brief.title, /frescura/i);
  assert.equal(brief.adaptation, "maintain");
});

test("el centro diario distingue datos parciales y resume alimentación", () => {
  const brief = dailyBrief({
    dateISO: "2026-09-28",
    records: [{ dateISO: "2026-09-28", category: "physical", durationSeconds: 3600 }],
    nutritionEntries: [
      { dateISO: "2026-09-28", kind: "meal" },
      { dateISO: "2026-09-28", kind: "water", amountMl: 750 }
    ]
  });
  assert.equal(brief.hasTodayActivity, true);
  assert.equal(brief.meals, 1);
  assert.equal(brief.waterMl, 750);
  assert.match(brief.signals.join(" "), /no compartió sueño/i);
});

test("el centro diario baja la exigencia después de una salida informada", () => {
  const brief = dailyBrief({
    dateISO: "2026-10-25",
    planTitle: "Día 1 · Piernas",
    planCategory: "physical",
    records: [],
    wearableDays: [{ dateISO: "2026-10-25", sleepMinutes: 450 }],
    recoveryContexts: [{
      kind: "alcohol", eventDateISO: "2026-10-24", endDateISO: "2026-10-25", endTime: "05:00",
      alcoholAmount: "high", symptoms: "unknown"
    }]
  });
  assert.equal(brief.adaptation, "recover");
  assert.equal(brief.recoveryContext.recoveryHours, 48);
  assert.match(brief.label, /salida/i);
  assert.match(brief.summary, /No progreses cargas/i);
  assert.match(brief.signals.join(" "), /05:00/);
});

test("el resumen móvil usa una ventana exacta de cuatro semanas", () => {
  const summary = rollingFourWeekSummary([
    { dateISO: "2026-09-28", category: "tennis", durationMinutes: 60 },
    { dateISO: "2026-09-10", category: "physical", durationSeconds: 1800, routinePain: 2 },
    { dateISO: "2026-08-31", category: "tennis", durationMinutes: 90 },
    { dateISO: "2026-09-20", category: "warmup", durationMinutes: 10 }
  ], [
    { dateISO: "2026-09-28", kind: "meal" },
    { dateISO: "2026-09-28", kind: "meal" },
    { dateISO: "2026-09-10", kind: "meal" }
  ], [
    { dateISO: "2026-09-27", sleepMinutes: 420 },
    { dateISO: "2026-09-10", sleepMinutes: 360 }
  ], "2026-09-28");
  assert.deepEqual(summary, {
    sessions: 2,
    activeDays: 2,
    minutes: 90,
    tennisSessions: 1,
    physicalSessions: 1,
    nutritionDays: 2,
    sleepDays: 2,
    averageSleepMinutes: 390,
    painDays: 1
  });
});
