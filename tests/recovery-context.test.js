import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRecoveryContext, recoveryImpactForDate, recoveryContextsFromQuestions, strongestRecoveryImpact } from "../assets/js/recovery-context.js";

test("una salida larga con consumo alto protege las 48 horas siguientes", () => {
  const context = normalizeRecoveryContext({
    kind: "alcohol",
    eventDateISO: "2026-10-24",
    endDateISO: "2026-10-25",
    endTime: "05:00",
    alcoholAmount: "high",
    symptoms: "unknown",
    summary: "Salió el sábado y tomó harto."
  });
  assert.equal(context.recoveryHours, 48);
  assert.equal(recoveryImpactForDate(context, "2026-10-25").adaptation, "recover");
  assert.equal(recoveryImpactForDate(context, "2026-10-26").adaptation, "reduce");
  assert.equal(recoveryImpactForDate(context, "2026-10-27"), null);
});

test("poco alcohol y un término temprano generan una cautela más breve", () => {
  const context = normalizeRecoveryContext({
    kind: "alcohol",
    eventDateISO: "2026-10-24",
    endDateISO: "2026-10-25",
    endTime: "00:30",
    alcoholAmount: "low",
    symptoms: "none"
  });
  assert.equal(context.recoveryHours, 24);
  assert.equal(recoveryImpactForDate(context, "2026-10-25").adaptation, "reduce");
  assert.equal(recoveryImpactForDate(context, "2026-10-26"), null);
});

test("selecciona el contexto activo más protector sin revivir salidas vencidas", () => {
  const questions = [{ recoveryContext: {
    kind: "alcohol", eventDateISO: "2026-10-24", endDateISO: "2026-10-25", endTime: "05:00",
    alcoholAmount: "moderate", symptoms: "mild"
  } }, { recoveryContext: {
    kind: "alcohol", eventDateISO: "2026-10-20", endDateISO: "2026-10-21", endTime: "01:00",
    alcoholAmount: "low", symptoms: "none"
  } }];
  const contexts = recoveryContextsFromQuestions(questions);
  assert.equal(contexts.length, 2);
  assert.equal(strongestRecoveryImpact(contexts, "2026-10-25").adaptation, "recover");
  assert.equal(strongestRecoveryImpact(contexts, "2026-10-28"), null);
});
