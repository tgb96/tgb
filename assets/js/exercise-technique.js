export const coreTechniqueGuides = {
  "stationary-bike-warmup": {
    visual: "bike",
    start: "Ajusta el asiento para que la rodilla quede ligeramente flexionada cuando el pedal esté abajo. Apoya el centro del pie y relaja el hombro derecho.",
    action: "Pedalea suave, con una cadencia continua. En el último minuto aumenta un poco el ritmo, sin subir mucho la resistencia.",
    key: "Tronco quieto, rodillas siguiendo la línea de los pies y respiración normal.",
    avoid: "No balancees la cadera ni empujes solo con las puntas de los pies. No debe cansarte antes del core."
  },
  "core-90-90-breathing": {
    visual: "brace",
    start: "Boca arriba, apoya las pantorrillas en una silla: caderas y rodillas cerca de 90°. Deja ambos brazos cómodos, sin obligar al izquierdo a una posición simétrica.",
    action: "Inhala por la nariz expandiendo costillas; exhala lento durante 5–7 segundos y activa suavemente el abdomen al final.",
    key: "Mantén costillas sobre pelvis y la zona lumbar neutra, sin aplastarla con fuerza contra el suelo.",
    avoid: "No eleves hombros, no contengas el aire y no hagas una contracción máxima."
  },
  "adapted-curl-up": {
    visual: "curl-up",
    start: "Boca arriba, una rodilla flexionada y la otra pierna extendida. Brazos relajados; no uses la mano derecha para impulsarte.",
    action: "Activa el abdomen y eleva apenas cabeza y hombros como una sola unidad. Mantén 5 segundos y baja controlado; luego cambia la pierna flexionada.",
    key: "Imagina que hay una tabla entre cabeza y pecho: el cuello permanece largo y la columna conserva su forma.",
    avoid: "No lleves el mentón al pecho, no hagas un abdominal completo y no aplastes o redondees la zona lumbar."
  },
  "legs-only-dead-bug": {
    visual: "dead-bug",
    start: "Boca arriba, eleva caderas y rodillas a 90°. Los brazos descansan y no presionan el suelo para ayudarte.",
    action: "Exhala, baja lentamente un talón hasta tocar o acercarse al suelo y vuelve. Alterna las piernas.",
    key: "Solo baja hasta donde puedas conservar costillas, pelvis y zona lumbar estables.",
    avoid: "No estires la pierna tan lejos que la espalda se arquee ni aceleres el regreso."
  },
  "glute-bridge-march": {
    visual: "bridge-march",
    start: "Boca arriba, rodillas flexionadas y pies al ancho de caderas. Eleva la pelvis hasta formar una línea hombros–caderas–rodillas.",
    action: "Sin bajar la cadera, despega un pie pocos centímetros, apóyalo y alterna. Haz una pausa breve en cada marcha.",
    key: "Mantén ambos lados de la pelvis a la misma altura y empuja el suelo con el pie de apoyo.",
    avoid: "No arquees la zona lumbar ni eleves mucho la rodilla. Si la pelvis gira, vuelve al puente normal."
  },
  "side-lying-oblique-crunch": {
    visual: "side-crunch",
    start: "Acuéstate de lado con rodillas flexionadas y pelvis apilada. Deja el brazo izquierdo cómodo; en ese costado puedes mantener la cabeza apoyada.",
    action: "Exhala y acerca suavemente las costillas a la cadera, elevando muy poco cabeza y hombros. Baja lento.",
    key: "Es una contracción corta del costado del abdomen, no un impulso del cuello ni de los brazos.",
    avoid: "No empujes con el brazo derecho y no ruedes la pelvis hacia atrás. Si carga el cuello, hazla isométrica sin levantar la cabeza."
  },
  "seated-trunk-rotation": {
    visual: "seated-rotation",
    start: "Siéntate alto, con ambos pies firmes y la pelvis mirando al frente. Deja los brazos relajados en una posición natural.",
    action: "Exhala y gira suavemente las costillas hacia un lado; vuelve al centro y repite al otro.",
    key: "El giro nace en el tronco sobre una pelvis quieta. Usa un rango medio que puedas frenar.",
    avoid: "No tomes impulso con el brazo derecho, no desplaces las rodillas y no busques el máximo rango lumbar."
  },
  "right-suitcase-march": {
    visual: "suitcase-march",
    start: "De pie, sostén la carga con la mano derecha al costado. Costillas sobre pelvis, mirada al frente y pies separados al ancho cómodo.",
    action: "Marcha lento, elevando una rodilla cada vez sin perder altura ni inclinarte hacia la carga o en sentido contrario.",
    key: "Pasos silenciosos y tronco vertical. La carga desafía al core; no debe sentirse como un ejercicio de agarre máximo.",
    avoid: "No subas el hombro derecho. Detén la carga si aparecen molestias en pulgar, antebrazo, codo u hombro."
  },
  "single-leg-knee-drive-hold": {
    visual: "knee-hold",
    start: "Apoya un pie completo —talón, base del dedo gordo y base del meñique— con la rodilla suavemente desbloqueada.",
    action: "Eleva la otra rodilla hasta una altura controlable y mantén. Cambia de lado al terminar el tiempo.",
    key: "Pelvis nivelada, tronco quieto y pie de apoyo activo. Ten una pared al lado para tocarla con la mano derecha si pierdes equilibrio.",
    avoid: "No bloquees la rodilla de apoyo ni inclines el tronco. Reduce altura o tiempo si molestan rodilla o Aquiles."
  },
  "core-controlled-shadow-tennis": {
    visual: "shadow-tennis",
    start: "Parte en posición de espera, con base estable y rodillas flexionadas. Imagina la trayectoria de una pelota concreta.",
    action: "Prepara, rota desde pies y cadera, acompaña con el tronco, simula el golpe derecho y frena antes de recuperar el centro.",
    key: "Trabaja al 60–70%: secuencia limpia, equilibrio final y regreso controlado importan más que la velocidad.",
    avoid: "No gires solo el brazo derecho, no cruces los pies al recuperar y no termines cada golpe desequilibrado."
  },
  "core-cooldown-breathing": {
    visual: "cooldown",
    start: "Boca arriba, pies apoyados y rodillas flexionadas juntas. Deja cuello y ambos brazos en una posición cómoda.",
    action: "Respira lento y permite que las rodillas caigan suavemente hacia un lado; vuelve al centro y cambia.",
    key: "El movimiento es pequeño y relajado. Los hombros permanecen apoyados sin forzar simetría del brazo izquierdo.",
    avoid: "No empujes las rodillas hacia el suelo ni permanezcas en un rango que genere dolor lumbar."
  }
};

