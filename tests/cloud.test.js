import test from "node:test";
import assert from "node:assert/strict";
import { createCloudSync, firestoreDocument } from "../assets/js/cloud.js";
import { firebaseConfig, firebaseConfigured } from "../assets/js/firebase-config.js";
import { createRepository } from "../assets/js/storage.js";

test("mantiene el modo local cuando Firebase todavía no está configurado", async () => {
  const statuses = [];
  const cloud = createCloudSync({
    repository: { list: () => [], subscribe: () => () => {} },
    storage: { getItem: () => null, setItem: () => {} },
    onStatus: status => statuses.push(status),
    isConfigured: false
  });
  assert.equal(cloud.configured, false);
  await cloud.initialize();
  assert.equal(statuses.at(-1).state, "unconfigured");
});

test("la configuración publicada apunta al proyecto TGTrain", () => {
  assert.equal(firebaseConfigured, true);
  assert.equal(firebaseConfig.projectId, "tgtrain");
  assert.match(firebaseConfig.authDomain, /^tgtrain\./);
});

test("el envío a Firebase omite campos undefined sin alterar el plan local", () => {
  const plan = {
    id: "plan-importado",
    weeks: [{ sessions: [{ options: [{ title: "Trote", details: ["5K", undefined], prefill: { distanceKm: 5, route: undefined } }] }] }],
    optional: undefined
  };
  const safe = firestoreDocument(plan);
  assert.equal("optional" in safe, false);
  assert.equal("route" in safe.weeks[0].sessions[0].options[0].prefill, false);
  assert.deepEqual(safe.weeks[0].sessions[0].options[0].details, ["5K", null]);
  assert.equal(plan.weeks[0].sessions[0].options[0].prefill.route, undefined);
  assert.equal(safe.weeks[0].sessions[0].options[0].prefill.distanceKm, 5);
});

test("un plan importado se sube al servidor y aparece en otro dispositivo", async () => {
  const remote = { records: new Map(), plans: new Map(), trainingBlocks: new Map(), settings: new Map(), coachQuestions: new Map(), nutritionEntries: new Map() };
  const user = { uid: "test-user", email: "test@example.com" };
  const containsUndefined = value => value === undefined || (value && typeof value === "object"
    && Object.values(value).some(containsUndefined));
  const firestoreModule = {
    collection: (_database, ...path) => ({ kind: path.at(-1) }),
    doc: (_database, ...path) => ({ kind: path.at(-2), id: path.at(-1) }),
    getDocsFromServer: async reference => ({ forEach: callback => remote[reference.kind].forEach((data, id) => callback({ id, data: () => data })) }),
    getDocFromServer: async reference => ({ exists: () => remote[reference.kind].has(reference.id), data: () => remote[reference.kind].get(reference.id) }),
    waitForPendingWrites: async () => {},
    setDoc: async (reference, data) => {
      assert.equal(containsUndefined(data), false, `Firebase rechazaría ${reference.kind}/${reference.id}`);
      remote[reference.kind].set(reference.id, structuredClone(data));
    },
    onSnapshot: () => () => {},
    getFirestore: () => ({})
  };
  const firebaseModules = {
    firestoreModule,
    appModule: { getApps: () => [], initializeApp: () => ({}) },
    authModule: {
      getAuth: () => ({}), browserLocalPersistence: {}, setPersistence: async () => {},
      onAuthStateChanged: (_auth, callback) => { callback(user); return () => {}; }
    }
  };
  const makeStorage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  };
  const connect = async (repository, storage) => {
    let markReady;
    const ready = new Promise(resolve => { markReady = resolve; });
    const cloud = createCloudSync({ repository, storage, firebaseModules, isConfigured: true,
      onStatus: status => { if (status.state === "synced") markReady(); } });
    await cloud.initialize();
    await ready;
    return cloud;
  };
  const phoneStorage = makeStorage();
  const phone = createRepository(phoneStorage);
  const block = phone.saveTrainingBlock({ title: "Plan del teléfono", weeks: [{ weekKey: "2026-W39", sessions: [{
    dateISO: "2026-09-22", options: [{ title: "Trote suave", category: "cardio", cardioTypeId: "running" }]
  }] }] });
  const listBlocks = phone.listTrainingBlocks.bind(phone);
  phone.listTrainingBlocks = () => listBlocks().map(item => ({
    ...item,
    weeks: item.weeks.map(week => ({ ...week, optionalNote: undefined }))
  }));
  phone.saveCoachQuestion({ id: "question-1", question: "¿Cómo estuvo mi trote?", answer: "Cuida la rodilla.", createdAt: "2026-09-23T12:00:00.000Z", updatedAt: "2026-09-23T12:01:00.000Z" });
  phone.saveNutritionEntry({ id: "food-1", dateISO: "2026-09-23", kind: "meal", slotId: "lunch", text: "Pollo y arroz", proteinG: 35, createdAt: "2026-09-23T13:00:00.000Z", updatedAt: "2026-09-23T13:00:00.000Z" });
  const phoneCloud = await connect(phone, phoneStorage);
  assert.equal(remote.trainingBlocks.get(block.id).title, "Plan del teléfono");
  assert.equal([...remote.coachQuestions.values()][0].answer, "Cuida la rodilla.");
  assert.equal([...remote.nutritionEntries.values()][0].text, "Pollo y arroz");
  const computerStorage = makeStorage();
  const computer = createRepository(computerStorage);
  const computerCloud = await connect(computer, computerStorage);
  assert.equal(computer.listTrainingBlocks()[0].title, "Plan del teléfono");
  assert.equal(computer.listCoachQuestions()[0].answer, "Cuida la rodilla.");
  assert.equal(computer.listNutritionEntries()[0].proteinG, 35);
  assert.equal(phone.clearCoachQuestions(), 1);
  await phoneCloud.syncNow();
  await computerCloud.syncNow();
  assert.equal([...remote.coachQuestions.values()][0].deleted, true);
  assert.equal(computer.listCoachQuestions().length, 0);
  phoneCloud.destroy();
  computerCloud.destroy();
});

