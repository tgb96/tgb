import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("la interfaz usa módulos, cuatro pestañas y ningún evento inline", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  assert.match(html, /assets\/css\/styles\.css/);
  assert.match(html, /type="module" src="assets\/js\/app\.js\?v=\d+"/);
  assert.doesNotMatch(html, /\son(?:click|change|submit)=/i);
  assert.equal([...html.matchAll(/class="nav-item/g)].length, 4);
  assert.doesNotMatch(html, /class="nav-item"[^>]+data-view-target="routines"/);
  assert.match(html, /id="viewRoutines"/);
  assert.match(html, /id="viewTimer"/);
  assert.match(html, /id="timerWorkDuration"/);
  assert.match(html, /id="timerStageLabel"/);
  assert.match(html, /id="sensationSuggestions"/);
  assert.match(html, /id="registrationDateRow"/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("hay cuatro rutinas físicas completas y configurables", async () => {
  const data = await import("../assets/js/data.js");
  assert.equal(data.physicalRoutines.length, 4);
  assert.deepEqual(data.physicalRoutines.map(routine => routine.exercises.length), [9, 12, 10, 11]);
  assert.ok(data.physicalRoutines.flatMap(routine => routine.exercises).every(exercise => exercise.sets && exercise.target));
  assert.deepEqual(data.cardioTypes.map(type => type.id), ["outdoor-bike", "stationary-bike", "running", "walking", "trekking"]);
  assert.deepEqual(data.tennisSurfaces, ["Arcilla", "Cemento"]);
  assert.ok(data.trekkingLocations.includes("Cerro El Carbón"));
  assert.ok(data.trekkingLocations.includes("Cerro Manquehue"));
  assert.ok(data.trekkingLocations.includes("Cerro San Cristóbal"));
  assert.deepEqual(data.trekkingRoutes["Cerro La Región"], ["Los Fresnos", "Ruta 7 Canchas"]);
  assert.ok(data.trainingCategories.some(category => category.id === "rest"));
  assert.ok(data.sensationSuggestions.physical.length >= 20);
  assert.ok(data.sensationSuggestions.cardio.length >= 20);
  assert.ok(data.sensationSuggestions.tennis.length >= 20);
  const app = await readFile(resolve(root, "assets/js/app.js"), "utf8");
  assert.match(app, /tgb-routine-settings-v1/);
  assert.match(app, /exercise-controls/);
  assert.match(app, /tgb-series-timer-v1/);
  assert.match(app, /tgb-routine-session-v1/);
  assert.match(app, /Finalizar y registrar/);
  assert.match(app, /routineVolumeKg/);
  assert.match(app, /AudioContext/);
  assert.match(app, /playTimerSound\("countdown"\)/);
  assert.match(app, /launchRoutineFromRegistration/);
  assert.match(app, /openRegistrationOrActiveRoutine/);
  assert.match(app, /activeSession\?\.status === "active"/);
  assert.match(app, /scrollToRoutineProgress/);
  assert.match(app, /data-exercise-id/);
  assert.match(app, /completedSets > 0 && state\.completedSets < state\.setCount/);
  assert.match(app, /exponentialRampToValueAtTime\(0\.34/);
  assert.match(app, /TIMER_WORK_OPTIONS = \[20, 25, 30, 35, 40, 45\]/);
  assert.match(app, /TIMER_REST_OPTIONS = \[20, 30, 40, 50\]/);
  assert.match(app, /closestAllowed/);
  assert.match(app, /Math\.min\(10, Math\.max\(1, requestedSets\)\)/);
  assert.match(app, /number <= 10/);
  assert.match(app, /data-routine-id/);
  assert.match(app, /routineSensations-/);
  assert.match(app, /Elige al menos una sensación/);
});

test("el shell offline incluye todos los recursos de la aplicación", async () => {
  const worker = await readFile(resolve(root, "service-worker.js"), "utf8");
  for (const asset of ["index.html", "assets/css/styles.css", "assets/js/app.js", "assets/js/data.js", "assets/js/storage.js", "assets/js/utils.js"]) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(worker, /tgb-shell-v24/);
});
