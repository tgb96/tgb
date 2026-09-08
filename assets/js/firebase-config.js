// La configuración pública de Firebase se completa al vincular TGTrain con el proyecto de Google.
// Las reglas de Firestore, no estas claves públicas, protegen los registros de cada usuario.
export const firebaseConfig = Object.freeze({
  apiKey: "AIzaSyB9P_V3bt0vkzkWGODPD2-cayXxWm_tpio",
  authDomain: "tgtrain.firebaseapp.com",
  projectId: "tgtrain",
  storageBucket: "tgtrain.firebasestorage.app",
  messagingSenderId: "139228744813",
  appId: "1:139228744813:web:a274b70f14cb9029c5c364"
});

export const firebaseConfigured = ["apiKey", "authDomain", "projectId", "appId"]
  .every(key => Boolean(firebaseConfig[key]));
