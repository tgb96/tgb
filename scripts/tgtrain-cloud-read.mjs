import { createRequire } from "node:module";
import { configureFoodCatalog, nutritionEntryWithEstimate } from "../assets/js/nutrition-presets.js";
import { nutritionDayTotals, nutritionPlanForDate, plannedNutritionContext } from "../assets/js/nutrition.js";

// Read-only owner tool for support and historical analysis. It reuses the
// authenticated Firebase CLI session, resolves only that account's UID and
// performs GET requests against its TGTrain collections. No token or UID is
// persisted in the repository.
// Usage: node scripts/tgtrain-cloud-read.mjs --days=28 --dates=2026-11-09

const require = createRequire(import.meta.url);
const firebaseAuth = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const firebaseApi = require("firebase-tools/lib/apiv2");

const PROJECT_ID = "tgtrain";
const DAYS = Math.min(120, Math.max(7, Number(process.argv.find(value => value.startsWith("--days="))?.split("=")[1]) || 28));
const DETAIL_DATES = new Set(String(process.argv.find(value => value.startsWith("--dates="))?.split("=")[1] || "").split(",").filter(Boolean));

function firestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(firestoreValue);
  if ("mapValue" in value) return firestoreFields(value.mapValue.fields || {});
  return null;
}

function firestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, firestoreValue(value)]));
}

async function authenticatedFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Firebase respondió ${response.status} al consultar ${new URL(url).pathname}.`);
  return response.json();
}

async function userIdForEmail(token, userEmail) {
  const response = await authenticatedFetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`, token, {
    method: "POST",
    body: JSON.stringify({ returnUserInfo: true, limit: "1", expression: [{ email: userEmail }] })
  });
  const match = (response.userInfo || []).find(user => String(user.email || "").toLowerCase() === userEmail.toLowerCase());
  if (!match?.localId) throw new Error("No se encontró la cuenta configurada para TGTrain.");
  return match.localId;
}

