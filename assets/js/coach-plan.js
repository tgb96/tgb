const option = (id, title, category, summary, details, prefill = {}) => ({
  id,
  title,
  category,
  summary,
  details,
  prefill
});

const physical = (id, title, summary, routineId, details, settings = {}, omitExerciseIds = []) => option(
  id,
  title,
  "physical",
  summary,
  details,
  { routineId, settings, omitExerciseIds }
);

const rest = (id, title, summary, details = []) => option(id, title, "rest", summary, details, { restTypeId: "planned" });
const tennis = (id, title, summary, details, tennisTypeId = "group-training") => option(id, title, "tennis", summary, details, { tennisTypeId });
const cardio = (id, title, summary, details, cardioTypeId, extra = {}) => option(id, title, "cardio", summary, details, { cardioTypeId, ...extra });

const baseCoachTrainingBlock = {
  id: "rendimiento-tenis-2026-09",
  title: "Rendimiento tenis",
  subtitle: "Fuerza + tenis + recuperación",
  startISO: "2026-09-14",
  endISO: "2026-10-11",
  source: "Entrenador ChatGPT",
  rules: [
    "Si hay partido el sábado: viernes sin fuerza pesada, jueves solo tenis suave o activación y miércoles tren superior reducido.",
    "Con entrenamientos grupales martes y jueves: no sumar trote fuerte el martes y mantener reducido el Día 3 durante la primera semana.",
    "Después de un trekking largo: domingo de descanso y Día 1 del lunes solo si las piernas están recuperadas.",
    "Si no haces tenis el jueves: puedes realizar Día 3 completo el viernes y dejar tenis, trekking o cardio para el sábado.",
    "Si una semana especial interrumpe el plan: prioriza continuidad y recuperación por sobre completar el 100%."
  ],
  priority: ["Fuerza base", "Tenis", "Recuperación", "Cardio y trekking", "Extras"],
  weeks: [
    {
      weekKey: "2026-W38",
      number: 38,
      startISO: "2026-09-14",
      endISO: "2026-09-20",
      label: "Semana de mantenimiento",
      context: "Semana especial: mantener el ritmo sin obsesionarse con cumplir el 100%.",
      objective: "Sostener la fuerza base, sumar cardio controlado y llegar recuperado.",
      sessions: [
        {
          id: "w38-d1",
          dateISO: "2026-09-14",
          objective: "Fuerza base para tenis.",
          primaryOptionId: "legs-full",
          options: [physical("legs-full", "Día 1 completo", "Piernas + glúteos + core", "legs", [
            "Bicicleta estática 10 min suave/moderado", "Movilidad dinámica 5 min", "Sin split step: la bicicleta cumple la activación"
          ], {
            "bodyweight-squat": { sets: 2, target: "12", weightKg: "" },
            "unilateral-loaded-squat": { sets: 4, target: "10", weightKg: 10 },
            "bulgarian-squat": { sets: 3, target: "8 por pierna", weightKg: 10 },
            "romanian-deadlift": { sets: 4, target: "10", weightKg: 10 },
            "step-up": { sets: 3, target: "10 por pierna", weightKg: 5 },
            "front-plank": { sets: 3, target: "35–45 seg", weightKg: "" },
            "dead-bug": { sets: 3, target: "10 por lado", weightKg: "" },
            "wall-sit": { sets: 2, target: "35–45 seg", weightKg: "" }
          }, ["soft-split-step"])]
        },
        {
          id: "w38-d2",
          dateISO: "2026-09-15",
          objective: "Resistencia aeróbica sin buscar una marca.",
          primaryOptionId: "run-5k",
          options: [cardio("run-5k", "Trote controlado", "5K máximo · ritmo conversable", [
            "Caminata rápida 5 min", "Movilidad de tobillo y cadera 3 min", "Trote suave 5K máximo", "Vuelta a la calma caminando 5 min", "Superficie ideal: tierra compacta, pista o trotadora", "Dolor de rodilla permitido: 0–2/10"
          ], "running", { distanceKm: 5 })]
        },
        {
          id: "w38-d3",
          dateISO: "2026-09-16",
          objective: "Espalda, hombro, pecho, core y transferencia para tenis.",
          primaryOptionId: "upper-full",
          options: [physical("upper-full", "Día 2 completo", "Tren superior + estabilidad", "upper", [
            "Bicicleta o movilidad general 5 min", "Movilidad de hombro y escápula 5 min", "Si mañana hay tenis, no fuerces el press militar pesado", "Abdominales finales: 20–25"
          ], {
            "one-arm-row": { sets: 4, target: "10", weightKg: 7 },
            "unsupported-row": { sets: 3, target: "10", weightKg: 7 },
            "one-arm-chest-press": { sets: 4, target: "10", weightKg: 10 },
            "incline-press": { sets: 3, target: "10", weightKg: 10 },
            "military-press": { sets: 3, target: "8", weightKg: 7 },
            "lateral-raise": { sets: 3, target: "10–12", weightKg: 5 },
            "reverse-fly": { sets: 3, target: "10–12", weightKg: 5 },
            "one-arm-curl": { sets: 3, target: "10", weightKg: 7 },
            "overhead-extension": { sets: 3, target: "8–10", weightKg: 7 },
            "triceps-kickback": { sets: 3, target: "10", weightKg: 5 },
            "suitcase-carry": { sets: 3, target: "30–40 seg", weightKg: 10 }
          })]
        },
        {
          id: "w38-d4",
          dateISO: "2026-09-17",
          objective: "Moverse sin buscar máxima exigencia.",
          primaryOptionId: "active-rest",
          options: [
            rest("active-rest", "Descanso activo", "Caminata y movilidad suave", ["Caminata suave 20–30 min", "Movilidad general 10 min", "Movilidad de hombro, muñeca y cadera 5 min"]),
            tennis("soft-tennis", "Tenis o frontón suave", "45–60 min · intensidad media", ["Sin buscar máxima exigencia", "Sin exceso de saque"], "wall")
          ]
        },
        {
          id: "w38-d5",
          dateISO: "2026-09-18",
          objective: "Día flexible por el feriado.",
          primaryOptionId: "holiday-rest",
          options: [
            rest("holiday-rest", "Descanso", "Descanso total o caminata libre", ["No necesitas compensar el entrenamiento"]),
            physical("agility-short", "Día 3 reducido", "Potencia técnica opcional", "agility", ["Bicicleta estática 10 min", "Movilidad dinámica 5 min", "Evita sentadilla con salto si estás cansado, con sueño o comiste mucho"], {
              "soft-shadow-tennis": { sets: 3, target: "45 seg", weightKg: "" },
              "split-step": { sets: 3, target: "20 seg", weightKg: "" },
              "skater-jumps": { sets: 3, target: "6 por lado", weightKg: "" },
              "lateral-lunge": { sets: 3, target: "8 por lado", weightKg: "" },
              "lateral-return": { sets: 4, target: "20 seg", weightKg: "" },
              "russian-twist": { sets: 3, target: "16 total", weightKg: 4 },
              "side-plank": { sets: 3, target: "25–30 seg por lado", weightKg: "" }
            }, ["jump-squat", "reverse-lunge", "intense-shadow-tennis"])
          ]
        },
        {
          id: "w38-d6",
          dateISO: "2026-09-19",
          objective: "Mover sin acumular fatiga.",
          primaryOptionId: "free-trekking",
          options: [
            cardio("free-trekking", "Trekking o caminata larga", "45–90 min · zona 2", ["Intensidad sostenible"], "trekking"),
            cardio("free-bike", "Bicicleta", "25–40 min · zona 2", ["Ritmo sostenible"], "stationary-bike")
          ]
        },
        { id: "w38-d7", dateISO: "2026-09-20", objective: "Recuperar y preparar la siguiente semana.", primaryOptionId: "recovery", options: [rest("recovery", "Recuperación", "Descanso + movilidad opcional", ["Movilidad suave 10–15 min", "Caminata opcional 20 min", "Prioriza hidratación y sueño"])] }
      ]
    },
    {
      weekKey: "2026-W39",
      number: 39,
      startISO: "2026-09-21",
      endISO: "2026-09-27",
      label: "Semana de partido",
      context: "Posible partido de escalerilla el sábado 26. Esta semana no busca récords.",
      objective: "Llegar fresco, rápido y con buen timing competitivo.",
      sessions: [
        { id: "w39-d1", dateISO: "2026-09-21", objective: "Activar sin dejar agujetas.", primaryOptionId: "legs-reduced", options: [physical("legs-reduced", "Día 1 reducido", "Piernas + core", "legs", ["Bicicleta estática 10 min", "Movilidad dinámica 5 min"], {
          "bodyweight-squat": { sets: 2, target: "12", weightKg: "" }, "unilateral-loaded-squat": { sets: 3, target: "10", weightKg: 10 }, "bulgarian-squat": { sets: 2, target: "8 por pierna", weightKg: 10 }, "romanian-deadlift": { sets: 3, target: "10", weightKg: 10 }, "step-up": { sets: 2, target: "10 por pierna", weightKg: 5 }, "front-plank": { sets: 3, target: "35 seg", weightKg: "" }, "dead-bug": { sets: 3, target: "10 por lado", weightKg: "" }, "wall-sit": { sets: 2, target: "30 seg", weightKg: "" }
        }, ["soft-split-step"])] },
        { id: "w39-d2", dateISO: "2026-09-22", objective: "Cardio suave o timing técnico.", primaryOptionId: "run-soft", options: [
          cardio("run-soft", "Trote suave", "4–5K máximo · sin buscar tiempo", ["Ritmo cómodo", "Sin progresiones"], "running", { distanceKm: 5 }),
          cardio("bike-zone2", "Bicicleta estática", "25–35 min · zona 2", ["Intensidad sostenible"], "stationary-bike"),
          tennis("technical-tennis", "Tenis o frontón técnico", "45–60 min · intensidad media", ["Timing, derecha, revés y movilidad", "Sin puntos largos intensos"], "wall")
        ] },
        { id: "w39-d3", dateISO: "2026-09-23", objective: "Dejar el brazo activo, no fatigado.", primaryOptionId: "upper-reduced", options: [physical("upper-reduced", "Día 2 reducido", "Tren superior + estabilidad", "upper", ["Movilidad hombro/escápula 7 min", "Abdominales finales: 15–20"], {
          "one-arm-row": { sets: 3, target: "10", weightKg: 7 }, "unsupported-row": { sets: 2, target: "10", weightKg: 7 }, "one-arm-chest-press": { sets: 3, target: "10", weightKg: 10 }, "incline-press": { sets: 2, target: "10", weightKg: 10 }, "military-press": { sets: 2, target: "8", weightKg: 7 }, "lateral-raise": { sets: 2, target: "12", weightKg: 5 }, "reverse-fly": { sets: 2, target: "12", weightKg: 5 }, "one-arm-curl": { sets: 2, target: "10", weightKg: 7 }, "overhead-extension": { sets: 2, target: "8", weightKg: 7 }, "suitcase-carry": { sets: 2, target: "30 seg", weightKg: 10 }
        }, ["triceps-kickback"])] },
        { id: "w39-d4", dateISO: "2026-09-24", objective: "Activación técnica antes del partido.", primaryOptionId: "activation", options: [
          physical("activation", "Activación tenis", "Movilidad + desplazamientos suaves", "agility", ["Movilidad general 10 min", "Movilidad de muñeca, hombro y cadera 5 min"], { "soft-shadow-tennis": { sets: 3, target: "45 seg", weightKg: "" }, "split-step": { sets: 3, target: "20 seg", weightKg: "" }, "lateral-return": { sets: 3, target: "20 seg", weightKg: "" } }, ["jump-squat", "skater-jumps", "lateral-lunge", "reverse-lunge", "intense-shadow-tennis", "russian-twist", "side-plank"]),
          tennis("activation-tennis", "Tenis suave", "45–60 min máximo", ["Intensidad media", "No hacer frontón intenso"], "friendly-hitting")
        ] },
        { id: "w39-d5", dateISO: "2026-09-25", objective: "Llegar suelto al sábado.", primaryOptionId: "pre-match-rest", options: [rest("pre-match-rest", "Descanso activo prepartido", "Caminata 15–25 min + movilidad", ["Movilidad de cadera, tobillo, hombro y muñeca", "Nada de fuerza, trote ni saltos"])] },
        { id: "w39-d6", dateISO: "2026-09-26", objective: "Competir con intensidad controlada.", primaryOptionId: "ladder-match", options: [tennis("ladder-match", "Partido de escalerilla", "Partido probable", ["Calentamiento: caminata/trote 5 min + movilidad 5 min", "Split step 3×15 seg", "Shadow tennis 3×30 seg", "Peloteo progresivo 10–15 min", "Después: caminata 5–10 min, movilidad, hidratación y comida con proteína + carbohidrato"], "match")] },
        { id: "w39-d7", dateISO: "2026-09-27", objective: "Evaluar la respuesta corporal al partido.", primaryOptionId: "post-match", options: [rest("post-match", "Recuperación postpartido", "Descanso o caminata suave", ["Caminata opcional 20–30 min", "Movilidad general 10–15 min", "Evaluar pulgar, codo/hombro, rodilla, Aquiles y fatiga general"])] }
      ]
    },
    {
      weekKey: "2026-W40",
      number: 40,
      startISO: "2026-09-28",
      endISO: "2026-10-04",
      label: "Semana de regreso al tenis",
      context: "El tenis gana protagonismo con clases martes y jueves.",
      objective: "Adaptar el cuerpo a más tenis sin perder fuerza.",
      sessions: [
        { id: "w40-d1", dateISO: "2026-09-28", objective: "Elegir según la recuperación del partido.", primaryOptionId: "legs-moderate", options: [
          physical("legs-moderate", "Día 1 moderado", "Solo si quedaste bien del partido", "legs", ["Bicicleta estática 10 min", "Movilidad dinámica 5 min"], { "bodyweight-squat": { sets: 2, target: "12", weightKg: "" }, "unilateral-loaded-squat": { sets: 3, target: "10", weightKg: 10 }, "bulgarian-squat": { sets: 2, target: "8 por pierna", weightKg: 10 }, "romanian-deadlift": { sets: 3, target: "10", weightKg: 10 }, "step-up": { sets: 2, target: "10 por pierna", weightKg: "" }, "front-plank": { sets: 3, target: "35 seg", weightKg: "" }, "dead-bug": { sets: 3, target: "10 por lado", weightKg: "" } }, ["soft-split-step", "wall-sit"]),
          cardio("recovery-bike", "Recuperación activa", "Si quedaste cargado", ["Bicicleta suave 20 min", "Movilidad general 15 min", "Sin fuerza pesada"], "stationary-bike")
        ] },
        { id: "w40-d2", dateISO: "2026-09-29", objective: "Volver al ritmo del grupo.", primaryOptionId: "group-tennis-1", options: [tennis("group-tennis-1", "Entrenamiento grupal", "Intensidad moderada", ["Prioridad: timing, piernas y consistencia", "Registra cómo responde el cuerpo al día siguiente"], "group-training")] },
        { id: "w40-d3", dateISO: "2026-09-30", objective: "Mantener fuerza sin fatigar antes del jueves.", primaryOptionId: "upper-moderate", options: [physical("upper-moderate", "Día 2 moderado", "Tren superior", "upper", ["Movilidad hombro/escápula 7 min", "No hacerlo pesado porque mañana hay tenis", "Abdominales finales: 20"], { "one-arm-row": { sets: 4, target: "10", weightKg: 7 }, "unsupported-row": { sets: 3, target: "10", weightKg: 7 }, "one-arm-chest-press": { sets: 3, target: "10", weightKg: 10 }, "incline-press": { sets: 2, target: "10", weightKg: 10 }, "military-press": { sets: 2, target: "8", weightKg: 7 }, "lateral-raise": { sets: 3, target: "12", weightKg: 5 }, "reverse-fly": { sets: 3, target: "12", weightKg: 5 }, "one-arm-curl": { sets: 3, target: "10", weightKg: 7 }, "overhead-extension": { sets: 2, target: "8–10", weightKg: 7 }, "triceps-kickback": { sets: 2, target: "10", weightKg: 5 }, "suitcase-carry": { sets: 3, target: "30 seg", weightKg: 10 } })] },
        { id: "w40-d4", dateISO: "2026-10-01", objective: "Subir intensidad de forma progresiva.", primaryOptionId: "group-tennis-2", options: [tennis("group-tennis-2", "Entrenamiento grupal", "Desplazamientos y recuperación al centro", ["Si el martes fue intenso, regula la sesión", "No necesitas ganar cada punto del entrenamiento"], "group-training")] },
        { id: "w40-d5", dateISO: "2026-10-02", objective: "Potencia técnica sin sumar fatiga excesiva.", primaryOptionId: "agility-reduced", options: [physical("agility-reduced", "Día 3 reducido", "Potencia técnica", "agility", ["Bicicleta estática 8–10 min", "Movilidad dinámica 5 min", "Eliminar sentadilla con salto salvo que te sientas excelente"], { "soft-shadow-tennis": { sets: 3, target: "45 seg", weightKg: "" }, "split-step": { sets: 3, target: "20 seg", weightKg: "" }, "skater-jumps": { sets: 2, target: "6 por lado", weightKg: "" }, "lateral-lunge": { sets: 2, target: "8 por lado", weightKg: "" }, "reverse-lunge": { sets: 2, target: "8 por pierna", weightKg: "" }, "lateral-return": { sets: 3, target: "20 seg", weightKg: "" }, "russian-twist": { sets: 2, target: "16 total", weightKg: 4 }, "side-plank": { sets: 2, target: "25–30 seg por lado", weightKg: "" } }, ["jump-squat", "intense-shadow-tennis"])] },
        { id: "w40-d6", dateISO: "2026-10-03", objective: "Elegir según disponibilidad y fatiga.", primaryOptionId: "weekend-tennis", options: [
          tennis("weekend-tennis", "Tenis o partido", "60–90 min · controlado", ["No sumar físico extra este día"], "match"),
          cardio("weekend-bike", "Bicicleta", "30–45 min", ["Añade movilidad 10 min"], "stationary-bike"),
          cardio("weekend-walk", "Caminata", "30–45 min", ["Añade movilidad 10 min"], "walking")
        ] },
        { id: "w40-d7", dateISO: "2026-10-04", objective: "Recuperación real.", primaryOptionId: "full-rest", options: [rest("full-rest", "Descanso", "Descanso real", ["Movilidad opcional 10 min", "Revisión semanal de cargas y molestias"])] }
      ]
    },
    {
      weekKey: "2026-W41",
      number: 41,
      startISO: "2026-10-05",
      endISO: "2026-10-11",
      label: "Semana de fortalecimiento",
      context: "Segunda semana con entrenamientos grupales.",
      objective: "Consolidar fuerza, tenis y recuperación con carga controlada.",
      sessions: [
        { id: "w41-d1", dateISO: "2026-10-05", objective: "Fuerza completa con una sola progresión.", primaryOptionId: "legs-progress", options: [physical("legs-progress", "Día 1 completo", "Piernas + glúteos + core", "legs", ["Bicicleta estática 10 min", "Movilidad dinámica 5 min", "Progresión permitida: subir solo step-up o tiempo de core; no subir todo"], { "bodyweight-squat": { sets: 2, target: "12", weightKg: "" }, "unilateral-loaded-squat": { sets: 4, target: "10", weightKg: 10 }, "bulgarian-squat": { sets: 3, target: "8 por pierna", weightKg: 10 }, "romanian-deadlift": { sets: 4, target: "10", weightKg: 10 }, "step-up": { sets: 3, target: "10 por pierna", weightKg: 7 }, "front-plank": { sets: 3, target: "40–50 seg", weightKg: "" }, "dead-bug": { sets: 3, target: "10 por lado", weightKg: "" }, "wall-sit": { sets: 2, target: "40–45 seg", weightKg: "" } }, ["soft-split-step"])] },
        { id: "w41-d2", dateISO: "2026-10-06", objective: "Intensidad media/alta controlada.", primaryOptionId: "group-tennis-focus-1", options: [tennis("group-tennis-focus-1", "Entrenamiento grupal", "Piernas activas y timing", ["Split step antes del golpe rival", "Recuperar el centro", "Cargar piernas antes de golpear", "No jugar solo con el brazo"], "group-training")] },
        { id: "w41-d3", dateISO: "2026-10-07", objective: "Tren superior completo con progresión selectiva.", primaryOptionId: "upper-progress", options: [physical("upper-progress", "Día 2 completo/moderado", "Tren superior + estabilidad", "upper", ["Movilidad hombro/escápula 7 min", "Puedes subir remo a una mano a 10 kg si 7 kg ya se siente muy fácil", "Abdominales finales: 20–25"], { "one-arm-row": { sets: 4, target: "10", weightKg: 10 }, "unsupported-row": { sets: 3, target: "10", weightKg: 7 }, "one-arm-chest-press": { sets: 4, target: "10", weightKg: 10 }, "incline-press": { sets: 3, target: "10", weightKg: 10 }, "military-press": { sets: 3, target: "8", weightKg: 7 }, "lateral-raise": { sets: 3, target: "12", weightKg: 5 }, "reverse-fly": { sets: 3, target: "12", weightKg: 5 }, "one-arm-curl": { sets: 3, target: "10", weightKg: 7 }, "overhead-extension": { sets: 3, target: "8", weightKg: 7 }, "triceps-kickback": { sets: 3, target: "10", weightKg: 5 }, "suitcase-carry": { sets: 3, target: "35–40 seg", weightKg: 10 } })] },
        { id: "w41-d4", dateISO: "2026-10-08", objective: "Sostener intensidad y técnica.", primaryOptionId: "group-tennis-focus-2", options: [tennis("group-tennis-focus-2", "Entrenamiento grupal", "Consistencia y pies activos", ["Foco: consistencia de fondo", "Revés", "Pies activos", "Recuperación después del golpe", "No hacer fuerza extra"], "group-training")] },
        { id: "w41-d5", dateISO: "2026-10-09", objective: "Calidad, explosividad y técnica; no cardio matador.", primaryOptionId: "agility-full", options: [physical("agility-full", "Día 3 completo", "Potencia + desplazamientos", "agility", ["Bicicleta estática 10 min", "Movilidad dinámica 5 min", "Split step + salida corta: 4×5 por lado"], { "soft-shadow-tennis": { sets: 3, target: "45 seg", weightKg: "" }, "split-step": { sets: 4, target: "20 seg", weightKg: "" }, "jump-squat": { sets: 3, target: "5", weightKg: "" }, "skater-jumps": { sets: 3, target: "6 por lado", weightKg: "" }, "lateral-lunge": { sets: 3, target: "8 por lado", weightKg: "" }, "reverse-lunge": { sets: 3, target: "8 por pierna", weightKg: "" }, "lateral-return": { sets: 4, target: "25 seg", weightKg: "" }, "intense-shadow-tennis": { sets: 3, target: "30 seg", weightKg: "" }, "russian-twist": { sets: 3, target: "16 total", weightKg: 4 }, "side-plank": { sets: 3, target: "30 seg por lado", weightKg: "" } })] },
        { id: "w41-d6", dateISO: "2026-10-10", objective: "Aplicar el trabajo de la semana o sumar cardio moderado.", primaryOptionId: "competition-tennis", options: [
          tennis("competition-tennis", "Partido o tenis", "60–90 min", ["Competir y aplicar piernas y timing"], "match"),
          cardio("moderate-trekking", "Trekking", "60–120 min · moderado", ["Sin convertirlo en carrera"], "trekking"),
          cardio("soft-bike", "Bicicleta", "30–45 min", ["Ritmo suave"], "stationary-bike"),
          cardio("soft-walk", "Caminata", "30–45 min", ["Ritmo suave"], "walking")
        ] },
        { id: "w41-d7", dateISO: "2026-10-11", objective: "Cerrar el bloque y revisar la respuesta corporal.", primaryOptionId: "block-recovery", options: [rest("block-recovery", "Recuperación", "Descanso + revisión semanal", ["Movilidad suave 10–15 min", "Caminata opcional 20 min", "Revisión semanal"])] }
      ]
    }
  ]
};

