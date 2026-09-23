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
  assert.match(html, /TGTrain/);
  assert.match(html, /id="cloudStatusButton"/);
  assert.match(html, /id="cloudDialog"/);
  assert.match(html, /id="coachProfileDialog"/);
  assert.match(html, /id="coachProfileText"/);
  assert.match(html, /id="homeCoachFeedback"/);
  assert.match(html, /id="runningRankings"/);
  assert.match(html, /id="physicalRankings"/);
  assert.match(html, /id="openAiPlanButton"/);
  assert.match(html, /id="aiPlanDialog"/);
  assert.doesNotMatch(html, /weeklyPlan|Plan semanal/);
  assert.match(html, /id="weekSessionDelta"/);
  assert.match(html, /id="weekBestAbsDelta"/);
  assert.match(html, /id="startPlannedActivityButton"/);
  assert.doesNotMatch(html, /id="homeRegisterButton"|id="evolutionMetrics"/);
  assert.match(html, /id="exerciseProgress"/);
  assert.match(html, /<details class="exercise-progress-card"/);
  assert.doesNotMatch(html, /coach(?:Send|Share|Conversation|Confirm|Baseline)/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("hay cuatro rutinas físicas completas y configurables", async () => {
  const data = await import("../assets/js/data.js");
  assert.equal(data.physicalRoutines.length, 4);
  assert.deepEqual(data.physicalRoutines.map(routine => routine.exercises.length), [10, 13, 11, 12]);
  assert.ok(data.physicalRoutines.every(routine => {
    const warmup = routine.exercises[0];
    return warmup.name === "Bicicleta estática" && warmup.sets === 1 && warmup.target === "10 min";
  }));
  assert.ok(data.physicalRoutines.flatMap(routine => routine.exercises).every(exercise => exercise.sets && exercise.target));
  assert.deepEqual(data.cardioTypes.map(type => type.id), ["outdoor-bike", "stationary-bike", "running", "walking", "trekking", "padel"]);
  assert.deepEqual(data.cardioTypes.find(type => type.id === "padel"), {
    id: "padel",
    name: "Pádel",
    description: "Sesión ocasional de pádel",
    distance: false
  });
  assert.deepEqual(data.tennisSurfaces, ["Arcilla", "Cemento"]);
  assert.deepEqual(data.tennisTypes.map(type => type.name), ["Entrenamiento grupal", "Partido", "Frontón", "Peloteo amistoso"]);
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
  assert.match(app, /Iniciar entrenamiento/);
  assert.match(app, /Ver rutina/);
  assert.match(app, /document\.createElement\("select"\)/);
  assert.match(app, /Array\.from\(\{ length: 10 \}/);
  assert.match(app, /routineExercises: summary\.exercises/);
  const routineLauncher = app.match(/function launchRoutineFromRegistration\(routine\) \{([\s\S]*?)\n\}\n\nfunction finishRoutineSession/)?.[1] || "";
  assert.doesNotMatch(routineLauncher, /startRoutineSession\(routine\)/);
  assert.match(app, /openRegistrationOrActiveRoutine/);
  assert.match(app, /activeSession\?\.status === "active"/);
  assert.match(app, /scrollToRoutineProgress/);
  assert.match(app, /routineExercisesForDate\(routine, session\.dateISO\)\.map/);
  assert.match(app, /lastCompletedIndex/);
  assert.match(app, /data-exercise-id/);
  assert.match(app, /completedSets > 0 && state\.completedSets < state\.setCount/);
  assert.match(app, /exponentialRampToValueAtTime\(0\.34/);
  assert.match(app, /TIMER_WORK_OPTIONS = \[20, 25, 30, 35, 40, 45\]/);
  assert.match(app, /TIMER_REST_OPTIONS = \[20, 30, 40, 50\]/);
  assert.match(app, /closestAllowed/);
  assert.match(app, /Math\.min\(10, Math\.max\(1, requestedSets\)\)/);
  assert.match(app, /number <= 10/);
  assert.match(app, /TIMER_PREP_SECONDS = 3/);
  assert.match(app, /timerState\.phase === "prepare"/);
  assert.match(app, /Prepárate/);
  assert.match(app, /data-routine-id/);
  assert.match(app, /routineSensations-/);
  assert.match(app, /Elige al menos una sensación/);
  assert.match(app, /runningDistanceSelect/);
  assert.match(app, /durationModeFor\(currentCategory/);
  assert.match(app, /Tiempo de subida \(HH:MM\)/);
  assert.doesNotMatch(app, /id: "ascentSeconds"/);
  assert.match(app, /renderRunningRankings/);
  assert.match(app, /createRoutineAbsFinisher/);
  assert.match(app, /routineAbsCount/);
  assert.match(app, /renderPhysicalRankings/);
  assert.match(app, /physicalRoutineDurationAverages/);
  assert.doesNotMatch(app, /renderWeeklyPlan|weeklyPlanOptions/);
  assert.match(app, /renderHeroEvolution/);
  assert.match(app, /renderExerciseProgress/);
  assert.match(app, /routineCompletionSummary/);
  assert.match(app, /Copiar informe para el entrenador/);
  assert.match(app, /attempts\.slice\(0, 3\)/);
  assert.match(app, /Duración aprox\./);
  assert.match(app, /requestRoutineAiAnalysis/);
  assert.match(app, /routineAiAnalysis/);
  assert.match(app, /routineEffort-/);
  assert.match(app, /routinePain-/);
  assert.match(app, /Aplicar propuesta/);
  assert.match(app, /Aplicar ajustes editados/);
  assert.match(app, /Descartar/);
  assert.match(app, /next48Hours/);
  assert.match(app, /repository\.getCoachProfile/);
  assert.doesNotMatch(app, /coachUpdateReport|coachSentAt|COACH_PENDING_BATCH_KEY/);
});

test("la importación del plan vive en Cuenta y respaldo, no ocupa el inicio", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  const home = html.slice(html.indexOf('id="viewHome"'), html.indexOf('id="viewRegister"'));
  const cloud = html.slice(html.indexOf('id="cloudDialog"'), html.indexOf('id="coachProfileDialog"'));
  assert.doesNotMatch(home, /coachBlockCard|openAiPlanButton|Plan activo/);
  assert.match(cloud, /id="openAiPlanButton"/);
  assert.match(cloud, /Importar planificación con IA/);
});

test("integra el bloque de cuatro semanas del entrenador con sesiones y alternativas", async () => {
  const { coachTrainingBlock, coachSessionForDate } = await import("../assets/js/coach-plan.js");
  const { physicalRoutines, trainingCategories } = await import("../assets/js/data.js");
  const sessions = coachTrainingBlock.weeks.flatMap(week => week.sessions);
  assert.equal(coachTrainingBlock.weeks.length, 4);
  assert.equal(sessions.length, 28);
  assert.equal(new Set(sessions.map(session => session.dateISO)).size, 28);
  assert.equal(coachTrainingBlock.startISO, "2026-09-14");
  assert.equal(coachTrainingBlock.endISO, "2026-10-11");
  assert.ok(sessions.some(session => session.options.length > 1));
  assert.equal(coachSessionForDate("2026-09-14").options[0].prefill.routineId, "legs");
  assert.equal(coachSessionForDate("2026-09-26").options[0].prefill.tennisTypeId, "match");
  const categoryIds = new Set(trainingCategories.map(category => category.id));
  const routines = new Map(physicalRoutines.map(routine => [routine.id, routine]));
  sessions.flatMap(session => session.options).forEach(option => {
    assert.ok(categoryIds.has(option.category));
    if (option.category !== "physical") return;
    const routine = routines.get(option.prefill.routineId);
    assert.ok(routine);
    const exerciseIds = new Set(routine.exercises.map(exercise => exercise.id));
    [...Object.keys(option.prefill.settings), ...option.prefill.omitExerciseIds].forEach(id => assert.ok(exerciseIds.has(id), `${id} no pertenece a ${routine.id}`));
  });
});

test("normaliza una respuesta compacta sin campos vacíos", async () => {
  const { normalizeTrainingBlock } = await import("../assets/js/training-plan.js");
  const block = normalizeTrainingBlock({ title: "Plan compacto", weeks: [{ weekKey: "2026-W39", sessions: [{ dateISO: "2026-09-22", options: [{ title: "Trote 5K", category: "cardio", cardioTypeId: "running", distanceKm: 5 }] }] }] });
  assert.equal(block.title, "Plan compacto");
  assert.equal(block.weeks[0].sessions[0].options[0].prefill.cardioTypeId, "running");
  assert.equal(block.weeks[0].sessions[0].options[0].prefill.distanceKm, 5);
});

test("el shell offline incluye todos los recursos de la aplicación", async () => {
  const worker = await readFile(resolve(root, "service-worker.js"), "utf8");
  for (const asset of ["index.html", "assets/css/styles.css", "assets/js/app.js", "assets/js/coach-plan.js", "assets/js/data.js", "assets/js/storage.js", "assets/js/utils.js", "assets/js/cloud.js", "assets/js/ai.js", "assets/js/training-plan.js", "assets/js/firebase-config.js", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "assets/brand/tgtrain-mark-160.png"]) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(worker, /tgtrain-shell-v60/);
  assert.match(worker, /coach-tracking\.js\?v=60/);
});

test("la IA usa el nivel gratuito de Firebase sin Cloud Functions", async () => {
  const ai = await readFile(resolve(root, "assets/js/ai.js"), "utf8");
  const firebase = JSON.parse(await readFile(resolve(root, "firebase.json"), "utf8"));
  assert.match(ai, /firebase-ai\.js/);
  assert.match(ai, /firebase-app-check\.js/);
  assert.match(ai, /ReCaptchaEnterpriseProvider/);
  assert.match(ai, /6LepnbotAAAAAGO5otmQYn725glRtwS-5aoh5-g9/);
  assert.match(ai, /useResponseSchema: false/);
  assert.match(ai, /GoogleAIBackend/);
  assert.match(ai, /gemini-3\.5-flash-lite/);
  assert.match(ai, /Mancuernas ajustables con una capacidad máxima de 40 kg/);
  assert.match(ai, /Kettlebell de 4,5 kg/);
  assert.match(ai, /privateCoachProfile/);
  assert.doesNotMatch(ai, /monoplegia|plexo braquial|menisco/i);
  assert.doesNotMatch(ai, /OPENAI_API_KEY|httpsCallable|firebase-functions/);
  assert.equal(firebase.functions, undefined);
});

test("el importador compacta planes largos y reintenta respuestas JSON truncadas", async () => {
  const ai = await readFile(resolve(root, "assets/js/ai.js"), "utf8");
  assert.match(ai, /error\.code !== "invalid-json"/);
  assert.match(ai, /REINTENTO COMPACTO OBLIGATORIO/);
  assert.match(ai, /No repitas reglas generales/);
  assert.match(ai, /Omite por completo los campos opcionales/);
  assert.match(ai, /maxOutputTokens: 16000/);
  assert.doesNotMatch(ai, /required: \["id", "title", "category", "summary"/);
});

test("el nombre y el logo corresponden a TGTrain", async () => {
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  const page = await readFile(resolve(root, "index.html"), "utf8");
  assert.equal(manifest.name, "TGTrain");
  assert.equal(manifest.short_name, "TGTrain");
  assert.ok(manifest.icons.some(icon => icon.purpose === "maskable" && icon.sizes === "512x512"));
  assert.match(page, /tgtrain-mark-160\.png/);
  assert.match(page, /apple-touch-icon\.png/);
});

test("al finalizar una rutina permite conservar o descartar los ajustes", async () => {
  const app = await readFile(resolve(root, "assets/js/app.js"), "utf8");
  assert.match(app, /Usar mis cambios la próxima vez/);
  assert.match(app, /routineSettingsSnapshot/);
  assert.match(app, /restoreRoutineSettings/);
  assert.match(app, /routineDefaultsSaved/);
  assert.match(app, /Finalizar, registrar y guardar cambios/);
});

test("la guía también analiza registros manuales y el plan reconoce actividades equivalentes", async () => {
  const app = await readFile(resolve(root, "assets/js/app.js"), "utf8");
  assert.match(app, /attachMatchingPlan\(formRecord\(\)\)/);
  assert.match(app, /requestRoutineAiAnalysis\(candidate\.id/);
  assert.match(app, /comparableActivity\(record, item\)/);
  assert.match(app, /currentPlan/);
  assert.match(app, /status: record\.category === "physical" \? "pending" : "reviewed"/);
});

test("plan y realidad conservan alternativas, contexto del día y un cierre sobrio", async () => {
  const app = await readFile(resolve(root, "assets/js/app.js"), "utf8");
  const ai = await readFile(resolve(root, "assets/js/ai.js"), "utf8");
  assert.match(app, /sameDayActivities/);
  assert.match(app, /referenceRoutine/);
  assert.match(app, /createPlanActualFeedback/);
  assert.match(ai, /planComparison/);
  assert.match(ai, /Más completa, más carga o más kilómetros no significa automáticamente mejor/);
  assert.match(ai, /Nunca digas que un trote doloroso fortalece o cura la rodilla/);
  assert.match(app, /closing\.textContent = analysis\.encouragement/);
});

test("la guía recibe métricas canónicas y valida ritmos antes de guardar su comentario", async () => {
  const ai = await readFile(resolve(root, "assets/js/ai.js"), "utf8");
  const app = await readFile(resolve(root, "assets/js/app.js"), "utf8");
  assert.match(ai, /const current = withTiming\(record\)/);
  assert.match(ai, /validateAnalysisPaces\(analysis, sourceActivities\)/);
  assert.match(ai, /Ritmo conversable es una indicación de intensidad percibida/);
  assert.match(app, /renderDurationField\(duration\)/);
  assert.match(app, /durationHms: timing\.durationHms/);
});

test("la tarjeta de la guía usa todo el ancho del historial y texto legible", async () => {
  const app = await readFile(resolve(root, "assets/js/app.js"), "utf8");
  const css = await readFile(resolve(root, "assets/css/styles.css"), "utf8");
  assert.match(app, /entry\.append\(top, aiCard\)/);
  assert.match(css, /\.routine-ai-card \{ width: 100%/);
  assert.match(css, /\.routine-ai-card p \{[^}]*font-size: 14px/);
  assert.match(css, /\.routine-ai-group ul \{[^}]*font-size: 13px/);
});
