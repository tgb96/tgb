import { isoWeekInfo } from "./utils.js?v=67";

export const OPEN_TENNIS_PAGE_URL = "https://opentennis.cl/partidos.html";
export const OPEN_TENNIS_FIXTURE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4Uc2YiXkim8OTwSbwK4AYfC1oWWNTX1TCE4RXFyzaK5azjuaHx4nWT1v6Ubiq2Lm9kpYFTJmY6C1d/pub?gid=0&single=true&output=csv";
export const OPEN_TENNIS_RESULTS_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR4Uc2YiXkim8OTwSbwK4AYfC1oWWNTX1TCE4RXFyzaK5azjuaHx4nWT1v6Ubiq2Lm9kpYFTJmY6C1d/pub?gid=1046180821&single=true&output=csv";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalized(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' && quoted && source[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some(value => clean(value))) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some(value => clean(value))) rows.push(row);
  return rows;
}

function isoDate(value) {
  const match = clean(value).match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (!match) return "";
  const year = String(Number(match[3]) < 100 ? Number(match[3]) + 2000 : Number(match[3])).padStart(4, "0");
  const month = String(Number(match[2])).padStart(2, "0");
  const day = String(Number(match[1])).padStart(2, "0");
  const result = `${year}-${month}-${day}`;
  const date = new Date(`${result}T12:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result ? "" : result;
}

function shiftTimes(value) {
  const matches = clean(value).match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
  return matches ? { startTime: matches[1].padStart(5, "0"), endTime: matches[2].padStart(5, "0") } : { startTime: "", endTime: "" };
}

function pairKey(player1, player2) {
  return [normalized(player1), normalized(player2)].sort().join("|");
}

function resultRows(csv) {
  const rows = parseCsv(csv).slice(1);
  const byId = new Map();
  const byPair = new Map();
  rows.forEach(columns => {
    const player1 = clean(columns[1]);
    const player2 = clean(columns[2]);
    if (!player1 || !player2) return;
    const result = {
      date: clean(columns[0]),
      player1,
      player2,
      pending: clean(columns[3]),
      observations: clean(columns[4]),
      winner: clean(columns[13]),
      score: clean(columns[16]),
      matchId: clean(columns[22])
    };
    if (result.matchId) byId.set(result.matchId, result);
    byPair.set(pairKey(player1, player2), result);
  });
  return { byId, byPair };
}

function matchStatus(fixtureStatus, fixtureObservations, result) {
  if (result?.winner || result?.score) return "played";
  const combined = normalized([fixtureStatus, fixtureObservations, result?.pending, result?.observations].filter(Boolean).join(" "));
  if (/suspend|posterg/.test(combined)) return "suspended";
  if (/por coordinar|pendiente|reprogram/.test(combined)) return "pending";
  return "scheduled";
}

export function parseOpenTennisMatches(fixtureCsv, resultsCsv, { playerName = "Tomás Gómez", todayISO = "0000-00-00" } = {}) {
  const player = normalized(playerName);
  const results = resultRows(resultsCsv);
  return parseCsv(fixtureCsv).slice(1).flatMap(columns => {
    const week = clean(columns[0]);
    const player1 = clean(columns[4]);
    const player2 = clean(columns[5]);
    if (!week || normalized(week).startsWith("semana") || !player1 || !player2) return [];
    if (normalized(player1) !== player && normalized(player2) !== player) return [];
    const dateISO = isoDate(columns[6] || columns[10]);
    if (!dateISO || dateISO < todayISO) return [];
    const matchId = clean(columns[9]);
    const result = results.byId.get(matchId) || results.byPair.get(pairKey(player1, player2));
    let status = matchStatus(columns[7], columns[8], result);
    if (status === "played") return [];
    const opponent = normalized(player1) === player ? player2 : player1;
    const { startTime, endTime } = shiftTimes(columns[2]);
    if (!startTime || !endTime) return [];
    const info = isoWeekInfo(dateISO);
    const beachTrip = dateISO === "2026-10-03" && normalized(opponent) === "felipe reyes";
    if (beachTrip && status === "scheduled") status = "likely-suspended";
    return [{
      dateISO,
      weekKey: info.weekKey,
      weekNumber: info.weekNumber,
      weekStartISO: info.startISO,
      weekEndISO: info.endISO,
      startTime,
      endTime,
      court: Number(clean(columns[1])) || clean(columns[1]),
      category: clean(columns[3]),
      opponent,
      homeSide: normalized(player1) === player,
      status,
      matchId,
      note: beachTrip ? "Probable suspensión por viaje a la playa. No contar como carga competitiva hasta confirmarlo." : clean(columns[8]),
      source: OPEN_TENNIS_PAGE_URL
    }];
  }).sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.startTime.localeCompare(b.startTime));
}

async function fetchText(url, fetchImpl) {
  const separator = url.includes("?") ? "&" : "?";
  const response = await fetchImpl(`${url}${separator}_tgtrain=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Open Tennis respondió con estado ${response.status}.`);
  return response.text();
}

export async function syncOpenTennisMatches({ playerName = "Tomás Gómez", todayISO, fetchImpl = fetch } = {}) {
  let fixtureCsv;
  let resultsCsv;
  try {
    [fixtureCsv, resultsCsv] = await Promise.all([
      fetchText(OPEN_TENNIS_FIXTURE_URL, fetchImpl),
      fetchText(OPEN_TENNIS_RESULTS_URL, fetchImpl)
    ]);
  } catch (error) {
    const wrapped = new Error("No se pudo consultar Open Tennis. Revisa tu conexión y vuelve a intentarlo.");
    wrapped.cause = error;
    throw wrapped;
  }
  const matches = parseOpenTennisMatches(fixtureCsv, resultsCsv, { playerName, todayISO });
  if (!matches.length) throw new Error("Open Tennis no publicó partidos futuros con fecha y horario para Tomás Gómez.");
  return { matches, syncedAt: new Date().toISOString(), source: OPEN_TENNIS_PAGE_URL };
}