export const matchCalendar = Object.freeze([
  {
    dateISO: "2026-10-03", weekKey: "2026-W40", weekNumber: 40, weekStartISO: "2026-09-28", weekEndISO: "2026-10-04",
    startTime: "15:30", endTime: "17:00", court: 1, category: "A", opponent: "Felipe Reyes", homeSide: false,
    status: "likely-suspended", note: "Probable suspensión por viaje a la playa. No contar como carga competitiva hasta confirmarlo."
  },
  { dateISO: "2026-10-17", weekKey: "2026-W42", weekNumber: 42, weekStartISO: "2026-10-12", weekEndISO: "2026-10-18", startTime: "13:45", endTime: "15:15", court: 1, category: "A", opponent: "Jose Astete", homeSide: true, status: "scheduled" },
  { dateISO: "2026-10-24", weekKey: "2026-W43", weekNumber: 43, weekStartISO: "2026-10-19", weekEndISO: "2026-10-25", startTime: "13:45", endTime: "15:15", court: 2, category: "A", opponent: "Nicolás Collao", homeSide: false, status: "scheduled" },
  { dateISO: "2026-11-07", weekKey: "2026-W45", weekNumber: 45, weekStartISO: "2026-11-02", weekEndISO: "2026-11-08", startTime: "13:45", endTime: "15:15", court: 1, category: "A", opponent: "Angelo Basualto", homeSide: false, status: "scheduled" },
  { dateISO: "2026-11-14", weekKey: "2026-W46", weekNumber: 46, weekStartISO: "2026-11-09", weekEndISO: "2026-11-15", startTime: "13:45", endTime: "15:15", court: 2, category: "A", opponent: "Luis Flores", homeSide: false, status: "scheduled" },
  { dateISO: "2026-11-21", weekKey: "2026-W47", weekNumber: 47, weekStartISO: "2026-11-16", weekEndISO: "2026-11-22", startTime: "15:30", endTime: "17:00", court: 1, category: "A", opponent: "Marcelo López", homeSide: false, status: "scheduled" }
]);

