import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseOpenTennisMatches, syncOpenTennisMatches } from "../assets/js/open-tennis-sync.js";

const fixture = `Semana,Cancha,Turno,Categoría,Jugador 1,Jugador 2,Fecha,Estado,Observaciones,ID
Semana 9,,,,,,,,,
9,1,3 (15:30-17:00),A,Felipe Reyes,Tomás Gómez,03/10/2026,Programado,,m-1
11,1,2 (13:45-15:15),A,Tomás Gómez,Jose Astete,17/10/2026,Programado,,m-2
12,2,2 (13:45-15:15),A,Nicolás Collao,Tomás Gómez,24/10/2026,Suspendido,Lluvia,m-3
14,1,2 (13:45-15:15),A,Otra Persona,Luis Flores,07/11/2026,Programado,,m-4`;

const results = `Fecha,Jugador 1,Jugador 2,Pendiente,Observaciones,,,,,,,,,Ganador,,,Resultado,,,,,,ID
11/07/2026,Tomás Gómez,Claudio Aedo,,,,,,,,,,,Tomás Gómez,,,6-3 7-5,,,,,,old`;

test("el lector CSV conserva comas entre comillas y saltos de fila", () => {
  assert.deepEqual(parseCsv('a,b\n"uno, dos",tres'), [["a", "b"], ["uno, dos", "tres"]]);
});

test("Open Tennis filtra a Tomás, interpreta horarios y conserva estados", () => {
  const matches = parseOpenTennisMatches(fixture, results, { playerName: "Tomás Gómez", todayISO: "2026-09-28" });
  assert.equal(matches.length, 3);
  assert.deepEqual(matches.map(item => [item.dateISO, item.opponent, item.startTime, item.court, item.status]), [
    ["2026-10-03", "Felipe Reyes", "15:30", 1, "likely-suspended"],
    ["2026-10-17", "Jose Astete", "13:45", 1, "scheduled"],
    ["2026-10-24", "Nicolás Collao", "13:45", 2, "suspended"]
  ]);
});

test("la sincronización consulta las dos hojas públicas sin usar credenciales", async () => {
  const requested = [];
  const fetchImpl = async url => {
    requested.push(url);
    return { ok: true, text: async () => url.includes("gid=0") ? fixture : results };
  };
  const result = await syncOpenTennisMatches({ playerName: "Tomás Gómez", todayISO: "2026-09-28", fetchImpl });
  assert.equal(requested.length, 2);
  assert.equal(result.matches.length, 3);
  assert.match(result.source, /opentennis\.cl\/partidos\.html/);
});
