# TGTrain Sync (Android)

Aplicación puente personal para traer los datos que Mi Fitness ya escribió en Health Connect a la cuenta Firebase de TGTrain.

## Qué sincroniza

- Pasos diarios de la fuente elegida durante los últimos 14 días.
- Sesiones de sueño, atribuidas al día en que terminan.
- Sesiones de ejercicio, con duración y tipo; distancia y calorías activas si Health Connect concede esos permisos y la fuente tiene datos.

La app solo **lee** Health Connect. Escribe documentos separados en `users/{uid}/wearableDays/{dateISO}` y `users/{uid}/wearableSessions/{id}`. No modifica la colección `records`, por lo que nunca duplica ni reemplaza los entrenamientos anotados en TGTrain. El mismo ID de Health Connect produce el mismo ID de Firestore al repetir la sincronización.

Esta primera versión sincroniza al pulsar **Sincronizar ahora**, no en segundo plano. El inicio de sesión con Google queda persistido por Firebase en el teléfono. Se debe elegir la fuente de Mi Fitness para no mezclar pasos del móvil.

## Configuración privada y compilación

1. Registrar la app Android `cl.tgtrain.sync` en el proyecto Firebase `tgtrain` y añadir la huella SHA-1 del certificado de firma. Descargar `google-services.json` a `app/google-services.json`.
2. Abrir esta carpeta con Android Studio o preparar JDK 17, Android SDK 36 y Gradle 8.13.
3. La configuración de firma de depuración espera `.tooling/signing/tgtrain-sync-debug.keystore`. Su certificado ya está registrado en Firebase para la instalación personal. **Conservar una copia segura:** sin el mismo certificado Android no permite actualizar un APK ya instalado.
4. Compilar con `gradle :app:assembleRelease`. El APK queda en `app/build/outputs/apk/release/app-release.apk`.
5. Instalar el APK en el Android, iniciar sesión con la misma cuenta de TGTrain, permitir Health Connect, elegir Mi Fitness y pulsar **Sincronizar ahora**.

`google-services.json`, el certificado y la carpeta `.tooling` están excluidos de Git. No se distribuye ninguna contraseña ni token de Firebase en el repositorio; `google-services.json` contiene identificadores públicos de la app, no una clave de administrador.

## Límites de esta versión

- Health Connect normalmente permite leer datos de otras apps hasta 30 días hacia atrás desde el primer permiso; por ello se importan los últimos 14 días, sin solicitar acceso histórico adicional.
- El valor de sueño representa la duración de las sesiones compartidas por Mi Fitness; no es un diagnóstico ni una puntuación clínica.
- La distancia y las calorías pueden faltar en algunas sesiones o versiones de Mi Fitness.
- No hay sincronización automática en segundo plano todavía. Se hará solo después de confirmar en el móvil que la fuente y las cifras son correctas.