function dateOffset(dateISO, days) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarMatchOption(event) {
  const conditional = event.status === "likely-suspended" ? " (si finalmente se juega)" : "";
  return {
    id: `calendar-match-${event.dateISO}`,
    title: `Partido vs. ${event.opponent}${conditional}`,
    category: "tennis",
    summary: `${event.startTime}–${event.endTime} · cancha ${event.court} · categoría ${event.category}`,
    startTime: event.startTime,
    endTime: event.endTime,
    details: [`Rival: ${event.opponent}`, "Llegar con tiempo para movilidad y calentamiento progresivo", "No sumar otra sesión física exigente este día", "Después: vuelta a la calma, hidratación y comida de recuperación"],
    prefill: { tennisTypeId: "match" },
    calendarStatus: event.status,
    opponent: event.opponent
  };
}

function inactiveMatchOption(event) {
  const title = event.status === "likely-suspended"
    ? "Viaje a la playa · partido por confirmar"
    : event.status === "suspended" ? "Partido suspendido · día flexible" : "Partido por coordinar · carga pendiente";
  return {
    id: `calendar-travel-${event.dateISO}`,
    title,
    category: "rest",
    summary: "No contar el partido como carga hasta que Open Tennis confirme fecha y estado",
    details: [event.note || "Revisar el estado antes de reorganizar la semana", "Una caminata suave y movilidad pueden ser suficientes", "No compensar el partido con una sesión intensa"],
    prefill: { restTypeId: "planned" },
    calendarStatus: event.status
  };
}

