const youtubeVideo = (id, title, source, note = "") => ({
  provider: "youtube",
  id,
  title,
  source,
  sourceUrl: `https://www.youtube.com/watch?v=${id}`,
  note
});

const vimeoVideo = (id, title, source, note = "") => ({
  provider: "vimeo",
  id,
  title,
  source,
  sourceUrl: `https://vimeo.com/${id}`,
  note
});

export const coreTechniqueGuides = {
  "stationary-bike-warmup": {
    video: youtubeVideo("tuLNGCYnuy8", "Ajuste de bicicleta estática", "Foundation Physical Therapy"),
    start: "Ajusta el asiento para que la rodilla quede ligeramente flexionada cuando el pedal esté abajo. Apoya el centro del pie y relaja el hombro derecho.",
    action: "Pedalea suave, con una cadencia continua. En el último minuto aumenta un poco el ritmo, sin subir mucho la resistencia.",
    key: "Tronco quieto, rodillas siguiendo la línea de los pies y respiración normal.",
    avoid: "No balancees la cadera ni empujes solo con las puntas de los pies. No debe cansarte antes del core."
  },
  "core-90-90-breathing": {
    video: vimeoVideo("303337669", "Respiración 90/90", "Chris Mullins", "El video usa una pared; en TGTrain puedes apoyar las pantorrillas en una silla si te resulta más cómodo."),
    start: "Boca arriba, apoya las pantorrillas en una silla: caderas y rodillas cerca de 90°. Deja ambos brazos cómodos, sin obligar al izquierdo a una posición simétrica.",
    action: "Inhala por la nariz expandiendo costillas; exhala lento durante 5–7 segundos y activa suavemente el abdomen al final.",
    key: "Mantén costillas sobre pelvis y la zona lumbar neutra, sin aplastarla con fuerza contra el suelo.",
    avoid: "No eleves hombros, no contengas el aire y no hagas una contracción máxima."
  },
  "adapted-curl-up": {
    video: youtubeVideo("CvpZJkepMyE", "Curl-up de McGill", "Physio REHAB", "Observa la elevación corta del tronco. Mantén los brazos en una posición cómoda y no fuerces simetría."),
    start: "Boca arriba, una rodilla flexionada y la otra pierna extendida. Brazos relajados; no uses la mano derecha para impulsarte.",
    action: "Activa el abdomen y eleva apenas cabeza y hombros como una sola unidad. Mantén 5 segundos y baja controlado; luego cambia la pierna flexionada.",
    key: "Imagina que hay una tabla entre cabeza y pecho: el cuello permanece largo y la columna conserva su forma.",
    avoid: "No lleves el mentón al pecho, no hagas un abdominal completo y no aplastes o redondees la zona lumbar."
  },
  "legs-only-dead-bug": {
    video: youtubeVideo("BZYaCzbP09M", "Dead bug", "E3 Rehab Exercise Library", "El video muestra el patrón general. En tu variante los brazos descansan y solo se mueven las piernas."),
    start: "Boca arriba, eleva caderas y rodillas a 90°. Los brazos descansan y no presionan el suelo para ayudarte.",
    action: "Exhala, baja lentamente un talón hasta tocar o acercarse al suelo y vuelve. Alterna las piernas.",
    key: "Solo baja hasta donde puedas conservar costillas, pelvis y zona lumbar estables.",
    avoid: "No estires la pierna tan lejos que la espalda se arquee ni aceleres el regreso."
  },
  "glute-bridge-march": {
    video: youtubeVideo("RESEoAnLEmk", "Puente de glúteos con marcha", "Horton Barbell"),
    start: "Boca arriba, rodillas flexionadas y pies al ancho de caderas. Eleva la pelvis hasta formar una línea hombros–caderas–rodillas.",
    action: "Sin bajar la cadera, despega un pie pocos centímetros, apóyalo y alterna. Haz una pausa breve en cada marcha.",
    key: "Mantén ambos lados de la pelvis a la misma altura y empuja el suelo con el pie de apoyo.",
    avoid: "No arquees la zona lumbar ni eleves mucho la rodilla. Si la pelvis gira, vuelve al puente normal."
  },
  "side-lying-oblique-crunch": {
    video: youtubeVideo("4ESORAB705Y", "Contracción oblicua de lado", "Danny Nichols Fitness", "Usa un recorrido pequeño y la adaptación escrita; no copies una posición de brazos que te resulte incómoda."),
    start: "Acuéstate de lado con rodillas flexionadas y pelvis apilada. Deja el brazo izquierdo cómodo; en ese costado puedes mantener la cabeza apoyada.",
    action: "Exhala y acerca suavemente las costillas a la cadera, elevando muy poco cabeza y hombros. Baja lento.",
    key: "Es una contracción corta del costado del abdomen, no un impulso del cuello ni de los brazos.",
    avoid: "No empujes con el brazo derecho y no ruedes la pelvis hacia atrás. Si carga el cuello, hazla isométrica sin levantar la cabeza."
  },
  "seated-trunk-rotation": {
    video: youtubeVideo("hFXmb7wy_No", "Rotación torácica sentada", "Oxford University Hospitals NHS", "El video enseña la rotación general; deja los brazos donde puedas mantenerlos relajados."),
    start: "Siéntate alto, con ambos pies firmes y la pelvis mirando al frente. Deja los brazos relajados en una posición natural.",
    action: "Exhala y gira suavemente las costillas hacia un lado; vuelve al centro y repite al otro.",
    key: "El giro nace en el tronco sobre una pelvis quieta. Usa un rango medio que puedas frenar.",
    avoid: "No tomes impulso con el brazo derecho, no desplaces las rodillas y no busques el máximo rango lumbar."
  },
  "right-suitcase-march": {
    video: youtubeVideo("SUTuluoYato", "Marcha con carga a un costado", "KI Rehab", "En TGTrain la carga va en la mano derecha y se detiene ante molestias del brazo dominante."),
    start: "De pie, sostén la carga con la mano derecha al costado. Costillas sobre pelvis, mirada al frente y pies separados al ancho cómodo.",
    action: "Marcha lento, elevando una rodilla cada vez sin perder altura ni inclinarte hacia la carga o en sentido contrario.",
    key: "Pasos silenciosos y tronco vertical. La carga desafía al core; no debe sentirse como un ejercicio de agarre máximo.",
    avoid: "No subas el hombro derecho. Detén la carga si aparecen molestias en pulgar, antebrazo, codo u hombro."
  },
  "single-leg-knee-drive-hold": {
    video: youtubeVideo("nLHy38nxMmY", "Equilibrio sobre una pierna", "E3 Rehab Exercise Library", "La variante de TGTrain añade la elevación controlada de la rodilla libre y permite tocar una pared."),
    start: "Apoya un pie completo —talón, base del dedo gordo y base del meñique— con la rodilla suavemente desbloqueada.",
    action: "Eleva la otra rodilla hasta una altura controlable y mantén. Cambia de lado al terminar el tiempo.",
    key: "Pelvis nivelada, tronco quieto y pie de apoyo activo. Ten una pared al lado para tocarla con la mano derecha si pierdes equilibrio.",
    avoid: "No bloquees la rodilla de apoyo ni inclines el tronco. Reduce altura o tiempo si molestan rodilla o Aquiles."
  },
  "core-controlled-shadow-tennis": {
    video: youtubeVideo("abr7eN-poK8", "Shadow tennis: movimiento y golpe sin pelota", "Demostración de tenis", "Mira el patrón de pies y recuperación. Tu versión se realiza al 60–70%, con golpe derecho y control del equilibrio."),
    start: "Parte en posición de espera, con base estable y rodillas flexionadas. Imagina la trayectoria de una pelota concreta.",
    action: "Prepara, rota desde pies y cadera, acompaña con el tronco, simula el golpe derecho y frena antes de recuperar el centro.",
    key: "Trabaja al 60–70%: secuencia limpia, equilibrio final y regreso controlado importan más que la velocidad.",
    avoid: "No gires solo el brazo derecho, no cruces los pies al recuperar y no termines cada golpe desequilibrado."
  },
  "core-cooldown-breathing": {
    video: youtubeVideo("VCl1fln30e4", "Knee rolling suave", "Oxford University Hospitals NHS", "Prioriza un recorrido pequeño y respiración lenta; no necesitas llevar las rodillas al suelo."),
    start: "Boca arriba, pies apoyados y rodillas flexionadas juntas. Deja cuello y ambos brazos en una posición cómoda.",
    action: "Respira lento y permite que las rodillas caigan suavemente hacia un lado; vuelve al centro y cambia.",
    key: "El movimiento es pequeño y relajado. Los hombros permanecen apoyados sin forzar simetría del brazo izquierdo.",
    avoid: "No empujes las rodillas hacia el suelo ni permanezcas en un rango que genere dolor lumbar."
  }
};

