import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("la interfaz usa módulos, tres vistas y ningún evento inline", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  assert.match(html, /assets\/css\/styles\.css/);
  assert.match(html, /type="module" src="assets\/js\/app\.js"/);
  assert.doesNotMatch(html, /\son(?:click|change|submit)=/i);
  assert.equal([...html.matchAll(/class="nav-item/g)].length, 3);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("hay cuatro rutinas físicas provisorias configurables", async () => {
  const data = await import("../assets/js/data.js");
  assert.equal(data.physicalRoutines.length, 4);
  assert.deepEqual(data.cardioTypes.map(type => type.id), ["outdoor-bike", "stationary-bike", "running", "walking", "trekking"]);
});

test("el shell offline incluye todos los recursos de la aplicación", async () => {
  const worker = await readFile(resolve(root, "service-worker.js"), "utf8");
  for (const asset of ["index.html", "assets/css/styles.css", "assets/js/app.js", "assets/js/data.js", "assets/js/storage.js", "assets/js/utils.js"]) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(worker, /tgb-shell-v7/);
});
