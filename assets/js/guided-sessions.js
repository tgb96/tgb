// Secuencias iniciales conservadoras: movilidad dinámica antes de jugar,
// vuelta a la calma y estiramientos suaves después. Se pueden revisar con el entrenador.
export const guidedSessions = {
  warmup: {
    id: "tennis-warmup-v1",
    category: "warmup",
    title: "Calentamiento para jugar",
    subtitle: "Preparación progresiva para tenis, sin empezar al máximo.",
    safety: "Si aparece dolor, mareo o una molestia que aumenta, detén la sesión. No fuerces la rodilla ni hagas saltos si hoy está sensible.",
    steps: [
      { id: "walk", title: "Caminar o trotar muy suave", seconds: 90, instruction: "Comienza a moverte a ritmo fácil. Respira cómodo y aumenta la velocidad gradualmente.", alternative: "Camina si prefieres evitar impacto." },
      { id: "ankles", title: "Tobillos y pantorrillas", seconds: 60, instruction: "Eleva y baja talones; mueve cada tobillo de forma controlada. Sin rebotes.", alternative: "Apóyate en una pared para mantener el equilibrio." },
      { id: "hips", title: "Cadera y pasos suaves", seconds: 60, instruction: "Haz pasos cortos adelante y atrás y abre la cadera con movimientos pequeños.", alternative: "Reduce el recorrido si la rodilla molesta." },
      { id: "shoulders", title: "Hombros, escápulas y muñecas", seconds: 60, instruction: "Rota hombros y muñecas lentamente; mueve los brazos como en golpes suaves.", alternative: "Mantén el brazo relajado y sin dolor." },
      { id: "trunk", title: "Rotación controlada de tronco", seconds: 60, instruction: "Gira suavemente el tronco a ambos lados, con los pies acompañando el movimiento.", alternative: "Haz menos amplitud si sientes tensión." },
      { id: "lateral", title: "Desplazamientos laterales", seconds: 75, instruction: "Da pasos laterales cortos, primero lento y luego algo más ágil. Evita frenadas bruscas.", alternative: "Camina lateralmente sin bajar tanto si la rodilla está sensible." },
      { id: "split", title: "Activación de pies", seconds: 45, instruction: "Alterna apoyos rápidos y suaves, como preparándote para reaccionar. Sin salto obligatorio.", alternative: "Haz pasos cortos en el sitio en vez de split-step si hay molestia." },
      { id: "shadow", title: "Golpes de sombra", seconds: 90, instruction: "Simula derecha, revés y servicio con amplitud y velocidad progresivas.", alternative: "Hazlo sin raqueta y sin elevar el brazo por encima de lo cómodo." },
      { id: "rally", title: "Peloteo progresivo", seconds: 120, instruction: "Si ya estás en cancha, empieza con golpes cómodos y ve aumentando el ritmo.", alternative: "Si estás solo, repite golpes de sombra y pasos suaves." }
    ]
  },
  stretching: {
    id: "post-play-stretch-v1",
    category: "stretching",
    title: "Estiramientos y vuelta a la calma",
    subtitle: "Después de jugar o entrenar: bajar pulsaciones y mover sin forzar.",
    safety: "Estira suave, sin rebotes ni dolor. Si tienes una lesión o dolor persistente, adapta la secuencia con un profesional.",
    steps: [
      { id: "cooldown", title: "Caminar y respirar", seconds: 60, instruction: "Camina despacio mientras tu respiración vuelve a la normalidad.", alternative: "Puedes permanecer de pie y respirar si no puedes caminar." },
      { id: "calf", title: "Pantorrillas", seconds: 40, instruction: "Apoya las manos en una pared, una pierna atrás y talón en el suelo. Cambia de lado a la mitad.", alternative: "Acorta la postura si tira demasiado." },
      { id: "quad", title: "Cuádriceps", seconds: 40, instruction: "De pie, con apoyo, lleva suavemente el talón hacia el glúteo. Cambia de lado a la mitad.", alternative: "Si flexionar la rodilla molesta, omite este paso." },
      { id: "hamstring", title: "Parte posterior del muslo", seconds: 40, instruction: "Extiende una pierna delante con rodilla levemente flexionada e inclina la cadera. Cambia de lado.", alternative: "Hazlo sentado si te resulta más estable." },
      { id: "glute", title: "Glúteos", seconds: 40, instruction: "Sentado, cruza suavemente una pierna y acerca el tronco sin encorvarlo. Cambia de lado.", alternative: "Reduce el cruce si la rodilla no está cómoda." },
      { id: "hip", title: "Cadera anterior", seconds: 40, instruction: "Da un paso atrás corto y desplaza suavemente la pelvis hacia adelante. Cambia de lado.", alternative: "Hazlo de pie y con apoyo." },
      { id: "chest", title: "Pecho y hombros", seconds: 40, instruction: "Abre el pecho suavemente y lleva un brazo cruzado frente al cuerpo. Cambia de lado.", alternative: "No fuerces el hombro ni el brazo de golpeo." },
      { id: "forearm", title: "Antebrazos y muñecas", seconds: 40, instruction: "Con el codo casi extendido, flexiona suavemente la muñeca con ayuda de la otra mano. Cambia de lado.", alternative: "Evita tirar de la mano si hay dolor." },
      { id: "breath", title: "Cerrar con respiración tranquila", seconds: 60, instruction: "Respira lento y comprueba cómo quedaron piernas, rodilla, hombro y brazo.", alternative: "Anota cualquier molestia al finalizar." }
    ]
  }
};

