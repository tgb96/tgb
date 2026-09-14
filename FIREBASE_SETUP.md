# Nube de TGTrain

La conexión con Firebase ya está activa. TGTrain incluye sincronización local–nube y reglas privadas por usuario.

- Proyecto Firebase: `tgtrain`.
- Aplicación web registrada: `TGTrain Web`.
- Acceso con Google habilitado y dominio `tgb96.github.io` autorizado.
- Cloud Firestore alojado en `southamerica-west1` (Santiago).
- `firestore.rules` publicado: solo concede acceso cuando el usuario autenticado coincide con la ruta `users/{userId}`.
- Persistencia local de la sesión: el usuario no necesita volver a iniciar sesión en cada visita.

La configuración web de Firebase identifica el proyecto, pero no reemplaza las reglas de seguridad ni contiene credenciales administrativas. Si no hay conexión, el registro local sigue disponible y los cambios se sincronizan al recuperarla.

## Inteligencia artificial gratuita

TGTrain importa planificaciones y analiza el cierre de las rutinas mediante Firebase AI Logic con Gemini Developer API. Esta modalidad funciona en el plan Spark gratuito, no requiere Cloud Functions, una clave guardada en el código ni una cuenta de facturación.

- Proveedor: Gemini Developer API mediante Firebase AI Logic.
- Modelo: `gemini-3.5-flash-lite`, estable, rápido y disponible en el nivel gratuito.
- Acceso normal de la interfaz: limitado al UID personal configurado en `assets/js/ai.js`.
- Protección del servicio: Firebase App Check registrado con reCAPTCHA Enterprise y restringido a `tgb96.github.io`.
- Persistencia: la IA nunca escribe directamente en Firestore; TGTrain valida el resultado, muestra una vista previa y solo guarda después de la confirmación del usuario.

La activación se realizó en Firebase Console → AI Logic con **Gemini Developer API**, manteniendo el proyecto en Spark y sin habilitar AI Monitoring. App Check usa la clave pública incluida en el cliente; la verificación de dominio permanece activa para `tgb96.github.io`.
