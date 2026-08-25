import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("la página carga estilos y lógica separados sin eventos inline", async () => {
  const html = await readFile(resolve(root, "index.html"), "utf8");
  assert.match(html, /assets\/css\/styles\.css/);
  assert.match(html, /type="module" src="assets\/js\/app\.js"/);
  assert.doesNotMatch(html, /\son(?:click|change|submit)=/i);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("el caché offline contiene toda la aplicación", async () => {
  const worker = await readFile(resolve(root, "service-worker.js"), "utf8");
  for (const asset of ["index.html", "assets/css/styles.css", "assets/js/app.js", "assets/js/data.js", "assets/js/storage.js", "assets/js/utils.js"]) {
    assert.match(worker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(worker, /SKIP_WAITING/);
});
