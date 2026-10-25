const youtubeVideo = (id, title, source, options = {}) => ({
  provider: "youtube",
  id,
  title,
  source,
  startSeconds: Math.max(0, Number(options.startSeconds) || 0),
  clipSeconds: Math.min(55, Math.max(10, Number(options.clipSeconds) || 55)),
  sourceUrl: `https://www.youtube.com/watch?v=${id}${options.startSeconds ? `&t=${options.startSeconds}s` : ""}`,
  note: options.note || ""
});

const makeGuide = (video, start, action, key, avoid) => ({ video, start, action, key, avoid });

const video = {
  bike: youtubeVideo("tuLNGCYnuy8", "Ajuste de bicicleta estática", "Foundation Physical Therapy"),
  breathing: youtubeVideo("2RKwvUmhID0", "Respiración 90/90", "Keep It Moving PT & Wellness"),
  curlUp: youtubeVideo("NsIWWkY7fQg", "Curl-up de McGill", "Live Lean TV", { clipSeconds: 50 }),
  deadBug: youtubeVideo("BZYaCzbP09M", "Dead bug", "E3 Rehab Exercise Library"),
  bridgeMarch: youtubeVideo("RESEoAnLEmk", "Puente de glúteos con marcha", "Horton Barbell"),
  oblique: youtubeVideo("4ESORAB705Y", "Contracción oblicua de lado", "Danny Nichols Fitness"),
  rotation: youtubeVideo("hFXmb7wy_No", "Rotación torácica sentada", "Oxford University Hospitals NHS"),
  carry: youtubeVideo("SUTuluoYato", "Marcha con carga a un costado", "KI Rehab"),
  balance: youtubeVideo("nLHy38nxMmY", "Equilibrio sobre una pierna", "E3 Rehab Exercise Library"),
  shadow: youtubeVideo("GqiFHAPxuWE", "Shadow tennis y recuperación", "Tennis Academy 101"),
  split: youtubeVideo("_BInFgItzmg", "Split step en casa", "Demostración de tenis"),
  mobility: youtubeVideo("VCl1fln30e4", "Movilidad lumbar suave", "Oxford University Hospitals NHS"),
  wristCurl: youtubeVideo("04u4uGk3Ia8", "Curl de muñeca", "Demostración de fuerza"),
  reverseWrist: youtubeVideo("jBwHPFy6uhs", "Curl inverso de muñeca", "Coach Shafeeque"),
  forearmRotation: youtubeVideo("VV7zsl6LafM", "Pronación y supinación", "Baptist Health"),
  frontRaise: youtubeVideo("cQ-m4-g78wA", "Elevación frontal unilateral", "Demostración de fuerza"),
  reverseFly: youtubeVideo("NfI8eKZzhj8", "Apertura posterior unilateral", "Demostración de fuerza"),
  plank: youtubeVideo("A2b2EmIg0dA", "Plancha frontal", "E3 Rehab", { startSeconds: 30, clipSeconds: 25 }),
  ankle: youtubeVideo("NqgwyM9hXMI", "Rodilla a pared", "Victoria Park Osteopaths"),
  hipFlexor: youtubeVideo("k9kK6su9F1c", "Flexor de cadera en media rodilla", "Aaron Pashley"),
  scapular: youtubeVideo("oMSVe7PWJ3o", "Control escapular en pared", "[P]rehab"),
  forearmMobility: youtubeVideo("0-DMeFInf94", "Movilidad de extensores de muñeca", "E3 Rehab Exercise Library"),
  gluteBridge: youtubeVideo("y6kquy65vnc", "Puente de glúteos", "E3 Rehab Exercise Library"),
  squat: youtubeVideo("yzL1543i1-o", "Sentadilla con peso corporal", "E3 Rehab Exercise Library"),
  lateralLunge: youtubeVideo("tmhESsZcpDY", "Zancada lateral", "E3 Rehab Exercise Library"),
  reverseLunge: youtubeVideo("9De3B6tUMsA", "Zancada hacia atrás", "E3 Rehab Exercise Library"),
  row: youtubeVideo("H8jf3DwlIlo", "Remo unilateral con mancuerna", "Demostración de fuerza"),
  wristEccentric: youtubeVideo("VX11nNxXaCA", "Extensión de muñeca con carga", "E3 Rehab Exercise Library"),
  rdl: youtubeVideo("hQgFixeXdZo", "Peso muerto rumano con mancuerna", "J2FIT Strength & Conditioning", { startSeconds: 20, clipSeconds: 35 }),
  bulgarian: youtubeVideo("hiLF_pF3EJM", "Sentadilla búlgara", "Demostración de fuerza"),
  chestPress: youtubeVideo("qFTnmyC-nf4", "Press de pecho unilateral", "NASM"),
  chairStand: youtubeVideo("jyIkCrabFiw", "Sentarse y levantarse", "E3 Rehab Exercise Library"),
  wallSit: youtubeVideo("RG7z0P9qrLk", "Sentadilla en pared", "E3 Rehab Exercise Library")
};

