# Nube de TGTrain

La conexión con Firebase ya está activa. TGTrain incluye sincronización local–nube y reglas privadas por usuario.

- Proyecto Firebase: `tgtrain`.
- Aplicación web registrada: `TGTrain Web`.
- Acceso con Google habilitado y dominio `tgb96.github.io` autorizado.
- Cloud Firestore alojado en `southamerica-west1` (Santiago).
- `firestore.rules` publicado: solo concede acceso cuando el usuario autenticado coincide con la ruta `users/{userId}`.
- Persistencia local de la sesión: el usuario no necesita volver a iniciar sesión en cada visita.

La configuración web de Firebase identifica el proyecto, pero no reemplaza las reglas de seguridad ni contiene credenciales administrativas. Si no hay conexión, el registro local sigue disponible y los cambios se sincronizan al recuperarla.