function supportingSession(event, offset) {
  const before = offset < 0;
  const dateISO = dateOffset(event.dateISO, offset);
  return {
    id: `calendar-${before ? "pre" : "post"}-${event.dateISO}`,
    dateISO,
    objective: before ? "Llegar fresco y móvil al partido." : "Recuperar y observar la respuesta corporal.",
    primaryOptionId: `calendar-${before ? "activation" : "recovery"}-${event.dateISO}`,
    options: [{
      id: `calendar-${before ? "activation" : "recovery"}-${event.dateISO}`,
      title: before ? "Activación prepartido" : "Recuperación postpartido",
      category: "rest",
      summary: before ? "Movilidad 10–15 min · sin fuerza pesada" : "Descanso, caminata suave y movilidad opcional",
      details: before ? ["Movilidad de cadera, tobillo, hombro y muñeca", "Nada de piernas pesadas, trote fuerte ni saltos"] : ["Priorizar sueño, hidratación y comida de recuperación", "Registrar molestias o fatiga antes de volver a cargar"],
      prefill: { restTypeId: "planned" },
      calendarStatus: event.status
    }]
  };
}

function calendarWeek(event) {
  return { weekKey: event.weekKey, number: event.weekNumber, startISO: event.weekStartISO, endISO: event.weekEndISO,
    label: `Semana de partido · ${event.opponent}`,
    context: `Partido programado contra ${event.opponent} el sábado ${event.dateISO}, de ${event.startTime} a ${event.endTime}, en cancha ${event.court}.`,
    objective: "Llegar con energía al partido y recuperar sin acumular fatiga innecesaria.", sessions: [] };
}

