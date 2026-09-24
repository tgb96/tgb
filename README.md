# TGTrain · Entrenamiento semanal

La integración personal con Xiaomi Smart Band mediante Health Connect está en [TGTrain Sync para Android](android/tgtrain-sync/README.md). [Descarga el APK instalable](downloads/tgtrain-sync-0.2.0.apk), inicia sesión con la misma cuenta de TGTrain y sincroniza desde la app puente. Los datos aparecen en Inicio y puedes vincular cada sesión de la pulsera con el entrenamiento manual correspondiente desde Historial, sin duplicarlo. La versión 0.2.0 añade la frecuencia cardíaca media, máxima y mínima si Mi Fitness la comparte. Para registros manuales de cardio o tenis, una hora aproximada de inicio opcional ayuda a encontrar la sesión correcta. La vinculación siempre requiere confirmación.

PWA personal para registrar y revisar entrenamiento físico, cardio y tenis, organizada por semanas ISO de lunes a domingo y preparada para sincronizar el historial mediante una cuenta de Google.

## Experiencia principal

- Inicio con la fecha actual y el número de semana del año.
- Vista completa de lunes a domingo con las actividades realmente realizadas cada día.
- Resumen semanal de sesiones, minutos y calorías.
- Bloque activo de cuatro semanas creado por el entrenador, con objetivo semanal, actividad diaria, alternativas y acceso directo al registro correspondiente.
- Inicio que diferencia lo planificado de lo realmente realizado y marca el cumplimiento del bloque sin alterar el historial.
- El calentamiento y los estiramientos aparecen en el día y en Historial, pero no sustituyen una actividad prevista ni inflan el conteo de entrenamientos principales.
- Registro guiado de entrenamiento físico, cardio, tenis, calentamiento, estiramientos y días de descanso.
- Pestaña Nutrición con la planificación semanal de comidas e hidratación entregada por el entrenador: días de físico, tenis, recuperación y escenarios de partido. Los horarios de partido 13:45 y 17:15 son ejemplos del plan, no eventos detectados. La guía se puede cambiar por fecha cuando el entrenamiento real varía.
- Diario de comidas y agua por día, con edición y eliminación. Cada comida se anota como se consumió realmente; calorías y macros son opcionales y nunca se calculan automáticamente a partir del texto.
- Desayunos y colaciones incluyen pan integral con jamón y queso y las alternativas frecuentes del plan. Un catálogo de alimentos muestra porciones de referencia; los ejemplos concretos rellenan kcal, proteína, carbohidratos y grasas aproximados que el usuario puede corregir antes de guardar. Las opciones genéricas sin cantidad permanecen sin estimación. Las referencias generales proceden de [USDA FoodData Central](https://fdc.nal.usda.gov/), pero marcas, preparación, aceite y tamaño real pueden cambiar mucho las cifras.
- Nutrición muestra el entrenamiento realmente registrado, los pasos y sueño compartidos por la banda y las mediciones de sesiones vinculadas. Son contexto para elegir conscientemente la guía del día; las kcal de la pulsera no se descuentan de lo comido ni cambian automáticamente las metas.
- Al elegir entrenamiento físico y una rutina, se abre primero una vista previa completa; la sesión y su cronómetro solo comienzan al pulsar Iniciar entrenamiento.
- Una rutina en curso se reabre automáticamente al volver desde Timer o al iniciar nuevamente la aplicación.
- Al reabrirse, la vista se desplaza hasta el ejercicio parcialmente realizado, el siguiente pendiente o el cierre si ya se completaron todos.
- Catálogo amplio de sensaciones por categoría que pueden combinarse sin escribir.
- Biblioteca de cuatro rutinas con ejercicios, propósito para el tenis, series marcables y sesiones cronometradas.
- Timer de intervalos y descansos que continúa al cambiar de sección.
- Historial agrupado por semanas con informe completo copiable para compartir con un entrenador.
- Panel de evolución de seis semanas y progreso detallado por ejercicio.
- Resumen automático al finalizar cada rutina física, comparado con la sesión anterior y los récords personales.
- Importación gratuita de nuevas planificaciones con IA, vista previa y confirmación antes de activarlas.
- Análisis inteligente opcional al finalizar una rutina, comparado con hasta ocho sesiones anteriores de la misma rutina y guardado dentro del historial.
- Copia local para funcionamiento sin conexión y sincronización privada en Firestore al iniciar sesión con Google.

## Tipos de entrenamiento

### Entrenamiento físico

Incluye cuatro rutinas configuradas en `assets/js/data.js`:

1. Día 1: piernas, glúteos y core.
2. Día 2: tren superior y estabilidad.
3. Día 3: potencia y desplazamientos.
4. Día 4 extra: antebrazo, core y técnica.

Cada ejercicio permite elegir entre 1 y 10 series desde un desplegable, además de modificar repeticiones o tiempo y peso. El editor distingue si el objetivo corresponde a repeticiones, segundos o minutos y permite borrar y sobrescribir el valor con normalidad. Los ajustes se conservan para futuras sesiones y el avance de cada serie se guarda por fecha en el dispositivo. Desde Registrar se elige Entrenamiento físico y luego una de las cuatro rutinas; esa elección abre una vista previa para revisar ejercicios y preparar implementos, sin iniciar el cronómetro. Al pulsar Iniciar entrenamiento comienza el seguimiento. Al finalizar se ingresan las calorías y se seleccionan una o varias sensaciones. El cierre registra el entrenamiento y entrega un balance de tiempo, series, ejercicios, repeticiones y volumen de carga estimado.

### Cardio

- Bicicleta al aire libre.
- Bicicleta estática.
- Trote.
- Caminata.
- Trekking.

Todo el cardio registra duración mediante selectores HH:MM. Las actividades al aire libre separan kilómetros y metros en formato `KK:MMM`. Trekking ofrece lugares frecuentes, opción personalizada y desnivel positivo en metros.

Trekking incluye Cerro La Región, El Carbón, Manquehue y San Cristóbal. Para Cerro La Región se distingue entre Los Fresnos y Ruta 7 Canchas. Además de la duración total, cada salida registra el tiempo específico de subida y el historial mantiene una clasificación del intento más rápido al más lento por cerro y ruta.

### Descanso

Permite registrar un día de descanso planificado o un descanso por molestia. Cuando existe una molestia, su descripción es obligatoria y queda incluida en el historial y en el informe semanal.

### Tenis

Antes del lugar permite elegir el tipo de sesión: entrenamiento grupal, partido, frontón o peloteo amistoso. También ofrece lugares frecuentes y una opción personalizada, superficie de arcilla o cemento y duración mediante selectores HH:MM:SS. Club Open Tenis propone arcilla; Sport Park y Parque Araucano proponen cemento.

### Calentamiento y estiramientos guiados

En Registrar hay dos tarjetas adicionales. Calentamiento ofrece 5, 11 y 15 minutos; estiramientos y movilidad ofrecen aproximadamente 7, 15 y 30 minutos. Cada guía se puede abrir para revisar todos sus pasos sin iniciar el reloj. Al pulsar Iniciar se presenta un movimiento a la vez, con duración sugerida, alternativa suave, pausa, omisión y avance manual. El tiempo cumplido se avisa con sonido y vibración cuando el dispositivo lo permite. El avance de una guía iniciada se guarda localmente y se recupera al volver a abrir la aplicación. Al terminar se registra en Historial el tiempo activo, pasos realizados u omitidos, sensaciones, molestias y calorías opcionales; también se incluye en el informe semanal. Estas secuencias son generales y deben adaptarse ante dolor o según indicación profesional.

## Timer

Permite elegir intervalos de 20, 25, 30, 35, 40 o 45 segundos y descansos de 20, 30, 40 o 50 segundos, además de configurar entre 1 y 10 series. Al pulsar Iniciar muestra una preparación sonora de tres segundos antes de comenzar la Serie 1. Luego alterna automáticamente las fases, muestra en grande la serie o el descanso actual, emite alertas sonoras reforzadas y vibración en los cambios y avisa durante los últimos tres segundos. Puede pausarse y mantiene la marcha al volver al entrenamiento desde Registrar. Su configuración queda guardada en el dispositivo; los valores antiguos se ajustan automáticamente a la opción permitida más cercana y cualquier cantidad anterior superior a 10 queda limitada a 10 series.

## Semanas e informes

TGTrain utiliza semanas ISO: comienzan el lunes y terminan el domingo. El bloque `Rendimiento tenis` cubre las semanas 38 a 41 de 2026. Cada sesión planificada conserva su variante elegida dentro del registro real, y las rutinas físicas cargan las series, repeticiones, pesos y omisiones prescritas sin modificar permanentemente la rutina base salvo que el usuario decida guardar sus cambios. Cada grupo del historial permite copiar o descargar un informe para el entrenador con comparación respecto de la semana anterior, resumen y detalle diario, incluidos los días sin actividad. Las rutinas físicas registradas incorporan además el resumen automático y el detalle completo por ejercicio: fase, series planificadas y realizadas, objetivo de repeticiones o tiempo, carga, repeticiones contabilizadas y volumen estimado. El mismo detalle puede desplegarse dentro de la entrada del historial y se incluye en el CSV y el respaldo JSON.

## Cuenta de Google y nube

TGTrain mantiene primero una copia local para continuar funcionando sin conexión. Una vez configurado Firebase, el botón de estado ubicado en el encabezado permite iniciar sesión con Google. En la primera conexión combina los registros del dispositivo con los de la cuenta; después, las altas, ediciones y eliminaciones se sincronizan automáticamente. Cada registro se guarda como un documento independiente para evitar que el historial completo dependa del límite de tamaño de un único documento.

El diario de nutrición se guarda en la misma copia local y respaldo JSON. Con la sesión de Google activa, sus registros se sincronizan como documentos privados independientes. Los objetivos de proteína y agua reproducen el texto del entrenador; la app no valida su adecuación clínica ni presenta los totales incompletos como consumo real exacto.

Las reglas incluidas en `firestore.rules` limitan cada historial al identificador privado del usuario autenticado. Un dispositivo ya vinculado no mezcla automáticamente su copia local con una cuenta diferente. La activación está documentada en `FIREBASE_SETUP.md`.

## Datos y migración

Los registros permanecen disponibles en el navegador y, al iniciar sesión, se sincronizan con la nube de TGTrain bajo la cuenta de Google correspondiente. La versión actual usa el esquema 11 y migra automáticamente:

- `tgb-data-v2` de la versión anterior.
- `history` de la primera versión.

Se mantienen respaldo JSON, importación y exportación CSV. Se recomienda descargar respaldos periódicos, especialmente antes de cambiar de teléfono o borrar datos del navegador.

## Estructura

- `index.html`: Inicio, registro, rutinas, Timer e historial.
- `assets/css/styles.css`: diseño adaptable.
- `assets/js/data.js`: categorías, rutinas y opciones.
- `assets/js/coach-plan.js`: bloque de cuatro semanas, sesiones, alternativas y ajustes prescritos.
- `assets/js/utils.js`: fechas, semanas ISO, informes y CSV.
- `assets/js/storage.js`: migración, validación, persistencia local y eventos de sincronización.
- `assets/js/cloud.js`: autenticación con Google y sincronización con Firestore.
- `assets/js/ai.js`: conexión directa y autenticada con Firebase AI Logic y Gemini Developer API.
- `assets/js/training-plan.js`: validación y normalización de planes importados.
- `assets/js/firebase-config.js`: configuración pública del proyecto Firebase.
- `assets/js/app.js`: interacción de la aplicación.
- `service-worker.js`: funcionamiento offline y actualizaciones.
- `tests/`: pruebas de semanas, datos, migración e integridad.

## Pruebas

No hay dependencias externas. Con Node.js instalado:

```text
npm test
```

Para probar la PWA y sus módulos es necesario servir la carpeta mediante HTTP local.

## Publicación

GitHub Pages publica la aplicación desde la raíz del repositorio. Al cambiar recursos del shell offline debe incrementarse `CACHE_NAME` en `service-worker.js`.
