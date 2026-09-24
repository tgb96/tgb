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

export const guidedPlan = kind => guidedSessions[kind] || null;
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
