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

// Firestore rechaza `undefined` incluso dentro de un objeto o una lista anidados.
// Los datos locales se conservan tal cual; solo se prepara una copia para el envío.
export function firestoreDocument(value) {
  if (Array.isArray(value)) return value.map(item => item === undefined ? null : firestoreDocument(item));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, firestoreDocument(item)]));
  }
  return value;
}

export function createCloudSync({
  repository,
  storage,
  onStatus = () => {},
  onDataChanged = () => {},
  onWearableChanged = () => {},
  configuration = firebaseConfig,
  isConfigured = firebaseConfigured,
  firebaseModules = null
}) {
  let modules = firebaseModules;
  let app = null;
  let auth = null;
  let database = null;
  let user = null;
  let unsubscribeAuth = null;
  let unsubscribeRecords = null;
  let unsubscribePlans = null;
  let unsubscribeTrainingBlocks = null;
  let unsubscribeCoachProfile = null;
  let unsubscribeCoachQuestions = null;
  let unsubscribeWearableDays = null;
  let unsubscribeWearableSessions = null;
  let unsubscribeRepository = null;
  let writeQueue = Promise.resolve();
  let mergePromise = null;
  let retryTimer = null;
  let retryDelayMs = 10000;
  let syncError = false;

  const emit = (state, message, extra = {}) => onStatus({ state, message, user: publicUser(user), ...extra });

  async function awaitServer(promise) {
    let deadline;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("La nube no respondió a tiempo.")), 15000); })
      ]);
    } finally {
      clearTimeout(deadline);
    }
  }

  function scheduleRetry() {
    if (retryTimer || !user) return;
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (!user) return;
      try {
        await writeQueue;
        await mergeCloudAndLocal();
        syncError = false;
        retryDelayMs = 10000;
        observeCloudRecords();
        observeCloudPlans();
        observeCloudTrainingBlocks();
        observeCloudCoachProfile();
        observeCloudCoachQuestions();
        observeCloudWearable();
        emit("synced", "Entrenamientos y planificación sincronizados con Google.");
      } catch {
        syncError = true;
        retryDelayMs = Math.min(retryDelayMs * 2, 120000);
        emit("offline", "No se pudo sincronizar toda la planificación. Se intentará otra vez; los datos siguen en este dispositivo.");
        scheduleRetry();
      }
    }, retryDelayMs);
  }

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
  const plansCollectionReference = () => modules.firestoreModule.collection(database, "users", user.uid, "plans");
  const planDocumentReference = weekKey => modules.firestoreModule.doc(database, "users", user.uid, "plans", String(weekKey));
  const trainingBlocksCollectionReference = () => modules.firestoreModule.collection(database, "users", user.uid, "trainingBlocks");
  const trainingBlockDocumentReference = id => modules.firestoreModule.doc(database, "users", user.uid, "trainingBlocks", String(id));
  const coachProfileDocumentReference = () => modules.firestoreModule.doc(database, "users", user.uid, "settings", "coachProfile");
  const coachQuestionsCollectionReference = () => modules.firestoreModule.collection(database, "users", user.uid, "coachQuestions");
  const coachQuestionDocumentReference = id => modules.firestoreModule.doc(database, "users", user.uid, "coachQuestions", cloudDocumentId(id));
  const wearableDaysCollectionReference = () => modules.firestoreModule.collection(database, "users", user.uid, "wearableDays");
  const wearableSessionsCollectionReference = () => modules.firestoreModule.collection(database, "users", user.uid, "wearableSessions");
  let wearableDays = [];
  let wearableSessions = [];
  const emitWearable = () => onWearableChanged({ days: wearableDays, sessions: wearableSessions });

  const setCloudDoc = (reference, value) => awaitServer(modules.firestoreModule.setDoc(reference, firestoreDocument(value)));

  async function writeChange(change) {
    if (!user) return;
    if (change.type === "plan-upsert") {
      await setCloudDoc(planDocumentReference(change.plan.weekKey), change.plan);
      return;
    }
    if (change.type === "training-block-upsert") {
      await setCloudDoc(trainingBlockDocumentReference(change.block.id), change.block);
      return;
    }
    if (change.type === "coach-profile-upsert") {
      await setCloudDoc(coachProfileDocumentReference(), change.profile);
      return;
    }
    if (change.type === "coach-question-upsert") {
      await setCloudDoc(coachQuestionDocumentReference(change.question.id), change.question);
      return;
    }
    if (change.type === "remove") {
      await setCloudDoc(documentReference(change.id), {
        id: change.id,
        deleted: true,
        updatedAt: change.deletedAt
      });
      return;
    }
    await setCloudDoc(documentReference(change.record.id), {
      ...change.record,
      deleted: false
    });
  }

  function queueChange(change) {
    writeQueue = writeQueue
      .then(() => writeChange(change))
      .then(() => { if (!syncError) emit("synced", "Entrenamientos y planificación sincronizados con Google."); })
      .catch(() => {
        syncError = true;
        emit("offline", "Hay cambios locales pendientes, incluida la planificación. Se intentará sincronizar otra vez.");
        scheduleRetry();
      });
  }

  function mergeCloudAndLocal() {
    if (!mergePromise) mergePromise = performMergeCloudAndLocal().finally(() => { mergePromise = null; });
    return mergePromise;
  }

  async function performMergeCloudAndLocal() {
    emit("syncing", "Comparando tus registros locales con la nube…");
    await awaitServer(modules.firestoreModule.waitForPendingWrites(database));
    const snapshot = await awaitServer(modules.firestoreModule.getDocsFromServer(collectionReference()));
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
    const plansSnapshot = await awaitServer(modules.firestoreModule.getDocsFromServer(plansCollectionReference()));
    const remotePlans = new Map();
    plansSnapshot.forEach(item => {
      const value = item.data();
      if (value?.weekKey) remotePlans.set(String(value.weekKey), value);
    });
    const localPlans = new Map(repository.listPlans().map(plan => [plan.weekKey, plan]));
    remotePlans.forEach((cloudPlan, weekKey) => {
      const localPlan = localPlans.get(weekKey);
      if (!localPlan || recordTimestamp(cloudPlan) >= recordTimestamp(localPlan)) {
        if (repository.applyCloudPlan(cloudPlan)) localChanged = true;
      } else {
        uploads.push({ type: "plan-upsert", plan: localPlan });
      }
    });
    localPlans.forEach((localPlan, weekKey) => {
      if (!remotePlans.has(weekKey)) uploads.push({ type: "plan-upsert", plan: localPlan });
    });
    for (const change of uploads.filter(change => change.type === "plan-upsert")) await writeChange(change);
    const blocksSnapshot = await awaitServer(modules.firestoreModule.getDocsFromServer(trainingBlocksCollectionReference()));
    const remoteBlocks = new Map();
    blocksSnapshot.forEach(item => {
      const value = item.data();
      if (value?.id) remoteBlocks.set(String(value.id), value);
    });
    const localBlocks = new Map(repository.listTrainingBlocks().map(block => [block.id, block]));
    remoteBlocks.forEach((cloudBlock, id) => {
      const localBlock = localBlocks.get(id);
      if (!localBlock || recordTimestamp(cloudBlock) >= recordTimestamp(localBlock)) {
        if (repository.applyCloudTrainingBlock(cloudBlock)) localChanged = true;
      } else {
        uploads.push({ type: "training-block-upsert", block: localBlock });
      }
    });
    localBlocks.forEach((localBlock, id) => {
      if (!remoteBlocks.has(id)) uploads.push({ type: "training-block-upsert", block: localBlock });
    });
    for (const change of uploads.filter(change => change.type === "training-block-upsert")) await writeChange(change);
    const profileSnapshot = await awaitServer(modules.firestoreModule.getDocFromServer(coachProfileDocumentReference()));
    const remoteProfile = profileSnapshot.exists() ? profileSnapshot.data() : null;
    const localProfile = repository.getCoachProfile();
    if (remoteProfile && (!localProfile || recordTimestamp(remoteProfile) >= recordTimestamp(localProfile))) {
      if (repository.applyCloudCoachProfile(remoteProfile)) localChanged = true;
    } else if (localProfile) {
      await writeChange({ type: "coach-profile-upsert", profile: localProfile });
    }
    const questionsSnapshot = await awaitServer(modules.firestoreModule.getDocsFromServer(coachQuestionsCollectionReference()));
    const remoteQuestions = new Map();
    questionsSnapshot.forEach(item => {
      const value = item.data();
      if (value?.id) remoteQuestions.set(String(value.id), value);
    });
    const localQuestions = new Map(repository.listCoachQuestions().map(question => [question.id, question]));
    const questionUploads = [];
    remoteQuestions.forEach((cloudQuestion, id) => {
      const localQuestion = localQuestions.get(id);
      if (!localQuestion || recordTimestamp(cloudQuestion) >= recordTimestamp(localQuestion)) {
        if (repository.applyCloudCoachQuestion(cloudQuestion)) localChanged = true;
      } else questionUploads.push({ type: "coach-question-upsert", question: localQuestion });
    });
    localQuestions.forEach((localQuestion, id) => {
      if (!remoteQuestions.has(id)) questionUploads.push({ type: "coach-question-upsert", question: localQuestion });
    });
    for (const change of questionUploads) await writeChange(change);
    await awaitServer(modules.firestoreModule.waitForPendingWrites(database));
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
      if (snapshot.metadata?.fromCache || snapshot.metadata?.hasPendingWrites) return;
      if (!syncError) emit("synced", "Entrenamientos y planificación sincronizados con Google.");
    }, () => {
      syncError = true;
      emit("offline", "No se pudo actualizar el historial desde la nube. Se intentará otra vez.");
      scheduleRetry();
    });
  }

  function observeCloudPlans() {
    unsubscribePlans?.();
    unsubscribePlans = modules.firestoreModule.onSnapshot(plansCollectionReference(), snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") return;
        changed = repository.applyCloudPlan(change.doc.data()) || changed;
      });
      if (changed) onDataChanged();
    }, () => {
      syncError = true;
      emit("offline", "No se pudo actualizar la planificación desde la nube. Se intentará otra vez.");
      scheduleRetry();
    });
  }

  function observeCloudTrainingBlocks() {
    unsubscribeTrainingBlocks?.();
    unsubscribeTrainingBlocks = modules.firestoreModule.onSnapshot(trainingBlocksCollectionReference(), snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") return;
        changed = repository.applyCloudTrainingBlock(change.doc.data()) || changed;
      });
      if (changed) onDataChanged();
    }, () => {
      syncError = true;
      emit("offline", "No se pudo actualizar el plan activo desde la nube. Se intentará otra vez.");
      scheduleRetry();
    });
  }

  function observeCloudCoachProfile() {
    unsubscribeCoachProfile?.();
    unsubscribeCoachProfile = modules.firestoreModule.onSnapshot(coachProfileDocumentReference(), snapshot => {
      if (!snapshot.exists()) return;
      if (repository.applyCloudCoachProfile(snapshot.data())) onDataChanged();
    }, () => {
      syncError = true;
      emit("offline", "No se pudo actualizar el perfil desde la nube. Se intentará otra vez.");
      scheduleRetry();
    });
  }

  function observeCloudCoachQuestions() {
    unsubscribeCoachQuestions?.();
    unsubscribeCoachQuestions = modules.firestoreModule.onSnapshot(coachQuestionsCollectionReference(), snapshot => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") return;
        changed = repository.applyCloudCoachQuestion(change.doc.data()) || changed;
      });
      if (changed) onDataChanged();
    }, () => {
      syncError = true;
      emit("offline", "No se pudieron actualizar las preguntas de la guía. Se intentará otra vez.");
      scheduleRetry();
    });
  }

  function observeCloudWearable() {
    unsubscribeWearableDays?.();
    unsubscribeWearableSessions?.();
    unsubscribeWearableDays = modules.firestoreModule.onSnapshot(wearableDaysCollectionReference(), snapshot => {
      wearableDays = snapshot.docs.map(item => item.data());
      emitWearable();
    }, () => emit("offline", "No se pudieron cargar los datos de la pulsera."));
    unsubscribeWearableSessions = modules.firestoreModule.onSnapshot(wearableSessionsCollectionReference(), snapshot => {
      wearableSessions = snapshot.docs.map(item => item.data());
      emitWearable();
    }, () => emit("offline", "No se pudieron cargar las sesiones de la pulsera."));
  }

  async function connect(currentUser) {
    user = currentUser;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    unsubscribeRepository?.();
    unsubscribeRepository = null;
    unsubscribeRecords?.();
    unsubscribeRecords = null;
    unsubscribePlans?.();
    unsubscribePlans = null;
    unsubscribeTrainingBlocks?.();
    unsubscribeTrainingBlocks = null;
    unsubscribeCoachProfile?.();
    unsubscribeCoachProfile = null;
    unsubscribeCoachQuestions?.();
    unsubscribeCoachQuestions = null;
    unsubscribeWearableDays?.();
    unsubscribeWearableDays = null;
    unsubscribeWearableSessions?.();
    unsubscribeWearableSessions = null;
    wearableDays = [];
    wearableSessions = [];
    emitWearable();
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
      syncError = false;
      retryDelayMs = 10000;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      unsubscribeRepository = repository.subscribe(queueChange);
      observeCloudRecords();
      observeCloudPlans();
      observeCloudTrainingBlocks();
      observeCloudCoachProfile();
      observeCloudCoachQuestions();
      observeCloudWearable();
      emit("synced", "Entrenamientos y planificación sincronizados con Google.");
    } catch {
      syncError = true;
      unsubscribeRepository = repository.subscribe(queueChange);
      emit("offline", "No fue posible sincronizar toda la planificación. Tus datos locales permanecen seguros.");
      scheduleRetry();
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
      try {
        await writeQueue;
        await mergeCloudAndLocal();
        syncError = false;
        retryDelayMs = 10000;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = null;
        observeCloudRecords();
        observeCloudPlans();
        observeCloudTrainingBlocks();
        observeCloudCoachProfile();
        observeCloudCoachQuestions();
        observeCloudWearable();
        emit("synced", "Entrenamientos y planificación sincronizados con Google.");
      } catch (error) {
        syncError = true;
        emit("offline", "No se pudo sincronizar toda la planificación. Se intentará otra vez.");
        scheduleRetry();
        throw error;
      }
    },
    destroy() {
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribeAuth?.();
      unsubscribeRecords?.();
      unsubscribePlans?.();
      unsubscribeTrainingBlocks?.();
      unsubscribeCoachProfile?.();
      unsubscribeCoachQuestions?.();
      unsubscribeWearableDays?.();
      unsubscribeWearableSessions?.();
      unsubscribeRepository?.();
    }
  };
}
