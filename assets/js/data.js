export const TZ = "America/Santiago";

export const dayNamesShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const dayNamesFull = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export const activityTypes = ["Físico", "Tenis", "Cardio", "Movilidad", "Descanso", "Kinesiología", "Otro"];

export const readinessThresholds = {
  highPain: 6,
  highFatigue: 8,
  moderatePain: 4,
  moderateFatigue: 6,
  moderateTotal: 10
};

export const exerciseDescriptions = {
  "Bicicleta suave": "Pedaleo cómodo para subir temperatura corporal sin impacto. Debes sentir que despiertas las piernas, no que te agotas.",
  "Movilidad tobillo/cadera/hombros": "Movimientos controlados de tobillos, cadera y hombros antes de cargar. La idea es preparar articulaciones y mejorar rango de movimiento.",
  "Puente de glúteo": "Acostado boca arriba, pies apoyados, sube la cadera apretando glúteos. Evita arquear excesivamente la espalda baja.",
  "Monster walk con banda": "Banda sobre rodillas o tobillos. Baja levemente en posición atlética y camina lateralmente manteniendo tensión. Trabaja glúteo medio y estabilidad de rodilla.",
  "Sentadilla goblet": "Sostén una mancuerna o pesa frente al pecho. Baja como sentadilla manteniendo torso firme, rodillas alineadas y pies bien apoyados.",
  "Peso muerto rumano": "Lleva la cadera hacia atrás con espalda neutra y rodillas apenas flexionadas. Debes sentir isquios y glúteos, no dolor lumbar.",
  "Step-up a banco": "Sube a un banco o escalón con una pierna, empujando desde el talón. Baja controlado. Muy útil para tenis y estabilidad unilateral.",
  "Elevación de gemelos": "Al inicio hazla bilateral: sube ambos talones, pausa arriba y baja lento. Más adelante puedes progresar a unilateral.",
  "Plancha": "Apoya antebrazos y pies, abdomen firme y cuerpo recto. No dejes caer la cadera ni eleves demasiado los glúteos.",
  "Plancha lateral": "Apoya un antebrazo y el borde del pie. Mantén cadera elevada y cuerpo alineado. Trabaja core lateral, clave para estabilidad en golpes.",
  "Dead bug": "Boca arriba, abdomen firme. Baja pierna y brazo contrario sin despegar la espalda baja del suelo. Control antes que velocidad.",
  "Movilidad hombro/escápula": "Incluye círculos de hombro, retracción escapular, wall slides y rotaciones suaves. Prepara hombro y escápula para empujar, tirar y golpear.",
  "Press unilateral mancuerna": "Empuja una mancuerna con un brazo de forma controlada. Mantén abdomen firme para no rotar el tronco.",
  "Remo unilateral": "Tira la mancuerna hacia el costado del cuerpo llevando el codo atrás. Aprieta escápula y evita encoger el hombro.",
  "Face pull": "Con banda o polea a la altura de la cara, tira hacia tu rostro abriendo codos y juntando escápulas. Fortalece hombro posterior.",
  "Rotación externa con banda": "Codo pegado al cuerpo a 90 grados. Gira el antebrazo hacia afuera contra la banda. Controla lento, sin compensar con el tronco.",
  "Curl martillo": "Curl con agarre neutro, como sosteniendo un martillo. Fortalece bíceps, braquial y antebrazo útil para agarre de raqueta.",
  "Extensión tríceps unilateral": "Extiende el codo de un brazo con mancuerna o banda. Mantén el hombro estable y evita balancear el cuerpo.",
  "Pronación/supinación": "Con mancuerna liviana o martillo, gira el antebrazo palma arriba y palma abajo. Útil para codo, muñeca y control de raqueta.",
  "Excéntrico muñeca": "Apoya el antebrazo. Sube la muñeca ayudándote si hace falta y baja lento en 3-4 segundos. Muy usado para prevenir codo de tenista.",
  "Excéntricos muñeca suaves": "Versión ligera del excéntrico de muñeca. Apoya el antebrazo, sube la muñeca sin forzar y baja lento. Debe sentirse preventivo, no doloroso.",
  "Farmer carry unilateral": "Camina sosteniendo una mancuerna en un solo lado. Mantén el tronco recto sin inclinarte. Trabaja agarre y core anti-inclinación.",
  "Pallof press": "Con banda al costado, empuja al frente sin dejar que el tronco rote. Es un ejercicio anti-rotación muy útil para tenis.",
  "Movilidad previa": "Antes de tenis: movilidad de tobillos, caderas, columna torácica, hombro y muñeca. Debe dejarte más suelto, no cansado.",
  "Tenis": "Sesión de cancha. En retorno progresivo, prioriza técnica, ritmo y sensaciones antes que intensidad máxima.",
  "Estiramientos suaves": "Después del tenis: estira suave gemelos, cuádriceps, glúteos, espalda, hombro y antebrazo. No fuerces rangos dolorosos.",
  "Vuelta a la calma": "Baja progresivamente pulsaciones con caminata suave, respiración y movilidad ligera. Ayuda a recuperar mejor.",
  "Movilidad antebrazo/pulgar": "Movimientos suaves de muñeca, dedos y pulgar. Busca circulación y rango sin dolor, especialmente tras volver de lesión.",
  "Movilidad dinámica": "Movimientos activos: cadera, tobillos, sentadillas suaves, skipping bajo, rotaciones de tronco y hombros. Prepara el cuerpo para moverse rápido.",
  "Split step": "Pequeño salto/rebote justo antes de reaccionar, cayendo con rodillas flexionadas y listo para salir a cualquier dirección.",
  "Pies rápidos / escalera": "Pasos cortos y rápidos en escalera real o imaginaria. Mantén postura atlética y contacto rápido con el suelo.",
  "Desplazamientos laterales": "Muévete lateralmente sin cruzar pies, postura baja y controlada. Simula defensa y recuperación de posición en tenis.",
  "Sprints cortos": "Aceleraciones de 10 metros. Enfócate en salida explosiva y frenado controlado, no en correr largo.",
  "Cambios de dirección": "Acelera, frena y cambia de dirección con control. Baja el centro de gravedad y evita que la rodilla colapse hacia adentro.",
  "Sentadilla explosiva controlada": "Subida rápida y potente, bajada controlada. Debe sentirse atlética, sin perder técnica ni cargar la rodilla con desorden.",
  "Zancadas caminando": "Da pasos largos controlados, baja la rodilla trasera sin golpear el suelo y avanza empujando desde la pierna delantera.",
  "Gemelos": "Trabajo de pantorrilla. Hazlo bilateral y con bajada lenta. Ayuda a tobillo, Aquiles y empuje en cancha.",
  "Bicicleta zona 2": "Ritmo cómodo pero activo. Puedes hablar frases cortas sin ahogarte. Mejora resistencia y recuperación sin impacto.",
  "Tenis suave": "Sesión liviana de cancha: técnica, peloteo suave y desplazamientos moderados. No es día para competir al máximo.",
  "Movilidad completa": "Trabajo general de movilidad de tobillos, cadera, espalda, hombro y muñeca. Ideal si estás cargado o recuperando.",
  "Recuperar rutina perdida": "Usa este bloque para hacer la rutina A, B o C que no pudiste realizar durante la semana.",
  "Caminata suave": "Camina a ritmo cómodo para mover sangre y recuperar sin impacto. Debe dejarte mejor, no más cansado.",
  "Movilidad general": "Movilidad global suave para mantener articulaciones activas y bajar rigidez.",
  "Respiración / estiramientos": "Respira lento y haz estiramientos suaves. Sirve para bajar activación y favorecer recuperación."
};

