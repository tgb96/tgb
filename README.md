# TGB

App web/PWA personal para registrar rutinas físicas, tenis, cardio, sensaciones, molestias, duración, calorías e informes de progreso.

## Funciones

- Plan semanal con seguimiento de series y cronómetros.
- Registro, edición y eliminación de entrenamientos.
- Informes de 7, 15 y 30 días.
- Respaldo y restauración en JSON.
- Exportación compatible con hojas de cálculo en CSV.
- Funcionamiento sin conexión y aviso cuando existe una actualización.
- Migración automática del historial creado por la versión anterior.

## Datos y privacidad

Los registros se guardan localmente en el navegador. TGB no los envía a ningún servidor. Borrar los datos del navegador o cambiar de dispositivo puede eliminar el historial, por lo que se recomienda descargar respaldos JSON periódicos desde Historial.

La opción de importar combina el respaldo con los registros actuales. Los elementos con el mismo identificador se actualizan y los demás se agregan.

Las sugerencias de carga son orientaciones personales y no reemplazan una evaluación médica o profesional.

## Estructura

- `index.html`: estructura accesible de la interfaz.
- `assets/css/styles.css`: diseño y adaptación móvil.
- `assets/js/data.js`: rutinas, descripciones y parámetros personales.
- `assets/js/utils.js`: fechas, métricas, informes, CSV y lógica de timers.
- `assets/js/storage.js`: migración, validación y persistencia.
- `assets/js/app.js`: interacción de la aplicación.
- `service-worker.js`: caché offline y actualización controlada.
- `tests/`: pruebas de integridad, datos, fechas y temporizadores.

## Desarrollo y pruebas

No hay dependencias externas. Con Node.js instalado:

```text
npm test
```

Para probar la PWA y los módulos ES es necesario servir la carpeta con un servidor HTTP local; abrir `index.html` directamente como archivo no es suficiente.

## Publicación en GitHub Pages

1. Ejecuta las pruebas.
2. Publica los archivos desde la rama principal.
3. GitHub Pages sirve la aplicación desde la raíz del repositorio.
4. Al detectar una versión nueva, la app muestra un botón “Actualizar”.

Al modificar los archivos del shell offline, incrementa `CACHE_NAME` en `service-worker.js` para crear un caché nuevo.