test("lee las mediciones de la pulsera por cuenta y las limpia al cerrar sesión", async () => {
  const emptyStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const repository = createRepository(emptyStorage);
  const updates = [];
  let authListener;
  let synced;
  const ready = new Promise(resolve => { synced = resolve; });
  const firestoreModule = {
    collection: (_database, ...path) => ({ kind: path.at(-1) }),
    doc: (_database, ...path) => ({ kind: path.at(-2), id: path.at(-1) }),
    getDocsFromServer: async () => ({ forEach: () => {} }),
    getDocFromServer: async () => ({ exists: () => false }),
    waitForPendingWrites: async () => {},
    onSnapshot: (reference, callback) => {
      const docs = reference.kind === "wearableDays"
        ? [{ data: () => ({ dateISO: "2026-09-23", steps: 8000 }) }]
        : reference.kind === "wearableSessions"
          ? [{ data: () => ({ id: "session-1", title: "Trote" }) }]
          : [];
      callback({ docs, docChanges: () => [], metadata: {}, exists: () => false });
      return () => {};
    },
    getFirestore: () => ({})
  };
  const cloud = createCloudSync({
    repository,
    storage: emptyStorage,
    isConfigured: true,
    firebaseModules: {
      firestoreModule,
      appModule: { getApps: () => [], initializeApp: () => ({}) },
      authModule: {
        getAuth: () => ({}), browserLocalPersistence: {}, setPersistence: async () => {},
        onAuthStateChanged: (_auth, listener) => {
          authListener = listener;
          listener({ uid: "test-user" });
          return () => {};
        }
      }
    },
    onWearableChanged: data => updates.push(data),
    onStatus: status => { if (status.state === "synced") synced(); }
  });
  await cloud.initialize();
  await ready;
  assert.equal(updates.at(-1).days[0].steps, 8000);
  assert.equal(updates.at(-1).sessions[0].title, "Trote");
  await authListener(null);
  assert.deepEqual(updates.at(-1), { days: [], sessions: [] });
  cloud.destroy();
});