export const suggestedWeights = {
  "Bicicleta suave": "Sin peso. Ritmo cómodo para calentar, sin agotarte.",
  "Movilidad tobillo/cadera/hombros": "Sin peso. Movimiento controlado y suave.",
  "Puente de glúteo": "Peso corporal. Si se siente muy fácil: 10–15 kg sobre la cadera.",
  "Monster walk con banda": "Banda liviana o media. Debe sentirse en glúteos, sin perder técnica.",
  "Sentadilla goblet": "8–12 kg al inicio. Objetivo: RPE 6–7/10, sin llegar al fallo.",
  "Peso muerto rumano": "8–12 kg total al inicio. Prioriza espalda neutra y bajada controlada.",
  "Step-up a banco": "Peso corporal al inicio. Si es fácil: 4–8 kg total.",
  "Elevación de gemelos": "Peso corporal al inicio. Luego 6–12 kg. Parte bilateral y progresa a unilateral.",
  "Plancha": "Peso corporal.",
  "Plancha lateral": "Peso corporal.",
  "Dead bug": "Peso corporal. Hazlo más lento antes de aumentar dificultad.",
  "Press unilateral mancuerna": "4–8 kg al inicio. No forzar el pulgar derecho.",
  "Remo unilateral": "8–12 kg al inicio. Controla la escápula y no tires con el cuello.",
  "Face pull": "Banda liviana/media o polea liviana. Prioriza técnica y control.",
  "Rotación externa con banda": "Banda liviana. Debe sentirse controlado, no pesado.",
  "Curl martillo": "4–8 kg. Si molesta el pulgar, baja carga o evita ese día.",
  "Extensión tríceps unilateral": "4–8 kg. Movimiento lento, sin bloquear agresivamente el codo.",
  "Pronación/supinación": "1–3 kg. Ideal con mancuerna liviana o martillo. Movimiento lento.",
  "Excéntrico muñeca": "1–3 kg. Baja lento en 3–4 segundos.",
  "Farmer carry unilateral": "8–14 kg. Tronco recto, sin inclinarte hacia el peso.",
  "Pallof press": "Banda media. Debe sentirse en el core, no en el hombro.",
  "Movilidad dinámica": "Sin peso. Debe prepararte para moverte rápido, no fatigarte.",
  "Split step": "Peso corporal.",
  "Pies rápidos / escalera": "Peso corporal.",
  "Desplazamientos laterales": "Peso corporal.",
  "Sprints cortos": "Peso corporal. Intensidad controlada si vienes retomando.",
  "Cambios de dirección": "Peso corporal. Prioriza frenar bien y rodillas alineadas.",
  "Sentadilla explosiva controlada": "Peso corporal al inicio. Luego 4–8 kg si no hay molestias.",
  "Zancadas caminando": "Peso corporal al inicio. Luego 4–8 kg total.",
  "Gemelos": "Peso corporal al inicio. Luego 6–12 kg. Bajada lenta.",
  "Bicicleta zona 2": "Sin peso. Ritmo cómodo y sostenido.",
  "Movilidad previa": "Sin peso. Activación articular antes de tenis.",
  "Tenis": "Sin peso. Controla intensidad por sensación y pulgar.",
  "Estiramientos suaves": "Sin peso. Estiramiento cómodo, nunca doloroso.",
  "Excéntricos muñeca suaves": "1–2 kg máximo o solo peso de la mano si hay molestia.",
  "Vuelta a la calma": "Sin peso. Baja pulsaciones y relaja piernas/brazo.",
  "Movilidad antebrazo/pulgar": "Sin peso o banda muy suave. Movimiento cómodo.",
  "Tenis suave": "Sin peso. Peloteo técnico, no partido intenso.",
  "Movilidad completa": "Sin peso.",
  "Recuperar rutina perdida": "Usa los pesos sugeridos de la rutina que recuperes.",
  "Caminata suave": "Sin peso.",
  "Movilidad general": "Sin peso.",
  "Respiración / estiramientos": "Sin peso."
};