async function listCollection(token, userId, collectionId) {
  const documents = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ pageSize: "300" });
    if (pageToken) query.set("pageToken", pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(userId)}/${collectionId}?${query}`;
    const page = await authenticatedFetch(url, token);
    documents.push(...(page.documents || []).map(document => firestoreFields(document.fields || {})));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return documents;
}

function dateMinusDays(dateISO, days) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function newestBlockForDate(blocks, dateISO) {
  const sorted = [...blocks].sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
  return sorted.find(block => dateISO >= block.startISO && dateISO <= block.endISO) || sorted[0] || null;
}

function sessionForDate(block, dateISO) {
  return block?.weeks?.flatMap(week => week.sessions || []).find(session => session.dateISO === dateISO) || null;
}

function dayPlan(dateISO, planEntries, blocks) {
  const override = planEntries.find(entry => entry.dateISO === dateISO)?.planMode || "default";
  const block = newestBlockForDate(blocks, dateISO);
  const planned = plannedNutritionContext(sessionForDate(block, dateISO));
  const mode = override === "default" && planned?.mode ? planned.mode : override;
  return { mode, plan: nutritionPlanForDate(dateISO, mode) };
}

async function main() {
  const account = firebaseAuth.getGlobalDefaultAccount();
  if (!account) throw new Error("Firebase CLI no tiene una sesión iniciada. Ejecuta firebase login.");
  const userEmail = process.env.TGTRAIN_USER_EMAIL || account.user.email;
  if (!userEmail) throw new Error("La sesión de Firebase no informa un correo de usuario.");
  await requireAuth({ project: PROJECT_ID, user: account.user, tokens: account.tokens });
  const token = await firebaseApi.getAccessToken();
  const userId = await userIdForEmail(token, userEmail);
  const [nutritionEntries, nutritionFoods, trainingBlocks] = await Promise.all([
    listCollection(token, userId, "nutritionEntries"),
    listCollection(token, userId, "nutritionFoods"),
    listCollection(token, userId, "trainingBlocks")
  ]);
  configureFoodCatalog(nutritionFoods.filter(food => !food.deleted));
  const live = nutritionEntries.filter(entry => !entry.deleted);
  const meals = live.filter(entry => entry.kind === "meal").map(nutritionEntryWithEstimate);
  const plans = live.filter(entry => entry.kind === "plan");
  const lastDate = [...new Set(meals.map(entry => entry.dateISO))].sort().at(-1) || new Date().toISOString().slice(0, 10);
  const firstDate = dateMinusDays(lastDate, DAYS - 1);
  const dates = [...new Set(meals.map(entry => entry.dateISO).filter(date => date >= firstDate && date <= lastDate))].sort();
  const daily = dates.map(dateISO => {
    const entries = meals.filter(entry => entry.dateISO === dateISO);
    const totals = nutritionDayTotals(entries);
    const { mode, plan } = dayPlan(dateISO, plans, trainingBlocks);
    return {
      dateISO,
      mode,
      meals: totals.meals,
      caloriesKcal: Math.round(totals.caloriesKcal),
      calorieCoverage: totals.meals ? Number((totals.caloriesKnownMeals / totals.meals).toFixed(2)) : 0,
      caloriesTargetMin: plan.caloriesMinKcal,
      caloriesTargetMax: plan.caloriesMaxKcal,
      calorieTargetPercent: Number((totals.caloriesKcal / plan.caloriesMinKcal * 100).toFixed(1)),
      proteinG: Number(totals.proteinG.toFixed(1)),
      proteinCoverage: totals.meals ? Number((totals.proteinKnownMeals / totals.meals).toFixed(2)) : 0,
      proteinTargetPercent: Number((totals.proteinG / 110 * 100).toFixed(1))
    };
  });
  const complete = daily.filter(day => day.meals >= 3 && day.calorieCoverage >= 0.8 && day.proteinCoverage >= 0.8);
  const average = (items, key) => items.length ? Number((items.reduce((sum, item) => sum + item[key], 0) / items.length).toFixed(1)) : null;
  const median = (items, key) => {
    const values = items.map(item => item[key]).sort((left, right) => left - right);
    if (!values.length) return null;
    const middle = Math.floor(values.length / 2);
    return Number((values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2).toFixed(1));
  };
  const withoutHighestTwo = [...complete].sort((left, right) => right.caloriesKcal - left.caloriesKcal).slice(Math.min(2, complete.length));
  const periodMeals = meals.filter(entry => entry.dateISO >= firstDate && entry.dateISO <= lastDate);
  const summary = {
    account: userEmail,
    period: { startISO: firstDate, endISO: lastDate, requestedDays: DAYS },
    dataQuality: {
      daysWithMeals: daily.length,
      daysWithAtLeastThreeMealsAndMacroCoverage: complete.length,
      mealsWithoutCalories: periodMeals.filter(entry => entry.caloriesKcal === null).length,
      mealsWithoutProtein: periodMeals.filter(entry => entry.proteinG === null).length
    },
    completeDayAverages: {
      caloriesKcal: average(complete, "caloriesKcal"),
      calorieTargetPercent: average(complete, "calorieTargetPercent"),
      proteinG: average(complete, "proteinG"),
      proteinTargetPercent: average(complete, "proteinTargetPercent")
    },
    completeDayMedians: {
      caloriesKcal: median(complete, "caloriesKcal"),
      proteinG: median(complete, "proteinG")
    },
    averagesWithoutHighestTwoCalorieDays: {
      days: withoutHighestTwo.length,
      caloriesKcal: average(withoutHighestTwo, "caloriesKcal"),
      proteinG: average(withoutHighestTwo, "proteinG")
    },
    completeDaysReachingMinimum: {
      calories: complete.filter(day => day.caloriesKcal >= day.caloriesTargetMin).length,
      protein: complete.filter(day => day.proteinG >= 110).length,
      total: complete.length
    },
    daily,
    selectedDateMeals: Object.fromEntries([...DETAIL_DATES].map(dateISO => [dateISO, periodMeals.filter(entry => entry.dateISO === dateISO).map(entry => ({
      slotId: entry.slotId,
      time: entry.time,
      text: entry.text,
      caloriesKcal: entry.caloriesKcal,
      proteinG: entry.proteinG,
      estimateSource: entry.estimateSource
    }))]))
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(`TGTRAIN_CLOUD_READ_ERROR: ${error.message}`);
  process.exitCode = 1;
});
