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
    description: "Resistencia en bicicleta, trote, caminata o trekking.",
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
    id: "rest",
    name: "Descanso",
    shortName: "Descanso",
    description: "Recuperación planificada o descanso por molestia.",
    accent: "violet"
  }
];

export const restTypes = [
  { id: "planned", name: "Día de descanso", description: "Recuperación planificada, sin molestias." },
  { id: "discomfort", name: "Descanso por molestia", description: "No entrenaste debido a dolor o molestia física." }
];

// Rutinas base personales. Los ajustes de progresión se guardan en el dispositivo.
export const physicalRoutines = [
  {
    id: "legs",
    name: "Día 1 · Piernas + glúteos + core",
    focus: "Base obligatoria · fuerza, cadera y estabilidad",
    objective: "Fortalecer piernas, cadera, glúteos y core para arrancar, frenar y proteger las rodillas.",
    exercises: [
      { id: "bodyweight-squat", phase: "Calentamiento", name: "Sentadilla sin peso", sets: 2, target: "12", weightKg: "", description: "Baja controlado, con las rodillas alineadas y la espalda firme.", benefit: "Prepara piernas y cadera para posiciones bajas." },
      { id: "soft-split-step", phase: "Calentamiento", name: "Split step suave", sets: 3, target: "20 seg", weightKg: "", description: "Haz un pequeño salto y cae activo sobre ambos pies.", benefit: "Mejora la reacción antes de desplazarte." },
      { id: "unilateral-loaded-squat", phase: "Fuerza principal", name: "Sentadilla con carga unilateral", sets: 4, target: "10", weightKg: 8, description: "Sostén la carga de un lado y mantén el tronco estable durante la sentadilla.", benefit: "Fortalece piernas y la estabilidad del core para transferir fuerza.", weightSuggestion: "Peso sugerido inicial: 8 kg." },
      { id: "bulgarian-squat", phase: "Fuerza principal", name: "Sentadilla búlgara", sets: 3, target: "8 por pierna", weightKg: "", description: "Apoya el pie trasero en alto y baja usando principalmente la pierna delantera.", benefit: "Trabaja fuerza unilateral, equilibrio y cambios de dirección.", weightSuggestion: "Comienza sin peso; usa 7–8 kg solo si te sientes estable." },
      { id: "romanian-deadlift", phase: "Fuerza principal", name: "Peso muerto rumano", sets: 4, target: "10", weightKg: 7, description: "Lleva la cadera atrás mientras bajas la carga con la espalda neutra.", benefit: "Refuerza glúteos e isquiotibiales para acelerar y frenar.", weightSuggestion: "Peso sugerido inicial: 7–8 kg, lento y controlado." },
      { id: "step-up", phase: "Fuerza principal", name: "Step-up", sets: 3, target: "10 por pierna", weightKg: "", description: "Sube a un banco o escalón impulsándote principalmente con una pierna.", benefit: "Desarrolla fuerza unilateral e impulso desde una pierna.", weightSuggestion: "Peso corporal; agrega 7 kg cuando resulte fácil." },
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
    exercises: [
      { id: "shoulder-mobility", phase: "Calentamiento", name: "Movilidad de hombro sin peso", sets: 1, target: "3 min", weightKg: "", description: "Haz círculos suaves, elevaciones controladas y aperturas de brazos.", benefit: "Prepara hombro y escápula para golpes y saque." },
      { id: "one-arm-row", phase: "Espalda", name: "Remo a una mano", sets: 4, target: "10", weightKg: 7, description: "Con el torso inclinado, lleva la mancuerna hacia la cadera.", benefit: "Mejora la tracción y la estabilidad escapular.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "unsupported-row", phase: "Espalda", name: "Remo inclinado unilateral", sets: 3, target: "10", weightKg: 7, description: "Inclina el torso sin apoyo y lleva la mancuerna hacia el cuerpo.", benefit: "Suma trabajo de equilibrio y estabilización del core.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "one-arm-chest-press", phase: "Pecho", name: "Press de pecho unilateral", sets: 4, target: "10", weightKg: 7, description: "Acostado, empuja la mancuerna desde el pecho hasta extender el brazo.", benefit: "Desarrolla empuje y resistencia a la rotación del core.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "incline-press", phase: "Pecho", name: "Press inclinado unilateral", sets: 3, target: "10", weightKg: 7, description: "Realiza el press con el torso ligeramente inclinado.", benefit: "Fortalece pecho superior y hombro anterior para acelerar el brazo.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "military-press", phase: "Hombros", name: "Press militar unilateral", sets: 3, target: "8", weightKg: 7, description: "Desde el hombro, empuja la mancuerna verticalmente sobre la cabeza.", benefit: "Aporta estabilidad por encima de la cabeza para saque y smash.", weightSuggestion: "7 kg solo si no hay dolor; si molesta, baja carga o repeticiones." },
      { id: "lateral-raise", phase: "Hombros", name: "Elevación lateral", sets: 3, target: "12", weightKg: "", description: "Eleva el brazo lateralmente hasta la altura del hombro.", benefit: "Fortalece el deltoides y la estabilidad del brazo.", weightSuggestion: "Usa menos de 7 kg; una botella sirve como carga liviana." },
      { id: "reverse-fly", phase: "Hombros", name: "Pájaros", sets: 3, target: "12", weightKg: "", description: "Inclina el torso y eleva el brazo lateralmente controlando la bajada.", benefit: "Refuerza hombro posterior y desaceleración después del golpe.", weightSuggestion: "Carga liviana; usa botella o banda si 7 kg es mucho." },
      { id: "one-arm-curl", phase: "Brazos", name: "Curl unilateral", sets: 3, target: "10", weightKg: 7, description: "Lleva la mancuerna hacia el hombro de forma controlada.", benefit: "Ayuda a estabilizar y desacelerar la raqueta.", weightSuggestion: "Peso sugerido inicial: 7 kg." },
      { id: "overhead-extension", phase: "Brazos", name: "Extensión sobre la cabeza", sets: 3, target: "10", weightKg: 7, description: "Baja la mancuerna detrás de la cabeza y vuelve a extender el codo.", benefit: "Fortalece la extensión usada en saque y golpes altos.", weightSuggestion: "7 kg solo si no molesta el codo o el hombro." },
      { id: "triceps-kickback", phase: "Brazos", name: "Patada de tríceps", sets: 3, target: "12", weightKg: "", description: "Con el torso inclinado y el codo junto al cuerpo, extiende el brazo atrás.", benefit: "Mejora la extensión y el control en la finalización del golpe.", weightSuggestion: "Hazlo lento y con menos de 7 kg si es necesario." },
      { id: "suitcase-carry", phase: "Core final", name: "Suitcase carry", sets: 3, target: "30–40 seg", weightKg: 8, description: "Camina con una carga en una mano manteniendo el cuerpo vertical.", benefit: "Entrena estabilidad lateral y antirotación del core.", weightSuggestion: "Peso sugerido inicial: 7–8 kg." }
    ]
  },
  {
    id: "agility",
    name: "Día 3 · Potencia + desplazamientos",
    focus: "Base obligatoria · reacción y tenis específico",
    objective: "Mejorar aceleración, reacción, recuperación al centro y potencia de piernas sin buscar fatiga de hipertrofia.",
    exercises: [
      { id: "soft-shadow-tennis", phase: "Calentamiento", name: "Shadow tennis suave", sets: 3, target: "45 seg", weightKg: "", description: "Simula derechas, reveses y preparación sin pelota.", benefit: "Practica técnica, transferencia de peso y coordinación." },
      { id: "split-step", phase: "Calentamiento", name: "Split step", sets: 4, target: "20 seg", weightKg: "", description: "Haz un pequeño salto y aterriza activo antes de desplazarte.", benefit: "Mejora la reacción y la salida hacia cualquier dirección." },
      { id: "jump-squat", phase: "Potencia", name: "Sentadilla con salto", sets: 3, target: "6", weightKg: "", description: "Desde la sentadilla, impulsa el cuerpo en un salto vertical y aterriza con control.", benefit: "Desarrolla potencia para arrancadas y recuperación.", caution: "Hazla solo si rodilla y Aquiles están bien; si molesta, usa sentadilla rápida sin salto." },
      { id: "skater-jumps", phase: "Potencia", name: "Skater jumps", sets: 3, target: "8 por lado", weightKg: "", description: "Salta lateralmente de una pierna a otra estabilizando cada aterrizaje.", benefit: "Trabaja potencia lateral, equilibrio y desplazamiento." },
      { id: "lateral-lunge", phase: "Piernas", name: "Zancada lateral", sets: 3, target: "10 por lado", weightKg: "", description: "Da un paso amplio al costado, flexiona esa pierna y mantén la otra extendida.", benefit: "Refuerza posiciones abiertas y desplazamientos laterales.", weightSuggestion: "Peso corporal; agrega 7 kg cuando resulte cómodo." },
      { id: "reverse-lunge", phase: "Piernas", name: "Zancada hacia atrás", sets: 3, target: "10 por pierna", weightKg: "", description: "Lleva una pierna atrás, baja con control y vuelve a impulsarte.", benefit: "Desarrolla fuerza unilateral y control al frenar.", weightSuggestion: "Peso corporal; agrega 7 kg cuando resulte cómodo." },
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
    exercises: [
      { id: "shadow-tennis", phase: "Técnica", name: "Shadow tennis", sets: 4, target: "45 seg", weightKg: "", description: "Simula derechas, reveses, saques y otros golpes sin pelota.", benefit: "Practica técnica, transferencia de peso y coordinación." },
      { id: "split-step-short", phase: "Técnica", name: "Split step + salida corta", sets: 4, target: "20 seg", weightKg: "", description: "Haz split step y una salida corta a derecha o izquierda.", benefit: "Mejora reacción inicial y preparación antes del golpe." },
      { id: "wrist-curl", phase: "Antebrazo y muñeca", name: "Curl de muñeca", sets: 3, target: "15", weightKg: "", description: "Apoya el antebrazo y flexiona la muñeca con control.", benefit: "Fortalece flexores y resistencia del agarre.", weightSuggestion: "Carga muy liviana: 1–3 kg. No usar 7 kg." },
      { id: "reverse-wrist-curl", phase: "Antebrazo y muñeca", name: "Curl inverso de muñeca", sets: 3, target: "15", weightKg: "", description: "Eleva el dorso de la mano con el antebrazo apoyado.", benefit: "Fortalece extensores y equilibra el trabajo del agarre.", weightSuggestion: "Carga sugerida: 1–3 kg." },
      { id: "wrist-rotation", phase: "Antebrazo y muñeca", name: "Rotación de muñeca", sets: 3, target: "12 por lado", weightKg: "", description: "Realiza rotaciones lentas con una carga ligera.", benefit: "Mejora el control de muñeca y antebrazo.", weightSuggestion: "Usa muy poco peso porque la palanca aumenta la carga." },
      { id: "pronation-supination", phase: "Antebrazo y muñeca", name: "Pronación y supinación", sets: 3, target: "12 por lado", weightKg: "", description: "Gira lentamente el antebrazo con la palma hacia arriba y abajo.", benefit: "Refuerza la rotación del antebrazo usada al controlar la raqueta.", weightSuggestion: "Carga sugerida: 1–3 kg." },
      { id: "front-raise", phase: "Hombro controlado", name: "Elevación frontal", sets: 3, target: "12", weightKg: "", description: "Eleva la carga al frente manteniendo el brazo casi extendido.", benefit: "Fortalece el hombro anterior involucrado en la aceleración.", weightSuggestion: "Usa carga liviana; una botella sirve si 7 kg es mucho." },
      { id: "one-arm-fly", phase: "Hombro controlado", name: "Apertura unilateral", sets: 3, target: "10", weightKg: "", description: "Abre lentamente el brazo hacia el costado y vuelve al centro.", benefit: "Trabaja el control de pecho y hombro en movimientos amplios.", weightSuggestion: "Carga liviana y controlada; no hacerlo pesado." },
      { id: "front-plank", phase: "Core", name: "Plancha frontal", sets: 3, target: "40 seg", weightKg: "", description: "Mantén el cuerpo alineado y el abdomen activo.", benefit: "Aporta estabilidad y transmisión de fuerza." },
      { id: "suitcase-carry", phase: "Core", name: "Suitcase carry", sets: 3, target: "40 seg", weightKg: 8, description: "Camina con la carga en una mano sin inclinar el tronco.", benefit: "Entrena estabilidad lateral y antirotación." },
      { id: "dead-bug", phase: "Core", name: "Dead bug", sets: 3, target: "10 por lado", weightKg: "", description: "Extiende un brazo y la pierna contraria manteniendo estable la zona lumbar.", benefit: "Mejora coordinación cruzada y control del core." }
    ]
  }
];

export const cardioTypes = [
  { id: "outdoor-bike", name: "Bicicleta al aire libre", description: "Bicicleta convencional en calle o ciclovía", distance: true },
  { id: "stationary-bike", name: "Bicicleta estática", description: "Sesión en bicicleta fija", distance: false },
  { id: "running", name: "Trote", description: "Trote continuo o por intervalos", distance: true },
  { id: "walking", name: "Caminata", description: "Caminata suave o rápida", distance: true },
  { id: "trekking", name: "Trekking", description: "Cerro, sendero o ruta", distance: true, location: true }
];

export const trekkingLocations = ["Cerro La Región", "Cerro El Carbón", "Cerro Manquehue", "Cerro San Cristóbal"];

export const trekkingRoutes = {
  "Cerro La Región": ["Los Fresnos", "Ruta 7 Canchas"]
};

export const tennisLocations = ["Club Open Tenis", "Sport Park de Huechuraba", "Parque Araucano"];

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