const profiles = {
  bike: makeGuide(video.bike,
    "Ajusta el asiento para que la rodilla quede levemente flexionada con el pedal abajo.",
    "Pedalea continuo y aumenta el ritmo de forma gradual.",
    "Tronco quieto, rodillas en la línea de los pies y hombro derecho relajado.",
    "No balancees la pelvis ni empujes solo con las puntas de los pies."),
  breathing: makeGuide(video.breathing,
    "Boca arriba, pantorrillas en una silla y caderas y rodillas cerca de 90°. Brazos cómodos.",
    "Inhala expandiendo costillas; exhala 5–7 segundos y activa suavemente el abdomen.",
    "Mantén costillas sobre pelvis y cuello relajado.",
    "No eleves hombros, contengas el aire ni hagas una contracción máxima."),
  curlUp: makeGuide(video.curlUp,
    "Boca arriba, una rodilla flexionada y la otra extendida. No uses la mano derecha para impulsarte.",
    "Eleva apenas cabeza y hombros como una unidad, mantén 5 segundos y baja controlado.",
    "Cuello largo y curva lumbar natural; el recorrido es corto.",
    "No lleves el mentón al pecho ni hagas un abdominal completo."),
  deadBug: makeGuide(video.deadBug,
    "Boca arriba, caderas y rodillas a 90°; en tu variante los brazos descansan.",
    "Exhala, baja lentamente un talón y vuelve; alterna las piernas.",
    "Baja solo hasta donde puedas conservar pelvis y zona lumbar estables.",
    "No arquees la espalda ni aceleres el regreso."),
  bridgeMarch: makeGuide(video.bridgeMarch,
    "Eleva la pelvis con pies al ancho de caderas.",
    "Despega un pie pocos centímetros, apóyalo y alterna sin bajar la cadera.",
    "Mantén ambos lados de la pelvis a la misma altura.",
    "No arquees la zona lumbar; si la pelvis gira, vuelve al puente normal."),
  gluteBridge: makeGuide(video.gluteBridge,
    "Boca arriba, rodillas flexionadas y pies firmes.",
    "Empuja el suelo, extiende la cadera y baja con control.",
    "Termina con glúteos activos y costillas controladas.",
    "No hiperextiendas la espalda ni abras las rodillas."),
  oblique: makeGuide(video.oblique,
    "De lado, rodillas flexionadas, pelvis apilada y brazo izquierdo cómodo.",
    "Exhala y acerca suavemente costillas a cadera con un recorrido pequeño.",
    "La contracción nace en el costado del abdomen, no en el cuello.",
    "No empujes con el brazo derecho ni ruedes la pelvis."),
  rotation: makeGuide(video.rotation,
    "Siéntate alto, pies firmes, pelvis al frente y brazos relajados.",
    "Gira las costillas, vuelve al centro y cambia de lado.",
    "El giro nace en el tronco sobre una pelvis quieta.",
    "No tomes impulso con el brazo derecho ni busques el máximo rango lumbar."),
  carry: makeGuide(video.carry,
    "Carga en la mano derecha, costillas sobre pelvis y mirada al frente.",
    "Camina o marcha lento sin perder altura ni inclinarte.",
    "Pasos silenciosos y tronco vertical.",
    "No subas el hombro; detén la carga si molesta pulgar, antebrazo, codo u hombro."),
  balance: makeGuide(video.balance,
    "Apoya el pie completo, rodilla desbloqueada y una pared cerca.",
    "Eleva la otra rodilla o estabiliza la llegada durante el tiempo indicado.",
    "Pelvis nivelada, tronco quieto y pie activo.",
    "No bloquees la rodilla ni continúes si molestan rodilla o Aquiles."),
  shadow: makeGuide(video.shadow,
    "Parte en posición de espera con base estable y rodillas flexionadas.",
    "Simula el golpe, frena y recupera el centro con pasos cortos.",
    "La secuencia y el equilibrio final importan más que la velocidad.",
    "No gires solo el brazo derecho ni cruces los pies al recuperar."),
  split: makeGuide(video.split,
    "Posición de espera, ligero sobre la parte delantera de los pies.",
    "Haz un rebote corto, aterriza equilibrado y sal uno o dos pasos.",
    "Cae silencioso y usa el primer apoyo para acelerar, no para saltar alto.",
    "No juntes demasiado los pies ni aterrices con rodillas rígidas."),
  wristCurl: makeGuide(video.wristCurl,
    "Antebrazo derecho apoyado y muñeca fuera del borde, palma arriba.",
    "Flexiona la muñeca y baja lento.",
    "Mueve solo la muñeca con poca carga.",
    "No muevas el codo ni continúes si molesta el pulgar."),
  reverseWrist: makeGuide(video.reverseWrist,
    "Antebrazo derecho apoyado, palma abajo y muñeca libre.",
    "Eleva el dorso de la mano y baja en 2–3 segundos.",
    "Usa poco peso y control completo.",
    "No cierres el puño con fuerza ni sigas si duele el codo."),
  forearmRotation: makeGuide(video.forearmRotation,
    "Codo derecho junto al cuerpo y flexionado a 90°; palanca corta.",
    "Gira lentamente la palma hacia arriba y hacia abajo.",
    "Hombro y codo permanecen quietos.",
    "No uses inercia ni una palanca que cargue codo o pulgar."),
  frontRaise: makeGuide(video.frontRaise,
    "Carga liviana a la derecha, costillas controladas y hombro abajo.",
    "Eleva al frente hasta un rango cómodo y baja lento.",
    "Tronco estable y movimiento suave.",
    "No arquees la espalda ni fuerces una molestia de hombro."),
  reverseFly: makeGuide(video.reverseFly,
    "Inclina el torso desde la cadera, espalda neutra y carga muy liviana.",
    "Abre el brazo derecho con codo suave y vuelve controlado.",
    "Mueve la escápula sin girar el tronco.",
    "No eleves el hombro ni uses impulso."),
  plank: makeGuide(video.plank,
    "Apoya antebrazos según tu comodidad y rodillas o pies, sin forzar simetría del brazo izquierdo.",
    "Activa glúteos y abdomen mientras mantienes el cuerpo estable.",
    "Costillas sobre pelvis y respiración continua.",
    "No hundas la zona lumbar ni cargues el hombro derecho."),
  ankle: makeGuide(video.ankle,
    "Frente a una pared, pie completo apoyado y talón firme.",
    "Lleva la rodilla a la pared siguiendo el segundo dedo y vuelve.",
    "Conserva el arco del pie.",
    "No levantes el talón ni fuerces dolor en tobillo o Aquiles."),
  hipRotation: makeGuide(video.mobility,
    "Boca arriba, rodillas flexionadas, pies apoyados y brazos cómodos.",
    "Deja caer ambas rodillas pocos grados, vuelve y alterna.",
    "Recorrido suave guiado por respiración.",
    "No despegues hombros ni empujes las rodillas al suelo."),
  hipFlexor: makeGuide(video.hipFlexor,
    "En media rodilla, pelvis neutra y apoyo estable.",
    "Activa el glúteo atrasado y lleva suavemente la pelvis adelante.",
    "Acerca el cinturón a las costillas antes de avanzar.",
    "No arquees la zona lumbar ni rebotes."),
  scapular: makeGuide(video.scapular,
    "Antebrazo derecho en la pared, hombro relajado y tronco estable.",
    "Desliza o mueve la escápula lentamente y vuelve con control.",
    "La escápula se mueve sin encoger el hombro.",
    "No fuerces sobre la cabeza ni inclines el tronco."),
  forearmMobility: makeGuide(video.forearmMobility,
    "Extiende el brazo derecho en un rango cómodo sin bloquear el codo.",
    "Mueve la muñeca lentamente con ayuda suave si la necesitas.",
    "Busca tensión leve, no dolor ni adormecimiento.",
    "No tires del pulgar ni mantengas un estiramiento intenso."),
  squat: makeGuide(video.squat,
    "Base cómoda, peso en todo el pie y tronco estable.",
    "Lleva cadera atrás y abajo; sube empujando el suelo.",
    "Rodillas siguen la línea de los pies y el tronco no rota.",
    "No colapses rodillas ni pierdas apoyo del talón."),
  lateralLunge: makeGuide(video.lateralLunge,
    "Base amplia, pies al frente y tronco alto.",
    "Lleva la cadera hacia una pierna y vuelve empujando el suelo.",
    "Absorbe con cadera atrás y rodilla alineada.",
    "No caigas sobre la rodilla ni uses un rango doloroso."),
  reverseLunge: makeGuide(video.reverseLunge,
    "De pie, tronco estable y espacio despejado detrás.",
    "Da un paso atrás, baja, frena y vuelve con la pierna delantera.",
    "Pelvis nivelada y rodilla delantera alineada.",
    "No golpees la rodilla trasera ni regreses con impulso."),
  wallSlide: makeGuide(video.scapular,
    "Antebrazo derecho sobre una toalla en la pared y hombro abajo.",
    "Desliza hasta un rango cómodo y vuelve lento.",
    "Escápula acompaña y costillas permanecen controladas.",
    "No fuerces por encima de la cabeza ni arquees la espalda."),
  row: makeGuide(video.row,
    "Apoyo estable y carga en la mano derecha.",
    "Lleva el codo hacia la cadera, pausa y baja controlado.",
    "Hombro lejos de la oreja y tronco sin rotar.",
    "No tires hacia el pecho ni uses impulso."),
  wristEccentric: makeGuide(video.wristEccentric,
    "Antebrazo derecho apoyado, palma abajo y muñeca libre.",
    "Ayuda a subir y baja solo con la derecha durante 3 segundos.",
    "La bajada lenta es el objetivo; usa 1–3 kg máximo.",
    "No subas solo con la derecha si reproduce dolor."),
  towelGrip: makeGuide(video.forearmMobility,
    "Toalla enrollada en la mano derecha y hombro relajado.",
    "Aprieta moderado durante el tiempo indicado y relaja por completo.",
    "Muñeca neutra y respiración normal.",
    "No aprietes al máximo si molesta pulgar, codo o antebrazo."),
  armMobility: makeGuide(video.scapular,
    "De pie o sentado, hombro derecho relajado.",
    "Haz círculos pequeños y movilidad suave de muñeca y antebrazo.",
    "Debe sentirse como descarga, no como esfuerzo.",
    "No fuerces el rango ni permanezcas en dolor."),
  ready: makeGuide(video.split,
    "Pies algo más anchos que caderas, rodillas flexionadas y mirada al frente.",
    "Baja el centro, mantén la pausa y vuelve sin perder alineación.",
    "Talones livianos y pecho estable.",
    "No te sientes demasiado atrás ni colapses rodillas."),
  stop: makeGuide(video.split,
    "Desde espera, elige dirección y deja espacio para frenar.",
    "Da el paso, baja el centro y congela la llegada dos segundos.",
    "Aterriza silencioso con cadera, rodilla y pie alineados.",
    "No frenes rígido ni dejes que el tronco siga viajando."),
  shuffle: makeGuide(video.shadow,
    "Posición baja y dos marcas cercanas en el suelo.",
    "Desplázate lateralmente, frena y cambia de sentido.",
    "Pecho al frente y recuperación bajo control.",
    "No cruces los pies ni aceleres si la frenada se desordena."),
  rdl: makeGuide(video.rdl,
    "Carga a la derecha, rodillas suaves y columna neutra.",
    "Lleva la cadera atrás y vuelve extendiéndola.",
    "Es una bisagra de cadera; el tronco no rota.",
    "No lo conviertas en sentadilla ni redondees la espalda."),
  bulgarian: makeGuide(video.bulgarian,
    "Pie trasero en silla estable y delantero suficientemente lejos.",
    "Baja vertical con control y sube con la pierna delantera.",
    "Pelvis al frente y rodilla alineada; usa apoyo cercano.",
    "No rebotes ni priorices profundidad sobre estabilidad."),
  chestPress: makeGuide(video.chestPress,
    "Acostado, carga derecha, pies firmes y abdomen activo.",
    "Empuja vertical y baja hasta un rango cómodo.",
    "Evita que el tronco rote.",
    "No fuerces hombro, codo o pulgar ni dejes caer la carga."),
  chairStand: makeGuide(video.chairStand,
    "Silla estable, pies firmes y tronco levemente adelante.",
    "Levántate por completo y vuelve a tocar la silla con control.",
    "Cuenta solo repeticiones completas y alineadas.",
    "No te dejes caer ni cambies la silla entre evaluaciones."),
  wallSit: makeGuide(video.wallSit,
    "Espalda en la pared y pies adelantados en una posición reproducible.",
    "Desliza hasta el ángulo elegido y mantén respirando.",
    "Usa una profundidad similar para comparar resultados.",
    "No llegues a dolor ni sigas cuando pierdas postura."),
  cooldown: makeGuide(video.mobility,
    "Adopta una posición cómoda y relaja ambos brazos.",
    "Respira lento mientras mueves suavemente cadera, rodillas o tobillos.",
    "Baja el ritmo y revisa cómo respondió el cuerpo.",
    "No fuerces rangos ni conviertas la descarga en otra sesión exigente.")
};