export function exerciseTechniqueGuide(routineId, exerciseId) {
  if (routineId !== "core") return null;
  return coreTechniqueGuides[exerciseId] || null;
}

function videoEmbedUrl(video) {
  if (video.provider === "vimeo") {
    return `https://player.vimeo.com/video/${encodeURIComponent(video.id)}?autoplay=1&title=0&byline=0&portrait=0`;
  }
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?autoplay=1&rel=0&playsinline=1&end=90`;
}

export function createTechniqueVideoPlayer(video, documentRef = document) {
  const wrapper = documentRef.createElement("div");
  wrapper.className = "technique-video";

  const stage = documentRef.createElement("div");
  stage.className = "technique-video-stage";
  const play = documentRef.createElement("button");
  play.type = "button";
  play.className = "technique-video-play";
  play.setAttribute("aria-label", `Reproducir video: ${video.title}`);
  const icon = documentRef.createElement("span");
  icon.className = "technique-video-play-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▶";
  const copy = documentRef.createElement("span");
  const title = documentRef.createElement("strong");
  title.textContent = video.title;
  const hint = documentRef.createElement("small");
  hint.textContent = "Reproducir demostración breve";
  copy.append(title, hint);
  play.append(icon, copy);
  play.addEventListener("click", () => {
    const iframe = documentRef.createElement("iframe");
    iframe.className = "technique-video-frame";
    iframe.title = video.title;
    iframe.src = videoEmbedUrl(video);
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    stage.replaceChildren(iframe);
  }, { once: true });
  stage.append(play);

  const source = documentRef.createElement("a");
  source.className = "technique-video-source";
  source.href = video.sourceUrl;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = `Fuente: ${video.source} ↗`;
  wrapper.append(stage, source);
  return wrapper;
}
