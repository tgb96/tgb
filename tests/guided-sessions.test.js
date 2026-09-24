import test from "node:test";
import assert from "node:assert/strict";
import { guidedElapsedMs, guidedOptions, guidedPlan, guidedRemainingMs, guidedTotalSeconds } from "../assets/js/guided-sessions.js";
import { createRepository } from "../assets/js/storage.js";
import { groupRecordsByWeek, recordsToCSV, validateRecord, weeklyReport } from "../assets/js/utils.js";
import { dayPlanOverview, plannedContextForRecord } from "../assets/js/coach-tracking.js";
import { weeklyEvolution } from "../assets/js/utils.js";

const memoryStorage = () => {
  const entries = new Map();
  return { getItem: key => entries.get(key) || null, setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key) };
};

test("las dos guías contienen pasos progresivos y alternativas suaves", () => {
  for (const kind of ["warmup", "stretching"]) {
    const plan = guidedPlan(kind);
    assert.equal(plan.category, kind);
    assert.ok(plan.steps.length >= 8);
    assert.ok(guidedTotalSeconds(plan) >= 300);
    assert.ok(plan.steps.every(step => step.id && step.title && step.instruction && step.alternative && step.seconds > 0));
    assert.equal(new Set(plan.steps.map(step => step.id)).size, plan.steps.length);
  }
});

test("calentamiento y estiramientos ofrecen tres duraciones estables", () => {
  assert.deepEqual(guidedOptions("warmup").map(guidedTotalSeconds), [300, 660, 900]);
  assert.deepEqual(guidedOptions("stretching").map(guidedTotalSeconds), [400, 900, 1800]);
  for (const kind of ["warmup", "stretching"]) {
    for (const plan of guidedOptions(kind)) {
      assert.equal(guidedPlan(kind, plan.id).id, plan.id);
      assert.equal(new Set(plan.steps.map(step => step.id)).size, plan.steps.length);
      assert.ok(plan.steps.every(step => step.alternative));
    }
  }
  assert.equal(guidedPlan("warmup", "tennis-warmup-v1").id, "tennis-warmup-v1");
});

test("el reloj mantiene tiempo restante y activo tras pausa y reanudación", () => {
  const active = { status: "active", elapsedMs: 5000, activeStartedAt: 10000, stepEndsAt: 30000 };
  assert.equal(guidedRemainingMs(active, 17000), 13000);
  assert.equal(guidedElapsedMs(active, 17000), 12000);
  const paused = { status: "paused", elapsedMs: 12000, stepRemainingMs: 13000 };
  assert.equal(guidedRemainingMs(paused, 99999), 13000);
  assert.equal(guidedElapsedMs(paused, 99999), 12000);
});

test("la sesión guiada se guarda y exporta con pasos, molestias y kcal opcionales", () => {
  const plan = guidedPlan("warmup");
  const storage = memoryStorage();
  const repository = createRepository(storage);
  const record = {
    id: "warmup-1", dateISO: "2026-09-22", category: "warmup", durationSeconds: 580,
    durationMinutes: 580 / 60, durationPrecision: "hms", calories: "", sensations: "Me sentí más suelto",
    guidedSessionId: plan.id, guidedSessionName: plan.title,
    guidedSteps: plan.steps.map((step, index) => ({ ...step, status: index === 0 ? "skipped" : "done" })),
    guidedPainScore: 2, guidedPainNotes: "Rodilla sensible al empezar",
    guidedStartedAt: "2026-09-22T14:00:00Z", guidedEndedAt: "2026-09-22T14:10:00Z"
  };
  assert.equal(validateRecord(record).valid, true);
  repository.upsert(record);
  const saved = createRepository(storage).get(record.id);
  assert.equal(repository.get(record.id).guidedSteps.length, plan.steps.length);
  assert.equal(repository.get(record.id).calories, "");
  assert.equal(saved.guidedPainNotes, "Rodilla sensible al empezar");
  const report = weeklyReport(repository.list(), groupRecordsByWeek(repository.list())[0]);
  assert.match(report, /Calorías: no anotadas/);
  assert.match(report, /Rodilla sensible al empezar/);
  assert.match(report, /omitido/);
  assert.match(recordsToCSV(repository.list()), /guía_pasos/);
});

test("rechaza calorías y molestias fuera de rango en la guía", () => {
  const base = { id: "test", dateISO: "2026-09-22", category: "stretching", durationSeconds: 120,
    guidedSessionId: "post-play-stretch-v1", calories: "" };
  assert.equal(validateRecord({ ...base, calories: -5 }).valid, false);
  assert.equal(validateRecord({ ...base, calories: 5001 }).valid, false);
  assert.equal(validateRecord({ ...base, guidedPainScore: 11 }).valid, false);
});

test("una guía complementaria no cumple ni reemplaza el plan o la sesión principal", () => {
  const session = { id: "day", dateISO: "2026-09-22", primaryOptionId: "tennis",
    options: [{ id: "tennis", category: "tennis", title: "Tenis" }] };
  const block = { id: "block", weeks: [{ sessions: [session] }] };
  const guide = { id: "warmup", dateISO: session.dateISO, category: "warmup", durationSeconds: 600, durationMinutes: 10 };
  assert.equal(plannedContextForRecord(guide, block), null);
  assert.equal(dayPlanOverview(session, [guide]).status, "planned");
  const week = weeklyEvolution([guide], session.dateISO, 1)[0];
  assert.equal(week.sessions, 0);
  assert.equal(week.minutes, 0);
  assert.equal(week.activeDays, 0);
});