const figure = (motion, label, content) => `
  <svg class="technique-svg" data-motion="${motion}" viewBox="0 0 240 140" role="img" aria-label="${label}">
    <rect class="technique-backdrop" x="1" y="1" width="238" height="138" rx="18"></rect>
    ${content}
  </svg>`;

const visuals = {
  bike: figure("bike", "Pedaleo suave en bicicleta estática", `
    <line class="technique-floor" x1="18" y1="117" x2="222" y2="117"></line>
    <circle class="technique-soft" cx="68" cy="102" r="25"></circle><circle class="technique-soft" cx="168" cy="102" r="25"></circle>
    <path class="technique-body" d="M68 102 L104 66 L137 102 L68 102 M104 66 L168 102 M92 77 L130 77"></path>
    <circle class="technique-head" cx="114" cy="30" r="9"></circle><path class="technique-body" d="M110 40 L102 68 L132 78"></path>
    <g class="technique-crank"><circle class="technique-accent" cx="118" cy="92" r="8"></circle><line class="technique-accent" x1="110" y1="92" x2="126" y2="92"></line></g>
    <path class="technique-accent technique-bike-leg" d="M103 67 L118 92 L137 102"></path>
  `),
  brace: figure("brace", "Respiración boca arriba con piernas sobre una silla", `
    <line class="technique-floor" x1="16" y1="111" x2="224" y2="111"></line><rect class="technique-equipment" x="165" y="59" width="48" height="52" rx="5"></rect>
    <circle class="technique-head" cx="45" cy="89" r="10"></circle><path class="technique-body" d="M55 92 L119 94 L153 72 L184 72"></path>
    <circle class="technique-pulse" cx="93" cy="87" r="18"></circle><path class="technique-accent" d="M82 80 Q93 70 104 80"></path>
  `),
  "curl-up": figure("curl-up", "Elevación corta de cabeza y hombros con columna neutra", `
    <line class="technique-floor" x1="18" y1="112" x2="222" y2="112"></line><path class="technique-soft" d="M108 102 L154 78 L182 108 M108 102 L197 108"></path>
    <g class="technique-upper"><circle class="technique-head" cx="47" cy="93" r="10"></circle><path class="technique-body" d="M57 96 L111 103"></path><path class="technique-accent" d="M68 89 Q87 81 105 91"></path></g>
    <path class="technique-arrow" d="M55 72 Q74 54 95 66"></path>
  `),
  "dead-bug": figure("dead-bug", "Descenso alternado del talón manteniendo la espalda estable", `
    <line class="technique-floor" x1="16" y1="112" x2="224" y2="112"></line><circle class="technique-head" cx="48" cy="91" r="10"></circle><path class="technique-body" d="M58 95 L116 96"></path>
    <path class="technique-soft" d="M113 96 L132 65 L163 65"></path><g class="technique-moving-leg"><path class="technique-accent" d="M113 96 L142 74 L181 102"></path><circle class="technique-joint" cx="181" cy="102" r="4"></circle></g>
    <line class="technique-guide-line" x1="70" y1="106" x2="122" y2="106"></line>
  `),
  "bridge-march": figure("bridge-march", "Puente con pelvis nivelada y una marcha corta", `
    <line class="technique-floor" x1="16" y1="115" x2="224" y2="115"></line><circle class="technique-head" cx="42" cy="102" r="9"></circle><path class="technique-body" d="M51 103 L92 93 L132 66 L173 104"></path>
    <path class="technique-soft" d="M132 66 L180 105"></path><g class="technique-march-leg"><path class="technique-accent" d="M132 66 L160 72 L179 55"></path><circle class="technique-joint" cx="179" cy="55" r="4"></circle></g>
    <line class="technique-guide-line" x1="93" y1="82" x2="139" y2="82"></line>
  `),
  "side-crunch": figure("side-crunch", "Contracción corta del costado sin impulso de brazos", `
    <line class="technique-floor" x1="16" y1="112" x2="224" y2="112"></line><path class="technique-soft" d="M118 99 L153 84 L187 104 M153 84 L196 105"></path>
    <g class="technique-upper"><circle class="technique-head" cx="56" cy="95" r="10"></circle><path class="technique-body" d="M66 98 Q91 92 119 99"></path><path class="technique-accent" d="M83 86 Q101 76 118 88"></path></g>
    <path class="technique-arrow" d="M76 71 Q94 56 112 69"></path>
  `),
  "seated-rotation": figure("seated-rotation", "Rotación de las costillas sobre una pelvis estable", `
    <line class="technique-floor" x1="16" y1="116" x2="224" y2="116"></line><path class="technique-equipment" d="M88 82 L151 82 L151 112 M95 82 L95 112"></path>
    <circle class="technique-head" cx="119" cy="34" r="10"></circle><path class="technique-body" d="M119 44 L119 83 L98 111 M119 83 L145 111"></path>
    <g class="technique-shoulders"><line class="technique-accent" x1="79" y1="56" x2="159" y2="56"></line><circle class="technique-joint" cx="79" cy="56" r="4"></circle><circle class="technique-joint" cx="159" cy="56" r="4"></circle></g>
    <path class="technique-arrow" d="M82 31 Q119 12 156 31"></path>
  `),
  "suitcase-march": figure("suitcase-march", "Marcha vertical con la carga en la mano derecha", `
    <line class="technique-floor" x1="16" y1="118" x2="224" y2="118"></line><circle class="technique-head" cx="114" cy="25" r="10"></circle><path class="technique-body" d="M114 35 L114 78 L94 116 M114 50 L145 78"></path>
    <rect class="technique-weight" x="137" y="77" width="19" height="25" rx="4"></rect><g class="technique-knee"><path class="technique-accent" d="M114 78 L138 88 L162 72"></path><circle class="technique-joint" cx="162" cy="72" r="4"></circle></g>
    <line class="technique-guide-line" x1="104" y1="39" x2="104" y2="107"></line>
  `),
  "knee-hold": figure("knee-hold", "Equilibrio sobre una pierna con la rodilla contraria elevada", `
    <line class="technique-floor" x1="16" y1="118" x2="224" y2="118"></line><line class="technique-equipment" x1="197" y1="24" x2="197" y2="118"></line>
    <circle class="technique-head" cx="112" cy="25" r="10"></circle><path class="technique-body" d="M112 35 L112 76 L98 117 M112 48 L141 62"></path>
    <g class="technique-knee"><path class="technique-accent" d="M112 76 L143 76 L143 103"></path><circle class="technique-joint" cx="143" cy="103" r="4"></circle></g><path class="technique-soft" d="M141 62 L187 61"></path>
    <line class="technique-guide-line" x1="102" y1="39" x2="102" y2="106"></line>
  `),
  "shadow-tennis": figure("shadow-tennis", "Golpe simulado con rotación y regreso equilibrado", `
    <line class="technique-floor" x1="16" y1="118" x2="224" y2="118"></line><g class="technique-shadow-body"><circle class="technique-head" cx="105" cy="26" r="10"></circle><path class="technique-body" d="M105 36 L110 77 L83 116 M110 77 L143 116"></path><g class="technique-shadow-arm"><path class="technique-accent" d="M107 50 L151 57 L185 40"></path><line class="technique-racket" x1="185" y1="40" x2="211" y2="20"></line><ellipse class="technique-racket" cx="216" cy="16" rx="9" ry="14" transform="rotate(42 216 16)"></ellipse></g></g>
    <path class="technique-arrow" d="M61 49 Q107 10 164 36"></path><path class="technique-soft" d="M64 116 L46 116 M157 116 L176 116"></path>
  `),
  cooldown: figure("cooldown", "Caída suave de ambas rodillas a cada lado", `
    <line class="technique-floor" x1="16" y1="113" x2="224" y2="113"></line><circle class="technique-head" cx="47" cy="94" r="10"></circle><path class="technique-body" d="M57 98 L118 99"></path>
    <g class="technique-knees"><path class="technique-accent" d="M116 99 L143 69 L174 100"></path><circle class="technique-joint" cx="143" cy="69" r="4"></circle></g><path class="technique-arrow" d="M126 56 Q151 37 181 55"></path>
    <circle class="technique-pulse" cx="91" cy="89" r="17"></circle>
  `)
};

export function exerciseTechniqueGuide(routineId, exerciseId) {
  if (routineId !== "core") return null;
  return coreTechniqueGuides[exerciseId] || null;
}

export function createTechniqueIllustration(visual, documentRef = document) {
  const wrapper = documentRef.createElement("div");
  wrapper.className = "technique-figure";
  wrapper.innerHTML = visuals[visual] || visuals.brace;
  return wrapper;
}
