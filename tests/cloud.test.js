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
  const remote = { records: new Map(), plans: new Map(), trainingBlocks: new Map(), settings: new Map(), coachQuestions: new Map() };
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
  const phoneCloud = await connect(phone, phoneStorage);
  assert.equal(remote.trainingBlocks.get(block.id).title, "Plan del teléfono");
  assert.equal([...remote.coachQuestions.values()][0].answer, "Cuida la rodilla.");
  const computerStorage = makeStorage();
  const computer = createRepository(computerStorage);
  const computerCloud = await connect(computer, computerStorage);
  assert.equal(computer.listTrainingBlocks()[0].title, "Plan del teléfono");
  assert.equal(computer.listCoachQuestions()[0].answer, "Cuida la rodilla.");
  phoneCloud.destroy();
  computerCloud.destroy();
});
