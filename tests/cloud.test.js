import test from "node:test";
import assert from "node:assert/strict";
import { createCloudSync } from "../assets/js/cloud.js";
import { firebaseConfig, firebaseConfigured } from "../assets/js/firebase-config.js";

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
