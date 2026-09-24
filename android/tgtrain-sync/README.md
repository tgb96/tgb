# TGTrain Sync (Android)

Aplicación puente personal para traer los datos que Mi Fitness ya escribió en Health Connect a la cuenta Firebase de TGTrain.

## Qué sincroniza

- Pasos diarios de la fuente elegida durante los últimos 14 días.
- Sesiones de sueño, atribuidas al día en que terminan.
- Sesiones de ejercicio, con duración y tipo; distancia, calorías activas y frecuencia cardíaca media, máxima y mínima si Health Connect concede esos permisos y Mi Fitness comparte las mediciones. No se suben muestras crudas de LPM.

La app solo **lee** Health Connect. Escribe documentos separados en `users/{uid}/wearableDays/{dateISO}` y `users/{uid}/wearableSessions/{id}`. No modifica la colección `records`, por lo que nunca duplica ni reemplaza los entrenamientos anotados en TGTrain. El mismo ID de Health Connect produce el mismo ID de Firestore al repetir la sincronización.

Esta primera versión sincroniza al pulsar **Sincronizar ahora**, no en segundo plano. El inicio de sesión con Google queda persistido por Firebase en el teléfono. Se debe elegir la fuente de Mi Fitness para no mezclar pasos del móvil.

## Vinculación con un entrenamiento de TGTrain

Inicia la rutina en TGTrain y también el entrenamiento en la pulsera. Cuando ambos terminen, abre Mi Fitness para actualizar Health Connect, pulsa **Sincronizar ahora** en TGTrain Sync y entra en **Historial** de TGTrain. En la actividad manual se ofrecerá **Vincular pulsera**: los horarios coincidentes aparecen primero, pero la elección siempre requiere una pulsación del usuario. Un registro sin horario exacto solo propone sesiones del mismo día. Al vincular, TGTrain conserva el entrenamiento manual y añade la medición de la pulsera; no cuenta una segunda actividad ni suma las dos cifras de calorías. Puedes actualizar o retirar el vínculo sin borrar ninguna fuente.

Si existe un perfil de entrenador IA configurado, al vincular se genera de nuevo el comentario con las LPM disponibles, las calorías activas estimadas y el contexto de sueño y pasos. Los informes semanales y CSV incluyen las métricas vinculadas. Una lectura aislada de pulso o calorías no equivale a una valoración médica ni demuestra por sí sola una mejora física.

## Configuración privada y compilación

1. Registrar la app Android `cl.tgtrain.sync` en el proyecto Firebase `tgtrain` y añadir la huella SHA-1 del certificado de firma. Descargar `google-services.json` a `app/google-services.json`.
2. Abrir esta carpeta con Android Studio o preparar JDK 17, Android SDK 36 y Gradle 8.13.
3. La configuración de firma de depuración espera `.tooling/signing/tgtrain-sync-debug.keystore`. Su certificado ya está registrado en Firebase para la instalación personal. **Conservar una copia segura:** sin el mismo certificado Android no permite actualizar un APK ya instalado.
4. Compilar con `gradle :app:assembleRelease`. El APK queda en `app/build/outputs/apk/release/app-release.apk`.
5. Instalar el APK en el Android, iniciar sesión con la misma cuenta de TGTrain, permitir Health Connect (incluidas LPM para el balance combinado), elegir Mi Fitness y pulsar **Sincronizar ahora**. Al actualizar desde la versión 0.1.0, se debe volver a tocar **Permitir acceso** para conceder la nueva lectura de frecuencia cardíaca.

`google-services.json`, el certificado y la carpeta `.tooling` están excluidos de Git. No se distribuye ninguna contraseña ni token de Firebase en el repositorio; `google-services.json` contiene identificadores públicos de la app, no una clave de administrador.

## Límites de esta versión

- Health Connect normalmente permite leer datos de otras apps hasta 30 días hacia atrás desde el primer permiso; por ello se importan los últimos 14 días, sin solicitar acceso histórico adicional.
- El valor de sueño representa la duración de las sesiones compartidas por Mi Fitness; no es un diagnóstico ni una puntuación clínica.
- La distancia, las calorías activas y las LPM pueden faltar en algunas sesiones o versiones de Mi Fitness. La media de LPM es la media de las muestras compartidas, no una media temporal continua.
- No hay sincronización automática en segundo plano todavía. Se hará solo después de confirmar en el móvil que la fuente y las cifras son correctas.