const complementaryRoutineIds = new Set([
  "full-body", "core", "mobility-recovery", "prematch-activation", "indoor-power",
  "right-upper-maintenance", "deceleration-direction", "physical-express",
  "adapted-full-body", "physical-assessment"
]);

const profileByExercise = {
  "stationary-bike-warmup": "bike", "shadow-tennis": "shadow", "split-step-short": "split",
  "wrist-curl": "wristCurl", "reverse-wrist-curl": "reverseWrist", "wrist-rotation": "forearmRotation",
  "pronation-supination": "forearmRotation", "front-raise": "frontRaise", "one-arm-fly": "reverseFly",
  "front-plank": "plank", "suitcase-carry": "carry", "dead-bug": "deadBug",
  "core-90-90-breathing": "breathing", "adapted-curl-up": "curlUp", "legs-only-dead-bug": "deadBug",
  "glute-bridge-march": "bridgeMarch", "side-lying-oblique-crunch": "oblique", "seated-trunk-rotation": "rotation",
  "right-suitcase-march": "carry", "single-leg-knee-drive-hold": "balance", "core-controlled-shadow-tennis": "shadow",
  "core-cooldown-breathing": "cooldown", "recovery-bike": "bike", "recovery-90-90-breathing": "breathing",
  "ankle-rock-wall": "ankle", "supine-hip-rotation": "hipRotation", "half-kneeling-hip-flexor": "hipFlexor",
  "seated-thoracic-rotation": "rotation", "right-scapular-circles": "scapular", "right-forearm-release": "forearmMobility",
  "recovery-glute-bridge": "gluteBridge", "recovery-cooldown": "cooldown", "prematch-bike": "bike",
  "prematch-ankle-hip": "ankle", "prematch-squat": "squat", "prematch-lateral-lunge": "lateralLunge",
  "prematch-split-step": "split", "prematch-first-step": "stop", "prematch-shadow": "shadow", "prematch-reset": "breathing",
  "indoor-power-bike": "bike", "indoor-fast-squat": "squat", "indoor-skater-step": "lateralLunge",
  "indoor-split-exit": "split", "indoor-lateral-brake": "shuffle", "indoor-shadow-point": "shadow",
  "indoor-dead-bug": "deadBug", "indoor-cooldown": "cooldown", "upper-maintenance-bike": "bike",
  "right-scapular-clock": "scapular", "right-wall-slide": "wallSlide", "right-light-row": "row",
  "right-light-reverse-fly": "reverseFly", "right-eccentric-wrist-extension": "wristEccentric",
  "right-pronation-supination": "forearmRotation", "right-towel-grip": "towelGrip", "right-upper-cooldown": "armMobility",
  "decel-bike": "bike", "decel-ready-position": "ready", "decel-step-stick": "stop",
  "decel-reverse-lunge-stop": "reverseLunge", "decel-lateral-shuffle": "shuffle", "decel-diagonal-exit": "shadow",
  "decel-single-leg-balance": "balance", "decel-shadow": "shadow", "decel-cooldown": "cooldown",
  "express-bike": "bike", "express-unilateral-squat": "squat", "express-rdl": "rdl", "express-row": "row",
  "express-dead-bug": "deadBug", "express-lateral-return": "shuffle", "express-cooldown": "cooldown",
  "full-adapted-bike": "bike", "full-adapted-squat": "squat", "full-adapted-rdl": "rdl",
  "full-adapted-bulgarian": "bulgarian", "full-adapted-row": "row", "full-adapted-chest-press": "chestPress",
  "full-adapted-bridge-march": "bridgeMarch", "full-adapted-suitcase": "carry", "full-adapted-shadow": "shadow",
  "full-adapted-cooldown": "cooldown", "assessment-bike": "bike", "assessment-chair-stand": "chairStand",
  "assessment-single-leg": "balance", "assessment-wall-sit": "wallSit", "assessment-lateral-touches": "shuffle",
  "assessment-split-step": "split", "assessment-core": "deadBug", "assessment-shadow": "shadow", "assessment-cooldown": "cooldown"
};

