import { firebaseConfig, firebaseConfigured } from "./firebase-config.js?v=35";

const FIREBASE_VERSION = "12.18.0";
const FIREBASE_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;

function recordTimestamp(record) {
  return Date.parse(record?.updatedAt || record?.createdAt || "") || 0;
}

function cloudDocumentId(recordId) {
  const bytes = new TextEncoder().encode(String(recordId));
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function publicUser(user) {
  return user ? {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "",
    photoURL: user.photoURL || ""
  } : null;
}

export function createCloudSync({
  repository,
  storage,
  onStatus = () => {},
  onDataChanged = () => {},
  configuration = firebaseConfig,
  isConfigured = firebaseConfigured
}) {
  let modules = null;
  let app = null;
  let auth = null;
  let database = null;
  let user = null;
  let unsubscribeAuth = null;
  let unsubscribeRecords = null;
  let unsubscribeRepository = null;
  let writeQueue = Promise.resolve();

  const emit = (state, message, extra = {}) => onStatus({ state, message, user: publicUser(user), ...extra });

  async function loadFirebase() {
    if (modules) return modules;
    const [appModule, authModule, firestoreModule] = await Promise.all([
      import(`${FIREBASE_BASE}/firebase-app.js`),
      import(`${FIREBASE_BASE}/firebase-auth.js`),
      import(`${FIREBASE_BASE}/firebase-firestore.js`)
    ]);
    modules = { appModule, authModule, firestoreModule };
    return modules;
  }

  const collectionReference = () => modules.firestoreModule.collection(database, "users", user.uid, "records");
  const documentReference = id => modules.firestoreModule.doc(database, "users", user.uid, "records", cloudDocumentId(id));

  async function writeChange(change) {
    if (!user) return;
    if (change.type === "remove") {
      await modules.firestoreModule.setDoc(documentReference(change.id), {
        id: change.id,
        deleted: true,
        updatedAt: change.deletedAt
      });
      return;
    }
    await modules.firestoreModule.setDoc(documentReference(change.record.id), {
      ...change.record,
      deleted: false
    });
  }

  function queueChange(change) {
    writeQueue = writeQueue
      .then(() => writeChange(change))
      .then(() => emit("synced", "Todos tus cambios están guardados en la nube."))
      .catch(() => emit("offline", "El cambio quedó guardado en este dispositivo y se subirá al recuperar conexión."));
  }

  async function mergeCloudAndLocal() {
    emit("syncing", "Comparando tus registros locales con la nube…");
    const snapshot = await modules.firestoreModule.getDocs(collectionReference());
    const remote = new Map();
    snapshot.forEach(item => {
      const value = item.data();
      if (value?.id) remote.set(String(value.id), value);
    });
    const local = new Map(repository.list().map(record => [record.id, record]));
    const uploads = [];
    let localChanged = false;

    remote.forEach((cloudRecord, id) => {
      const localRecord = local.get(id);
      if (cloudRecord.deleted) {
        if (repository.applyCloudDeletion(id, cloudRecord.updatedAt)) localChanged = true;
        return;
      }
      if (!localRecord || recordTimestamp(cloudRecord) >= recordTimestamp(localRecord)) {
        if (repository.applyCloudRecord(cloudRecord)) localChanged = true;
      } else {
        uploads.push({ type: "upsert", record: localRecord });
      }
    });

    local.forEach((localRecord, id) => {
      if (!remote.has(id)) uploads.push({ type: "upsert", record: localRecord });
    });
    for (const change of uploads) await writeChange(change);
    if (localChanged) onDataChanged();
  }

  function observeCloudRecords() {
    unsubscribeRecords?.();
    unsubscribeRecords = modules.firestoreModule.onSnapshot(collectionReference(), snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        const cloudRecord = change.doc.data();
        if (!cloudRecord?.id) return;
        if (cloudRecord.deleted) changed = repository.applyCloudDeletion(cloudRecord.id, cloudRecord.updatedAt) || changed;
        else changed = repository.applyCloudRecord(cloudRecord) || changed;
      });
      if (changed) onDataChanged();
      emit("synced", "Todos tus cambios están guardados en la nube.");
    }, () => emit("offline", "Sin conexión con la nube. Tus cambios siguen seguros en este dispositivo."));
  }

  async function connect(currentUser) {
    user = currentUser;
    unsubscribeRepository?.();
    unsubscribeRepository = null;
    unsubscribeRecords?.();
    unsubscribeRecords = null;
    if (!user) {
      emit("signed-out", "Inicia sesión para guardar tus entrenamientos en la nube.");
      return;
    }
    const localOwner = storage?.getItem("tgtrain-cloud-owner-v1") || "";
    if (localOwner && localOwner !== user.uid) {
      emit("account-mismatch", "Esta copia local ya está vinculada a otra cuenta de Google. Cierra sesión y vuelve a entrar con la cuenta original.");
      return;
    }
    storage?.setItem("tgtrain-cloud-owner-v1", user.uid);
    try {
      await mergeCloudAndLocal();
      unsubscribeRepository = repository.subscribe(queueChange);
      observeCloudRecords();
      emit("synced", "Todos tus cambios están guardados en la nube.");
    } catch {
      unsubscribeRepository = repository.subscribe(queueChange);
      emit("offline", "No fue posible acceder a la nube. Tus datos locales permanecen seguros.");
    }
  }

  return {
    get configured() { return isConfigured; },
    get currentUser() { return publicUser(user); },
    async initialize() {
      if (!isConfigured) {
        emit("unconfigured", "La conexión con Google está pendiente de activación.");
        return;
      }
      try {
        await loadFirebase();
        app = modules.appModule.getApps().length
          ? modules.appModule.getApp()
          : modules.appModule.initializeApp(configuration);
        auth = modules.authModule.getAuth(app);
        database = modules.firestoreModule.getFirestore(app);
        await modules.authModule.setPersistence(auth, modules.authModule.browserLocalPersistence);
        unsubscribeAuth = modules.authModule.onAuthStateChanged(auth, connect, () => emit("error", "No fue posible comprobar la cuenta de Google."));
      } catch {
        emit("offline", "No fue posible cargar la conexión con Google. TGTrain seguirá funcionando en modo local.");
      }
    },
    async signIn() {
      if (!isConfigured) throw new Error("La conexión con Google todavía no está activada.");
      if (!auth) await this.initialize();
      if (!auth) throw new Error("No fue posible iniciar la conexión con Google.");
      const provider = new modules.authModule.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      emit("syncing", "Abriendo el inicio de sesión de Google…");
      await modules.authModule.signInWithPopup(auth, provider);
    },
    async signOut() {
      if (auth) await modules.authModule.signOut(auth);
    },
    async syncNow() {
      if (!user) throw new Error("Primero inicia sesión con Google.");
      await mergeCloudAndLocal();
      emit("synced", "Todos tus cambios están guardados en la nube.");
    },
    destroy() {
      unsubscribeAuth?.();
      unsubscribeRecords?.();
      unsubscribeRepository?.();
    }
  };
}
