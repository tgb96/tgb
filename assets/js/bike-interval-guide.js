const STORAGE_KEY = "tgtrain-bike-interval-guide-v1";

const step = (phase, seconds, rpe, cadence, detail, tone = "steady", round = null, rounds = null) => ({
  phase,
  seconds,
  rpe,
  cadence,
  detail,
  tone,
  round,
  rounds
});

export const bikeIntervalSteps = [
  step("Calentamiento progresivo", 480, "3–4/10", "Cadencia cómoda", "Empieza muy suave y aumenta de forma gradual. Debes poder hablar con normalidad.", "easy"),
  ...Array.from({ length: 3 }, (_, index) => [
    step("Aceleración de cadencia", 20, "6/10", "Piernas rápidas", "Aumenta la velocidad de los pedales sin rebotar en el asiento.", "fast", index + 1, 3),
    step("Recuperación", 40, "2–3/10", "Muy suave", "Suelta las piernas y recupera una respiración tranquila.", "recovery", index + 1, 3)
  ]).flat(),
  ...Array.from({ length: 10 }, (_, index) => [
    step("Intervalo de punto", 30, "7–8/10", "Rápida y firme", "Empuja con control: exigente, pero sin perder postura ni llegar al máximo.", "hard", index + 1, 10),
    step("Recuperación entre puntos", 60, "2–3/10", "Suave", "Baja resistencia y cadencia; deja que respiración y piernas se recompongan.", "recovery", index + 1, 10)
  ]).flat(),
  ...Array.from({ length: 6 }, (_, index) => [
    step("Arrancada corta", 15, "8/10", "Muy rápida", "Acelera con intención, tronco quieto y pedaleo limpio. No es un sprint máximo.", "sprint", index + 1, 6),
    step("Recuperación corta", 45, "2–3/10", "Muy suave", "Reduce el ritmo de inmediato y prepara una repetición de la misma calidad.", "recovery", index + 1, 6)
  ]).flat(),
  step("Vuelta a la calma", 360, "2/10", "Muy suave", "Baja progresivamente el ritmo hasta terminar con respiración cómoda.", "easy")
];

export const bikeIntervalDurationSeconds = bikeIntervalSteps.reduce((total, item) => total + item.seconds, 0);

const idleState = () => ({
  status: "idle",
  stepIndex: 0,
  remainingSeconds: bikeIntervalSteps[0].seconds,
  stepEndsAt: 0
});

export function loadBikeIntervalState(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
    if (!parsed || !["idle", "running", "paused", "complete"].includes(parsed.status)) return idleState();
    if (!Number.isInteger(parsed.stepIndex) || parsed.stepIndex < 0 || parsed.stepIndex >= bikeIntervalSteps.length) return idleState();
    return {
      status: parsed.status,
      stepIndex: parsed.stepIndex,
      remainingSeconds: Math.max(0, Number(parsed.remainingSeconds) || bikeIntervalSteps[parsed.stepIndex].seconds),
      stepEndsAt: Number(parsed.stepEndsAt) || 0
    };
  } catch {
    return idleState();
  }
}

export function normalizeBikeIntervalState(state, now = Date.now()) {
  if (state.status !== "running") return state;
  let stepIndex = state.stepIndex;
  let stepEndsAt = state.stepEndsAt || now + Math.max(1, state.remainingSeconds) * 1000;
  while (stepIndex < bikeIntervalSteps.length && now >= stepEndsAt) {
    stepIndex += 1;
    if (stepIndex >= bikeIntervalSteps.length) {
      return { status: "complete", stepIndex: bikeIntervalSteps.length - 1, remainingSeconds: 0, stepEndsAt: 0 };
    }
    stepEndsAt += bikeIntervalSteps[stepIndex].seconds * 1000;
  }
  return {
    status: "running",
    stepIndex,
    remainingSeconds: Math.max(1, Math.ceil((stepEndsAt - now) / 1000)),
    stepEndsAt
  };
}

export function bikeIntervalRemainingSeconds(state) {
  if (state.status === "complete") return 0;
  return state.remainingSeconds + bikeIntervalSteps
    .slice(state.stepIndex + 1)
    .reduce((total, item) => total + item.seconds, 0);
}

function saveState(state, storage) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // El cronómetro continúa visible aunque el navegador no permita persistirlo.
  }
  return state;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function signalIntervalChange() {
  try {
    window.navigator?.vibrate?.([100, 60, 100]);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 760;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.16);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  } catch {
    // Algunos navegadores bloquean sonido; la señal visual sigue funcionando.
  }
}

const mounts = new Set();
let ticker = 0;

function ensureTicker() {
  if (ticker || typeof window === "undefined") return;
  ticker = window.setInterval(() => {
    mounts.forEach(controller => {
      if (!controller.root.isConnected) {
        mounts.delete(controller);
        return;
      }
      controller.tick();
    });
    if (!mounts.size) {
      window.clearInterval(ticker);
      ticker = 0;
    }
  }, 500);
}

