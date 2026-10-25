export const TZ = "America/Santiago";

export const dayNamesShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const dayNamesFull = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const trainingCategories = [
  {
    id: "physical",
    name: "Entrenamiento físico",
    shortName: "Físico",
    description: "Fuerza, estabilidad y habilidades para el tenis.",
    accent: "lime"
  },
  {
    id: "cardio",
    name: "Cardio",
    shortName: "Cardio",
    description: "Bicicleta, trote, caminata, trekking o pádel.",
    accent: "coral"
  },
  {
    id: "tennis",
    name: "Tenis",
    shortName: "Tenis",
    description: "Sesiones de cancha, superficie y sensaciones.",
    accent: "blue"
  },
  {
    id: "warmup",
    name: "Calentamiento para jugar",
    shortName: "Calentamiento",
    description: "Abre la guía y prepara cuerpo, pies y golpes antes de entrar a la cancha.",
    accent: "lime"
  },
  {
    id: "stretching",
    name: "Estiramientos",
    shortName: "Estiramientos",
    description: "Vuelta a la calma guiada después de jugar o entrenar.",
    accent: "blue"
  },
  {
    id: "rest",
    name: "Descanso",
    shortName: "Descanso",
    description: "Recuperación planificada, clima o descanso por molestia.",
    accent: "violet"
  }
];

export const restTypes = [
  { id: "planned", name: "Día de descanso", description: "Recuperación planificada, sin molestias." },
  { id: "weather", name: "Descanso por clima", description: "No pudiste realizar la actividad por lluvia u otras condiciones climáticas." },
  { id: "discomfort", name: "Descanso por molestia", description: "No entrenaste debido a dolor o molestia física." }
];

