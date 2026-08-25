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
  }
];

// Nombres provisorios: se reemplazarán cuando se definan las cuatro rutinas finales.
export const physicalRoutines = [
  {
    id: "legs",
    name: "Fuerza de piernas",
    focus: "Piernas, glúteos y base de fuerza",
    exercises: [
      { id: "squat", name: "Sentadilla", prescription: "3 series · 12 repeticiones", description: "Baja con el pecho estable y empuja el suelo al subir.", benefit: "Mejora la base, la estabilidad y la potencia al golpear." },
      { id: "reverse-lunge", name: "Zancada hacia atrás", prescription: "3 series · 12 por lado", description: "Da un paso atrás y controla la rodilla de la pierna delantera.", benefit: "Refuerza frenadas y cambios de dirección en la cancha." },
      { id: "calf-raise", name: "Elevación de pantorrillas", prescription: "3 series · 12 repeticiones", description: "Sube y baja los talones lentamente, manteniendo el equilibrio.", benefit: "Ayuda al impulso inicial y a los ajustes cortos de pies." }
    ]
  },
  {
    id: "upper",
    name: "Tren superior",
    focus: "Espalda, hombros, brazos y estabilidad",
    exercises: [
      { id: "backpack-row", name: "Remo con mochila", prescription: "3 series · 12 repeticiones", description: "Lleva la mochila hacia el torso con la espalda larga.", benefit: "Fortalece la espalda para estabilizar los golpes." },
      { id: "shoulder-press", name: "Press de hombros", prescription: "3 series · 12 repeticiones", description: "Empuja la carga sobre la cabeza sin arquear la espalda.", benefit: "Aporta fuerza y control en el saque." },
      { id: "external-rotation", name: "Rotación externa", prescription: "3 series · 12 por lado", description: "Gira el antebrazo hacia afuera con el codo junto al cuerpo.", benefit: "Trabaja el control del hombro y el manguito rotador." }
    ]
  },
  {
    id: "agility",
    name: "Potencia y agilidad",
    focus: "Aceleración, frenado y cambios de dirección",
    exercises: [
      { id: "lateral-hops", name: "Saltos laterales", prescription: "3 series · 12 repeticiones", description: "Salta de lado a lado y aterriza con control.", benefit: "Mejora la reacción lateral y la estabilidad al frenar." },
      { id: "split-step", name: "Split step", prescription: "3 series · 12 repeticiones", description: "Realiza un pequeño salto y cae listo para salir hacia ambos lados.", benefit: "Entrena la activación previa al golpe del rival." },
      { id: "court-shuffle", name: "Desplazamiento lateral", prescription: "3 series · 12 repeticiones", description: "Muévete lateralmente sin cruzar los pies y vuelve al centro.", benefit: "Ayuda a recuperar la posición después de cada golpe." }
    ]
  },
  {
    id: "full-body",
    name: "Fuerza integral",
    focus: "Trabajo coordinado de cuerpo completo",
    exercises: [
      { id: "backpack-deadlift", name: "Peso muerto con mochila", prescription: "3 series · 12 repeticiones", description: "Lleva la cadera atrás y sube apretando glúteos.", benefit: "Refuerza la cadena posterior para movimientos explosivos." },
      { id: "plank", name: "Plancha frontal", prescription: "3 series · 30 segundos", description: "Mantén el cuerpo alineado y el abdomen activo.", benefit: "Aporta estabilidad para transferir fuerza a la raqueta." },
      { id: "pallof-press", name: "Press antirotación", prescription: "3 series · 12 por lado", description: "Extiende los brazos evitando que el tronco gire.", benefit: "Mejora el control del torso durante derecha y revés." }
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

export const trekkingLocations = ["Cerro La Región", "Cerro El Caracol", "Cerro Manquehue"];

export const tennisLocations = ["Club Open Tenis", "Sport Park de Huechuraba", "Parque Araucano"];

export const tennisSurfaces = ["Arcilla", "Cemento"];

export const sensationSuggestions = {
  common: ["Me sentí bien", "Buena energía", "Cansancio controlado", "Terminé exigido"],
  physical: ["No tuve molestias", "Tuve leves molestias", "Buena técnica", "Me costó la última serie"],
  cardio: ["Ritmo cómodo", "Respiración controlada", "Piernas cansadas", "Mejoré al avanzar"],
  tennis: ["Buen control", "Golpes consistentes", "Me sentí rápido", "Me costó el saque"]
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