export function createBikeIntervalGuide({ documentRef = document, storage = window.localStorage, onEnsureRoutine = () => true } = {}) {
  const root = documentRef.createElement("section");
  root.className = "bike-guide";
  const eyebrow = documentRef.createElement("span");
  eyebrow.className = "bike-guide-eyebrow";
  eyebrow.textContent = "SESIÓN GUIADA · 38 MIN";
  const heading = documentRef.createElement("div");
  heading.className = "bike-guide-heading";
  const title = documentRef.createElement("h3");
  title.textContent = "Intervalos automáticos para tenis";
  const total = documentRef.createElement("small");
  heading.append(title, total);

  const dashboard = documentRef.createElement("div");
  dashboard.className = "bike-guide-dashboard";
  const phase = documentRef.createElement("strong");
  phase.className = "bike-guide-phase";
  const clock = documentRef.createElement("strong");
  clock.className = "bike-guide-clock";
  const round = documentRef.createElement("span");
  round.className = "bike-guide-round";
  dashboard.append(phase, clock, round);

  const effort = documentRef.createElement("div");
  effort.className = "bike-guide-effort";
  const effortTop = documentRef.createElement("div");
  const effortLabel = documentRef.createElement("strong");
  const cadence = documentRef.createElement("span");
  effortTop.append(effortLabel, cadence);
  const track = documentRef.createElement("div");
  track.className = "bike-guide-effort-track";
  const fill = documentRef.createElement("span");
  track.append(fill);
  const detail = documentRef.createElement("p");
  effort.append(effortTop, track, detail);

  const sessionTrack = documentRef.createElement("div");
  sessionTrack.className = "bike-guide-session-track";
  const sessionFill = documentRef.createElement("span");
  sessionTrack.append(sessionFill);

  const actions = documentRef.createElement("div");
  actions.className = "bike-guide-actions";
  const primary = documentRef.createElement("button");
  primary.type = "button";
  primary.className = "bike-guide-primary";
  const skip = documentRef.createElement("button");
  skip.type = "button";
  skip.textContent = "Siguiente";
  const reset = documentRef.createElement("button");
  reset.type = "button";
  reset.textContent = "Reiniciar";
  actions.append(primary, skip, reset);

  const footnote = documentRef.createElement("small");
  footnote.className = "bike-guide-footnote";
  footnote.textContent = "TGTrain cambia de intervalo automáticamente y avisa con vibración o sonido. Si tu bicicleta muestra RPM, usa la sensación y la fluidez antes que perseguir un número exacto.";
  root.append(eyebrow, heading, dashboard, effort, sessionTrack, actions, footnote);

  const controller = {
    root,
    lastStepIndex: null,
    getState() {
      return normalizeBikeIntervalState(loadBikeIntervalState(storage));
    },
    setState(state) {
      saveState(state, storage);
      this.render(state);
    },
    tick() {
      const before = loadBikeIntervalState(storage);
      const state = normalizeBikeIntervalState(before);
      if (JSON.stringify(state) !== JSON.stringify(before)) saveState(state, storage);
      this.render(state);
    },
    render(state = this.getState()) {
      const current = bikeIntervalSteps[state.stepIndex];
      const maxRpe = Number(String(current.rpe).match(/\d+(?!.*\d)/)?.[0] || 3);
      phase.textContent = state.status === "complete" ? "Sesión completada" : current.phase;
      clock.textContent = state.status === "complete" ? "00:00" : formatTime(state.remainingSeconds);
      round.textContent = current.round ? `Repetición ${current.round} de ${current.rounds}` : state.status === "idle" ? "Lista para empezar" : `Paso ${state.stepIndex + 1} de ${bikeIntervalSteps.length}`;
      total.textContent = state.status === "complete" ? "Completada" : `${formatTime(bikeIntervalRemainingSeconds(state))} restantes`;
      effortLabel.textContent = `Esfuerzo ${current.rpe}`;
      cadence.textContent = current.cadence;
      detail.textContent = current.detail;
      fill.style.width = `${Math.min(100, maxRpe * 10)}%`;
      fill.dataset.tone = current.tone;
      const elapsed = bikeIntervalDurationSeconds - bikeIntervalRemainingSeconds(state);
      sessionFill.style.width = `${Math.min(100, Math.max(0, elapsed / bikeIntervalDurationSeconds * 100))}%`;
      primary.textContent = state.status === "running" ? "Pausar" : state.status === "paused" ? "Continuar" : state.status === "complete" ? "Repetir guía" : "Iniciar guía";
      skip.disabled = state.status === "idle" || state.status === "complete";
      reset.disabled = state.status === "idle";
      root.dataset.status = state.status;
      root.dataset.tone = current.tone;
      if (state.status === "running" && this.lastStepIndex !== null && this.lastStepIndex !== state.stepIndex) signalIntervalChange();
      this.lastStepIndex = state.stepIndex;
    }
  };

  primary.addEventListener("click", () => {
    let state = controller.getState();
    const now = Date.now();
    if (state.status === "running") {
      state = { ...state, status: "paused", stepEndsAt: 0 };
    } else {
      if (!onEnsureRoutine()) return;
      if (state.status === "complete") state = idleState();
      state = { ...state, status: "running", stepEndsAt: now + Math.max(1, state.remainingSeconds) * 1000 };
      signalIntervalChange();
    }
    controller.setState(state);
  });
  skip.addEventListener("click", () => {
    const state = controller.getState();
    const nextIndex = state.stepIndex + 1;
    controller.setState(nextIndex >= bikeIntervalSteps.length
      ? { status: "complete", stepIndex: bikeIntervalSteps.length - 1, remainingSeconds: 0, stepEndsAt: 0 }
      : {
          status: state.status,
          stepIndex: nextIndex,
          remainingSeconds: bikeIntervalSteps[nextIndex].seconds,
          stepEndsAt: state.status === "running" ? Date.now() + bikeIntervalSteps[nextIndex].seconds * 1000 : 0
        });
    signalIntervalChange();
  });
  reset.addEventListener("click", () => controller.setState(idleState()));

  controller.render();
  mounts.add(controller);
  ensureTicker();
  return root;
}
