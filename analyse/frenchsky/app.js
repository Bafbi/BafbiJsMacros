/* FrenchSky — analyse économique : logique du tableau */
"use strict";

const $ = (sel) => document.querySelector(sel);

const state = {
  items: [],       // [{resource_id, resource_name, farming_price, selling_price}]
  rates: new Map(),// resource_id -> rate_per_hour
  histories: new Map(), // resource_id -> [{date, farming_price, selling_price, increase_score}]
  meta: null,
  sortKey: "revenue",
  sortDir: "desc",
};

// ---------------------------------------------------------------- format

const fmtMoney = (v) =>
  v == null || !isFinite(v) ? "—" :
  Math.abs(v) >= 1e6 ? (v / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " M" :
  Math.abs(v) >= 1e3 ? (v / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " k" :
  v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

const fmtNum = (v) =>
  v == null ? "—" : v.toLocaleString("fr-FR", { maximumFractionDigits: 0 });

const fmtPct = (v) => {
  if (v == null || !isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return s + v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " %";
};

// ------------------------------------------------------------- sparkline

function sparkline(values, width = 130, height = 30) {
  if (!values || values.length < 2) {
    return `<svg width="${width}" height="${height}"></svg>`;
  }
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const n = values.length;
  const step = Math.max(1, Math.floor(n / width));
  const sampled = [];
  for (let i = 0; i < n; i += step) sampled.push(values[i]);
  if (sampled[sampled.length - 1] !== values[n - 1]) sampled.push(values[n - 1]);

  const pts = sampled.map((v, i) => {
    const x = (i / (sampled.length - 1)) * width;
    const y = height - 2 - ((v - min) / span) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const up = sampled[sampled.length - 1] >= sampled[0];
  const color = up ? "#5fd06e" : "#e0686f";
  return (
    `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<polyline fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" points="${pts.join(" ")}"/>` +
    `<circle cx="${width - 1}" cy="${(height - 2 - ((sampled[sampled.length - 1] - min) / span) * (height - 4)).toFixed(1)}" r="2" fill="${color}"/>` +
    `</svg>`
  );
}

// ------------------------------------------------------------- analyse

function trendPctDays(item, days) {
  const hist = state.histories.get(item.resource_id);
  if (!hist || hist.length < 2) return null;
  const current = item.farming_price;
  const target = Date.now() - days * 24 * 3600 * 1000;
  let past = null;
  let bestDiff = Infinity;
  for (const p of hist) {
    const t = new Date(p.date.replace(" ", "T")).getTime();
    const d = Math.abs(t - target);
    if (d < bestDiff) { bestDiff = d; past = p.farming_price; }
  }
  if (!past || past <= 0) return null;
  return ((current - past) / past) * 100;
}

function trendPctSpan(item) {
  const hist = state.histories.get(item.resource_id);
  if (!hist || hist.length < 2) return null;
  const first = hist[0].farming_price;
  const last = hist[hist.length - 1].farming_price;
  if (!first || first <= 0) return null;
  return ((last - first) / first) * 100;
}

function buildRow(item) {
  const rate = state.rates.get(item.resource_id) ?? null;
  const configured = rate != null && rate > 0;
  const hist = state.histories.get(item.resource_id);
  const revenue = configured ? item.farming_price * rate : null;
  const bonusPerHour = configured ? item.selling_price * rate : null;
  const trend24 = trendPctDays(item, 1);
  const trendSpan = trendPctSpan(item);
  const score = hist && hist.length ? hist[hist.length - 1].increase_score : null;

  const trendCls = (v) => v == null ? "flat" : v > 0.5 ? "up" : v < -0.5 ? "down" : "flat";

  const sparkVals = hist ? hist.map((p) => p.farming_price) : null;
  const sparkTitle = hist && hist.length >= 2
    ? `Du ${hist[0].date} au ${hist[hist.length - 1].date} (${hist.length} relevés)`
    : "Aucun historique";

  return {
    item,
    configured,
    revenue,
    bonusPerHour,
    trend24,
    trendSpan,
    score,
    sparkVals,
    cell: `
      <td class="item-name">${escapeHtml(item.resource_name)}</td>
      <td class="num">${fmtMoney(item.farming_price)}</td>
      <td class="num">${fmtMoney(item.selling_price)}</td>
      <td class="num">${configured ? fmtNum(rate) : "—"}</td>
      <td class="num revenue${configured ? "" : " none"}">${configured ? fmtMoney(revenue) : "—"}</td>
      <td class="num">${configured ? fmtMoney(bonusPerHour) : "—"}</td>
      <td class="num"><span class="trend ${trendCls(trend24)}">${fmtPct(trend24)}</span></td>
      <td class="num"><span class="trend ${trendCls(trendSpan)}">${fmtPct(trendSpan)}</span></td>
      <td class="num"><span class="score${score != null && score >= 4 ? " hot" : ""}">${score ?? "—"}</span></td>
      <td class="spark" title="${sparkTitle}">${sparkline(sparkVals)}</td>
    `,
  };
}

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ------------------------------------------------------------- tri

function sortRows(rows) {
  const { sortKey, sortDir } = state;
  const dir = sortDir === "desc" ? -1 : 1;
  const get = (r) => {
    switch (sortKey) {
      case "name": return r.item.resource_name;
      case "farming": return r.item.farming_price;
      case "selling": return r.item.selling_price;
      case "rate": return state.rates.get(r.item.resource_id) ?? -1;
      case "revenue": return r.revenue ?? -1;
      case "bonusPerHour": return r.bonusPerHour ?? -1;
      case "trend24": return r.trend24 ?? -Infinity;
      case "trendSpan": return r.trendSpan ?? -Infinity;
      case "score": return r.score ?? -1;
      default: return 0;
    }
  };
  return rows.slice().sort((a, b) => {
    const va = get(a), vb = get(b);
    if (typeof va === "string") return va.localeCompare(vb, "fr") * dir;
    if (va === vb) return 0;
    return (va > vb ? 1 : -1) * dir;
  });
}

// ------------------------------------------------------------- rendu

function render() {
  const search = $("#search").value.trim().toLocaleLowerCase("fr");
  const onlyConfigured = $("#only-configured").checked;

  let rows = state.items.map(buildRow);
  if (search) rows = rows.filter((r) => r.item.resource_name.toLocaleLowerCase("fr").includes(search));

  // les items non configurés passent en bas
  const configured = sortRows(rows.filter((r) => r.configured));
  const unconfigured = sortRows(rows.filter((r) => !r.configured));

  const body = $("#rows");
  body.innerHTML = configured.map((r) =>
    `<tr>${r.cell}</tr>`
  ).join("") + (onlyConfigured ? "" : unconfigured.map((r) =>
    `<tr class="unconfigured" title="Aucun taux dans rates.toml — ajoutez-le pour voir le revenu">${r.cell}</tr>`
  ).join(""));

  const nCfg = configured.length;
  const nTotal = rows.length;
  $("#count").textContent = onlyConfigured
    ? `${nCfg} item(s)`
    : `${nTotal} item(s) — ${nCfg} configuré(s)`;
}

function renderMeta() {
  const meta = state.meta;
  if (!meta) return;
  const d = new Date(meta.fetchedAt);
  const fresh = Date.now() - d.getTime() < meta.ttlHours * 3600000;
  $("#meta").innerHTML =
    `Données du ${d.toLocaleString("fr-FR")}` +
    `<span class="badge${fresh ? "" : " warn"}">${fresh ? "à jour" : "à rafraîchir (pnpm fetch)"}</span>`;
}

// ------------------------------------------------------------- init

async function init() {
  try {
    const [items, rates, meta] = await Promise.all([
      fetch("data/items.json").then((r) => r.json()),
      fetch("data/rates.json").then((r) => r.json()),
      fetch("data/meta.json").then((r) => r.json()),
    ]);
    state.items = items;
    state.meta = meta;
    for (const r of rates) state.rates.set(r.resource_id, r.rate_per_hour);

    // historiques : en parallèle, chaque fichier séparément (serveur local)
    const results = await Promise.allSettled(
      items.map((it) =>
        fetch(`data/history/${it.resource_id}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => j && j.history ? [it.resource_id, j.history] : null)
      )
    );
    let missing = 0;
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) state.histories.set(r.value[0], r.value[1]);
      else missing++;
    }

    renderMeta();
    render();

    if (missing) {
      $("#hint").innerHTML += ` <span class="badge warn">${missing} historique(s) manquant(s) — relancez <code>pnpm fetch</code></span>`;
    }
  } catch (err) {
    const main = document.querySelector("main");
    const div = document.createElement("div");
    div.id = "error";
    div.textContent = `Impossible de charger les données (${err.message}). Lancez d'abord \`pnpm fetch\` puis \`pnpm dev\`, et ouvrez http://localhost:8080 — les données ne peuvent pas être lues depuis file:// (CORS).`;
    main.prepend(div);
  }
}

// événements
$("#search").addEventListener("input", render);
$("#only-configured").addEventListener("change", render);
document.querySelectorAll("thead th.sortable").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.key;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === "desc" ? "asc" : "desc";
    } else {
      state.sortKey = key;
      state.sortDir = key === "name" ? "asc" : "desc";
    }
    document.querySelectorAll("thead th").forEach((t) => t.classList.remove("sorted"));
    th.classList.add("sorted");
    render();
  });
});

init();
