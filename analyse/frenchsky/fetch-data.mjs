#!/usr/bin/env node
/**
 * FrenchSky — téléchargement des données d'économie.
 *
 * Récupère :
 *   - /api/v1/economy/items          (1 requête)
 *   - /api/v1/economy/items/<id>/history?period=90d  (1 requête par item)
 *
 * NB : l'API ignore le paramètre period et renvoie toujours les ~18 derniers
 * relevés (≈ 4 jours à raison d'un relevé toutes les ~5h30). On demande 90d
 * au cas où le serveur en garde plus un jour, et on garde tout ce qui revient.
 *
 * Politesse envers l'API :
 *   - TTL de 4h sur le cache (les prix changent toutes les 4h) sauf --force
 *   - délai minimal de 3s entre deux requêtes
 *   - lecture des headers x-ratelimit-* et backoff sur HTTP 429
 *   - les historiques déjà à jour sont réutilisés (pas de re-téléchargement)
 *
 * Usage :
 *   pnpm fetch                 # rafraîchit si le cache a > 4h
 *   pnpm fetch:force           # force le re-téléchargement
 *   pnpm fetch --limit 5       # dev : seulement les 5 premiers items
 *   pnpm fetch --items 21,54   # dev : items spécifiques
 *   pnpm list-items            # affiche les noms exacts des items
 */
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { parse as parseToml } from "smol-toml";

const API = "https://www.frenchsky.net/api/v1/economy";
const PERIOD = "90d";
const TTL_MS = 4 * 60 * 60 * 1000; // les prix changent toutes les 4h
const MIN_GAP_MS = 3000; // politesse : délai minimal entre 2 requêtes
const REQUEST_TIMEOUT_MS = 30000;

const DATA_DIR = new URL("./", import.meta.url);
const HISTORY_DIR = new URL("./data/history/", import.meta.url);

// ---------------------------------------------------------------- args

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const force = has("force");
const listOnly = has("list-items");
const limitArg = value("limit");
const itemsArg = value("items");
const quiet = has("quiet");