// Rutinas base personales. Los ajustes de progresión se guardan en el dispositivo.
export const physicalRoutines = [
  {
    id: "legs",
    name: "Día 1 · Piernas + glúteos + core",
    focus: "Base obligatoria · fuerza, cadera y estabilidad",
    objective: "Fortalecer piernas, cadera, glúteos y core para arrancar, frenar y proteger las rodillas.",
    expectedDurationMinutes: 60,
    recommendedFor: ["sesión base semanal de fuerza inferior", "piernas recuperadas", "al menos 48 horas antes de un partido exigente"],
    avoidWhen: ["dolor actual de rodilla o Aquiles", "piernas pesadas", "partido dentro de 24 horas"],
    equipment: ["bicicleta estática", "mancuerna o kettlebell de 7–8 kg", "silla o banco estable"],
    exercises: [
      { id: "stationary-bike-warmup", phase: "Calentamiento", name: "Bicicleta estática", sets: 1, target: "10 min", weightKg: "", description: "Pedalea 10 minutos a intensidad suave o moderada antes de comenzar la rutina.", benefit: "Eleva la temperatura corporal y prepara las piernas sin impacto." },
      { id: "bodyweight-squat", phase: "Calentamiento", name: "Sentadilla sin peso", sets: 2, target: "12", weightKg: "", description: "Baja controlado, con las rodillas alineadas y la espalda firme.", benefit: "Prepara piernas y cadera para posiciones bajas." },
      { id: "soft-split-step", phase: "Calentamiento", name: "Split step suave", sets: 3, target: "20 seg", weightKg: "", description: "Haz un pequeño salto y cae activo sobre ambos pies.", benefit: "Mejora la reacción antes de desplazarte." },
      { id: "unilateral-loaded-squat", phase: "Fuerza principal", name: "Sentadilla con carga unilateral", sets: 4, target: "10", weightKg: 8, progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Sostén la carga de un lado y mantén el tronco estable durante la sentadilla.", benefit: "Fortalece piernas y la estabilidad del core para transferir fuerza.", weightSuggestion: "Peso sugerido inicial: 8 kg." },
      { id: "bulgarian-squat", phase: "Fuerza principal", name: "Sentadilla búlgara", sets: 3, target: "8 por pierna", weightKg: "", progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Apoya el pie trasero en alto y baja usando principalmente la pierna delantera.", benefit: "Trabaja fuerza unilateral, equilibrio y cambios de dirección.", weightSuggestion: "Comienza sin peso; usa 7–8 kg solo si te sientes estable." },
      { id: "romanian-deadlift", phase: "Fuerza principal", name: "Peso muerto rumano", sets: 4, target: "10", weightKg: 7, progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Lleva la cadera atrás mientras bajas la carga con la espalda neutra.", benefit: "Refuerza glúteos e isquiotibiales para acelerar y frenar.", weightSuggestion: "Peso sugerido inicial: 7–8 kg, lento y controlado." },
      { id: "step-up", phase: "Fuerza principal", name: "Step-up", sets: 3, target: "10 por pierna", weightKg: "", progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Sube a un banco o escalón impulsándote principalmente con una pierna.", benefit: "Desarrolla fuerza unilateral e impulso desde una pierna.", weightSuggestion: "Peso corporal; agrega 7 kg cuando resulte fácil." },
      { id: "front-plank", phase: "Core", name: "Plancha frontal", sets: 3, target: "30–45 seg", weightKg: "", description: "Mantén el cuerpo alineado apoyado en antebrazos y pies.", benefit: "Estabiliza el tronco para transmitir fuerza desde las piernas." },
      { id: "dead-bug", phase: "Core", name: "Dead bug", sets: 3, target: "10 por lado", weightKg: "", description: "Extiende lentamente un brazo y la pierna contraria sin perder la posición lumbar.", benefit: "Mejora coordinación cruzada y control del core." },
      { id: "wall-sit", phase: "Core", name: "Sentadilla isométrica en pared", sets: 2, target: "30–45 seg", weightKg: "", description: "Apoya la espalda en la pared y mantén las rodillas flexionadas.", benefit: "Aumenta la resistencia para sostener posiciones bajas." }
    ]
  },
  {
    id: "upper",
    name: "Día 2 · Tren superior + estabilidad",
    focus: "Base obligatoria · hombro, espalda, pecho y brazo",
    objective: "Fortalecer el tren superior y el core con intensidad moderada, buena técnica y sin llegar al fallo.",
    expectedDurationMinutes: 55,
    recommendedFor: ["sesión base de tren superior", "brazo derecho recuperado", "desarrollar fuerza y estabilidad para tolerar el golpeo"],
    avoidWhen: ["dolor actual de hombro, codo, antebrazo o pulgar derecho", "volumen alto de tenis sin recuperar"],
    equipment: ["bicicleta estática", "mancuernas de 7 kg", "carga liviana de 1–3 kg"],
    exercises: [
      { id: "stationary-bike-warmup", phase: "Calentamiento", name: "Bicicleta estática", sets: 1, target: "10 min", weightKg: "", description: "Pedalea 10 minutos a intensidad suave o moderada antes de comenzar la rutina.", benefit: "Activa la circulación y prepara el cuerpo para el trabajo de fuerza." },
      { id: "shoulder-mobility", phase: "Calentamiento", name: "Movilidad de hombro sin peso", sets: 1, target: "3 min", weightKg: "", description: "Haz círculos suaves, elevaciones controladas y aperturas de brazos.", benefit: "Prepara hombro y escápula para golpes y saque." },
      { id: "one-arm-row", phase: "Espalda", name: "Remo a una mano", sets: 3, target: "10", weightKg: 7, progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Con el torso inclinado, lleva la mancuerna hacia la cadera.", benefit: "Mejora la tracción y la estabilidad escapular.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "one-arm-chest-press", phase: "Pecho", name: "Press de pecho unilateral", sets: 3, target: "10", weightKg: 7, progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Acostado, empuja la mancuerna desde el pecho hasta extender el brazo.", benefit: "Desarrolla empuje y resistencia a la rotación del core.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "military-press", phase: "Hombros", name: "Press militar unilateral", sets: 3, target: "8", weightKg: 7, progression: { type: "double", minTarget: 6, maxTarget: 10, loadStepKg: 1 }, description: "Desde el hombro, empuja la mancuerna verticalmente sobre la cabeza.", benefit: "Aporta estabilidad por encima de la cabeza para saque y smash.", weightSuggestion: "7 kg solo si no hay dolor; si molesta, baja carga o repeticiones." },
      { id: "lateral-raise", phase: "Hombros", name: "Elevación lateral", sets: 3, target: "12", weightKg: "", progression: { type: "double", minTarget: 10, maxTarget: 15, loadStepKg: 0.5 }, description: "Eleva el brazo lateralmente hasta la altura del hombro.", benefit: "Fortalece el deltoides y la estabilidad del brazo.", weightSuggestion: "Usa menos de 7 kg; una botella sirve como carga liviana." },
      { id: "reverse-fly", phase: "Hombros", name: "Pájaros", sets: 3, target: "12", weightKg: "", progression: { type: "double", minTarget: 10, maxTarget: 15, loadStepKg: 0.5 }, description: "Inclina el torso y eleva el brazo lateralmente controlando la bajada.", benefit: "Refuerza hombro posterior y desaceleración después del golpe.", weightSuggestion: "Carga liviana; usa botella o banda si 7 kg es mucho." },
      { id: "one-arm-curl", phase: "Brazos", name: "Curl unilateral", sets: 3, target: "10", weightKg: 7, progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Lleva la mancuerna hacia el hombro de forma controlada.", benefit: "Ayuda a estabilizar y desacelerar la raqueta.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "overhead-extension", phase: "Brazos", name: "Extensión sobre la cabeza", sets: 3, target: "10", weightKg: 7, progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Baja la mancuerna detrás de la cabeza y vuelve a extender el codo.", benefit: "Fortalece la extensión usada en saque y golpes altos.", weightSuggestion: "7 kg solo si no molesta el codo o el hombro." },
      { id: "suitcase-carry", phase: "Core final", name: "Suitcase carry", sets: 3, target: "30–40 seg", weightKg: 8, description: "Camina con una carga en una mano manteniendo el cuerpo vertical.", benefit: "Entrena estabilidad lateral y antirotación del core.", weightSuggestion: "Peso sugerido inicial: 7–8 kg." }
    ]
  },
  {
    id: "agility",
    name: "Día 3 · Potencia + desplazamientos",
    focus: "Base obligatoria · reacción y tenis específico",
    objective: "Mejorar aceleración, reacción, recuperación al centro y potencia de piernas sin buscar fatiga de hipertrofia.",
    expectedDurationMinutes: 50,
    recommendedFor: ["sesión base de potencia", "piernas frescas", "desarrollar velocidad y desplazamiento lejos de competencia inmediata"],
    avoidWhen: ["dolor de rodilla o Aquiles", "partido dentro de 24 horas", "fatiga que reduzca la calidad de salto o frenada"],
    equipment: ["bicicleta estática", "espacio despejado"],
    exercises: [
      { id: "stationary-bike-warmup", phase: "Calentamiento", name: "Bicicleta estática", sets: 1, target: "10 min", weightKg: "", description: "Pedalea 10 minutos a intensidad suave o moderada antes de comenzar la rutina.", benefit: "Prepara piernas y articulaciones para los movimientos explosivos posteriores." },
      { id: "soft-shadow-tennis", phase: "Calentamiento", name: "Shadow tennis suave", sets: 3, target: "45 seg", weightKg: "", description: "Simula derechas, reveses y preparación sin pelota.", benefit: "Practica técnica, transferencia de peso y coordinación." },
      { id: "split-step", phase: "Calentamiento", name: "Split step", sets: 4, target: "20 seg", weightKg: "", description: "Haz un pequeño salto y aterriza activo antes de desplazarte.", benefit: "Mejora la reacción y la salida hacia cualquier dirección." },
      { id: "jump-squat", phase: "Potencia", name: "Sentadilla con salto", sets: 3, target: "6", weightKg: "", description: "Desde la sentadilla, impulsa el cuerpo en un salto vertical y aterriza con control.", benefit: "Desarrolla potencia para arrancadas y recuperación.", caution: "Hazla solo si rodilla y Aquiles están bien; si molesta, usa sentadilla rápida sin salto." },
      { id: "skater-jumps", phase: "Potencia", name: "Skater jumps", sets: 3, target: "8 por lado", weightKg: "", description: "Salta lateralmente de una pierna a otra estabilizando cada aterrizaje.", benefit: "Trabaja potencia lateral, equilibrio y desplazamiento." },
      { id: "lateral-lunge", phase: "Piernas", name: "Zancada lateral", sets: 3, target: "10 por lado", weightKg: "", progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Da un paso amplio al costado, flexiona esa pierna y mantén la otra extendida.", benefit: "Refuerza posiciones abiertas y desplazamientos laterales.", weightSuggestion: "Peso corporal; agrega 7 kg cuando resulte cómodo." },
      { id: "reverse-lunge", phase: "Piernas", name: "Zancada hacia atrás", sets: 3, target: "10 por pierna", weightKg: "", progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 1 }, description: "Lleva una pierna atrás, baja con control y vuelve a impulsarte.", benefit: "Desarrolla fuerza unilateral y control al frenar.", weightSuggestion: "Peso corporal; agrega 7 kg cuando resulte cómodo." },
      { id: "lateral-return", phase: "Desplazamiento", name: "Desplazamiento lateral + regreso al centro", sets: 5, target: "30 seg", weightKg: "", description: "Sal del centro, simula el golpe y vuelve rápido a la posición inicial.", benefit: "Entrena directamente salir, golpear y recuperar posición." },
      { id: "intense-shadow-tennis", phase: "Desplazamiento", name: "Shadow tennis intenso", sets: 4, target: "45 seg", weightKg: "", description: "Simula un punto con split step, golpes y recuperación.", benefit: "Mejora fluidez, timing y resistencia específica." },
      { id: "russian-twist", phase: "Core", name: "Russian twist", sets: 3, target: "16 total", weightKg: "", description: "Gira el torso llevando la carga de un lado al otro con control.", benefit: "Trabaja el control rotacional usado en derecha y revés.", weightSuggestion: "Usa 7 kg solo con buen control; si no, hazlo sin peso." },
      { id: "side-plank", phase: "Core", name: "Plancha lateral", sets: 3, target: "25–35 seg por lado", weightKg: "", description: "Mantén el cuerpo de lado apoyado en un antebrazo y los pies.", benefit: "Desarrolla estabilidad lateral durante golpes y desplazamientos." }
    ]
  },
  {
    id: "full-body",
    name: "Día 4 extra · Antebrazo + técnica",
    focus: "Opcional · muñeca, core y estabilidad",
    objective: "Complementar agarre, antebrazo, muñeca, core y técnica sin cargar demasiado las piernas.",
    expectedDurationMinutes: 50,
    recommendedFor: ["complementar técnica, core y antebrazo", "piernas cargadas pero brazo derecho recuperado", "semana con poco trabajo complementario"],
    avoidWhen: ["sobrecarga de hombro, codo, antebrazo o pulgar derecho", "volumen alto de golpeo sin recuperar"],
    equipment: ["bicicleta estática", "carga liviana de 1–3 kg", "mancuerna de 7–8 kg para suitcase carry"],
    exercises: [
      { id: "stationary-bike-warmup", phase: "Calentamiento", name: "Bicicleta estática", sets: 1, target: "10 min", weightKg: "", description: "Pedalea 10 minutos a intensidad suave o moderada antes de comenzar la rutina.", benefit: "Activa el cuerpo completo antes del trabajo técnico y de estabilidad." },
      { id: "shadow-tennis", phase: "Técnica", name: "Shadow tennis", sets: 4, target: "45 seg", weightKg: "", description: "Simula derechas, reveses, saques y otros golpes sin pelota.", benefit: "Practica técnica, transferencia de peso y coordinación." },
      { id: "split-step-short", phase: "Técnica", name: "Split step + salida corta", sets: 4, target: "20 seg", weightKg: "", description: "Haz split step y una salida corta a derecha o izquierda.", benefit: "Mejora reacción inicial y preparación antes del golpe." },
      { id: "wrist-curl", phase: "Antebrazo y muñeca", name: "Curl de muñeca", sets: 3, target: "15", weightKg: "", progression: { type: "double", minTarget: 12, maxTarget: 15, loadStepKg: 0.5 }, description: "Apoya el antebrazo y flexiona la muñeca con control.", benefit: "Fortalece flexores y resistencia del agarre.", weightSuggestion: "Carga muy liviana: 1–3 kg. No usar 7 kg." },
      { id: "reverse-wrist-curl", phase: "Antebrazo y muñeca", name: "Curl inverso de muñeca", sets: 3, target: "15", weightKg: "", progression: { type: "double", minTarget: 12, maxTarget: 15, loadStepKg: 0.5 }, description: "Eleva el dorso de la mano con el antebrazo apoyado.", benefit: "Fortalece extensores y equilibra el trabajo del agarre.", weightSuggestion: "Carga sugerida: 1–3 kg." },
      { id: "wrist-rotation", phase: "Antebrazo y muñeca", name: "Rotación de muñeca", sets: 3, target: "12 por lado", weightKg: "", description: "Realiza rotaciones lentas con una carga ligera.", benefit: "Mejora el control de muñeca y antebrazo.", weightSuggestion: "Usa muy poco peso porque la palanca aumenta la carga." },
      { id: "pronation-supination", phase: "Antebrazo y muñeca", name: "Pronación y supinación", sets: 3, target: "12 por lado", weightKg: "", description: "Gira lentamente el antebrazo con la palma hacia arriba y abajo.", benefit: "Refuerza la rotación del antebrazo usada al controlar la raqueta.", weightSuggestion: "Carga sugerida: 1–3 kg." },
      { id: "front-raise", phase: "Hombro controlado", name: "Elevación frontal", sets: 3, target: "12", weightKg: "", progression: { type: "double", minTarget: 10, maxTarget: 15, loadStepKg: 0.5 }, description: "Eleva la carga al frente manteniendo el brazo casi extendido.", benefit: "Fortalece el hombro anterior involucrado en la aceleración.", weightSuggestion: "Usa carga liviana; una botella sirve si 7 kg es mucho." },
      { id: "one-arm-fly", phase: "Hombro controlado", name: "Apertura unilateral", sets: 3, target: "10", weightKg: "", progression: { type: "double", minTarget: 8, maxTarget: 12, loadStepKg: 0.5 }, description: "Abre lentamente el brazo hacia el costado y vuelve al centro.", benefit: "Trabaja el control de pecho y hombro en movimientos amplios.", weightSuggestion: "Carga liviana y controlada; no hacerlo pesado." },
      { id: "front-plank", phase: "Core", name: "Plancha frontal", sets: 3, target: "40 seg", weightKg: "", description: "Mantén el cuerpo alineado y el abdomen activo.", benefit: "Aporta estabilidad y transmisión de fuerza." },
      { id: "suitcase-carry", phase: "Core", name: "Suitcase carry", sets: 3, target: "40 seg", weightKg: 8, description: "Camina con la carga en una mano sin inclinar el tronco.", benefit: "Entrena estabilidad lateral y antirotación." },
      { id: "dead-bug", phase: "Core", name: "Dead bug", sets: 3, target: "10 por lado", weightKg: "", description: "Extiende un brazo y la pierna contraria manteniendo estable la zona lumbar.", benefit: "Mejora coordinación cruzada y control del core." }
    ]
  },
  {
    id: "core",
    name: "Día 5 extra · Full core para tenis",
    focus: "Opcional · 40 min · estabilidad 360° y transferencia",
    objective: "Desarrollar control lumbar, pélvico, lateral y rotacional para transferir fuerza a los golpes sin depender del apoyo de ambos brazos.",
    expectedDurationMinutes: 40,
    durationGuidance: "5 min de activación · 3 bloques de core · transferencia y vuelta a la calma. Descansa 30–40 seg entre series y 60 seg entre bloques; la calidad manda sobre la velocidad.",
    recommendedFor: ["mejorar estabilidad central", "complementar una semana sin suficiente core", "entrenar sin depender del apoyo de ambos brazos"],
    avoidWhen: ["fatiga marcada del tronco", "dolor lumbar", "partido inmediato si la sesión pudiera dejar rigidez"],
    equipment: ["bicicleta estática", "mancuerna o kettlebell de 7–8 kg", "silla"],
    exercises: [
      { id: "stationary-bike-warmup", phase: "Activación · 5 min", name: "Bicicleta estática", sets: 1, target: "5 min", weightKg: "", description: "Pedalea suave y aumenta ligeramente el ritmo durante el último minuto, sin buscar fatiga.", benefit: "Eleva la temperatura corporal y prepara cadera y tronco para estabilizar." },
      { id: "core-90-90-breathing", phase: "Activación · control", name: "Respiración 90/90 + brace", sets: 2, target: "5 respiraciones", weightKg: "", description: "Acuéstate con pantorrillas sobre una silla, cadera y rodillas a 90°. Deja ambos brazos en su posición cómoda, exhala largo y activa el abdomen sin despegar la zona lumbar.", benefit: "Enseña a crear presión abdominal sin tensar el cuello ni compensar con el brazo derecho." },
      { id: "adapted-curl-up", phase: "Bloque A · anti-extensión", name: "Curl-up modificado", sets: 3, target: "6 por lado · 5 seg", weightKg: "", description: "Con una rodilla flexionada y la otra pierna extendida, eleva apenas cabeza y hombros manteniendo la columna neutra. Los brazos quedan relajados y no ayudan a subir.", benefit: "Fortalece la pared anterior para estabilizar el tronco durante golpes y frenadas.", caution: "No tires del cuello ni aplastes la zona lumbar. Cambia la pierna flexionada en cada lado; si molesta la espalda, reduce la elevación." },
      { id: "legs-only-dead-bug", phase: "Bloque A · anti-extensión", name: "Dead bug solo con piernas", sets: 3, target: "8 por lado", weightKg: "", description: "Boca arriba, lleva cadera y rodillas a 90°. Baja un talón hacia el suelo y vuelve sin arquear la espalda; mantén los brazos descansando, sin usarlos como apoyo.", benefit: "Mejora el control lumbo-pélvico sin exigir una función simétrica de los brazos." },
      { id: "glute-bridge-march", phase: "Bloque A · pelvis", name: "Puente de glúteos con marcha", sets: 3, target: "10 total", weightKg: "", description: "Eleva la cadera y alterna despegar un pie pocos centímetros. Mantén la pelvis nivelada y los brazos relajados.", benefit: "Integra glúteos y core para controlar la pelvis en apoyos unilaterales.", caution: "Si la pelvis gira, realiza primero un puente normal de 10–12 repeticiones." },
      { id: "side-lying-oblique-crunch", phase: "Bloque B · estabilidad lateral", name: "Contracción oblicua de lado", sets: 3, target: "8 por lado", weightKg: "", description: "Acuéstate de lado con rodillas flexionadas. Acerca suavemente las costillas a la cadera elevando apenas cabeza y hombros, sin empujarte con los brazos.", benefit: "Trabaja ambos costados del tronco sin requerir planchas ni apoyos sobre el brazo izquierdo.", caution: "El movimiento es corto y controlado. Si carga el cuello, mantén la cabeza apoyada y haz solo la contracción isométrica durante 15–20 seg." },
      { id: "seated-trunk-rotation", phase: "Bloque B · rotación", name: "Rotación de tronco sentado", sets: 3, target: "8 por lado", weightKg: "", description: "Siéntate erguido con pies apoyados. Gira costillas y tronco sobre una pelvis estable, sin peso y sin tomar impulso con los brazos.", benefit: "Mejora el control de la rotación que conecta piernas, tronco y raqueta.", caution: "No busques rango máximo. Si aparece molestia lumbar, acorta el giro y exhala durante el movimiento." },
      { id: "right-suitcase-march", phase: "Bloque C · antiinclinación", name: "Marcha suitcase con mano derecha", sets: 3, target: "30–40 seg", weightKg: 8, description: "Sostén la carga solo con la mano derecha y marcha lento sin inclinarte. Mantén costillas sobre pelvis y pasos silenciosos.", benefit: "Entrena estabilidad lateral y antirotación respetando que la carga se sostiene con el brazo funcional.", weightSuggestion: "Comienza con 7–8 kg. Progresa primero hasta 40 seg estables y solo después aumenta la carga.", caution: "Detén o reemplaza por marcha sin peso si se carga el pulgar, antebrazo, codo u hombro derecho." },
      { id: "single-leg-knee-drive-hold", phase: "Bloque C · estabilidad de pie", name: "Equilibrio con rodilla elevada", sets: 3, target: "20 seg por lado", weightKg: "", description: "De pie, eleva una rodilla y mantén pelvis y tronco quietos. Usa una pared cercana y toca con la mano derecha solo si necesitas recuperar el equilibrio.", benefit: "Refuerza la estabilidad del core sobre una pierna, clave al golpear abierto y recuperar la posición.", caution: "Mantén el pie de apoyo activo. Si rodilla o Aquiles molestan, baja la altura de la rodilla y reduce el tiempo." },
      { id: "core-controlled-shadow-tennis", phase: "Transferencia · tenis", name: "Shadow tennis con control del core", sets: 3, target: "45 seg", weightKg: "", description: "Simula golpes al 60–70%: prepara, rota desde cadera y tronco, frena el giro y recupera el centro. Prioriza control sobre velocidad.", benefit: "Transfiere el trabajo de estabilidad a la secuencia real de golpeo y recuperación." },
      { id: "core-cooldown-breathing", phase: "Vuelta a la calma", name: "Respiración y descarga lumbar", sets: 1, target: "3 min", weightKg: "", description: "Boca arriba con rodillas flexionadas, respira lento y deja caer ambas rodillas a cada lado dentro de un rango cómodo.", benefit: "Reduce tensión del tronco y permite terminar sin rigidez innecesaria.", caution: "El movimiento debe ser suave y sin dolor; no fuerces la rotación." }
    ]
  },
  {
    id: "mobility-recovery",
    name: "Recuperación · Movilidad + descarga",
    focus: "Complementaria · 25–30 min · recuperar movimiento",
    objective: "Recuperar movilidad de tobillos, cadera y tronco, descargar el brazo derecho y terminar con mejor disposición para la siguiente sesión.",
    expectedDurationMinutes: 28,
    durationGuidance: "RPE 2–4/10. Respira con calma, usa rangos cómodos y descansa solo lo necesario para cambiar de posición.",
    recommendedFor: ["día posterior a partido o tenis exigente", "fatiga general o piernas pesadas sin dolor relevante", "sueño insuficiente", "vuelta gradual tras una pausa"],
    avoidWhen: ["dolor agudo", "mareo o síntomas que impidan moverse con seguridad"],
    equipment: ["bicicleta estática opcional", "pared o silla"],
    exercises: [
      { id: "recovery-bike", phase: "Entrada en calor", name: "Bicicleta muy suave", sets: 1, target: "5 min", weightKg: "", description: "Pedalea a ritmo conversacional, sin resistencia alta.", benefit: "Aumenta circulación sin sumar impacto ni fatiga." },
      { id: "recovery-90-90-breathing", phase: "Respiración", name: "Respiración 90/90", sets: 2, target: "5 respiraciones", weightKg: "", description: "Acuéstate con pantorrillas sobre una silla y exhala largo; deja ambos brazos cómodos.", benefit: "Reduce tensión accesoria y recupera control de costillas y pelvis." },
      { id: "ankle-rock-wall", phase: "Movilidad", name: "Rodilla a pared para tobillo", sets: 2, target: "8 por lado", weightKg: "", description: "Lleva la rodilla hacia la pared sin despegar el talón; usa la mano derecha solo para equilibrarte.", benefit: "Mejora el rango de tobillo necesario para frenar y bajar el centro de gravedad." },
      { id: "supine-hip-rotation", phase: "Movilidad", name: "Rotación de cadera acostado", sets: 2, target: "8 por lado", weightKg: "", description: "Boca arriba con rodillas flexionadas, deja caer ambas piernas a cada lado dentro de un rango cómodo.", benefit: "Moviliza cadera y tronco sin exigir apoyo de brazos." },
      { id: "half-kneeling-hip-flexor", phase: "Movilidad", name: "Movilidad de flexor de cadera", sets: 2, target: "30 seg por lado", weightKg: "", description: "En media rodilla, lleva suavemente la pelvis hacia delante sin arquear la espalda; usa una silla si necesitas estabilidad.", benefit: "Libera la cadera para zancadas y recuperación al centro." },
      { id: "seated-thoracic-rotation", phase: "Movilidad", name: "Rotación torácica sentado", sets: 2, target: "6 por lado", weightKg: "", description: "Sentado y erguido, gira el pecho sin tomar impulso con los brazos.", benefit: "Recupera rotación del tronco sin cargar la zona lumbar." },
      { id: "right-scapular-circles", phase: "Descarga superior", name: "Círculos escapulares derechos", sets: 2, target: "8 por sentido", weightKg: "", description: "Mueve lentamente la escápula derecha hacia arriba, atrás, abajo y delante con el brazo relajado.", benefit: "Descarga el hombro funcional después del volumen de golpeo." },
      { id: "right-forearm-release", phase: "Descarga superior", name: "Movilidad de muñeca y antebrazo derecho", sets: 2, target: "30 seg por posición", weightKg: "", description: "Alterna flexión, extensión, pronación y supinación sin forzar.", benefit: "Reduce rigidez acumulada por agarre y desaceleración de la raqueta.", caution: "No empujes sobre dolor, hormigueo ni pérdida de fuerza." },
      { id: "recovery-glute-bridge", phase: "Activación suave", name: "Puente de glúteos", sets: 2, target: "10", weightKg: "", description: "Eleva la cadera sin hiperextender la espalda y baja lentamente.", benefit: "Reactiva glúteos sin dejar fatiga residual." },
      { id: "recovery-cooldown", phase: "Cierre", name: "Respiración de vuelta a la calma", sets: 1, target: "3 min", weightKg: "", description: "Respira lento en una posición cómoda y comprueba cómo respondió el cuerpo.", benefit: "Cierra la sesión con una referencia clara de recuperación." }
    ]
  },
  {
    id: "prematch-activation",
    name: "Prepartido · Activación 18 min",
    focus: "Complementaria · 15–20 min · llegar despierto, no cansado",
    objective: "Activar temperatura, apoyos, primera salida y secuencia de golpeo sin generar fatiga antes de competir.",
    expectedDurationMinutes: 18,
    durationGuidance: "RPE 4–6/10. Descansos breves, movimientos nítidos y ninguna serie al fallo; debes terminar con más energía de la que empezaste.",
    recommendedFor: ["mismo día de partido", "antes de tenis cuando falta activación", "día previo si solo se necesita despertar el cuerpo"],
    avoidWhen: ["dolor que altera los apoyos", "fatiga o malestar que justifique recuperación"],
    equipment: ["bicicleta estática opcional", "espacio corto bajo techo"],
    exercises: [
      { id: "prematch-bike", phase: "Temperatura", name: "Bicicleta progresiva", sets: 1, target: "4 min", weightKg: "", description: "Comienza suave y termina a ritmo moderado, sin quemar las piernas.", benefit: "Eleva temperatura con bajo impacto." },
      { id: "prematch-ankle-hip", phase: "Movilidad dinámica", name: "Tobillos + apertura de cadera", sets: 1, target: "2 min", weightKg: "", description: "Alterna balanceos de tobillo, marcha y apertura de cadera; apóyate con la mano derecha si hace falta.", benefit: "Prepara rangos usados al frenar y golpear abierto." },
      { id: "prematch-squat", phase: "Activación", name: "Sentadilla sin peso", sets: 2, target: "8", weightKg: "", description: "Baja controlado y sube con intención rápida, sin saltar.", benefit: "Activa piernas para la posición de espera." },
      { id: "prematch-lateral-lunge", phase: "Activación", name: "Zancada lateral corta", sets: 2, target: "6 por lado", weightKg: "", description: "Da un paso lateral corto, carga la cadera y vuelve al centro.", benefit: "Prepara apoyos abiertos sin acumular volumen." },
      { id: "prematch-split-step", phase: "Reacción", name: "Split step reactivo", sets: 3, target: "15 seg", weightKg: "", description: "Haz apoyos pequeños y elásticos con pausas completas entre series.", benefit: "Despierta la primera reacción sin fatigar." },
      { id: "prematch-first-step", phase: "Reacción", name: "Primera salida + frenada", sets: 3, target: "3 por lado", weightKg: "", description: "Desde split step, realiza una salida corta, frena estable y vuelve caminando.", benefit: "Activa aceleración y control del primer apoyo." },
      { id: "prematch-shadow", phase: "Transferencia", name: "Shadow tennis progresivo", sets: 3, target: "30 seg", weightKg: "", description: "Simula puntos del 50 al 75%, coordinando preparación, golpe y regreso al centro.", benefit: "Conecta activación física con ritmo de juego." },
      { id: "prematch-reset", phase: "Cierre", name: "Respiración + foco", sets: 1, target: "1 min", weightKg: "", description: "Baja pulsaciones, suelta el brazo derecho y define una consigna simple para comenzar.", benefit: "Permite entrar a cancha activado y con atención estable." }
    ]
  },
  {
    id: "indoor-power",
    name: "Bajo techo · Potencia controlada",
    focus: "Complementaria · 35 min · lluvia y poco espacio",
    objective: "Entrenar velocidad de aplicación de fuerza, apoyos y desplazamiento específico cuando no es posible jugar en cancha.",
    expectedDurationMinutes: 35,
    durationGuidance: "RPE 6–7/10. Descansa 45–60 seg y detén cada bloque cuando pierdas velocidad o control.",
    recommendedFor: ["tenis suspendido por lluvia", "espacio cubierto disponible", "piernas recuperadas y sin partido inmediato"],
    avoidWhen: ["partido dentro de 24 horas", "dolor de rodilla o Aquiles", "piernas pesadas tras fuerza o tenis"],
    equipment: ["bicicleta estática", "espacio corto bajo techo"],
    exercises: [
      { id: "indoor-power-bike", phase: "Calentamiento", name: "Bicicleta progresiva", sets: 1, target: "7 min", weightKg: "", description: "Sube gradualmente la cadencia sin llegar a esfuerzo alto.", benefit: "Prepara piernas y tendones sin impacto." },
      { id: "indoor-fast-squat", phase: "Potencia sin salto", name: "Sentadilla rápida sin salto", sets: 3, target: "6", weightKg: "", description: "Baja controlado y sube rápido manteniendo los pies en el suelo.", benefit: "Entrena intención explosiva con menor impacto." },
      { id: "indoor-skater-step", phase: "Potencia lateral", name: "Skater step con estabilización", sets: 3, target: "8 por lado", weightKg: "", description: "Da un paso lateral amplio y estabiliza un segundo antes de volver; progresa a un salto corto solo si rodilla y Aquiles están bien.", benefit: "Desarrolla empuje lateral y control de llegada." },
      { id: "indoor-split-exit", phase: "Reacción", name: "Split step + salida corta", sets: 4, target: "15 seg", weightKg: "", description: "Alterna split step y una salida de uno o dos pasos, usando poco espacio.", benefit: "Mejora la primera arrancada específica." },
      { id: "indoor-lateral-brake", phase: "Frenada", name: "Desplazamiento lateral + freno", sets: 4, target: "20 seg", weightKg: "", description: "Muévete dos pasos, frena bajo control y vuelve al centro.", benefit: "Integra aceleración y desaceleración sin necesitar cancha completa." },
      { id: "indoor-shadow-point", phase: "Transferencia", name: "Shadow point bajo techo", sets: 4, target: "30 seg", weightKg: "", description: "Simula un punto con recorrido corto, rotación y recuperación al centro.", benefit: "Mantiene timing y coordinación cuando no puedes jugar." },
      { id: "indoor-dead-bug", phase: "Core", name: "Dead bug solo con piernas", sets: 2, target: "8 por lado", weightKg: "", description: "Alterna bajar un talón sin arquear la zona lumbar; los brazos descansan.", benefit: "Cierra con control del tronco sin cargar el brazo funcional." },
      { id: "indoor-cooldown", phase: "Cierre", name: "Movilidad suave de tobillo y cadera", sets: 1, target: "3 min", weightKg: "", description: "Recorre rangos cómodos y comprueba rodilla y Aquiles.", benefit: "Facilita la recuperación posterior." }
    ]
  },
  {
    id: "tennis-bike-intervals",
    name: "Bicicleta · Intervalos para tenis",
    focus: "Complementaria · 40 min · repetir esfuerzos y recuperar",
    objective: "Mejorar la capacidad de repetir esfuerzos intensos y recuperar entre ellos con bajo impacto articular.",
    expectedDurationMinutes: 40,
    durationGuidance: "Usa resistencia que permita mantener cadencia. Los intervalos fuertes son RPE 7–8/10, no sprints máximos; la recuperación debe sentirse realmente suave.",
    recommendedFor: ["cardio bajo techo", "evitar impacto de trote", "mejorar recuperación entre puntos y juegos"],
    avoidWhen: ["fatiga alta de piernas", "partido dentro de 24 horas", "dolor que empeora al pedalear"],
    equipment: ["bicicleta estática"],
    exercises: [
      { id: "bike-tennis-warmup", phase: "Calentamiento", name: "Pedaleo progresivo", sets: 1, target: "8 min", weightKg: "", description: "Aumenta cadencia y resistencia gradualmente hasta RPE 4/10.", benefit: "Prepara el sistema cardiovascular y las piernas." },
      { id: "bike-cadence-primer", phase: "Preparación", name: "Aceleraciones de cadencia", sets: 3, target: "20 seg", weightKg: "", description: "Acelera sin rebotar en el asiento y recupera 40 seg muy suave.", benefit: "Despierta velocidad de piernas antes del bloque principal." },
      { id: "bike-tennis-main", phase: "Bloque principal", name: "Intervalo largo de punto", sets: 10, target: "30 seg fuerte + 60 seg suave", weightKg: "", description: "Pedalea fuerte y controlado durante 30 seg; luego recupera 60 seg a cadencia cómoda.", benefit: "Entrena repetir esfuerzos y bajar pulsaciones entre acciones." },
      { id: "bike-tennis-short", phase: "Bloque específico", name: "Arrancada corta en bicicleta", sets: 6, target: "15 seg fuerte + 45 seg suave", weightKg: "", description: "Aumenta rápido la cadencia sin convertirlo en sprint máximo.", benefit: "Simula la demanda breve de una salida explosiva." },
      { id: "bike-tennis-cooldown", phase: "Vuelta a la calma", name: "Pedaleo muy suave", sets: 1, target: "6 min", weightKg: "", description: "Reduce resistencia y cadencia progresivamente.", benefit: "Facilita una transición gradual hacia la recuperación." }
    ]
  },
  {
    id: "right-upper-maintenance",
    name: "Mantenimiento · Hombro + antebrazo",
    focus: "Complementaria · 25–30 min · tolerar el volumen de golpeo",
    objective: "Mejorar control escapular y resistencia del hombro, codo, antebrazo y agarre derechos sin añadir volumen pesado.",
    expectedDurationMinutes: 28,
    durationGuidance: "RPE 4–6/10. Usa cargas livianas y deja 3–4 repeticiones en reserva; este trabajo no debe irritar el brazo funcional.",
    recommendedFor: ["mantenimiento preventivo lejos de dolor agudo", "semanas con mucho golpeo", "necesidad de reforzar control escapular y antebrazo"],
    avoidWhen: ["dolor actual que aumenta al mover o agarrar", "pérdida de fuerza, hormigueo o inflamación"],
    equipment: ["mancuerna liviana de 1–3 kg o botella", "pared", "toalla"],
    exercises: [
      { id: "upper-maintenance-bike", phase: "Calentamiento", name: "Bicicleta suave", sets: 1, target: "4 min", weightKg: "", description: "Pedalea suave mientras relajas cuello y hombro derecho.", benefit: "Eleva temperatura sin cargar el brazo." },
      { id: "right-scapular-clock", phase: "Control escapular", name: "Reloj escapular derecho en pared", sets: 2, target: "6 por dirección", weightKg: "", description: "Con la mano derecha apoyada suavemente, mueve la escápula arriba, abajo, dentro y fuera sin doblar el tronco.", benefit: "Mejora control de la base del hombro." },
      { id: "right-wall-slide", phase: "Control escapular", name: "Deslizamiento derecho en pared", sets: 3, target: "10", weightKg: "", description: "Desliza el antebrazo derecho sobre una toalla hasta un rango cómodo y vuelve controlado.", benefit: "Trabaja serrato y rotación escapular sin carga alta.", caution: "No fuerces el rango por encima de la cabeza si aparece molestia." },
      { id: "right-light-row", phase: "Resistencia", name: "Remo derecho liviano", sets: 3, target: "12", weightKg: 4.5, description: "Lleva la carga hacia la cadera con pausa de un segundo y descenso lento.", benefit: "Refuerza espalda y control escapular con volumen moderado.", weightSuggestion: "Usa 4,5 kg o menos; no es una serie pesada." },
      { id: "right-light-reverse-fly", phase: "Resistencia", name: "Pájaro derecho liviano", sets: 2, target: "12", weightKg: "", description: "Inclina el torso y abre el brazo derecho con carga muy liviana.", benefit: "Fortalece hombro posterior para desacelerar la raqueta.", weightSuggestion: "Botella o 1–3 kg; prioriza control." },
      { id: "right-eccentric-wrist-extension", phase: "Antebrazo", name: "Extensión excéntrica de muñeca derecha", sets: 3, target: "12", weightKg: "", description: "Ayuda a subir la carga y bájala lentamente con la muñeca derecha durante 3 segundos.", benefit: "Aumenta tolerancia de extensores ante agarre y golpes.", weightSuggestion: "1–3 kg como máximo." },
      { id: "right-pronation-supination", phase: "Antebrazo", name: "Pronación y supinación derecha", sets: 2, target: "12 por lado", weightKg: "", description: "Gira el antebrazo lentamente con una carga de palanca corta.", benefit: "Refuerza control rotacional del antebrazo.", weightSuggestion: "Carga mínima; la palanca aumenta mucho la exigencia." },
      { id: "right-towel-grip", phase: "Agarre", name: "Apretón de toalla derecho", sets: 3, target: "20 seg", weightKg: "", description: "Aprieta una toalla enrollada a intensidad moderada y relaja completamente.", benefit: "Trabaja resistencia del agarre sin carga externa pesada.", caution: "Omite si molesta el pulgar, codo o antebrazo." },
      { id: "right-upper-cooldown", phase: "Cierre", name: "Movilidad suave de brazo derecho", sets: 1, target: "3 min", weightKg: "", description: "Realiza círculos pequeños, movilidad de muñeca y respiración sin estirar con dolor.", benefit: "Permite valorar la respuesta del brazo antes de terminar." }
    ]
  },
  {
    id: "deceleration-direction",
    name: "Técnica · Frenada + cambios de dirección",
    focus: "Complementaria · 30 min · moverse y detenerse mejor",
    objective: "Mejorar postura, control del centro de masa y calidad de los apoyos al frenar, cambiar de dirección y recuperar el centro.",
    expectedDurationMinutes: 30,
    durationGuidance: "RPE 5–7/10. Descansa lo suficiente para repetir con precisión; cuenta solo repeticiones con frenada estable.",
    recommendedFor: ["mejorar desplazamiento técnico", "sesiones sin fatiga alta", "bloques de preparación lejos de competencia inmediata"],
    avoidWhen: ["rodilla o Aquiles sintomáticos", "superficie resbaladiza", "partido dentro de 24 horas si deja fatiga"],
    equipment: ["espacio despejado", "dos marcas en el suelo"],
    exercises: [
      { id: "decel-bike", phase: "Calentamiento", name: "Bicicleta progresiva", sets: 1, target: "5 min", weightKg: "", description: "Pedalea de suave a moderado.", benefit: "Prepara articulaciones antes de frenar y cambiar de dirección." },
      { id: "decel-ready-position", phase: "Técnica base", name: "Posición baja + pausa", sets: 3, target: "20 seg", weightKg: "", description: "Mantén pies activos, cadera atrás y tronco estable; descansa 30 seg.", benefit: "Construye la postura desde la que se acelera y frena." },
      { id: "decel-step-stick", phase: "Frenada", name: "Paso y estabilización", sets: 3, target: "5 por lado", weightKg: "", description: "Da un paso diagonal, baja el centro y congela la posición dos segundos.", benefit: "Enseña a absorber fuerza antes del siguiente movimiento." },
      { id: "decel-reverse-lunge-stop", phase: "Frenada", name: "Zancada atrás con freno", sets: 3, target: "6 por pierna", weightKg: "", description: "Retrocede, controla la bajada y vuelve sin impulso excesivo.", benefit: "Fortalece control unilateral y desaceleración." },
      { id: "decel-lateral-shuffle", phase: "Cambio de dirección", name: "Shuffle lateral + freno", sets: 4, target: "20 seg", weightKg: "", description: "Haz dos o tres pasos laterales, frena estable y cambia de sentido.", benefit: "Mejora control lateral sin buscar agotamiento." },
      { id: "decel-diagonal-exit", phase: "Cambio de dirección", name: "Salida diagonal + regreso", sets: 3, target: "4 por lado", weightKg: "", description: "Sal en diagonal, simula el golpe, frena y recupera al centro.", benefit: "Conecta la técnica de pies con una situación de tenis." },
      { id: "decel-single-leg-balance", phase: "Estabilidad", name: "Equilibrio tras frenada", sets: 2, target: "20 seg por lado", weightKg: "", description: "Termina un paso corto sobre una pierna y mantén pelvis estable; usa una pared cercana si hace falta.", benefit: "Consolida el control final del apoyo." },
      { id: "decel-shadow", phase: "Transferencia", name: "Shadow tennis con frenadas", sets: 3, target: "30 seg", weightKg: "", description: "Simula puntos breves priorizando bajar, frenar y volver equilibrado.", benefit: "Transfiere la mecánica a secuencias reales." },
      { id: "decel-cooldown", phase: "Cierre", name: "Movilidad de tobillo y cadera", sets: 1, target: "3 min", weightKg: "", description: "Realiza movimientos suaves y revisa la respuesta de rodillas y Aquiles.", benefit: "Facilita detectar tempranamente una mala tolerancia." }
    ]
  },
  {
    id: "physical-express",
    name: "Express · Físico 20 min",
    focus: "Complementaria · 20 min · poco tiempo, trabajo completo",
    objective: "Mantener continuidad con un estímulo breve de piernas, tracción, core y pies cuando no hay tiempo para una sesión completa.",
    expectedDurationMinutes: 20,
    durationGuidance: "RPE 6–7/10. Descansa 30–45 seg y no agregues series para convertirla en una rutina larga.",
    recommendedFor: ["solo hay 20 minutos", "semana irregular", "se necesita continuidad sin compensar con exceso"],
    avoidWhen: ["partido inminente si las piernas no están frescas", "dolor o fatiga que indique recuperación"],
    equipment: ["mancuerna de 7–8 kg", "bicicleta estática opcional", "espacio corto"],
    exercises: [
      { id: "express-bike", phase: "Calentamiento", name: "Bicicleta rápida", sets: 1, target: "3 min", weightKg: "", description: "Pedalea de suave a moderado sin pausas.", benefit: "Prepara el cuerpo usando poco tiempo." },
      { id: "express-unilateral-squat", phase: "Fuerza", name: "Sentadilla con carga unilateral", sets: 3, target: "8", weightKg: 8, description: "Sostén la carga con la mano derecha y mantén el tronco estable.", benefit: "Trabaja piernas y antiinclinación en un solo ejercicio." },
      { id: "express-rdl", phase: "Fuerza", name: "Peso muerto rumano unilateral de carga", sets: 3, target: "8", weightKg: 7, description: "Lleva cadera atrás con la carga en la mano derecha y espalda neutra.", benefit: "Refuerza cadena posterior para acelerar y frenar." },
      { id: "express-row", phase: "Tren superior", name: "Remo derecho", sets: 2, target: "10", weightKg: 7, description: "Lleva la mancuerna hacia la cadera con control.", benefit: "Mantiene fuerza de tracción y estabilidad escapular." },
      { id: "express-dead-bug", phase: "Core", name: "Dead bug solo con piernas", sets: 2, target: "8 por lado", weightKg: "", description: "Alterna bajar un talón sin arquear la espalda; brazos relajados.", benefit: "Añade control lumbar sin apoyo bilateral." },
      { id: "express-lateral-return", phase: "Pies", name: "Salida lateral + regreso", sets: 3, target: "20 seg", weightKg: "", description: "Sal, frena y vuelve al centro con pasos cortos.", benefit: "Conserva transferencia específica al tenis." },
      { id: "express-cooldown", phase: "Cierre", name: "Respiración y movilidad breve", sets: 1, target: "2 min", weightKg: "", description: "Baja el ritmo y mueve suavemente cadera, tobillos y hombro derecho.", benefit: "Termina la sesión sin cortar bruscamente." }
    ]
  },
  {
    id: "adapted-full-body",
    name: "Full body · Fuerza adaptada",
    focus: "Complementaria · 45 min · una sola sesión de fuerza semanal",
    objective: "Reunir fuerza de piernas, cadena posterior, empuje, tracción y estabilidad cuando la semana solo permite una sesión física completa.",
    expectedDurationMinutes: 45,
    durationGuidance: "RPE 6–8/10 y 2–3 repeticiones en reserva. Descansa 60–90 seg en fuerza y no aumentes simultáneamente carga y volumen.",
    recommendedFor: ["solo habrá una sesión de fuerza en la semana", "regreso a una semana ordenada", "necesidad de estímulo general con equipo de casa"],
    avoidWhen: ["partido o tenis exigente dentro de 24–48 horas", "brazo derecho sobrecargado", "fatiga alta de piernas"],
    equipment: ["mancuernas de 7–10 kg", "bicicleta estática", "silla o banco estable"],
    exercises: [
      { id: "full-adapted-bike", phase: "Calentamiento", name: "Bicicleta progresiva", sets: 1, target: "7 min", weightKg: "", description: "Sube gradualmente a intensidad moderada.", benefit: "Prepara el cuerpo completo sin impacto." },
      { id: "full-adapted-squat", phase: "Piernas", name: "Sentadilla con carga unilateral", sets: 3, target: "10", weightKg: 8, description: "Sostén la carga con la mano derecha y evita inclinar el tronco.", benefit: "Desarrolla fuerza de piernas y estabilidad lateral." },
      { id: "full-adapted-rdl", phase: "Cadena posterior", name: "Peso muerto rumano", sets: 3, target: "10", weightKg: 7, description: "Lleva la cadera atrás con columna neutra y descenso controlado.", benefit: "Refuerza glúteos e isquiotibiales." },
      { id: "full-adapted-bulgarian", phase: "Piernas", name: "Sentadilla búlgara", sets: 3, target: "8 por pierna", weightKg: "", description: "Comienza sin carga y usa una referencia cercana para equilibrarte si hace falta.", benefit: "Trabaja fuerza unilateral y control de cadera." },
      { id: "full-adapted-row", phase: "Tracción", name: "Remo derecho", sets: 3, target: "10", weightKg: 7, description: "Lleva la carga hacia la cadera con escápula controlada.", benefit: "Mantiene fuerza de espalda y tolerancia al golpeo." },
      { id: "full-adapted-chest-press", phase: "Empuje", name: "Press de pecho derecho", sets: 3, target: "10", weightKg: 7, description: "Acostado, empuja con el brazo derecho mientras el core evita rotar.", benefit: "Integra empuje unilateral y antirotación.", caution: "Reduce carga o rango ante molestia de hombro, codo o pulgar." },
      { id: "full-adapted-bridge-march", phase: "Core y pelvis", name: "Puente de glúteos con marcha", sets: 3, target: "10 total", weightKg: "", description: "Alterna elevar un pie sin dejar que la pelvis gire.", benefit: "Conecta glúteos y estabilidad central." },
      { id: "full-adapted-suitcase", phase: "Core de pie", name: "Marcha suitcase derecha", sets: 3, target: "30 seg", weightKg: 8, description: "Marcha con carga en la mano derecha sin inclinarte.", benefit: "Trabaja antirotación y control lateral.", caution: "Sustituye por marcha sin peso si se carga el brazo derecho." },
      { id: "full-adapted-shadow", phase: "Transferencia", name: "Shadow tennis controlado", sets: 3, target: "45 seg", weightKg: "", description: "Simula puntos al 60–70% manteniendo buena recuperación al centro.", benefit: "Transfiere la fuerza general al patrón deportivo." },
      { id: "full-adapted-cooldown", phase: "Cierre", name: "Movilidad y respiración", sets: 1, target: "3 min", weightKg: "", description: "Moviliza cadera, tobillos y hombro derecho dentro de rangos cómodos.", benefit: "Facilita valorar la respuesta global de la sesión." }
    ]
  },
  {
    id: "physical-assessment",
    name: "Evaluación · Indicadores físicos",
    focus: "Complementaria · 30 min · medir sin entrenar al fallo",
    objective: "Repetir pruebas simples de estabilidad, resistencia y desplazamiento para comprobar si la preparación se transfiere al tenis.",
    expectedDurationMinutes: 30,
    durationGuidance: "Realízala cada 4–6 semanas, descansado y en condiciones similares. Cambia el campo de repeticiones o segundos por tu resultado real antes de marcar cada prueba.",
    recommendedFor: ["control periódico cada 4–6 semanas", "semana sin competencia inmediata", "necesidad de revisar progreso o estancamiento"],
    avoidWhen: ["fatiga o dolor actual", "partido dentro de 48 horas", "condiciones diferentes que impidan comparar"],
    equipment: ["bicicleta estática", "silla", "pared", "dos marcas en el suelo", "cronómetro"],
    exercises: [
      { id: "assessment-bike", phase: "Estandarización", name: "Bicicleta suave", sets: 1, target: "5 min", weightKg: "", description: "Usa siempre una intensidad similar antes de evaluar.", benefit: "Hace más comparables los resultados entre fechas." },
      { id: "assessment-chair-stand", phase: "Resistencia de piernas", name: "Sentarse y levantarse en 30 seg", sets: 1, target: "30 seg", weightKg: "", description: "Cuenta repeticiones completas desde una silla estable y anota el resultado en el campo antes de marcar la serie.", benefit: "Entrega una referencia sencilla de resistencia de piernas." },
      { id: "assessment-single-leg", phase: "Equilibrio", name: "Equilibrio unipodal", sets: 1, target: "60 seg por lado", weightKg: "", description: "Mide hasta 60 seg por pierna cerca de una pared; detén al apoyar el otro pie y anota cada resultado en sensaciones.", benefit: "Controla estabilidad relevante para apoyos abiertos." },
      { id: "assessment-wall-sit", phase: "Resistencia isométrica", name: "Sentadilla en pared", sets: 1, target: "90 seg", weightKg: "", description: "Mantén una posición reproducible y registra el tiempo hasta perderla, sin llegar a dolor.", benefit: "Mide tolerancia de piernas a posiciones bajas." },
      { id: "assessment-lateral-touches", phase: "Desplazamiento", name: "Toques laterales en 30 seg", sets: 2, target: "30 seg", weightKg: "", description: "Entre dos marcas cercanas, cuenta toques con control; usa la primera serie de práctica y registra la segunda.", benefit: "Sigue velocidad lateral y capacidad de frenar." },
      { id: "assessment-split-step", phase: "Coordinación", name: "Split step de calidad", sets: 2, target: "20 seg", weightKg: "", description: "Cuenta apoyos nítidos sin perder postura; primera serie de práctica y segunda de registro.", benefit: "Controla rapidez de pies sin exigir una cancha." },
      { id: "assessment-core", phase: "Core", name: "Dead bug solo con piernas", sets: 1, target: "repeticiones técnicas", weightKg: "", description: "Cuenta repeticiones alternadas hasta antes de arquear la espalda y escribe el resultado en el campo.", benefit: "Mide control lumbo-pélvico sin depender de los brazos." },
      { id: "assessment-shadow", phase: "Transferencia", name: "Shadow tennis técnico", sets: 2, target: "45 seg", weightKg: "", description: "Graba o valora postura, frenada y recuperación; no busques agotarte.", benefit: "Permite observar si las mejoras aparecen en un patrón de tenis." },
      { id: "assessment-cooldown", phase: "Cierre", name: "Recuperación suave", sets: 1, target: "3 min", weightKg: "", description: "Camina o pedalea suave y registra sensaciones, dolor y RPE.", benefit: "Completa la evaluación con la respuesta de recuperación." }
    ]
  }
];

export const cardioTypes = [
  { id: "outdoor-bike", name: "Bicicleta al aire libre", description: "Bicicleta convencional en calle o ciclovía", distance: true },
  { id: "stationary-bike", name: "Bicicleta estática", description: "Sesión en bicicleta fija", distance: false },
  { id: "running", name: "Trote", description: "Trote continuo o por intervalos", distance: true },
  { id: "walking", name: "Caminata", description: "Caminata suave o rápida", distance: true },
  { id: "trekking", name: "Trekking", description: "Cerro, sendero o ruta", distance: true, location: true },
  { id: "padel", name: "Pádel", description: "Sesión ocasional de pádel", distance: false }
];

export const trekkingLocations = ["Cerro La Región", "Cerro El Carbón", "Cerro Manquehue", "Cerro San Cristóbal"];

export const trekkingRoutes = {
  "Cerro La Región": ["Los Fresnos", "Ruta 7 Canchas"]
};

export const tennisLocations = ["Club Open Tenis", "Sport Park de Huechuraba", "Parque Araucano"];

export const tennisTypes = [
  { id: "group-training", name: "Entrenamiento grupal" },
  { id: "match", name: "Partido" },
  { id: "wall", name: "Frontón" },
  { id: "friendly-hitting", name: "Peloteo amistoso" }
];

export const tennisSurfaces = ["Arcilla", "Cemento"];

export const sensationSuggestions = {
  common: [
    "Me sentí excelente", "Me sentí bien", "Me sentí normal", "Me costó empezar",
    "Buena energía", "Energía media", "Poca energía", "Cansancio controlado",
    "Terminé exigido", "Terminé con energía", "Dormí bien", "Dormí poco",
    "Buena concentración", "Me costó concentrarme", "No tuve molestias", "Tuve leves molestias"
  ],
  physical: [
    "Buena técnica", "Técnica estable", "Perdí técnica al final", "Me costó la última serie",
    "Carga liviana", "Carga adecuada", "Carga exigente", "Podía hacer más repeticiones",
    "Buena activación muscular", "Buen equilibrio", "Me faltó estabilidad", "Recuperé bien entre series",
    "Molestia en pulgar", "Molestia en codo", "Molestia en hombro", "Molestia en rodilla", "Molestia en Aquiles",
    "Piernas fuertes", "Piernas pesadas", "Core estable"
  ],
  cardio: [
    "Ritmo muy cómodo", "Ritmo cómodo", "Ritmo exigente", "Ritmo constante",
    "Respiración controlada", "Me faltó aire", "Pulso controlado", "Mejoré al avanzar",
    "Piernas livianas", "Piernas cansadas", "Piernas pesadas", "Buena recuperación",
    "Ruta fácil", "Ruta exigente", "Subidas controladas", "Me costaron las subidas",
    "Buena hidratación", "Me faltó hidratación", "Molestia en rodilla", "Molestia en Aquiles",
    "Buen clima", "Mucho calor", "Mucho viento", "Frío durante la sesión"
  ],
  tennis: [
    "Buen control", "Golpes consistentes", "Buen timing", "Me faltó timing",
    "Derecha sólida", "Revés sólido", "Me costó la derecha", "Me costó el revés",
    "Buen saque", "Me costó el saque", "Buena devolución", "Me costó devolver",
    "Buen desplazamiento", "Me sentí rápido", "Llegué tarde a la pelota", "Recuperé bien al centro",
    "Buena concentración", "Tomé buenas decisiones", "Jugué con confianza", "Jugué tenso",
    "Me adapté bien a la superficie", "Me costó la superficie", "Brazo relajado", "Brazo cansado",
    "Molestia en pulgar", "Molestia en codo", "Molestia en hombro"
  ]
};

export function categoryById(id) {
  return trainingCategories.find(category => category.id === id) || null;
}

export function physicalRoutineById(id) {
  return physicalRoutines.find(routine => routine.id === id) || null;
}

export function cardioTypeById(id) {
  return cardioTypes.find(type => type.id === id) || null;
}

export function tennisTypeById(id) {
  return tennisTypes.find(type => type.id === id) || null;
}
