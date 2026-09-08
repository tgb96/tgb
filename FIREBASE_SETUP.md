# Activación de la nube de TGTrain

La aplicación ya incluye la interfaz, la sincronización local–nube y las reglas privadas por usuario. Para activar la conexión hay que completar una vez estos pasos dentro de la cuenta Google propietaria del proyecto:

1. Crear un proyecto en Firebase y registrar una aplicación web.
2. Copiar la configuración web entregada por Firebase en `assets/js/firebase-config.js`.
3. En Authentication, habilitar el proveedor Google.
4. Añadir `tgb96.github.io` a los dominios autorizados de Authentication.
5. Crear una base Cloud Firestore.
6. Publicar `firestore.rules`, que solo concede acceso cuando el usuario autenticado coincide con la ruta `users/{userId}`.

La configuración web de Firebase identifica el proyecto, pero no reemplaza las reglas de seguridad ni debe contener credenciales administrativas. TGTrain carga el SDK oficial de Firebase únicamente cuando la integración está activada; si no hay conexión, el registro local sigue disponible.