const coreExerciseIds = [
  "stationary-bike-warmup", "core-90-90-breathing", "adapted-curl-up", "legs-only-dead-bug",
  "glute-bridge-march", "side-lying-oblique-crunch", "seated-trunk-rotation", "right-suitcase-march",
  "single-leg-knee-drive-hold", "core-controlled-shadow-tennis", "core-cooldown-breathing"
];

export const coreTechniqueGuides = Object.fromEntries(
  coreExerciseIds.map(exerciseId => [exerciseId, profiles[profileByExercise[exerciseId]]])
);

export function exerciseTechniqueGuide(routineId, exerciseId) {
  if (!complementaryRoutineIds.has(routineId)) return null;
  return profiles[profileByExercise[exerciseId]] || null;
}

function videoEmbedUrl(item) {
  const start = Math.max(0, Number(item.startSeconds) || 0);
  const end = start + Math.min(55, Math.max(10, Number(item.clipSeconds) || 55));
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.id)}?autoplay=1&rel=0&playsinline=1&start=${start}&end=${end}`;
}

export function createTechniqueVideoPlayer(item, documentRef = document) {
  const wrapper = documentRef.createElement("div");
  wrapper.className = "technique-video";
  const stage = documentRef.createElement("div");
  stage.className = "technique-video-stage";
  const play = documentRef.createElement("button");
  play.type = "button";
  play.className = "technique-video-play";
  play.setAttribute("aria-label", `Reproducir video: ${item.title}`);
  const icon = documentRef.createElement("span");
  icon.className = "technique-video-play-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "▶";
  const copy = documentRef.createElement("span");
  const title = documentRef.createElement("strong");
  title.textContent = item.title;
  const hint = documentRef.createElement("small");
  hint.textContent = `YouTube · clip de ${item.clipSeconds} s`;
  copy.append(title, hint);
  play.append(icon, copy);
  play.addEventListener("click", () => {
    const iframe = documentRef.createElement("iframe");
    iframe.className = "technique-video-frame";
    iframe.title = item.title;
    iframe.src = videoEmbedUrl(item);
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.allowFullscreen = true;
    stage.replaceChildren(iframe);
  }, { once: true });
  stage.append(play);
  const source = documentRef.createElement("a");
  source.className = "technique-video-source";
  source.href = item.sourceUrl;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = `Abrir fuente en YouTube · ${item.source} ↗`;
  wrapper.append(stage, source);
  return wrapper;
}