export function withMatchCalendar(sourceBlock, events = sourceBlock?.matchCalendar?.length ? sourceBlock.matchCalendar : matchCalendar) {
  if (!sourceBlock?.weeks) return sourceBlock;
  const block = structuredClone(sourceBlock);
  block.weeks = Array.isArray(block.weeks) ? block.weeks : [];
  const calendar = Array.isArray(events) && events.length ? events : matchCalendar;
  block.matchCalendar = structuredClone(calendar);
  for (const event of calendar) {
    const isConfirmed = event.status === "scheduled";
    let week = block.weeks.find(item => item.weekKey === event.weekKey || (event.dateISO >= item.startISO && event.dateISO <= item.endISO));
    if (!week) { week = calendarWeek(event); block.weeks.push(week); }
    week.sessions = Array.isArray(week.sessions) ? week.sessions : [];
    week.label = isConfirmed ? `Semana de partido · ${event.opponent}` : event.status === "likely-suspended" ? "Semana de viaje y partido por confirmar" : "Semana de partido por confirmar";
    week.context = !isConfirmed
      ? `${event.note || `El partido contra ${event.opponent} no está confirmado.`} No se cuenta como carga hasta confirmarlo.`
      : `Partido programado contra ${event.opponent} el sábado ${event.dateISO}, de ${event.startTime} a ${event.endTime}, en cancha ${event.court}.`;
    week.objective = !isConfirmed ? "Mantener la semana flexible y evitar compensar con carga innecesaria." : "Llegar con energía al partido y recuperar sin acumular fatiga innecesaria.";
    let session = week.sessions.find(item => item.dateISO === event.dateISO);
    if (!session) { session = { id: `calendar-session-${event.dateISO}`, dateISO: event.dateISO, options: [] }; week.sessions.push(session); }
    const existingAlternatives = (session.options || []).filter(item => !String(item.id || "").startsWith("calendar-") && !(item.category === "tennis" && item.prefill?.tennisTypeId === "match"));
    const matchOption = calendarMatchOption(event);
    session.objective = !isConfirmed ? "Confirmar fecha y estado del partido y adaptar el día sin compensar." : `Competir contra ${event.opponent} con calentamiento y recuperación adecuados.`;
    Object.assign(session, { startTime: event.startTime, endTime: event.endTime, calendarStatus: event.status, opponent: event.opponent, court: event.court, matchCategory: event.category });
    if (!isConfirmed) {
      const travel = inactiveMatchOption(event);
      session.primaryOptionId = travel.id;
      session.options = [travel, matchOption, ...existingAlternatives];
    } else {
      session.primaryOptionId = matchOption.id;
      session.options = [matchOption, ...existingAlternatives];
      for (const offset of [-1, 1]) {
        const dateISO = dateOffset(event.dateISO, offset);
        if (!week.sessions.some(item => item.dateISO === dateISO)) week.sessions.push(supportingSession(event, offset));
      }
    }
    week.sessions.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
  }
  block.weeks.sort((a, b) => a.startISO.localeCompare(b.startISO));
  block.startISO = [block.startISO, ...block.weeks.map(week => week.startISO)].filter(Boolean).sort()[0];
  block.endISO = [block.endISO, ...block.weeks.map(week => week.endISO)].filter(Boolean).sort().at(-1);
  const calendarRules = [
    "El calendario de partidos de escalerilla prevalece al adaptar carga, recuperación y nutrición de cada semana.",
    "En las 48 horas previas a un partido confirmado evita piernas pesadas, pliometría intensa y cardio exigente.",
    "El partido del 3 de octubre contra Felipe Reyes está probablemente suspendido por viaje a la playa: no se cuenta como carga hasta confirmarlo."
  ];
  block.rules = [...new Set([...(block.rules || []), ...calendarRules])];
  return block;
}

export const coachTrainingBlock = withMatchCalendar(baseCoachTrainingBlock);
export const coachBaseTrainingBlock = baseCoachTrainingBlock;

export function coachSessionForDate(dateISO, block = coachTrainingBlock) {
  for (const week of block.weeks) {
    const session = week.sessions.find(item => item.dateISO === dateISO);
    if (session) return { ...session, week };
  }
  return null;
}

export function coachWeekForDate(dateISO, block = coachTrainingBlock) {
  return block.weeks.find(week => dateISO >= week.startISO && dateISO <= week.endISO) || null;
}

export function coachOption(session, optionId) {
  return session?.options?.find(item => item.id === optionId) || null;
}
