# Nube de TGTrain

La conexión con Firebase ya está activa. TGTrain incluye sincronización local–nube y reglas privadas por usuario.

- Proyecto Firebase: `tgtrain`.
- Aplicación web registrada: `TGTrain Web`.
- Acceso con Google habilitado y dominio `tgb96.github.io` autorizado.
- Cloud Firestore alojado en `southamerica-west1` (Santiago).
- `firestore.rules` publicado: solo concede acceso cuando el usuario autenticado coincide con la ruta `users/{userId}`.
- Persistencia local de la sesión: el usuario no necesita volver a iniciar sesión en cada visita.

La configuración web de Firebase identifica el proyecto, pero no reemplaza las reglas de seguridad ni contiene credenciales administrativas. Si no hay conexión, el registro local sigue disponible y los cambios se sincronizan al recuperarla.

## Funciones GPT

La interfaz ya está preparada para importar planificaciones y analizar el cierre de las rutinas. Las llamadas pasan por Cloud Functions; la clave de OpenAI nunca se entrega al navegador ni se publica en GitHub.

Antes de publicar las funciones se configuran dos secretos:

```text
firebase functions:secrets:set OPENAI_API_KEY --project tgtrain
firebase functions:secrets:set TGTRAIN_ALLOWED_UID --project tgtrain
```

- `OPENAI_API_KEY`: clave de un proyecto de la API de OpenAI. Debe ingresarse directamente en la terminal de Firebase y nunca guardarse en este repositorio.
- `TGTRAIN_ALLOWED_UID`: UID de la cuenta personal, visible en Firebase Console → Authentication → Users. La función rechaza cualquier otra cuenta aunque pueda abrir la página pública.

El modelo predeterminado es `gpt-5.6-luna`. Puede cambiarse sin modificar el código configurando el parámetro `OPENAI_MODEL` durante la publicación.

Después se publican las funciones:

```text
firebase deploy --only functions --project tgtrain
```

Las solicitudes usan respuestas JSON estructuradas, no permiten que GPT escriba directamente en Firestore y se realizan con `store: false`. TGTrain valida el plan recibido, muestra una vista previa y solo lo guarda después de una confirmación explícita.
