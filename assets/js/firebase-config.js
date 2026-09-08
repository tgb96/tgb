// La configuración pública de Firebase se completa al vincular TGTrain con el proyecto de Google.
// Las reglas de Firestore, no estas claves públicas, protegen los registros de cada usuario.
export const firebaseConfig = Object.freeze({
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
});

export const firebaseConfigured = ["apiKey", "authDomain", "projectId", "appId"]
  .every(key => Boolean(firebaseConfig[key]));