export const routines = {
  1: { name: "Fuerza A", type: "Piernas + fuerza base", goal: "Piernas, glúteos, core y base física para tenis.", exercises: [
    ["Bicicleta suave", "5 min", 1],
    ["Movilidad tobillo/cadera/hombros", "5 min", 1],
    ["Puente de glúteo", "3 x 15", 3],
    ["Monster walk con banda", "3 x 12", 3],
    ["Sentadilla goblet", "4 x 8", 4],
    ["Peso muerto rumano", "4 x 8", 4],
    ["Step-up a banco", "3 x 10 por pierna", 3],
    ["Elevación de gemelos", "4 x 15", 4],
    ["Plancha", "3 x 40-60s", 3],
    ["Plancha lateral", "3 x 30s por lado", 3],
    ["Dead bug", "3 x 10", 3]
  ] },
  2: { name: "Tenis", type: "Cancha", goal: "Ritmo, técnica y retorno progresivo.", exercises: [
    ["Movilidad previa", "10 min aprox", 1, { noCountdown: true }],
    ["Tenis", "60-90 min aprox", 1, { noCountdown: true }],
    ["Estiramientos suaves", "10 min aprox", 1, { noCountdown: true }],
    ["Excéntricos muñeca suaves", "2 x 12", 2, { noCountdown: true }]
  ] },
  3: { name: "Fuerza B", type: "Tren superior + estabilidad", goal: "Hombro, espalda, antebrazo, agarre y core.", exercises: [
    ["Bicicleta suave", "5 min", 1],
    ["Movilidad hombro/escápula", "5 min", 1],
    ["Press unilateral mancuerna", "4 x 8", 4],
    ["Remo unilateral", "4 x 10", 4],
    ["Face pull", "4 x 15", 4],
    ["Rotación externa con banda", "3 x 15", 3],
    ["Curl martillo", "3 x 10", 3],
    ["Extensión tríceps unilateral", "3 x 12", 3],
    ["Pronación/supinación", "3 x 15", 3],
    ["Excéntrico muñeca", "3 x 12", 3],
    ["Farmer carry unilateral", "3 x 30 m", 3],
    ["Pallof press", "3 x 12", 3]
  ] },
  4: { name: "Tenis", type: "Cancha", goal: "Sesión de tenis con intensidad controlada.", exercises: [
    ["Movilidad previa", "10 min aprox", 1, { noCountdown: true }],
    ["Tenis", "60-90 min aprox", 1, { noCountdown: true }],
    ["Vuelta a la calma", "10 min aprox", 1, { noCountdown: true }],
    ["Movilidad antebrazo/pulgar", "5 min aprox", 1, { noCountdown: true }],
    ["Excéntricos muñeca suaves", "2 x 12", 2, { noCountdown: true }]
  ] },
  5: { name: "Fuerza C", type: "Agilidad + potencia", goal: "Split step, aceleración, frenado y resistencia específica.", exercises: [
    ["Bicicleta suave", "5 min", 1],
    ["Movilidad dinámica", "5 min", 1],
    ["Split step", "3 x 20", 3],
    ["Pies rápidos / escalera", "5 min", 1],
    ["Desplazamientos laterales", "5 x 20s", 5],
    ["Sprints cortos", "6 x 10m", 6],
    ["Cambios de dirección", "6 repeticiones", 6],
    ["Sentadilla explosiva controlada", "3 x 8", 3],
    ["Zancadas caminando", "3 x 10", 3],
    ["Gemelos", "3 x 15", 3],
    ["Bicicleta zona 2", "15 min", 1],
    ["Plancha", "2 x 45s", 2]
  ] },
  6: { name: "Flexible", type: "Tenis / cardio / recuperar", goal: "Elegir según fatiga: tenis suave, bicicleta zona 2, movilidad o recuperar sesión perdida.", exercises: [
    ["Tenis suave", "60 min aprox", 1, { noCountdown: true }],
    ["Bicicleta zona 2", "30-45 min", 1],
    ["Movilidad completa", "20 min", 1],
    ["Recuperar rutina perdida", "según corresponda", 1, { noCountdown: true }]
  ] },
  0: { name: "Recuperación", type: "Descanso activo", goal: "Recuperar y preparar la semana.", exercises: [
    ["Caminata suave", "20-30 min", 1],
    ["Movilidad general", "15 min", 1],
    ["Respiración / estiramientos", "5 min", 1]
  ] }
};