const warmupBase = guidedSessions.warmup;
const stretchBase = guidedSessions.stretching;
const stepWithTime = (step, seconds) => ({ ...step, seconds });
const warmupExtra = [
  { id: "diagonal", title: "Pasos diagonales", seconds: 60, instruction: "Avanza y retrocede en diagonal con pasos cortos y controlados, sin giros bruscos.", alternative: "Camina en diagonal y reduce la velocidad." },
  { id: "reaction", title: "Reacción y frenada suave", seconds: 60, instruction: "Desde una posición cómoda, sal un paso hacia cada lado y frena con control.", alternative: "Haz solo cambios de apoyo sin acelerar si la rodilla está sensible." },
  { id: "forehand-backhand", title: "Derecha y revés progresivos", seconds: 60, instruction: "Alterna golpes de sombra de derecha y revés, aumentando ligeramente la velocidad.", alternative: "Haz el gesto más corto y sin raqueta." },
  { id: "serve-build", title: "Servicio progresivo", seconds: 60, instruction: "Ensaya el saque en partes, primero lento y luego cerca del ritmo de juego.", alternative: "Omite la elevación del brazo si el hombro molesta; practica solo pies y lanzamiento suave." }
];
const longStretchSteps = [
  { id: "settle", title: "Respirar y bajar el ritmo", instruction: "Camina despacio y deja que baje el ritmo respiratorio.", alternative: "Quédate de pie con apoyo y respira cómodo." },
  { id: "feet", title: "Pies y tobillos", instruction: "Moviliza tobillos y dedos de los pies sin forzar.", alternative: "Hazlo sentado." },
  { id: "calves", title: "Pantorrillas", instruction: "Estira suavemente una pantorrilla y luego la otra, alternando cada 30–40 segundos.", alternative: "Reduce el paso y apóyate en la pared." },
  { id: "quads", title: "Parte anterior del muslo", instruction: "Con apoyo, acerca el talón al glúteo sin tirar de la rodilla; cambia de lado.", alternative: "Si flexionar la rodilla incomoda, omite el estiramiento y respira." },
  { id: "hamstrings", title: "Parte posterior del muslo", instruction: "Inclina la cadera suavemente sobre una pierna adelantada; cambia de lado.", alternative: "Siéntate y mantén una flexión cómoda de rodilla." },
  { id: "glutes", title: "Glúteos", instruction: "Sentado, cruza una pierna y acerca el tronco suavemente; cambia de lado.", alternative: "Mantén ambos pies en el suelo si la rodilla se siente incómoda." },
  { id: "hip-front", title: "Cadera anterior", instruction: "Da un paso corto atrás y mueve la pelvis suavemente; cambia de lado.", alternative: "Hazlo de pie con apoyo y poca amplitud." },
  { id: "spine", title: "Columna y espalda", instruction: "Sentado o de pie, alterna una espalda larga con una ligera flexión, sin llegar a dolor.", alternative: "Haz movimientos pequeños mientras respiras." },
  { id: "rotation", title: "Rotación de tronco", instruction: "Gira despacio el tronco a cada lado sin bloquear la cadera.", alternative: "Reduce la amplitud y acompaña el giro con los pies." },
  { id: "chest", title: "Pecho", instruction: "Abre el pecho con brazos relajados, sin forzar el hombro; alterna la posición.", alternative: "Mantén las manos bajas si el hombro está sensible." },
  { id: "shoulder", title: "Hombros", instruction: "Cruza suavemente un brazo delante del pecho y cambia de lado.", alternative: "Haz círculos pequeños de hombros sin estirar el brazo." },
  { id: "forearms", title: "Antebrazos y muñecas", instruction: "Flexiona y extiende suavemente las muñecas, alternando lados.", alternative: "Solo abre y cierra las manos si el codo o la muñeca molestan." },
  { id: "neck", title: "Cuello y postura", instruction: "Inclina ligeramente la cabeza a cada lado; mantén la mandíbula relajada.", alternative: "Mantén la cabeza neutra y haz respiraciones lentas." },
  { id: "body-check", title: "Revisión corporal", instruction: "Nota cómo se sienten piernas, rodilla, hombro y brazo; evita forzar zonas sensibles.", alternative: "Si estás incómodo, descansa sentado." },
  { id: "finish", title: "Respiración final", instruction: "Respira de forma natural y registra cualquier molestia al terminar.", alternative: "Termina sentado si lo prefieres." }
];

