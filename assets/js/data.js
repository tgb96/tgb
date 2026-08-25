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
  { id: "legs", name: "Fuerza de piernas", focus: "Piernas, glúteos y base de fuerza" },
  { id: "upper", name: "Tren superior", focus: "Espalda, hombros, brazos y estabilidad" },
  { id: "agility", name: "Potencia y agilidad", focus: "Aceleración, frenado y cambios de dirección" },
  { id: "full-body", name: "Fuerza integral", focus: "Trabajo coordinado de cuerpo completo" }
];

export const cardioTypes = [
  { id: "outdoor-bike", name: "Bicicleta al aire libre", description: "Bicicleta convencional en calle o ciclovía", distance: true },
  { id: "stationary-bike", name: "Bicicleta estática", description: "Sesión en bicicleta fija", distance: false },
  { id: "running", name: "Trote", description: "Trote continuo o por intervalos", distance: true },
  { id: "walking", name: "Caminata", description: "Caminata suave o rápida", distance: true },
  { id: "trekking", name: "Trekking", description: "Cerro, sendero o ruta", distance: true, location: true }
];

export const tennisSurfaces = ["Arcilla", "Cemento", "Pasto", "Sintética", "Indoor", "Otra"];

export function categoryById(id) {
  return trainingCategories.find(category => category.id === id) || null;
}

export function physicalRoutineById(id) {
  return physicalRoutines.find(routine => routine.id === id) || null;
}

export function cardioTypeById(id) {
  return cardioTypes.find(type => type.id === id) || null;
}
