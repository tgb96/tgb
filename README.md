# TGB · Diario de entrenamiento

PWA personal para registrar y revisar entrenamiento físico, cardio y tenis, organizada por semanas ISO de lunes a domingo.

## Experiencia principal

- Inicio con la fecha actual y el número de semana del año.
- Vista completa de lunes a domingo con las actividades realmente realizadas cada día.
- Resumen semanal de sesiones, minutos y calorías.
- Registro guiado por tres categorías: físico, cardio y tenis.
- Sugerencias de sensaciones que pueden combinarse y editarse como texto.
- Biblioteca de cuatro rutinas con ejercicios, propósito para el tenis y series marcables.
- Historial agrupado por semanas con informe completo copiable para compartir con un entrenador.

## Tipos de entrenamiento

### Entrenamiento físico

Incluye cuatro rutinas configuradas en `assets/js/data.js`:

1. Día 1: piernas, glúteos y core.
2. Día 2: tren superior y estabilidad.
3. Día 3: potencia y desplazamientos.
4. Día 4 extra: antebrazo, core y técnica.

Cada ejercicio permite modificar series, repeticiones o tiempo y peso. Los ajustes se conservan para futuras sesiones y el avance de cada serie se guarda por fecha en el dispositivo.

### Cardio

- Bicicleta al aire libre.
- Bicicleta estática.
- Trote.
- Caminata.
- Trekking.

Trote registra horas, minutos y segundos. Trekking ofrece lugares frecuentes, opción personalizada y duración en horas y minutos. Las actividades al aire libre también permiten registrar distancia.

### Tenis

Ofrece lugares frecuentes y una opción personalizada, superficie de arcilla o cemento y duración exacta en horas, minutos y segundos.

## Semanas e informes

TGB utiliza semanas ISO: comienzan el lunes y terminan el domingo. Cada grupo del historial permite copiar o descargar un informe con resumen y detalle diario, incluidos los días sin actividad.

## Datos y migración

Los registros permanecen en el navegador y no se envían a servidores. La versión actual usa el esquema 3 y migra automáticamente:

- `tgb-data-v2` de la versión anterior.
- `history` de la primera versión.

Se mantienen respaldo JSON, importación y exportación CSV. Se recomienda descargar respaldos periódicos, especialmente antes de cambiar de teléfono o borrar datos del navegador.

## Estructura

- `index.html`: Inicio, registro, rutinas e historial.
- `assets/css/styles.css`: diseño adaptable.
- `assets/js/data.js`: categorías, rutinas y opciones.
- `assets/js/utils.js`: fechas, semanas ISO, informes y CSV.
- `assets/js/storage.js`: migración, validación y persistencia.
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