export const guidedVariants = {
  warmup: [
    { ...warmupBase, id: "tennis-warmup-5-v1", title: "Calentamiento rápido · 5 min",
      subtitle: "Movilidad y golpes progresivos cuando tienes poco tiempo.",
      steps: [stepWithTime(warmupBase.steps[0], 60), stepWithTime(warmupBase.steps[1], 35), stepWithTime(warmupBase.steps[2], 35),
        stepWithTime(warmupBase.steps[3], 35), stepWithTime(warmupBase.steps[4], 35), stepWithTime(warmupBase.steps[5], 40),
        stepWithTime(warmupBase.steps[7], 30), stepWithTime(warmupBase.steps[8], 30)] },
    { ...warmupBase, title: "Calentamiento completo · 11 min" },
    { ...warmupBase, id: "tennis-warmup-15-v1", title: "Calentamiento extendido · 15 min",
      subtitle: "Más tiempo para pies, reacción y golpes antes de jugar.",
      steps: [...warmupBase.steps.slice(0, -1), ...warmupExtra, warmupBase.steps.at(-1)] }
  ],
  stretching: [
    { ...stretchBase, title: "Estiramientos cortos · 7 min" },
    { ...stretchBase, id: "post-play-stretch-15-v1", title: "Movilidad y estiramientos · 15 min",
      subtitle: "Vuelta a la calma más pausada después del entrenamiento.",
      steps: longStretchSteps.slice(0, 10).map(step => ({ ...step, seconds: 90 })) },
    { ...stretchBase, id: "post-play-stretch-30-v1", title: "Movilidad tranquila · 30 min",
      subtitle: "Sesión larga de movilidad suave y respiración, de estilo relajado.",
      steps: longStretchSteps.map(step => ({ ...step, seconds: 120 })) }
  ]
};

export const guidedOptions = kind => guidedVariants[kind] || [];
export const guidedPlan = (kind, id = "") => id
  ? guidedOptions(kind).find(plan => plan.id === id) || null
  : guidedOptions(kind).find(plan => plan.id === guidedSessions[kind]?.id) || null;
export const guidedTotalSeconds = plan => (plan?.steps || []).reduce((sum, step) => sum + step.seconds, 0);

export function guidedRemainingMs(state, now = Date.now()) {
  if (!state || state.status === "preview") return 0;
  return state.status === "active" ? Math.max(0, (Number(state.stepEndsAt) || 0) - now) : Math.max(0, Number(state.stepRemainingMs) || 0);
}

export function guidedElapsedMs(state, now = Date.now()) {
  if (!state) return 0;
  return Math.max(0, Number(state.elapsedMs) || 0)
    + (state.status === "active" ? Math.max(0, now - (Number(state.activeStartedAt) || now)) : 0);
}
