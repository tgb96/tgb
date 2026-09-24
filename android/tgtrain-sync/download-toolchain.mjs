import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const directory = join(import.meta.dirname, ".tooling");
mkdirSync(directory, { recursive: true });

async function save(url, name) {
  const destination = join(directory, name);
  if (existsSync(destination)) {
    console.log(`${name} ya existe`);
    return;
  }
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`${name}: HTTP ${response.status}`);
  console.log(`Descargando ${name} (${response.headers.get("content-length") || "?"} bytes)…`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  console.log(`Listo: ${destination}`);
}

const releases = await fetch("https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows")
  .then(response => response.json());
await Promise.all([
  save(releases[0].binary.package.link, "jdk17.zip"),
  save("https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip", "android-cmdline.zip"),
  save("https://services.gradle.org/distributions/gradle-8.13-bin.zip", "gradle-8.13.zip")
]);