const log = (...m) => { if (!quiet) console.log(...m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------ utils

async function fileFresh(fileUrl, maxAgeMs) {
  try {
    const s = await stat(fileUrl);
    return Date.now() - s.mtimeMs < maxAgeMs;
  } catch {
    return false;
  }
}

// ------------------------------------------------------- rate limiting

let rateRemaining = null;
let rateLimit = null;
let lastRequestAt = 0;

async function politeFetch(path) {
  const gap = lastRequestAt + MIN_GAP_MS - Date.now();
  if (gap > 0) await sleep(gap);
  lastRequestAt = Date.now();

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(API + path, {
        headers: { "user-agent": "jsMacros-frenchsky-analysis/1.0 (usage local, non commercial)" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      if (attempt >= 4) throw new Error(`échec réseau pour ${path}: ${err.message}`);
      log(`  ⚠ échec réseau (${err.message}) — nouvel essai dans 5s…`);
      await sleep(5000);
      continue;
    }

    const rlRemaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "", 10);
    const rlLimit = parseInt(res.headers.get("x-ratelimit-limit") ?? "", 10);
    if (Number.isFinite(rlRemaining)) rateRemaining = rlRemaining;
    if (Number.isFinite(rlLimit)) rateLimit = rlLimit;

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") ?? "", 10);
      const waitMs = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : rateRemaining > 0 ? 5000 : 60000;
      log(`  ⏳ 429 (limite API) — pause de ${Math.round(waitMs / 1000)}s…`);
      await sleep(waitMs);
      if (attempt >= 5) throw new Error(`trop de 429 pour ${path}`);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} pour ${path}`);

    // si on approche de la limite, on ralentit
    if (rateRemaining !== null && rateRemaining <= 5) {
      log(`  🐢 quota restant: ${rateRemaining}/${rateLimit} — on ralentit`);
      await sleep(10000);
    }
    return res.json();
  }
}

// ------------------------------------------------------------- main

await mkdir(HISTORY_DIR, { recursive: true });

// 1) items
const itemsFile = new URL("data/items.json", DATA_DIR);
const wantForceRefresh =
  force ||
  limitArg !== undefined ||
  itemsArg !== undefined ||
  listOnly;

let items;
if (!wantForceRefresh && (await fileFresh(itemsFile, TTL_MS))) {
  items = JSON.parse(await readFile(itemsFile, "utf8"));
  log(`✓ items.json est frais (cache < 4h) — pas de re-téléchargement (--force pour forcer)`);
} else {
  log(`→ téléchargement de /items …`);
  items = await politeFetch("/items");
  if (!Array.isArray(items) || items.length === 0) throw new Error("réponse /items invalide");
  await writeFile(itemsFile, JSON.stringify(items, null, 2));
  log(`✓ ${items.length} items enregistrés`);
}

// 2) filtre dev éventuel
let selected = items;
if (itemsArg) {
  const ids = itemsArg.split(",").map((s) => parseInt(s, 10)).filter(Number.isFinite);
  selected = items.filter((it) => ids.includes(it.resource_id));
  log(`ℹ dev : ${selected.length} item(s) sélectionné(s) (--items ${itemsArg})`);
} else if (limitArg) {
  const n = parseInt(limitArg, 10);
  selected = items.slice(0, n);
  log(`ℹ dev : ${n} item(s) seulement (--limit ${n})`);
}

// 3) --list-items
if (listOnly) {
  console.log("Items disponibles (noms exacts pour rates.toml) :");
  for (const it of items) console.log(`  ${it.resource_id} — ${it.resource_name}`);
  process.exit(0);
}

// 4) historiques (réutilisation du cache frais par item)
let fetched = 0;
let reused = 0;
for (const it of selected) {
  const file = new URL(`${it.resource_id}.json`, HISTORY_DIR);
  if (!force && (await fileFresh(file, TTL_MS))) {
    reused++;
    continue;
  }
  log(`→ historique ${it.resource_name} (${it.resource_id})…`);
  const hist = await politeFetch(`/items/${it.resource_id}/history?period=${PERIOD}`);
  await writeFile(file, JSON.stringify(hist, null, 2));
  fetched++;
}
log(`✓ historiques : ${fetched} téléchargé(s), ${reused} réutilisé(s) du cache`);

// 5) rates.toml → data/rates.json
const ratesFile = new URL("./rates.toml", DATA_DIR);
let rates = {};
try {
  rates = parseToml(await readFile(ratesFile, "utf8"));
} catch (err) {
  log(`⚠ rates.toml illisible (${err.message}) — poursuite sans taux`);
}

const byName = new Map(items.map((it) => [it.resource_name, it]));
const byNameLower = new Map(items.map((it) => [it.resource_name.toLocaleLowerCase("fr"), it]));
const resolved = [];
const warnings = [];
for (const [name, ratePerHour] of Object.entries(rates)) {
  let item = byName.get(name);
  if (!item) {
    const fuzzy = byNameLower.get(name.toLocaleLowerCase("fr"));
    if (fuzzy) {
      warnings.push(`« ${name} » ≈ « ${fuzzy.resource_name} » (correspondance approximative)`);
      item = fuzzy;
    }
  }
  if (!item) {
    warnings.push(`⚠ « ${name} » ne correspond à aucun item — ignoré`);
    continue;
  }
  if (typeof ratePerHour !== "number" || !(ratePerHour > 0)) {
    warnings.push(`⚠ taux de « ${name} » invalide (${ratePerHour}) — ignoré`);
    continue;
  }
  resolved.push({ resource_id: item.resource_id, resource_name: item.resource_name, rate_per_hour: ratePerHour });
}
if (warnings.length) {
  log("Avertissements rates.toml :");
  for (const w of warnings) log(`  ${w}`);
}
await writeFile(
  new URL("data/rates.json", DATA_DIR),
  JSON.stringify(resolved, null, 2)
);
log(`✓ ${resolved.length} taux résolus (${Object.keys(rates).length} entrées dans rates.toml)`);

// 6) meta
const meta = {
  fetchedAt: new Date().toISOString(),
  period: PERIOD,
  ttlHours: TTL_MS / 3600000,
  itemsCount: items.length,
  historyCount: fetched + reused,
  ratesCount: resolved.length,
  source: { items: `${API}/items`, history: `${API}/items/<id>/history?period=${PERIOD}` },
};
await writeFile(new URL("data/meta.json", DATA_DIR), JSON.stringify(meta, null, 2));

log("✓ terminé — lancez `pnpm dev` puis ouvrez http://localhost:8080");
