
(() => {
"use strict";
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = () => matchMedia("(max-width:760px)").matches;
const andList = a => a.length <= 1 ? (a[0] || "") : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
const fmt = n => Number(n).toLocaleString("en-GB");
const store = {get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }};
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- data prep ---------- */
$("#asof").textContent = META.asof_label;
const byAbbr = Object.fromEntries(STATES.map(s => [s.abbr, s]));
const byFips = Object.fromEntries(STATES.map(s => [s.fips, s]));
const alias = Object.fromEntries(ALIASES.map(a => [a.registry_name, a]));
const sponsorName = n => alias[n] ? alias[n].display_name : n;
// v1.9.4 (D100): legal categories that score 75 or more.
const FAST = new Set(["Own state program", "Trigger or conditional law", "General follow-federal rule"]);
const STATUS_LABEL = {"Recruiting": "Recruiting", "Active, not recruiting": "Not recruiting, trial still open", "Completed or closed": "Not recruiting, trial closed"};
const statusGroup = s => ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION"].includes(s) ? "Recruiting" : s === "ACTIVE_NOT_RECRUITING" ? "Active, not recruiting" : "Completed or closed";
const prettyStatus = s => s.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());
for (const t of Object.values(TRIALS)) { t.sgroup = statusGroup(t.status); t.company = t.sponsor_class === "INDUSTRY"; }
const TIER_LABELS = ["No company trials", "1 company", "2 to 3 companies", "4+ companies"];
// Clinic display names that differ from the registry (D40). The registry name stays in the data files and in search.
const CLINIC_ALIAS = {"Sunstone Medical, PC": "Sunstone Therapies (registered as Sunstone Medical, PC)",
  // v1.9.4: the registry misspells this clinic; the page shows the correct spelling, the data file keeps the registry's.
  "Univeristy of Southern California Brain and Creativity Institute": "University of Southern California Brain and Creativity Institute"};
SITES.forEach((s, i) => {
  s.i = i; s.registry_facility = s.facility; if (CLINIC_ALIAS[s.facility]) s.facility = CLINIC_ALIAS[s.facility]; s.trials = s.nct_ids.map(n => TRIALS[n]);
  s.site_status = Object.fromEntries(s.site_trial_status.map(x => x.split(":")));
  // v1.6 (D46): tiers count companies (industry lead sponsors), the one unit used for every headline figure.
  s.tier = s.n_companies >= 4 ? 3 : s.n_companies >= 2 ? 2 : s.n_companies === 1 ? 1 : 0;
  s.tierLabel = TIER_LABELS[s.tier];
  s.companies = s.industry_sponsors;
  s.sgroup = s.status;
  const d = [...new Set(s.trials.flatMap(t => t.drugs))]; s.drugs = d.sort();
  // v1.7: clinics whose trials are all in the wider classes get their own colour, so they are not lost in grey.
  s.dgroup = d.length === 1 && {Psilocybin: 1, MDMA: 1, LSD: 1}[d[0]] ? ({Psilocybin: "psi", MDMA: "mdma", LSD: "lsd"}[d[0]]) : d.length && d.every(x => WIDE_CLASSES.includes(x)) ? "wide" : "oth";
});
// v1.9.4 (D100): drug-neutral legal categories. A state's law has been read (category, score, statute links, a small-text
// note and the drugs covered) or it is "Not yet checked", which scores 0. The check date stays in the data, not on the page.
const NYC = "Not yet checked", NYC_TIP = "Not yet checked. Nobody has read this state's law for the atlas yet, so it scores 0 on the legal path.";
const LEGAL_C = (() => { const v = STATES.filter(s => s.legal); return {ver: v.length, nyc: STATES.length - v.length}; })();
// v1.9.5: at 51 of 51 the line says so and the States banner disappears.
const legalLine = () => LEGAL_C.nyc ? `Legal path read for ${LEGAL_C.ver} of ${STATES.length} states so far. States not yet read score 0 on the legal path.` : `Legal path read for all ${STATES.length} states.`;
const legalBadge = s => s.legal ? ["ok", s.legal.category] : ["none", NYC];
const LEGAL_ORDER = ["Own state program", "Trigger or conditional law", "General follow-federal rule", "Regulator must act", "Legislature must act"];
const lcls = s => s.legal ? "c" + s.legal.score : "nyc";
const lrank = s => s.legal ? LEGAL_ORDER.indexOf(s.legal.category) : 9;
const legalChip = s => `<span class="lchip ${lcls(s)}" title="${esc(glossDef(s.legal.category))}">${esc(s.legal.category)}<span class="lsc mono">${s.legal.score}</span></span>`;
const legalShortHTML = s => s.legal ? `<span class="lpt">${esc(s.legal.category)}</span>` : `<span class="lpt nyc" title="${NYC_TIP}" tabindex="0">${NYC}</span>`;
const citesHTML = s => s.legal.links.map(c => `<a class="lcite" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`).join(" &middot; ");
const legalCellHTML = (s, br, dot) => { if (!s.legal) return dot ? `<span class="lpt nyrdot" title="${NYC_TIP}" tabindex="0" aria-label="${NYC}">&middot;</span>` : legalShortHTML(s);
  return `${legalShortHTML(s)}${br}<span class="note mono">${s.legal.score}</span>`; };
function legalGroupsHTML() {
  const V = STATES.filter(s => s.legal), N = STATES.filter(s => !s.legal);
  const names = a => a.map(s => s.name).sort().join(", ").replace(/, ([^,]*)$/, " and $1"), sts = n => `${n} state${n === 1 ? "" : "s"}`;
  const cats = LEGAL_ORDER.filter(c => V.some(s => s.legal.category === c));
  return `${N.length ? `<p class="stbanner" id="stbanner">${legalLine()}</p>` : ""}<p class="note" id="stchanged" style="margin:0 0 10px">Scores have changed since the last version because the legal path scoring rules changed.</p>
  <h2 class="caps">Legal paths by category</h2><dl class="lgroups">
  ${cats.map(c => { const a = V.filter(s => s.legal.category === c); return `<dt>${esc(c)} <span class="n">scores ${a[0].legal.score} &middot; ${sts(a.length)}</span></dt><dd>${names(a)}.</dd>`; }).join("")}</dl>
  ${N.length ? `<p class="nyrline" id="nyrline">${NYC}, scores 0 (${sts(N.length)}): ${names(N)}.</p>` : ""}`; }
// One status rule everywhere, filters included (D30, extended in v1.5 by D39): the clinic's own registry status for that trial where given, else the trial's.
// v1.6 (D44): same rule as build_sites.group_here. Only a RECRUITING site record counts as recruiting here.
const statusHere = (s, t) => { if (!s) return statusGroup(t.status); const st = s.site_status[t.nct];
  if (st === "RECRUITING") return "Recruiting"; if (["NOT_YET_RECRUITING", "ACTIVE_NOT_RECRUITING", "ENROLLING_BY_INVITATION"].includes(st)) return "Active, not recruiting";
  if (st) return "Completed or closed"; return ["RECRUITING", "NOT_YET_RECRUITING", "ENROLLING_BY_INVITATION", "ACTIVE_NOT_RECRUITING"].includes(t.status) ? "Active, not recruiting" : "Completed or closed"; };

// v1.9.2 (D87): each company beside its compounds. Codes come only from the registry's drug interventions; with no code, the class alone.
const dlow = d => /^[A-Z][a-z]/.test(d) && !/[A-Z]/.test(d.slice(1)) ? d.toLowerCase() : d;
const cmpdText = ts => { const by = new Map();
  ts.forEach(t => t.drugs.forEach(d => { if (!by.has(d)) by.set(d, new Set()); if (t.drugs.length === 1) (t.codes || []).forEach(c => by.get(d).add(c)); }));
  return [...by.entries()].map(([d0, cs]) => { const d = d0.replace(/ \([^)]*unconfirmed\)/, ""), c = [...cs].filter(x => !d.includes(x)); return c.length ? `${c.join(", ")} (${dlow(d)})` : dlow(d); }).join("; "); };
const coLine = (s, n) => { const ts = s.trials.filter(t => t.sponsor === n); return `${sponsorName(n)}: ${cmpdText(ts) || "drug not listed"}`; };
const otherSp = s => s.sponsors.filter(n => !s.companies.includes(n)).length;
/* ---------- filters ---------- */
const DRUGS = [...new Set(Object.values(TRIALS).flatMap(t => t.drugs))].sort((a, b) => a === "Psilocybin" ? -1 : b === "Psilocybin" ? 1 : a.localeCompare(b));
const PHASES = ["Early 1", "1", "2", "3", "n/a"];
const STATUSES = ["Recruiting", "Active, not recruiting", "Completed or closed"];
const COMPANIES = [...new Set(SITES.flatMap(s => s.companies))].sort((a, b) => SITES.filter(s => s.companies.includes(b)).length - SITES.filter(s => s.companies.includes(a)).length);
// Developers = the companies plus Usona Institute, a non-profit running a Phase 3 trial (D37). "Company" figures stay industry-only.
const NONPROFIT_DEVS = Object.keys(SPGROUPS).filter(k => SPGROUPS[k].developer);
const spClass = n => (SPGROUPS[n] || {}).group || "Unclassified";
const DEVELOPERS = [...COMPANIES, ...NONPROFIT_DEVS];
SITES.forEach(s => { s.developers = s.sponsors.filter(n => DEVELOPERS.includes(n)); s.n_other = otherSp(s); });
// v1.7.3: the always-visible "no registered trial" paragraph is gone; the All companies list carries each finding.
const TIERS = TIER_LABELS;
const F = {drug: new Set(), phase: new Set(), status: new Set(), company: new Set(), tier: new Set(), state: new Set()};
const FACETS = [
  ["drug", "Drug", DRUGS, o => o],
  ["phase", "Phase", PHASES, o => o === "n/a" ? "Not applicable" : o === "Early 1" ? "Early phase 1" : "Phase " + o],
  ["status", "Trial status at the clinic", STATUSES, o => STATUS_LABEL[o]],
  ["company", "Company or developer", DEVELOPERS, sponsorName],
  ["tier", "Companies the clinic has worked with", TIERS, o => o],
];
let lens = "";
// A clinic matches when at least one of its trials passes every trial-level filter, and the clinic passes the clinic-level ones.
function trialOK(t, skip, s) {
  return (skip === "drug" || !F.drug.size || t.drugs.some(d => F.drug.has(d)))
    && (skip === "phase" || !F.phase.size || t.phases.some(p => F.phase.has(p)))
    && (skip === "status" || !F.status.size || F.status.has(statusHere(s, t)))
    && (skip === "company" || !F.company.size || F.company.has(t.sponsor));
}
function siteOK(s, skip) {
  if (skip !== "tier" && F.tier.size && !F.tier.has(s.tierLabel)) return false;
  if (skip !== "state" && F.state.size && !F.state.has(s.state)) return false;
  return s.trials.some(t => trialOK(t, skip, s));
}
const matchedTrials = s => s.trials.filter(t => trialOK(t, undefined, s));
function facetCount(key, opt) {
  let n = 0;
  for (const s of SITES) {
    if (!siteOK(s, key)) continue;
    if (key === "tier") { if (s.tierLabel === opt) n++; continue; }
    if (key === "state") { if (s.state === opt) n++; continue; }
    const ok = s.trials.some(t => trialOK(t, key, s) && (key === "drug" ? t.drugs.includes(opt) : key === "phase" ? t.phases.includes(opt) : key === "status" ? statusHere(s, t) === opt : t.sponsor === opt));
    if (ok) n++;
  }
  return n;
}
const anyFilter = () => Object.values(F).some(x => x.size);
let visible = SITES.slice();
function renderFacets() {
  const tierSw = {"No company trials": "--t0", "1 company": "--t1", "2 to 3 companies": "--t2", "4+ companies": "--t3"};
  let h = "";
  for (const [key, label, opts, name] of FACETS) {
    const open = ACC_OPEN.has(key), c = F[key].size;
    h += `<div class="grp facet" id="g-${key}"><button class="acc" type="button" aria-expanded="${open}" aria-controls="gb-${key}" data-acc="${key}"><span class="al">${label}</span><span class="acnt${c ? " on" : ""}" data-cnt="${key}"${c ? "" : " hidden"}>${c || ""}</span><span class="sr"> selected</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="gbody" id="gb-${key}" role="group" aria-label="${label}"${open ? "" : " hidden"}><div class="gtools">${c ? `<button class="gclear" data-clear="${key}">Clear</button>` : ""}</div>`;
    for (const o of opts) {
      const n = facetCount(key, o), on = F[key].has(o);
      const sw = key === "tier" ? `<span class="sw" style="background:var(${tierSw[o]})"></span>` : "";
      h += `<button class="opt${n ? "" : " zero"}" aria-pressed="${on}" data-k="${key}" data-o="${esc(o)}"><span class="box"></span>${sw}<span>${esc(name(o))}</span><span class="n">${n}</span></button>`;
    }
    h += `</div></div>`;
  }
  $("#facets").innerHTML = h;
  renderStateFacet(); accCounts();
}
/* v1.7.3: accordion state survives re-renders. Counts are active selections per group. */
const ACC_OPEN = new Set();
function accCounts() {
  const n = {state: F.state.size, dis: $("#lgdis") && $("#lgdis").getAttribute("aria-pressed") === "true" ? 1 : 0, co: lens ? 1 : 0};
  document.querySelectorAll("#rail [data-cnt]").forEach(e => { const k = e.dataset.cnt, v = k in n ? n[k] : F[k] ? F[k].size : 0; e.textContent = v || ""; e.classList.toggle("on", v > 0); e.hidden = !v; });
}
function setAcc(key, open) {
  open ? ACC_OPEN.add(key) : ACC_OPEN.delete(key);
  const b = document.querySelector(`#rail [data-acc="${key}"]`), g = document.getElementById("gb-" + key);
  if (b) b.setAttribute("aria-expanded", String(open)); if (g) g.hidden = !open;
}
$("#rail").addEventListener("click", e => { const b = e.target.closest("[data-acc]"); if (b) setAcc(b.dataset.acc, b.getAttribute("aria-expanded") !== "true"); });
/* ---------- state selection (v1.3) ---------- */
function renderStateFacet() {
  const q = ($("#stsearch").value || "").trim().toLowerCase();
  $("#stchips").innerHTML = [...F.state].sort((a, b) => byAbbr[a].name.localeCompare(byAbbr[b].name)).map(a => `<button class="stchip" data-unst="${a}" aria-label="Remove ${esc(byAbbr[a].name)}">${esc(byAbbr[a].name)}<span aria-hidden="true">&times;</span></button>`).join("");
  $("#stclear").hidden = !F.state.size; accCounts();
  const opts = STATES.slice().sort((a, b) => a.name.localeCompare(b.name)).filter(s => !q || s.name.toLowerCase().includes(q) || s.abbr.toLowerCase() === q);
  $("#stlist").innerHTML = opts.map(s => { const n = facetCount("state", s.abbr), on = F.state.has(s.abbr); return `<button class="opt${n ? "" : " zero"}" aria-pressed="${on}" data-st="${s.abbr}"><span class="box"></span><span>${esc(s.name)}</span><span class="n">${n}</span></button>`; }).join("") || `<div class="note" style="padding:6px 0">No state matches.</div>`;
}
function toggleStateSel(a) { F.state.has(a) ? F.state.delete(a) : F.state.add(a); update(); }
function setStates(list) { F.state.clear(); list.forEach(a => F.state.add(a)); update(); }
$("#statefacet").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "stclear") return setStates([]);
  if (b.dataset.unst) return toggleStateSel(b.dataset.unst);
  if (b.dataset.st) { const a = b.dataset.st; if (isMobile()) $("#rail").classList.remove("mopen"); toggleStateSel(a); const nb = $(`#stlist [data-st="${a}"]`); if (nb) nb.focus(); }
});
$("#stsearch").addEventListener("input", renderStateFacet);
$("#stsearch").addEventListener("keydown", e => { if (e.key === "Enter") { const f = $("#stlist [data-st]"); if (f) { e.preventDefault(); toggleStateSel(f.dataset.st); $("#stsearch").value = ""; renderStateFacet(); } } });
let lastStateKey = "";
function stateBounds(list) { const b = list.map(a => path.bounds(featByAbbr[a])); return [[d3.min(b, x => x[0][0]), d3.min(b, x => x[0][1])], [d3.max(b, x => x[1][0]), d3.max(b, x => x[1][1])]]; }
function stateFocus() {
  const sel = [...F.state];
  statePaths.classed("fade", f => sel.length > 0 && !F.state.has(byFips[f.id].abbr)).classed("pick", f => sel.length > 1 && F.state.has(byFips[f.id].abbr));
  if (sel.length === 1) openState(sel[0]);
  else if (sel.length > 1) { openSelection(); flyTo(fitTransform(stateBounds(sel), 7, 30, true)); }
  else { if (drawerMode === "selection") closeDrawer(); flyTo(fitTransform(homeBounds(), 8, 10, true)); }
  placeLights();
}
function openSelection() {
  const ss = [...F.state].map(a => byAbbr[a]).sort((a, b) => a.rank - b.rank);
  const n = ss.length, can = n >= 2 && n <= 3;
  const body = `<div class="sec"><div class="score"><span class="num">${visible.length}</span><span class="of">clinics in ${n} states${anyFilter() && Object.entries(F).some(([k, v]) => k !== "state" && v.size) ? ", other filters on" : ""}</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">${can ? `<button class="btn primary" id="cmpthese">Compare these states</button>` : ""}<button class="btn" id="selcopy">Download states as CSV</button><button class="btn" id="selclear">Clear selection</button></div>
    ${n > 3 ? `<p class="note" style="margin-top:8px">Compare takes up to 3 states. Remove some to compare them side by side.</p>` : ""}</div>
  <div class="sec"><h3 class="caps">Selected states, by rank</h3><ul class="list">${ss.map(s => `<li><button data-state="${s.abbr}"><span class="mono" style="width:24px;color:var(--ink-3)">${s.rank}</span><span>${esc(s.name)}<br><span class="note">${visible.filter(x => x.state === s.abbr).length} clinics shown &middot; ${esc(s.legal_category)}</span></span><span class="n">${Math.round(s.readiness_score)}</span></button></li>`).join("")}</ul>
    <div class="note">Shift or Cmd+click on the map to add or remove states.</div></div>`;
  openDrawer(`<div class="caps">Selected states</div><h2>${ss.map(s => esc(s.abbr)).join(" &middot; ")}</h2>`, body, "selection");
}
$("#facets").addEventListener("click", e => {
  const b = e.target.closest("button[data-clear],button[data-k]"); if (!b) return;
  if (b.dataset.clear) { F[b.dataset.clear].clear(); return update(); }
  const set = F[b.dataset.k], o = b.dataset.o; set.has(o) ? set.delete(o) : set.add(o); update();
});
$("#facets").addEventListener("change", e => { if (e.target.id === "statesel") { F.state.clear(); if (e.target.value) F.state.add(e.target.value); update(); } });
$("#clearall").onclick = () => { Object.values(F).forEach(x => x.clear()); setLens(""); if (disShow) $("#lgdis").click(); update(); };

/* ---------- map ---------- */
const svg = d3.select("#map"), zg = d3.select("#zoomg"), gStates = d3.select("#states"), gLights = d3.select("#lights"), gTags = d3.select("#tags");
const fc = topojson.feature(US, US.objects.states); fc.features = fc.features.filter(f => byFips[f.id]);
const geoms = US.objects.states.geometries;
const nb = topojson.neighbors(geoms);
geoms.forEach((g, i) => { const s = byFips[g.id]; if (s) s.neighbours = nb[i].map(j => byFips[geoms[j].id]).filter(Boolean); });
const proj = d3.geoAlbersUsa().scale(1300).translate([487.5, 305]);
const path = d3.geoPath(proj);
const featByAbbr = {}; fc.features.forEach(f => featByAbbr[byFips[f.id].abbr] = f);
let W = innerWidth, H = innerHeight, T = d3.zoomIdentity;
function frame() { // the map area not covered by floating panels
  if (isMobile()) return {x0: 6, y0: 96, x1: W - 6, y1: $("#drawer").classList.contains("open") ? H - (sheetH || H * 0.46) : H - 84};
  const left = $("#rail").classList.contains("collapsed") ? 20 : 300, right = $("#drawer").classList.contains("open") ? 420 : 20;
  return {x0: left, y0: 60, x1: W - right, y1: H - 106};
}
function fitTransform(bounds, maxK = 8, pad = 24, avoidLegend = false) {
  const f = frame(), [[x0, y0], [x1, y1]] = bounds;
  // State fits keep the shape clear of the legend panel, which floats over the bottom-left of the map.
  if (avoidLegend && !isMobile()) { const lg = $("#legend").getBoundingClientRect();
    if (lg.height && lg.right > f.x0 && lg.top < f.y1) {
      const kOf = g => Math.min((g.x1 - g.x0 - pad * 2) / (x1 - x0), (g.y1 - g.y0 - pad * 2) / (y1 - y0));
      const above = {...f, y1: Math.min(f.y1, lg.top - 10)}, right = {...f, x0: Math.max(f.x0, lg.right + 10)};
      Object.assign(f, kOf(above) >= kOf(right) ? above : right);
    } }
  const k = Math.min(maxK, 0.92 * Math.min((f.x1 - f.x0 - pad * 2) / (x1 - x0), (f.y1 - f.y0 - pad * 2) / (y1 - y0)));
  const cx = (f.x0 + f.x1) / 2, cy = (f.y0 + f.y1) / 2;
  return d3.zoomIdentity.translate(cx, cy).scale(k).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
}
const homeBounds = () => path.bounds(fc);
let homeT;
const zoom = d3.zoom().scaleExtent([0.5, 40]).on("zoom", e => { T = e.transform; zg.attr("transform", T); placeLights(); hideTip(); });
svg.call(zoom).on("dblclick.zoom", null);
const SEQ = () => ["--s0", "--s1", "--s2", "--s3", "--s4", "--s5"].map(css);
let shadeKey = "readiness_score";
const shadeFill = v => (v === "" || v == null) ? "url(#hatch)" : SEQ()[Math.min(5, Math.floor(Math.min(99.99, v) / (100 / 6)))];
svg.insert("defs", ":first-child").html(`<pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--s0)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--line)" stroke-width="2"/></pattern>`);
const statePaths = gStates.selectAll("path").data(fc.features).join("path").attr("class", "st ghost").attr("d", path)
  .attr("tabindex", 0).attr("role", "button").attr("aria-label", f => `${byFips[f.id].name}, readiness ${Math.round(byFips[f.id].readiness_score)} of 100. Shift+Enter adds or removes it from the selection.`)
  .on("click", (e, f) => { e.stopPropagation(); if (e.shiftKey || e.metaKey || e.ctrlKey) toggleStateSel(byFips[f.id].abbr); else openState(byFips[f.id].abbr); })
  .on("keydown", (e, f) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (e.shiftKey) toggleStateSel(byFips[f.id].abbr); else openState(byFips[f.id].abbr); } })
  .on("mousemove", (e, f) => { const s = byFips[f.id]; tip(e, `<b>${esc(s.name)}</b> &middot; ${shadeLabel() + " " + Math.round(s[shadeKey])}<br><span class="note">${s.n_sites} clinics &middot; rank ${s.rank} of 51</span>`); })
  .on("mouseleave", hideTip);
// sort focus order by rank
statePaths.sort((a, b) => byFips[a.id].rank - byFips[b.id].rank);
function shadeLabel() { return {readiness_score: "Readiness", layer_experience: "Experience", layer_legal: "Legal path"}[shadeKey]; }
function paintStates() { statePaths.attr("fill", f => shadeFill(byFips[f.id][shadeKey])); }

// Clinic lights sit at ZIP centroids where known, else city centres. Clinics that share a point are spread on a golden-angle spiral.
const cityGroups = d3.group(SITES, s => s.lat + "," + s.lon);
for (const [, arr] of cityGroups) {
  arr.sort((a, b) => b.n_companies - a.n_companies || b.n_trials - a.n_trials);
  const p = proj([arr[0].lon, arr[0].lat]);
  arr.forEach((s, i) => { s.p = p; const r = i === 0 ? 0 : (isMobile() ? 4.6 : 7) * Math.sqrt(i), a = i * 2.39996 + 0.6; s.dx = r * Math.cos(a); s.dy = r * Math.sin(a); s.cityN = arr.length; });
}
const lightSites = SITES.filter(s => s.p);
const MOB = isMobile(), R = MOB ? [1.9, 2.4, 3.3, 4.4] : [2.5, 3.2, 4.6, 6.2];
const lights = gLights.selectAll("g.site").data(lightSites, s => s.i).join("g").attr("class", "site")
  .on("click", (e, s) => { e.stopPropagation(); openSite(s.i); })
  .on("mousemove", (e, s) => tip(e, `<b>${esc(s.facility)}</b><br>${esc(s.city)}, ${esc(s.state)} &middot; ${s.n_companies} compan${s.n_companies === 1 ? "y" : "ies"} &middot; ${s.n_trials} trial${s.n_trials > 1 ? "s" : ""}${s.unidentified ? " &middot; unidentified registry location" : ""}`))
  .on("mouseleave", hideTip);
lights.each(function (s) {
  const g = d3.select(this);
  if (s.tier >= 2) g.append("circle").attr("class", "halo").attr("r", R[s.tier] + 3);
  if (s.tier >= 3 && !MOB) g.append("circle").attr("class", "halo").attr("r", R[s.tier] + 6);
  g.append("circle").attr("class", "core").attr("r", R[s.tier]);
});
lights.sort((a, b) => a.n_companies - b.n_companies);
// City labels group clinics by city name and sit at the mean position of that city's clinics.
const CITIES = [...d3.group(SITES.filter(s => s.p), s => s.city.toLowerCase() + "|" + s.state).values()].map(a => ({city: a[0].city, state: a[0].state, n: a.length, members: a, p: [d3.mean(a, s => s.p[0]), d3.mean(a, s => s.p[1])]})).sort((a, b) => b.n - a.n);
const tags = gTags.selectAll("text").data(CITIES).join("text").attr("class", "ctag");
function placeLights() {
  const spread = Math.min(Math.max(T.k, 1), 3.2);
  lights.attr("transform", s => `translate(${T.applyX(s.p[0]) + s.dx * spread},${T.applyY(s.p[1]) + s.dy * spread})`);
  if (typeof BYO !== "undefined" && BYO) placeMine();
  if (typeof placeDissoc === "function") placeDissoc();
  // City labels. Normal view: cities with 6+ clinics, at low zoom only. One state selected: every city in it, any zoom.
  // Placed greedily so no two overlap (largest cities win).
  const one = F.state.size === 1 ? [...F.state][0] : null, placed = [];
  const litPts = one ? visible.filter(s => s.state === one && s.p).map(s => [T.applyX(s.p[0]) + s.dx * spread, T.applyY(s.p[1]) + s.dy * spread]) : [];
  // Counts always follow what is drawn: only clinics that pass the filters are counted.
  let _lit = null; const allLit = () => _lit || (_lit = visible.filter(s => s.p).map(s => [T.applyX(s.p[0]) + s.dx * spread, T.applyY(s.p[1]) + s.dy * spread]));
  const visN = d3.rollup(visible.filter(s => !one || s.state === one), v => v.length, s => s.city.toLowerCase() + "|" + s.state), filtered = anyFilter();
  tags.each(function (c) {
    const el = d3.select(this);
    const n = one && c.state !== one ? 0 : visN.get(c.city.toLowerCase() + "|" + c.state) || 0;
    const show = one ? n > 0 : (n >= (filtered ? 2 : 6) && T.k < 2.2 && !isMobile() && !F.state.size);
    if (!show) { el.attr("display", "none"); return; }
    const label = `${c.city} ${n}`, w = label.length * 6.3;
    let x, y, box, anchor = null;
    if (one) { // try above, below, right, left of the city's lights; take the first spot clear of lights and labels
      const xs = c.members.map(s => T.applyX(s.p[0]) + s.dx * spread), ys = c.members.map(s => T.applyY(s.p[1]) + s.dy * spread);
      const cx = (d3.min(xs) + d3.max(xs)) / 2, cy = (d3.min(ys) + d3.max(ys)) / 2, g = R[3] + 5;
      const cands = [[cx, d3.min(ys) - g, "middle"], [cx, d3.max(ys) + g + 9, "middle"], [d3.max(xs) + g, cy + 4, "start"], [d3.min(xs) - g, cy + 4, "end"]];
      const boxOf = ([px, py, an]) => an === "middle" ? [px - w / 2, py - 9, px + w / 2, py + 3] : an === "start" ? [px, py - 9, px + w, py + 3] : [px - w, py - 9, px, py + 3];
      const hit = bx => placed.some(q => !(bx[2] < q[0] || bx[0] > q[2] || bx[3] < q[1] || bx[1] > q[3])) || litPts.some(([lx, ly]) => lx > bx[0] - 3 && lx < bx[2] + 3 && ly > bx[1] - 3 && ly < bx[3] + 3);
      const pick = cands.find(cd => !hit(boxOf(cd))) || cands[0];
      [x, y] = pick; anchor = pick[2]; box = boxOf(pick);
    } else {
      // v1.7: label to the right of the city's lights; flip to the left when it would run past the map's right edge
      // (keeping clear of the details panel), and drop it if it still sits on a light.
      const off = 7 * Math.sqrt(Math.max(0, n - 1)) * spread + R[3] + 6, cx = T.applyX(c.p[0]); y = T.applyY(c.p[1]) + 3;
      const rightEdge = (svg.node().clientWidth || innerWidth) - (document.querySelector("#drawer.open") && !isMobile() ? 420 : 0) - 12;
      if (cx + off + w > rightEdge) { x = cx - off; anchor = "end"; box = [x - w, y - 9, x, y + 3]; } else { x = cx + off; box = [x, y - 9, x + w, y + 3]; }
    }
    const pad = R[3] + 1, dotHit = !one && allLit().some(([lx, ly]) => lx > box[0] - pad && lx < box[2] + pad && ly > box[1] - pad && ly < box[3] + pad);
    const ok = !dotHit && !placed.some(b => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
    if (ok) placed.push(box);
    el.attr("x", x).attr("y", y).attr("text-anchor", anchor).text(label).classed("in", !!one).attr("display", ok ? null : "none");
  });
}
let colourBy = "tier";
const COLOURS = {
  tier: {label: "Companies worked with", fn: s => ["--t0", "--t1", "--t2", "--t3"][s.tier], hollow: s => s.tier === 0, items: [["--t0", "None (academic or investigator trials only)", 0, 1], ["--t1", "1 company", 1], ["--t2", "2 to 3 companies", 2], ["--t3", "4+ companies (most experienced)", 3]]},
  status: {label: "Recruiting now", fn: s => s.sgroup === "Recruiting" ? "--rec" : "--closed", hollow: s => s.sgroup !== "Recruiting", items: [["--rec", "Recruiting now"], ["--closed", "Not recruiting", 0, 1]]},
};
function paintLights() {
  const c = COLOURS[colourBy];
  lights.each(function (s) {
    const col = css(c.fn(s)), g = d3.select(this);
    g.select(".core").attr("fill", col).attr("stroke", c.hollow(s) ? col : null);
    g.selectAll(".halo").attr("stroke", col);
    g.classed("hol", c.hollow(s));
  });
}
function applyVisibility() {
  const vis = new Set(visible.map(s => s.i));
  lights.classed("off", s => !vis.has(s.i)).classed("dim", s => lens && !s.developers.includes(lens)).classed("lens", s => lens && s.developers.includes(lens));
  if (lens) lights.filter(s => s.developers.includes(lens)).raise();
}
// v1.7.2: the legend is collapsible, collapsed by default below 1600px wide, so it never covers lights at first view.
let lgOpen = innerWidth >= 1600;
function legend() {
  const c = COLOURS[colourBy], seq = SEQ();
  const head = `<button class="lghead" id="lgtoggle" aria-expanded="${lgOpen}" aria-controls="lgbody"><span class="caps" style="color:var(--ink)">Legend</span><span class="lgmini" aria-hidden="true">${seq.slice(1).map(x => `<span style="background:${x}"></span>`).join("")}</span><span class="lgchev" aria-hidden="true">${lgOpen ? "&minus;" : "+"}</span></button>`;
  $("#legend").classList.toggle("closed", !lgOpen);
  // v1.7.2: the legal-layer warning stays visible, in short form, when the legend is collapsed.
  if (!lgOpen) { $("#legend").innerHTML = head + `<p class="legalwarn" id="maplegalwarn" style="margin:4px 0 0;max-width:270px;font-size:11.5px">${legalLine()}</p>`; return; }
  let h = `<div class="caps lgtitle">States: ${shadeLabel()}</div>`;
  h += `<div class="ramp" aria-hidden="true">${seq.map(x => `<span style="background:${x}"></span>`).join("")}</div><div class="lg" style="justify-content:space-between;margin-top:0"><span>0</span><span>100</span></div>`;
  h += `<label class="lg" style="margin-top:6px"><span class="sr">Shade states by</span><select class="ctl" id="shade" style="padding:3px 6px;font-size:12px">${[["readiness_score", "Readiness score"], ["layer_experience", "Layer: trial experience"], ["layer_legal", "Layer: legal path"]].map(([k, t]) => `<option value="${k}" ${k === shadeKey ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  h += `<div class="caps lgtitle" style="margin-top:10px">Clinics: colour by</div><div class="colorby" role="group" aria-label="Colour clinics by">${Object.entries(COLOURS).map(([k, v]) => `<button aria-pressed="${k === colourBy}" data-c="${k}">${v.label}</button>`).join("")}</div>`;
  h += c.items.map(([v, t, tier, hol]) => { const r = tier ? R[tier] : 4.2; return `<div class="lg"><svg width="22" height="18" aria-hidden="true">${tier >= 2 ? `<circle cx="11" cy="9" r="${r + 3}" fill="none" stroke="${css(v)}" opacity=".55"/>` : ""}<circle cx="11" cy="9" r="${r}" fill="${hol ? "none" : css(v)}" stroke="${css(v)}" stroke-width="${hol ? 1.6 : 0}"/></svg>${t}</div>`; }).join("");
  if (colourBy !== "tier") h += `<div class="note">Size shows the number of companies.</div>`;
  if (disShow) h += `<div class="lg"><svg width="22" height="18" aria-hidden="true"><rect x="7" y="5" width="8" height="8" transform="rotate(45 11 9)" fill="none" stroke="${css("--d-dis")}" stroke-width="1.6"/></svg>Ketamine or esketamine (not counted)</div>`;
  h += `<div class="note" style="margin-top:4px">Lights sit at ZIP centres where the registry gives a ZIP, else city centres.</div>`;
  h += `<div class="caps lgtitle" style="margin-top:10px">Legal path scores</div><div class="lgkey">${[["c100", "Own program or trigger law", 100], ["c75", "Follow-federal", 75], ["c50", "Regulator must act", 50], ["c25", "Legislature must act", 25]].map(([c, t, v]) => `<span class="lchip ${c}" title="${esc(glossDef(t === "Own program or trigger law" ? "Trigger or conditional law" : t === "Follow-federal" ? "General follow-federal rule" : t))}">${t}<span class="lsc mono">${v}</span></span>`).join("")}</div>`;
  h += `<p class="legalwarn" id="maplegalwarn" style="margin:6px 0 0;max-width:330px">${legalLine()}</p>`;
  if (typeof BYO !== "undefined" && BYO) h += `<div class="caps lgtitle" style="margin-top:10px">Your sites</div><div class="lg"><svg width="22" height="18" aria-hidden="true"><path d="M11,3L17,9L11,15L5,9Z" fill="var(--bg)" stroke="var(--ink)" stroke-width="1.6"/></svg>Not matched</div><div class="lg"><svg width="22" height="18" aria-hidden="true"><path d="M11,3L17,9L11,15L5,9Z" fill="var(--accent)" stroke="var(--bg)"/></svg>Matched to an atlas clinic</div><button class="btn" id="lgbyo" style="margin-top:4px;padding:2px 8px;font-size:12px" aria-pressed="${byoShow}">${byoShow ? "Hide" : "Show"} my sites</button>`;
  $("#legend").innerHTML = head + `<div id="lgbody">${h}</div>`;
}
let disShow = false;
const gDis = svg.append("g").attr("id", "dissoc").attr("display", "none").attr("aria-label", "Dissociative layer: ketamine and esketamine psychiatric trial locations");
DISSOC.forEach(d => { d.p = proj([d.lon, d.lat]); });
const disMarks = gDis.selectAll("rect").data(DISSOC.filter(d => d.p)).join("rect").attr("width", 6).attr("height", 6).attr("x", -3).attr("y", -3)
  .attr("fill", "none").attr("stroke", "var(--d-dis)").attr("stroke-width", 1.4).style("cursor", "default")
  .on("mousemove", (e, d) => tip(e, `<b>${esc(d.facility)}</b><br>${esc(d.city)}, ${esc(d.state)} &middot; ${d.n_trials} ketamine or esketamine trial${d.n_trials > 1 ? "s" : ""}${d.companies.length ? " &middot; " + d.companies.map(esc).join(", ") : ""}<br><span class="note">Dissociative layer: not in any count or score</span>`))
  .on("mouseleave", hideTip);
function placeDissoc() { if (disShow) disMarks.attr("transform", d => `translate(${T.applyX(d.p[0])},${T.applyY(d.p[1])}) rotate(45)`); }
$("#disn").textContent = DISSOC.length;
$("#lgdis").addEventListener("click", () => { disShow = !disShow; $("#lgdis").setAttribute("aria-pressed", String(disShow)); gDis.attr("display", disShow ? null : "none"); placeDissoc(); legend(); accCounts(); });
$("#legend").addEventListener("click", e => { if (e.target.closest("#lgtoggle")) { lgOpen = !lgOpen; legend(); return; } if (e.target.id === "lgbyo") { byoShow = !byoShow; d3.select("#mine").attr("display", byoShow ? null : "none"); legend(); if (drawerMode === "byo") openByo(false); return; } const b = e.target.closest("[data-c]"); if (b) { colourBy = b.dataset.c; paintLights(); legend(); } });
$("#legend").addEventListener("change", e => { if (e.target.id === "shade") { shadeKey = e.target.value; paintStates(); legend(); } });

/* ---------- summary strip ---------- */
const shown = {};
function countUp(el, to) {
  const from = shown[el.id] ?? 0; shown[el.id] = to;
  if (RM || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), d = 520;
  const step = now => { const p = Math.min(1, (now - t0) / d), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
let compare = [];
function strip() {
  const tr = new Set(visible.flatMap(s => matchedTrials(s).map(t => t.nct)));
  const comp = new Set(visible.flatMap(s => matchedTrials(s).filter(t => t.company).map(t => t.sponsor)));
  const figs = [["fc", visible.length, "clinics" + (anyFilter() ? " match" : "")], ["ft", tr.size, "trials"], ["fco", comp.size, "companies"], ["fs", new Set(visible.map(s => s.state)).size, "states"],
    ["fr", visible.filter(s => matchedTrials(s).some(t => recruitingHere(s, t))).length, "recruiting now"], ["fv", visible.filter(s => s.tier === 3).length, "4+ companies"]];
  if (!$("#fc")) $("#strip").innerHTML = figs.map(([id, , k]) => `<div class="fig" title="${{fc: "Clinics on the map", ft: "Trials at those clinics", fco: "Companies (industry lead sponsors)", fs: "States with at least one clinic", fr: "Clinics with a recruiting site record", fv: "Clinics that have worked with 4 or more companies"}[id]}"><div class="v mono" id="${id}">0</div><div class="k" id="${id}k">${k}</div></div>`).join("") + `<div class="cmp" id="cmptray"></div>`;
  figs.forEach(([id, v, k]) => { countUp($("#" + id), v); $("#" + id + "k").textContent = k; });
  if (!visible.length) $("#fck").innerHTML = `clinics match. <a href="#" id="clr0">Clear filters</a>`;
  const tray = $("#cmptray");
  const selN = F.state.size, offer = selN >= 2 && selN <= 3 && [...F.state].sort().join() !== compare.slice().sort().join();
  if (offer) { tray.innerHTML = `<span class="caps">${selN} states</span><button class="btn primary" id="cmpthese2">Compare these states</button>`; return; }
  tray.innerHTML = compare.length ? `<span class="caps">Compare</span>${compare.map(a => `<span class="chip">${a}</span>`).join("")}<button class="btn primary" id="cmpgo">Open</button>` : "";
}
$("#strip").addEventListener("click", e => {
  if (e.target.id === "clr0") { e.preventDefault(); $("#clearall").click(); }
  if (e.target.id === "cmpgo") openCompare();
  if (e.target.id === "cmpthese2") { compare = [...F.state]; statePaths.classed("cmp", f => compare.includes(byFips[f.id].abbr)); strip(); renderStateTable(); openCompare(); }
});

/* ---------- sponsor lens ---------- */
/* v1.7.3: "All companies". Companies with clinics are the lens (one at a time, as before). Companies the build
   searched for that have no clinics on the map are listed at 0, greyed, and can only be inspected: each has an info box
   with what the registry holds (company_registry_report.csv). Alias rows (renamed companies) are not listed twice. */
const CO_COUNT = c => SITES.filter(s => s.developers.includes(c)).length;
const CO_WITH = DEVELOPERS.map(c => [c, CO_COUNT(c)]).sort((a, b) => b[1] - a[1] || sponsorName(a[0]).localeCompare(sponsorName(b[0])));
const CO_REPORT_OF = {}; COREP.forEach(r => (r.registry || []).forEach(n => { if (!r.alias) (CO_REPORT_OF[n] = CO_REPORT_OF[n] || []).push(r.company); }));
const CO_ZERO = COREP.filter(r => !r.alias && !(r.registry || []).some(n => DEVELOPERS.includes(n) && CO_COUNT(n) > 0)).sort((a, b) => a.company.localeCompare(b.company));
function renderCompanies() {
  $("#colist").innerHTML = `<div class="cocap">With clinics on the map (click to highlight)</div>` + CO_WITH.map(([c, n]) => `<button class="opt co" aria-pressed="${lens === c}" data-co="${esc(c)}" data-report="${esc((CO_REPORT_OF[c] || []).join("|"))}"><span class="box rad"></span><span>${esc(sponsorName(c))}</span><span class="n">${n}</span></button>`).join("")
    + `<div class="cocap">Searched, no clinics on the map</div>` + CO_ZERO.map((r, i) => `<div class="cz"><button class="opt zero coi" aria-expanded="false" aria-controls="coi${i}" aria-describedby="coi${i}" data-report="${esc(r.company)}"><span class="box" aria-hidden="true">i</span><span>${esc(r.company)}</span><span class="n">0</span></button><div class="cotip" id="coi${i}" role="tooltip">${esc(r.tip)}</div></div>`).join("");
}
renderCompanies();
$("#colist").addEventListener("click", e => {
  const z = e.target.closest(".coi"); if (z) { const o = z.getAttribute("aria-expanded") !== "true"; $("#colist").querySelectorAll(".coi").forEach(x => x.setAttribute("aria-expanded", "false")); z.setAttribute("aria-expanded", String(o)); return; }
  const b = e.target.closest("[data-co]"); if (b) setLens(lens === b.dataset.co ? "" : b.dataset.co, lens !== b.dataset.co);
});
$("#colist").addEventListener("keydown", e => { if (e.key === "Escape") { const z = e.target.closest(".coi"); if (z) z.setAttribute("aria-expanded", "false"); } });
document.addEventListener("click", e => { const g = e.target.closest("[data-goto]"); if (!g) return; e.preventDefault(); const id = g.dataset.goto; location.hash = "#methods"; setTimeout(() => { const el = document.getElementById(id); if (el) { const d = el.closest("details"); if (d) d.open = true; el.scrollIntoView({block: "start"}); } }, 120); });
function lensSites() { return SITES.filter(s => s.developers.includes(lens)); }
function setLens(c, open) {
  lens = c; $("#lensbox").classList.toggle("on", !!c);
  $("#colist").querySelectorAll("[data-co]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.co === c)));
  if (c) setAcc("co", true);
  accCounts();
  if (c) {
    const k = compStats(c);
    $("#lensn").textContent = `${k.n} clinic${k.n === 1 ? "" : "s"}`;
    $("#lenssub").innerHTML = `In ${k.states} state${k.states === 1 ? "" : "s"}. ${k.recMine} recruiting for ${esc(sponsorName(c))} now.`;
    if (open) openLens();
  }
  applyVisibility(); renderClinicTable();
}
$("#lensclear").onclick = () => { setLens(""); if (drawerMode === "lens") closeDrawer(); };
$("#lensopen").onclick = () => openLens();
$("#lenscopy").onclick = () => copyCSV(lensSites(), `${sponsorName(lens)} sites`);

/* ---------- drawer ---------- */
let drawerMode = null, selState = null, selSite = null;
function openDrawer(title, body, mode) {
  drawerMode = mode; $("#dtitle").innerHTML = title; $("#dbody").innerHTML = body; $("#dbody").scrollTop = 0;
  const d = $("#drawer"); d.dataset.mode = mode; d.classList.add("open"); d.setAttribute("aria-hidden", "false");
  // v1.7.2: every table in the panel sits in a scroller; if it overflows, a "Scroll →" cue shows.
  $("#dbody").querySelectorAll("table").forEach(t => { if (!t.parentElement.classList.contains("tscroll")) { const w = document.createElement("div"); w.className = "tscroll"; t.replaceWith(w); w.appendChild(t); } });
  requestAnimationFrame(() => $("#dbody").querySelectorAll(".tscroll").forEach(w => w.classList.toggle("more", w.scrollWidth > w.clientWidth + 1)));
  if (isMobile()) setSheet(sheetH || innerHeight * 0.46);
}
function closeDrawer() {
  const d = $("#drawer"); d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); drawerMode = null;
  selState = selSite = null; statePaths.classed("sel", false); lights.classed("sel", false);
}
$("#dclose").onclick = closeDrawer;
function flyTo(t, dur = 750) { svg.transition().duration(RM ? 0 : dur).ease(d3.easeCubicInOut).call(zoom.transform, t); }
function layerBar(name, v) {
  return v === "" || v == null ? `<div class="lbar"><span>${name}</span><span class="tr nodata" title="No data yet"></span><span class="v">n/a</span></div>`
    : `<div class="lbar"><span>${name}</span><span class="tr"><span class="fl" style="width:${v}%"></span></span><span class="v">${Math.round(v)}</span></div>`;
}
function openState(abbr, fly = true) {
  const s = byAbbr[abbr]; if (!s) return;
  selState = abbr; selSite = null; lights.classed("sel", false); statePaths.classed("sel", f => byFips[f.id].abbr === abbr);
  const nbs = [s, ...(s.neighbours || [])].sort((a, b) => a.rank - b.rank);
  const clin = SITES.filter(x => x.state === abbr).sort((a, b) => b.n_companies - a.n_companies || b.n_trials - a.n_trials);
  const inCmp = compare.includes(abbr);
  const body = `
  <div class="sec"><div class="score"><span class="num">${Math.round(s.readiness_score)}</span><span class="of">/ 100 readiness &middot; rank ${s.rank} of 51${deltaHTML(s)}${isDefaultW() ? "" : ` <span class="note">(default rank ${s.base_rank})</span>`}</span></div>
    ${layerBar("Trial experience", s.layer_experience)}${layerBar("Legal path", s.layer_legal)}
    <div class="note">Layers are scaled 0 to 100 across states. ${esc(weightsLine())}.</div>
    <div style="margin-top:10px;display:flex;gap:8px"><button class="btn${inCmp ? "" : " primary"}" data-cmp="${abbr}">${inCmp ? "Remove from compare" : "Add to compare"}</button><button class="btn" data-filter-state="${abbr}">Show only this state</button></div></div>
  <div class="sec" id="stlegal"><h3 class="caps">Legal path after rescheduling</h3>
    ${s.legal ? `<div class="lhead">${legalChip(s)}</div>
    <div class="llinks">${citesHTML(s)}</div>
    <p style="margin:6px 0;color:var(--ink-2);font-size:13px">${esc(s.legal.detail)}</p>
    ${s.legal.note ? `<p class="note lnote" style="margin:4px 0 0">${esc(s.legal.note)}</p>` : ""}
    ${s.legal.drugs.length ? `<p class="note ldrugs" style="margin:4px 0 0">Drugs covered: ${esc(s.legal.drugs.join(", "))}</p>` : ""}
    ${s.legal.footnote ? `<p class="note lfoot" style="margin:6px 0 0">${esc(s.legal.footnote)}</p>` : ""}`
    : `<div class="lhead"><span class="lchip nyc">${NYC}<span class="lsc mono">0</span></span></div><p class="note" style="margin:6px 0 0">Nobody has read this state's law for the atlas yet, so it scores 0 on the legal path.</p>`}</div>
  <div class="sec"><h3 class="caps">Against its neighbours</h3><ul class="list">${nbs.map(n => `<li><button data-state="${n.abbr}" ${n === s ? 'style="color:var(--accent)"' : ""}><span class="mono" style="width:24px;color:var(--ink-3)">${n.rank}</span>${esc(n.name)}<span class="n">${Math.round(n.readiness_score)}</span></button></li>`).join("") || "<li class='note'>No land neighbours</li>"}</ul></div>
  <div class="sec"><h3 class="caps">Facts</h3><dl class="kv">
    <dt>Trial clinics</dt><dd class="mono">${s.n_sites} &middot; ${s.n_sites_2plus} with 2+ companies &middot; ${s.n_sites_4plus} with 4+</dd>
    <dt>Trials</dt><dd class="mono">${s.n_trials} &middot; ${s.n_industry_trials} company-sponsored</dd>
    <dt>Recruiting clinics</dt><dd class="mono">${s.n_recruiting_sites}</dd>
    <dt>Population (2019)</dt><dd><span class="mono">${fmt(s.population_2019_context_only)}</span> <span class="note">context only, not scored</span></dd>
</dl></div>
  <div class="sec"><h3 class="caps">Clinics in ${esc(s.name)} (${clin.length})</h3>${clin.length ? `<ul class="list">${clin.map(c => `<li><button data-site="${c.i}"><span>${esc(c.facility)}<br><span class="note">${esc(c.city)}</span></span><span class="n">${c.n_sponsors} sp &middot; ${c.n_trials} tr</span></button></li>`).join("")}</ul>` : `<p class="note">No clinic in ${esc(s.name)} has run a registered psychedelic trial yet.</p>`}</div>
  ${capCalc("state", Math.max(1, s.n_sites_2plus * 2))}`;
  openDrawer(`<div class="caps">State</div><h2>${esc(s.name)}</h2>`, body, "state");
  if (fly) flyTo(fitTransform(path.bounds(featByAbbr[abbr]), 7, 24, true));
}
function openSite(i, fly = false) {
  const s = SITES[i]; selSite = i; selState = null; statePaths.classed("sel", false); lights.classed("sel", x => x.i === i);
  const tr = s.trials.slice().sort((a, b) => (b.start || "").localeCompare(a.start || ""));
  // v1.9 (D81): one row per sponsor with its drug(s) and how many of its trials are recruiting here.
  const spRow = (n, cls) => { const ts = s.trials.filter(t => t.sponsor === n), dr = [cmpdText(ts)].filter(Boolean), rc = ts.filter(t => statusHere(s, t) === "Recruiting").length, dev = s.developers.includes(n);
    return `<li><button class="corow" data-lens="${dev ? esc(n) : ""}" ${dev ? "" : "disabled"}><span><b>${esc(sponsorName(n))}</b>: ${esc(dr.join(", ") || "drug not listed")}${cls && !sponsorName(n).toLowerCase().includes(cls) ? ` <span class="note">(${esc(cls)})</span>` : ""}${SPNOTE[n] ? `<br><span class="note">${esc(SPNOTE[n])}</span>` : ""}</span><span class="n">${ts.length} trial${ts.length === 1 ? "" : "s"}${rc ? ` &middot; <span class="recn">${rc} recruiting</span>` : ""}</span></button></li>`; };
  const others = s.sponsors.filter(n => !s.companies.includes(n));
  const coSec = `<div class="sec" id="cosec"><p class="defs"><b>Recruiting</b> means the registry says the trial is recruiting at this clinic. <b>Not recruiting</b> is every other case, including trials that give no status for this clinic.</p>
   <h3 class="caps">Companies here (${s.companies.length})</h3>${s.companies.length ? `<ul class="list">${s.companies.map(n => spRow(n)).join("")}</ul>` : `<p class="note">No company has run a trial here. The sponsors are universities, hospitals or non-profits.</p>`}
   ${others.length ? `<h3 class="caps" style="margin-top:10px">Other sponsors (${others.length})</h3><ul class="list">${others.map(n => spRow(n, spClass(n).toLowerCase())).join("")}</ul>` : ""}
   ${s.own_sponsors.length ? `<h3 class="caps" style="margin-top:10px">This clinic's own trials</h3><ul class="list">${s.own_sponsors.map(n => spRow(n)).join("")}</ul><div class="note">Run by the clinic's own institution, so not counted as a sponsor.</div>` : ""}
   ${s.companies.some(n => s.developers.includes(n)) ? `<div class="note" style="margin-top:6px">Click a company to light up every clinic it has used.</div>` : ""}</div>`;
  // v1.9.2 (D89): more detail, in two columns on wide screens. Only what the registry lists for this site; no personal contact details.
  const hereLbl = t => { const st = s.site_status[t.nct]; return `${statusHere(s, t)}${st ? "" : ' <span class="note">(no site record; trial status)</span>'}`; };
  const trialCard = t => { const co = s.companies.includes(t.sponsor);
    return `<div class="trial tcard"><div class="tt">${esc(t.title)}</div><dl class="kv tkv"><dt>Phase</dt><dd>${esc(t.phases.join("/"))}</dd><dt>Status here</dt><dd>${hereLbl(t)}</dd><dt>Start</dt><dd class="mono">${esc(t.start || "not listed")}</dd>
      <dt>${co ? "Company" : "Sponsor"}</dt><dd>${esc(sponsorName(t.sponsor))}${co ? "" : ` <span class="note">(${esc(spClass(t.sponsor).toLowerCase())})</span>`}${SPNOTE[t.sponsor] ? `<br><span class="note">${esc(SPNOTE[t.sponsor])}</span>` : ""}</dd><dt>Compound</dt><dd>${esc(cmpdText([t]) || "not listed")}</dd>
      <dt>Registry</dt><dd><a class="mono" href="https://clinicaltrials.gov/study/${t.nct}" target="_blank" rel="noopener">${t.nct}</a></dd></dl></div>`; };
  const locSec = `<div class="sec" id="locsec"><h3 class="caps">Location</h3><dl class="kv"><dt>Facility</dt><dd>${esc(s.facility)}</dd><dt>City</dt><dd>${esc(s.city)}</dd><dt>State</dt><dd>${esc(byAbbr[s.state].name)} (${s.state})</dd><dt>ZIP</dt><dd class="mono">${esc(s.zip || "not listed")}</dd></dl></div>`;
  const body = `<div class="sitegrid"><div class="scol">${siteInsight(s)}${locSec}${coSec}
  <div class="sec"><dl class="kv"><dt>Companies</dt><dd class="mono">${s.n_companies}</dd><dt>Other sponsors</dt><dd class="mono">${s.n_other}${s.own_sponsors.length ? " (own institution not counted)" : ""}</dd><dt>Trials</dt><dd class="mono">${s.n_trials} &middot; ${s.n_recruiting} recruiting here</dd>
    <dt>Site records</dt><dd>${s.n_site_status} of ${s.n_trials} trials give a status for this location. Recruiting counts only those that say recruiting.</dd>
    <dt>Status</dt><dd>${esc(STATUS_LABEL[s.sgroup])}</dd><dt>Drugs</dt><dd>${s.drugs.map(d => `<span class="chip">${esc(d)}</span>`).join(" ")}</dd><dt>Phases</dt><dd>${esc(s.phases)}</dd></dl></div>
  ${competitionHTML(s)}</div><div class="scol">
  <div class="sec" id="trialsec"><h3 class="caps">Trials at this clinic (${tr.length})</h3><p class="note" style="margin-top:0">Newest first. Status here is the registry's status for this clinic where it gives one.</p>${tr.map(trialCard).join("")}</div>
  ${capCalc("clinic")}
  ${s.name_variants ? `<div class="sec note">The registry spells this clinic as: ${esc(s.name_variants)}</div>` : ""}
  <div class="sec note">Facts from ClinicalTrials.gov only. The atlas does not rate clinics. ${s.located_by === "ZIP" ? `Position is the centre of ZIP area ${esc(s.zip)} (Census 2016), not the building.` : `Position is the city centre: ${esc(s.loc_why || "no usable ZIP")}.`}</div></div></div>`;
  openDrawer(`<div class="caps">Clinic</div><h2>${esc(s.facility)}</h2><div class="meta">${esc(s.city)}, <a href="#" data-state="${s.state}">${esc(byAbbr[s.state].name)}</a><span class="loc" title="How this clinic is placed on the map">${s.located_by === "ZIP" ? `Located by ZIP ${esc(s.zip)}` : "Located by city"}</span></div><a class="btn primary openfull" href="#clinic/${esc(s.id)}">Open full page</a>${s.unidentified ? `<p class="note warnnote">Unidentified registry location: the registry gives only the sponsor's site label, not a clinic name. It may be the same place as a named clinic in ${esc(s.city)}.</p>` : ""}`, body, "site");
  if (fly && s.p) { const k = Math.max(T.k, 7), f = frame(); flyTo(d3.zoomIdentity.translate((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2).scale(k).translate(-s.p[0], -s.p[1])); }
}
function openLens() {
  if (!lens) return;
  const ss = lensSites(), byS = d3.group(ss, s => s.state), a = alias[lens];
  const lt = Object.values(TRIALS).filter(t => t.sponsor === lens).sort((x, y) => (y.start || "").localeCompare(x.start || ""));
  const states = [...byS.entries()].sort((x, y) => y[1].length - x[1].length);
  const body = `${lensInsight(lens)}${overlapHTML(lens)}
  <div class="sec">${a && a.note && !/as written/.test(a.note) ? `<p class="note" style="margin-top:0">${esc(a.note)}</p>` : ""}
   <div style="display:flex;gap:8px"><button class="btn primary" id="lenscopy2">Download clinics as CSV</button><button class="btn" id="lensfit">Fit map to clinics</button></div></div>
  <div class="sec"><h3 class="caps">Registered trials (${lt.length})</h3>${lt.map(t => `<div class="trial"><div class="t1"><a class="mono" href="https://clinicaltrials.gov/study/${t.nct}" target="_blank" rel="noopener">${t.nct}</a><span class="chip">${esc(t.drugs.join(", "))}</span><span class="chip">Ph ${esc(t.phases.join("/"))}</span><span class="note">${esc(prettyStatus(t.status))}</span></div><div class="t2">${esc(t.title)}</div></div>`).join("")}</div>
  <div class="sec"><h3 class="caps">Clinics by state</h3>${states.map(([st, arr]) => { const s = byAbbr[st], [bc, bt] = legalBadge(s); return `<div style="margin:10px 0 2px;display:flex;gap:8px;align-items:center"><button class="btn" data-state="${st}" style="padding:2px 8px">${esc(s.name)}</button><span class="mono note">${arr.length}</span><span class="note">${legalShortHTML(s)}</span></div><ul class="list">${arr.sort((x, y) => y.n_companies - x.n_companies).map(c => `<li><button data-site="${c.i}"><span>${esc(c.facility)} <span class="note">${esc(c.city)}</span></span><span class="n">${plural(c.n_companies, "company", "companies")}</span></button></li>`).join("")}</ul>`; }).join("")}</div>`;
  openDrawer(`<div class="caps">Company lens</div><h2>${esc(sponsorName(lens))}</h2><div class="meta">Registry name: ${esc(lens)}</div>`, body, "lens");
  fitLens();
}
function fitLens() { const ls = lensSites(), pts = ls.filter(s => s.p).map(s => s.p); if (!pts.length) return;
  if (new Set(ls.map(s => s.state)).size === 1) return flyTo(fitTransform(path.bounds(featByAbbr[ls[0].state]), 7, 24, true)); // one state: show the whole state, not empty sea
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); flyTo(fitTransform([[d3.min(xs), d3.min(ys)], [d3.max(xs), d3.max(ys)]], 4, 40)); }
function openCompare(fly = true) {
  if (!compare.length) return;
  const ss = compare.map(a => byAbbr[a]);
  const mini = v => v === "" || v == null ? `<div class="ib"><span class="tr" style="background:repeating-linear-gradient(135deg,var(--panel-2) 0 4px,var(--line) 4px 6px)"></span><span class="v">n/a</span></div>` : `<div class="ib"><span class="tr"><span class="fl" style="width:${v}%"></span></span><span class="v">${Math.round(v)}</span></div>`;
  const best = (f, hi = true) => { const v = ss.map(f); const m = hi ? Math.max(...v) : Math.min(...v); return v.map(x => ss.length > 1 && x === m); };
  const rows = [["Readiness", s => `<span style="font:500 30px/1 var(--serif)">${Math.round(s.readiness_score)}</span>`, best(s => s.readiness_score)],
    ["Rank", s => `<span class="mono">${s.rank} of 51</span>${deltaHTML(s)}`], ["Experience", s => mini(s.layer_experience)], ["Legal layer", s => mini(s.layer_legal)],
    ["Clinics", s => `<span class="mono">${s.n_sites}</span>`, best(s => s.n_sites)], ["With 2+ companies", s => `<span class="mono">${s.n_sites_2plus}</span>`, best(s => s.n_sites_2plus)], ["With 4+ companies", s => `<span class="mono">${s.n_sites_4plus}</span>`],
    ["Trials (company)", s => `<span class="mono">${s.n_trials} (${s.n_industry_trials})</span>`], ["Legal path", s => legalCellHTML(s, "<br>")],
    ["Population (context)", s => `<span class="mono">${fmt(s.population_2019_context_only)}</span>`]];
  const body = `<table class="grid cmpt" style="table-layout:fixed;margin-top:6px"><thead><tr><th style="width:96px"></th>${ss.map(s => `<th style="text-transform:none;letter-spacing:0;font:500 16px var(--serif);color:var(--ink)"><button data-state="${s.abbr}" style="color:inherit">${esc(s.name)}</button></th>`).join("")}</tr></thead>
  <tbody>${rows.map(([k, f, b]) => `<tr><td class="note">${k}</td>${ss.map((s, i) => `<td${b && b[i] ? ' style="box-shadow:inset 2px 0 0 var(--accent)"' : ""}>${f(s)}</td>`).join("")}</tr>`).join("")}
  <tr><td></td>${ss.map(s => `<td><button class="btn" data-uncmp="${s.abbr}">Remove</button></td>`).join("")}</tr></tbody></table>
  <p class="note" style="margin-top:12px">An accent bar marks the highest value in a row. Add states from a state profile or the States view, up to 3.</p>`;
  openDrawer(`<div class="caps">Compare</div><h2>${ss.map(s => esc(s.abbr)).join(" &middot; ")}</h2>`, body, "compare");
  statePaths.classed("cmp", f => compare.includes(byFips[f.id].abbr));
  const b = ss.map(s => path.bounds(featByAbbr[s.abbr])); if (fly) flyTo(fitTransform([[d3.min(b, x => x[0][0]), d3.min(b, x => x[0][1])], [d3.max(b, x => x[1][0]), d3.max(b, x => x[1][1])]], 6, 30, true));
}
function toggleCompare(a) {
  if (compare.includes(a)) compare = compare.filter(x => x !== a); else { if (compare.length >= 3) compare.shift(); compare.push(a); }
  statePaths.classed("cmp", f => compare.includes(byFips[f.id].abbr)); strip(); renderStateTable();
}
$("#drawer").addEventListener("click", e => {
  const b = e.target.closest("[data-state],[data-site],[data-lens],[data-cmp],[data-uncmp],[data-filter-state],#lenscopy2,#lensfit,#cmpthese,#selcopy,#selclear"); if (!b) return;
  if (b.id === "cmpthese") { e.preventDefault(); compare = [...F.state].slice(0, 3); statePaths.classed("cmp", f => compare.includes(byFips[f.id].abbr)); strip(); renderStateTable(); return openCompare(); }
  if (b.id === "selclear") { e.preventDefault(); return setStates([]); }
  if (b.id === "selcopy") { e.preventDefault(); return copyRows([...F.state].map(a => byAbbr[a]).sort((x, y) => x.rank - y.rank), [["state", s => s.name], ["rank", s => s.rank], ["readiness_score", s => Math.round(s.readiness_score)], ["clinics", s => s.n_sites], ["clinics_2plus_sponsors", s => s.n_sites_2plus], ["legal_path", s => s.legal_category]], "selected states"); }
  e.preventDefault();
  if (b.dataset.state) openState(b.dataset.state);
  else if (b.dataset.site) openSite(+b.dataset.site, true);
  else if (b.dataset.lens) setLens(b.dataset.lens, true);
  else if (b.dataset.cmp) { toggleCompare(b.dataset.cmp); compare.length > 1 ? openCompare() : openState(b.dataset.cmp, false); }
  else if (b.dataset.uncmp) { toggleCompare(b.dataset.uncmp); compare.length ? openCompare() : closeDrawer(); }
  else if (b.dataset.filterState) setStates([b.dataset.filterState]);
  else if (b.id === "lenscopy2") copyCSV(lensSites(), `${sponsorName(lens)} sites`);
  else if (b.id === "lensfit") fitLens();
});
$("#dtitle").addEventListener("click", e => { const b = e.target.closest("[data-state]"); if (b) { e.preventDefault(); openState(b.dataset.state); } });

// Mobile bottom sheet: drag the handle; snaps to peek, half and full.
let sheetH = 0;
function setSheet(h) { const max = innerHeight * 0.88; sheetH = Math.max(120, Math.min(max, h)); $("#drawer").style.setProperty("--sheet", sheetH + "px"); }
(() => {
  const hd = $("#handle"); let y0 = null, h0 = 0, moved = false;
  hd.addEventListener("pointerdown", e => { y0 = e.clientY; h0 = sheetH || innerHeight * 0.46; moved = false; hd.setPointerCapture(e.pointerId); $("#drawer").classList.add("dragging"); });
  hd.addEventListener("pointermove", e => { if (y0 == null) return; if (Math.abs(e.clientY - y0) > 4) moved = true; setSheet(h0 + (y0 - e.clientY)); });
  hd.addEventListener("pointerup", () => {
    $("#drawer").classList.remove("dragging"); y0 = null;
    const snaps = [140, innerHeight * 0.46, innerHeight * 0.86];
    if (!moved) { const i = snaps.findIndex(s => Math.abs(s - sheetH) < 30); setSheet(snaps[(i + 1) % 3]); return; }
    if (sheetH < 110) return closeDrawer();
    setSheet(snaps.reduce((a, b) => Math.abs(b - sheetH) < Math.abs(a - sheetH) ? b : a));
  });
})();

/* ---------- tooltip ---------- */
const tipEl = $("#tip");
function tip(e, h) { if (isMobile()) return; tipEl.innerHTML = h; const x = Math.min(e.clientX + 14, innerWidth - tipEl.offsetWidth - 8); tipEl.style.left = x + "px"; tipEl.style.top = (e.clientY + 14) + "px"; tipEl.style.opacity = 1; }
function hideTip() { tipEl.style.opacity = 0; }

/* ---------- command palette ---------- */
const INDEX = [];
SITES.forEach(s => INDEX.push({type: "Clinics", label: s.facility, sub: `${s.city}, ${s.state}`, n: `${s.n_companies} co`, hay: (s.facility + " " + (s.name_variants || "") + " " + s.city).toLowerCase(), go: () => openSite(s.i, true)}));
[...d3.group(SITES, s => s.city + "|" + s.state)].forEach(([k, arr]) => { const [c, st] = k.split("|"); INDEX.push({type: "Cities", label: c, sub: byAbbr[st].name, n: `${arr.length} clinic${arr.length > 1 ? "s" : ""}`, hay: (c + " " + st).toLowerCase(), go: () => { const pts = arr.filter(s => s.p); if (pts.length) { const f = frame(); flyTo(d3.zoomIdentity.translate((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2).scale(9).translate(-pts[0].p[0], -pts[0].p[1])); } if (arr.length === 1) openSite(arr[0].i); else openState(st, false); }}); });
STATES.forEach(s => INDEX.push({type: "States", label: s.name, sub: `Readiness ${Math.round(s.readiness_score)}, rank ${s.rank}`, n: s.abbr, hay: (s.name + " " + s.abbr).toLowerCase(), go: () => openState(s.abbr)}));
const allSponsors = [...new Set(SITES.flatMap(s => s.sponsors))];
allSponsors.forEach(sp => { const n = SITES.filter(s => s.sponsors.includes(sp)).length, isCo = DEVELOPERS.includes(sp), a = alias[sp];
  INDEX.push({type: "Sponsors", label: sponsorName(sp), sub: (isCo ? "Opens company lens" : spClass(sp)) + (SPNOTE[sp] ? ". " + SPNOTE[sp] : ""), n: `${n} clinic${n > 1 ? "s" : ""}`, hay: (sp + " " + (a ? a.display_name + " " + a.also_known_as : "")).toLowerCase(), rank: isCo ? 1 : 0,
    go: () => { if (isCo) setLens(sp, true); else { const ss = SITES.filter(s => s.sponsors.includes(sp)); ss.length === 1 ? openSite(ss[0].i, true) : (F.state.size && setStates([]), openState(ss[0].state)); } }}); });
let palSel = 0, palItems = [];
function palSearch(q) {
  q = q.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  let res = !q ? [...INDEX.filter(x => x.type === "Sponsors" && x.rank).slice(0, 6), ...INDEX.filter(x => x.type === "States").sort((a, b) => a.label.localeCompare(b.label)).slice(0, 0)]
    : INDEX.filter(x => words.every(w => x.hay.includes(w))).map(x => ({x, sc: (x.hay.startsWith(q) ? 3 : 0) + (x.label.toLowerCase().includes(q) ? 1 : 0) + (x.rank || 0)})).sort((a, b) => b.sc - a.sc).map(a => a.x);
  const stHit = q && STATES.some(s => s.name.toLowerCase().startsWith(q) || s.abbr.toLowerCase() === q);
  const order = stHit ? ["States", "Sponsors", "Cities", "Clinics"] : ["Sponsors", "States", "Cities", "Clinics"], cap = {Sponsors: 6, States: 5, Cities: 5, Clinics: 12};
  palItems = []; let h = "";
  for (const g of order) { const it = res.filter(x => x.type === g).slice(0, cap[g]); if (!it.length) continue; h += `<li class="grp caps" role="presentation">${q ? g : "Companies"}</li>`; it.forEach(x => { h += `<li class="it" role="option" id="po${palItems.length}" data-i="${palItems.length}"><span>${esc(x.label)}</span><span class="s">${esc(x.sub)}</span><span class="n">${esc(x.n)}</span></li>`; palItems.push(x); }); }
  $("#palres").innerHTML = h || `<li class="grp note" style="padding:14px">No matches. Try a city, a state code like TX, or a company such as Compass.</li>`;
  palSel = 0; markPal();
}
function markPal() { $$("#palres li.it").forEach(li => li.setAttribute("aria-selected", +li.dataset.i === palSel)); const el = $("#po" + palSel); if (el) { el.scrollIntoView({block: "nearest"}); $("#palq").setAttribute("aria-activedescendant", el.id); } }
function openPal() { $("#pal").classList.add("open"); $("#palq").value = ""; palSearch(""); setTimeout(() => $("#palq").focus(), 0); }
function closePal() { $("#pal").classList.remove("open"); }
function choosePal(i) { const x = palItems[i]; if (!x) return; closePal(); if (location.hash && location.hash !== "#map") location.hash = "#map"; setTimeout(x.go, 30); }
$("#searchbtn").onclick = openPal;
$("#palq").addEventListener("input", e => palSearch(e.target.value));
$("#palq").addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { palSel = Math.min(palItems.length - 1, palSel + 1); markPal(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { palSel = Math.max(0, palSel - 1); markPal(); e.preventDefault(); }
  else if (e.key === "Enter") { choosePal(palSel); e.preventDefault(); }
});
$("#palres").addEventListener("click", e => { const li = e.target.closest("li.it"); if (li) choosePal(+li.dataset.i); });
$("#pal").addEventListener("click", e => { if (e.target.id === "pal") closePal(); });
$("#kbd").textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
document.addEventListener("keydown", e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#pal").classList.contains("open") ? closePal() : openPal(); }
  else if (e.key === "Escape") { if ($("#copyfb").classList.contains("open")) $("#copyfb").classList.remove("open"); else if ($("#byodlg").classList.contains("open")) closeByoDialog(); else if (!$("#scoring").hidden) $("#scoreclose").click(); else if ($("#pal").classList.contains("open")) closePal(); else if ($("#drawer").classList.contains("open")) closeDrawer(); }
  else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPal(); }
});

/* ---------- copy CSV ---------- */
// v1.9.3: the first eight columns are the Clinics table's columns, in the same order; detail columns follow.
const CSV_COLS = [["clinic", s => s.facility], ["city", s => s.city], ["state", s => s.state], ["status", s => STATUS_LABEL[s.sgroup] || s.sgroup], ["trials", s => s.n_trials],
  ["company", s => s.companies.map(sponsorName).join(" | ")], ["compound", s => s.companies.length ? s.companies.map(n => cmpdText(coTrials(s, n)) || "not listed").join(" | ") : "none"], ["company_trials", s => s.companies.map(n => coTrials(s, n).length).join(" | ")],
  ["companies", s => s.n_companies], ["other_sponsors", s => s.n_other], ["drugs", s => s.drugs.join("; ")],
  ["zip", s => s.zip], ["located_by", s => s.located_by], ["own_institution_not_counted", s => s.own_sponsors.join("; ")], ["unidentified_location", s => s.unidentified ? "yes" : ""],
  ["trials_recruiting_here_site_record", s => s.n_recruiting], ["trials_with_site_status", s => s.n_site_status], ["sponsor_names", s => s.sponsors.join("; ")], ["phases", s => s.phases],
  ["state_legal_path", s => byAbbr[s.state].legal_category], ["nct_ids", s => s.nct_ids.join("; ")]];
// v1.9.4: a text cell that starts with =, +, - or @ gets a leading apostrophe, so a spreadsheet never runs it as a formula.
const csvCell = v0 => { const v = typeof v0 === "number" ? String(v0) : /^[=+\-@]/.test(String(v0)) ? "'" + v0 : String(v0); return /[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove("on"), 2200); }
async function copyCSV(rows, what) {
  if (!rows.length) return toast("Nothing to copy");
  return copyRows(rows, CSV_COLS, what);
}
function copyRows(rows, cols, what) {
  if (!rows.length) return toast("Nothing to copy");
  const txt = [cols.map(c => c[0]).join(","), ...rows.map(s => cols.map(c => csvCell(c[1](s) ?? "")).join(","))].join("\n") + "\n";
  return copyText(txt, `${rows.length} rows: ${what}`, true);
}
async function copyText(txt, what, withMeta) {
  if (SITE_BUILD) { // real file download on the website version
    const name = "atlas-" + (String(what).replace(/^\d+ rows: /, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "data") + ".csv";
    const url = URL.createObjectURL(new Blob([txt], {type: "text/csv;charset=utf-8"}));
    const el = document.createElement("a"); el.href = url; el.download = name; document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000); toast(`Downloaded ${name}`); return;
  }
  try { await navigator.clipboard.writeText(txt); toast(`Copied ${what}`); }
  catch (e) { $("#copyta").value = txt; $("#copyfb").classList.add("open"); $("#copyta").focus(); $("#copyta").select(); }
}
$("#copyclose").onclick = () => $("#copyfb").classList.remove("open");

/* ---------- States view ---------- */
let stSort = ["rank", 1], stQ = "", stPick = new Set();
const ST_COLS = [["pick", "", null], ["rank", "Rank", "n"], ["name", "State", ""], ["readiness_score", "Readiness", "bar score"], ["layer_experience", "Experience", "bar"], ["layer_legal", "Legal", "bar"], ["n_sites", "Clinics", "n"], ["n_sites_2plus", "2+ companies", "n"], ["legal_category", "Legal path", ""]];
// v1.9.2 (D90): the greyed burden and capacity columns are gone. Next stage lists them as planned.
const ST_NA = {};
const stNA = c => ST_NA[c] && STATES.every(s => s[c] === "" || s[c] == null);
const ST_HM = ["n_sites_2plus", "layer_experience", "layer_legal"];
// v1.7.1: the lede names only the layers scored.
function stLede() { const e = effWeights(), on = LAYERS.filter(([k]) => e[k] > 0).map(([, n]) => n.toLowerCase()), off = LAYERS.filter(([k]) => !e[k]).map(([, n]) => n.toLowerCase());
  return `Readiness score and the ${on.length === 2 ? "two" : on.length === 3 ? "three" : on.length} layers it is scored from (${andList(on)}), for all 50 states and DC.${off.length ? ` ${andList(off).replace(/^./, c => c.toUpperCase())} ${off.length > 1 ? "are" : "is"} not yet included.` : ""} Click a row to open it on the map. Select up to 3 states to compare.`; }
function renderStateTable() {
  if ($("#stlede")) $("#stlede").textContent = stLede();
  if ($("#stgroups") && !$("#stgroups").innerHTML) $("#stgroups").innerHTML = legalGroupsHTML();
  const [k, dir] = stSort;
  const lkey = s => lrank(s) + " " + s.name;
  const rows = STATES.filter(s => !stQ || (s.name + " " + s.abbr + " " + s.legal_category).toLowerCase().includes(stQ)).sort((a, b) => { const x = k === "legal_category" ? lkey(a) : a[k], y = k === "legal_category" ? lkey(b) : b[k]; return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir; });
  $("#sttbl").innerHTML = `<thead><tr>${ST_COLS.map(([c, t, ty]) => c === "pick" ? `<th><span class="sr">Select to compare</span></th>` : c === "delta" ? `<th class="n wrap" title="Rank change against the atlas's default weights. Unchanged unless you edit the weights under Scoring.">Change vs default weights</th>` : stNA(c) ? `<th class="na hide-m"><button class="nahead" type="button" aria-expanded="false" aria-describedby="na-${c}" data-na="${c}">${ST_NA[c][0]} <span class="nai" aria-hidden="true">i</span></button><span class="natip" role="tooltip" id="na-${c}">${ST_NA[c][1]}</span></th>` : `<th aria-sort="${k === c ? (dir > 0 ? "ascending" : "descending") : "none"}" class="${ty === "n" ? "n" : ""} ${ST_HM.includes(c) || c === "legal_category" ? "hide-m" : ""}"><button data-sort="${c}">${t}</button></th>`).join("")}</tr></thead><tbody>${rows.map(s => {
    return `<tr class="click" data-open="${s.abbr}">${ST_COLS.map(([c, , ty]) => {
      if (c === "delta") return `<td class="n">${deltaHTML(s) || '<span class="note">unchanged</span>'}</td>`;
      if (c === "pick") return `<td><input type="checkbox" aria-label="Compare ${esc(s.name)}" data-pick="${s.abbr}" ${compare.includes(s.abbr) ? "checked" : ""}></td>`;
      const hm = ST_HM.includes(c) ? " hide-m" : "";
      if (stNA(c)) return `<td class="na${hm}"></td>`;
      if (ty && ty.startsWith("bar") && (s[c] === "" || s[c] == null)) return `<td class="${hm}"><span class="note">not yet included</span></td>`;
      if (ty && ty.startsWith("bar")) return `<td class="${hm}"><div class="ib ${ty.includes("score") ? "score" : ""}"><span class="tr"><span class="fl" style="width:${s[c]}%"></span></span><span class="v">${Math.round(s[c])}</span></div></td>`;
      if (c === "legal_category") return `<td class="hide-m lp">${legalCellHTML(s, " ", true)}</td>`;
      if (c === "name") return `<td class="nm">${esc(s.name)}</td>`;
      return `<td class="${ty === "n" ? "n" : ""}${hm}">${esc(s[c])}</td>`;
    }).join("")}</tr>`; }).join("")}</tbody>`;
  $("#stcmp").disabled = compare.length < 2;
  stFit();
}
// v1.7.3: legal path text and badge share one line when every row fits; otherwise every row stacks the same way, so rows stay one height.
function stFit() { const tb = $("#sttbl"); if (!tb || !tb.offsetParent) return; const box = tb.parentElement;
  tb.classList.remove("stack"); tb.querySelectorAll("tbody td").forEach(td => td.style.height = "");
  tb.classList.remove("wrap2");
  if (tb.scrollWidth > box.clientWidth + 1) tb.classList.add("stack");
  if (tb.scrollWidth > box.clientWidth + 1) tb.classList.add("wrap2");
  // every row takes the height of the tallest, so wrapping looks the same on every row
  const rows = [...tb.querySelectorAll("tbody tr")], h = Math.max(0, ...rows.map(r => r.getBoundingClientRect().height));
  if (rows.some(r => Math.abs(r.getBoundingClientRect().height - h) > 0.5)) rows.forEach(r => r.firstElementChild && (r.firstElementChild.style.height = h - 1 + "px")); }
addEventListener("resize", () => { if (location.hash === "#states") stFit(); });
addEventListener("hashchange", () => { if (location.hash === "#states") setTimeout(stFit, 40); });
if (document.fonts) document.fonts.ready.then(() => setTimeout(stFit, 40));
$("#sttbl").addEventListener("keydown", e => { if (e.key === "Escape") { const b = e.target.closest(".nahead"); if (b) b.setAttribute("aria-expanded", "false"); } });
$("#sttbl").addEventListener("click", e => {
  const na = e.target.closest(".nahead"); if (na) { e.stopPropagation(); const o = na.getAttribute("aria-expanded") !== "true"; $("#sttbl").querySelectorAll(".nahead").forEach(x => x.setAttribute("aria-expanded", "false")); na.setAttribute("aria-expanded", String(o)); return; }
  const sb = e.target.closest("[data-sort]"); if (sb) { const c = sb.dataset.sort; stSort = [c, stSort[0] === c ? -stSort[1] : (["rank", "name", "legal_category"].includes(c) ? 1 : -1)]; return renderStateTable(); }
  const pk = e.target.closest("[data-pick]"); if (pk) { toggleCompare(pk.dataset.pick); return; }
  const tr = e.target.closest("[data-open]"); if (tr) { location.hash = "#map"; setTimeout(() => openState(tr.dataset.open), 60); }
});
$("#stq").addEventListener("input", e => { stQ = e.target.value.toLowerCase(); renderStateTable(); });
$("#stcmp").onclick = () => { location.hash = "#map"; setTimeout(openCompare, 60); };

/* ---------- Clinics view ---------- */
let clSort = ["n_companies", -1], clQ = "", clScroll = null;
// v1.9.1: each column carries its own cell, so headers and cells can never drift apart again (the v1.7.4 to v1.9 table had 9 headers and 8 cells).
// v1.9.3 (D97): one row per clinic; the company area has its own three columns, one line per company (Company | Compound | Trials).
const coTrials = (s, n) => s.trials.filter(t => t.sponsor === n);
const coLines = (s, f) => s.companies.length ? s.companies.map(n => `<div class="coln">${f(n)}</div>`).join("") : '<div class="coln"><span class="note">none</span></div>';
const CL_COLS = [["facility", "Clinic", "", s => `<a class="clink" href="#clinic/${esc(s.id)}"><b style="font-weight:500">${esc(s.facility)}</b></a>`], ["city", "City", "hide-m", s => esc(s.city)], ["state", "State", "", s => s.state],
  ["sgroup", "Status", "hide-m", s => esc(STATUS_LABEL[s.sgroup] || s.sgroup)], ["n_trials", "Trials", "n", s => s.n_trials],
  ["n_companies", "Company", "hide-m colist co1", s => coLines(s, n => esc(sponsorName(n)))], ["cmpd", "Compound", "hide-m colist", s => coLines(s, n => esc(cmpdText(coTrials(s, n)) || "not listed"))],
  ["cotr", "Company trials", "n hide-m colist", s => coLines(s, n => coTrials(s, n).length)]];
// Lines in the three company columns share one height per company, so each company reads straight across.
function alignCoLines() { $$("#cltbl tbody tr").forEach(r => { const cols = [...r.querySelectorAll("td.colist")].map(td => [...td.querySelectorAll(".coln")]); if (cols.length < 2) return;
  cols[0].forEach((_, k) => { cols.forEach(c => c[k] && (c[k].style.minHeight = "")); const h = Math.max(...cols.map(c => c[k] ? c[k].getBoundingClientRect().height : 0)); cols.forEach(c => c[k] && (c[k].style.minHeight = h + "px")); }); }); }
function clinicRows() {
  let rows = visible.filter(s => !lens || s.developers.includes(lens));
  if (clQ) rows = rows.filter(s => (s.facility + " " + s.city + " " + s.state + " " + s.sponsors.join(" ") + " " + s.companies.map(sponsorName).join(" ")).toLowerCase().includes(clQ));
  const [k, dir] = clSort;
  return rows.sort((a, b) => { const x = Array.isArray(a[k]) ? a[k].length : a[k], y = Array.isArray(b[k]) ? b[k].length : b[k]; return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir || b.n_trials - a.n_trials; });
}
function renderClinicTable() {
  const rows = clinicRows(), [k, dir] = clSort;
  $("#clcount").textContent = `${rows.length} clinic${rows.length === 1 ? "" : "s"}${anyFilter() ? ", filtered" : ""}${lens ? `, ${sponsorName(lens)} lens` : ""}`;
  $("#clcopy").disabled = !rows.length;
  const NOSORT = new Set(["cmpd", "cotr"]);
  $("#cltbl").innerHTML = `<thead><tr>${CL_COLS.map(([c, t, ty]) => NOSORT.has(c) ? `<th class="${ty}">${t}</th>` : `<th class="${ty}" aria-sort="${k === c ? (dir > 0 ? "ascending" : "descending") : "none"}"><button data-sort="${c}">${t}</button></th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(s => `<tr class="click" data-site="${s.i}">${CL_COLS.map(([c, , ty, cell]) => `<td class="${ty}" data-col="${c}">${cell(s)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${CL_COLS.length}" class="note" style="padding:20px">No clinics match these filters.</td></tr>`}</tbody>`;
  requestAnimationFrame(alignCoLines);
}
$("#cltbl").addEventListener("click", e => {
  const sb = e.target.closest("[data-sort]"); if (sb) { const c = sb.dataset.sort; clSort = [c, clSort[0] === c ? -clSort[1] : (["facility", "city", "state", "sgroup"].includes(c) ? 1 : -1)]; return renderClinicTable(); }
  // v1.9.4: a row opens the clinic's full page. The name is a real link (middle-click, copy link); Back returns here with filters and scroll kept.
  const tr = e.target.closest("[data-site]"); if (!tr) return; clScroll = [scrollY, $("#v-clinics").scrollTop];
  if (e.target.closest("a.clink")) return; location.hash = "#clinic/" + SITES[+tr.dataset.site].id;
});
$("#clq").addEventListener("input", e => { clQ = e.target.value.toLowerCase(); renderClinicTable(); });
$("#clcopy").onclick = () => copyCSV(clinicRows(), "clinic directory");

/* ---------- Methods ---------- */
$("#methods").innerHTML = META.methods_html;
$("#about").innerHTML = META.about_html;
$("#limitsbody").innerHTML = META.limits_html;

/* ---------- routing ---------- */
// v1.9.3 (D96): the old limits page is now "Next stage" at #next; #limits stays as an alias so old links work.
const VIEWS = ["map", "states", "clinics", "methods", "about", "next"], VIEW_ALIAS = {limits: "next"};
const VIEW_TITLES = {states: "States", clinics: "Clinics", methods: "Methods", about: "About", next: "Next stage"};
function route() {
  const h0 = location.hash.slice(1), h = VIEW_ALIAS[h0] || h0, v = VIEWS.includes(h) ? h : "map";
  VIEWS.forEach(x => { const el = $("#v-" + x); if (el) el.classList.toggle("on", x === v); });
  $$("nav.views a").forEach(a => a.setAttribute("aria-current", a.dataset.view === v ? "page" : "false"));
  if (v === "states") renderStateTable(); if (v === "clinics") { renderClinicTable(); if (clScroll) { const [y, t] = clScroll; requestAnimationFrame(() => { $("#v-clinics").scrollTop = t; scrollTo(0, y); }); } }
  if (v !== "map" && !$("#scoring").hidden) { $("#scoring").hidden = true; $("#scorebtn").setAttribute("aria-expanded", "false"); }
  document.title = `${v === "map" ? "" : (VIEW_TITLES[v] || v[0].toUpperCase() + v.slice(1)) + " - "}Psychedelic Launch Readiness Atlas (US)`;
}
addEventListener("hashchange", route);

/* ---------- theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t; store.set("atlas-theme", t);
  $("#theme").setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
  $("#theme").innerHTML = t === "dark" ? `<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/></svg>` : `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>`;
  paintStates(); paintLights(); legend();
}
$("#theme").onclick = () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");

/* ---------- rail ---------- */
$("#railclose").onclick = () => { if (isMobile()) { $("#rail").classList.remove("mopen"); return; } $("#rail").classList.add("collapsed"); setTimeout(placeLights, 250); };
if (isMobile()) { $("#railclose").setAttribute("aria-label", "Close filters"); $("#railclose").innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'; }
$("#railtoggle").onclick = () => $("#rail").classList.remove("collapsed");
$("#mobfilters").onclick = () => { $("#rail").classList.remove("collapsed"); $("#rail").classList.add("mopen"); };

/* ---------- update loop ---------- */
function update() {
  visible = SITES.filter(s => siteOK(s));
  renderFacets(); applyVisibility(); strip(); placeLights();
  if ($("#v-clinics").classList.contains("on")) renderClinicTable();
  const sk = [...F.state].sort().join();
  if (sk !== lastStateKey) { lastStateKey = sk; stateFocus(); }
  else if (drawerMode === "selection") openSelection();
  $("#mobfilters").textContent = anyFilter() ? `Filters (${Object.values(F).reduce((a, x) => a + x.size, 0)})` : "Filters";
}
svg.on("click", () => { if (drawerMode === "state" || drawerMode === "site") closeDrawer(); });
$("#zin").onclick = () => svg.transition().duration(RM ? 0 : 300).call(zoom.scaleBy, 1.8);
$("#zout").onclick = () => svg.transition().duration(RM ? 0 : 300).call(zoom.scaleBy, 1 / 1.8);
$("#zreset").onclick = () => flyTo(fitTransform(homeBounds(), 8, 10, true));
function resize() { W = innerWidth; H = innerHeight; svg.attr("viewBox", `0 0 ${W} ${H}`); }
addEventListener("resize", () => { resize(); placeLights(); });

/* ================= v1.2: scoring, capacity, competition, bring your own sites ================= */

/* ---------- B. Scoring weights ---------- */
const LAYERS = [
  ["experience", "Trial experience", "layer_experience", 40],
  ["legal", "Legal path", "layer_legal", 30],
  // v1.9.2 (D90): condition burden and capacity had no data and are no longer shown; Next stage lists them as planned.
];
const hasData = key => STATES.some(s => s[key] !== "" && s[key] != null);
const DEFAULT_W = Object.fromEntries(LAYERS.map(l => [l[0], l[3]]));
let WTS = {...DEFAULT_W};
STATES.forEach(s => { s.base_score = s.readiness_score; s.base_rank = s.rank; });
const isDefaultW = () => LAYERS.every(([k]) => WTS[k] === DEFAULT_W[k]);
function effWeights() {
  const act = LAYERS.filter(([k, , key]) => hasData(key) && WTS[k] > 0), tot = act.reduce((a, [k]) => a + WTS[k], 0);
  return Object.fromEntries(LAYERS.map(([k, , key]) => [k, hasData(key) && tot ? (WTS[k] || 0) / tot : 0]));
}
function weightsLine() {
  const e = effWeights();
  return "Weights used: " + LAYERS.filter(([k]) => e[k] > 0).map(([k, n]) => `${n.replace(/ \(.*\)/, "").toLowerCase()} ${Math.round(e[k] * 100)}%`).join(", ") + (isDefaultW() ? " (atlas defaults)" : " (custom)");
}
function rescore() {
  if (isDefaultW()) STATES.forEach(s => { s.readiness_score = s.base_score; s.rank = s.base_rank; });
  else {
    const e = effWeights();
    STATES.forEach(s => { s.readiness_score = Math.round(LAYERS.reduce((a, [k, , key]) => a + (e[k] ? e[k] * (+s[key] || 0) : 0), 0) * 10) / 10; });
    [...STATES].sort((a, b) => b.readiness_score - a.readiness_score || a.name.localeCompare(b.name)).forEach((s, i) => s.rank = i + 1);
  }
  $("#custompill").hidden = isDefaultW();
  paintStates(); renderStateTable();
  statePaths.attr("aria-label", f => `${byFips[f.id].name}, readiness ${Math.round(byFips[f.id].readiness_score)} of 100`);
  if (drawerMode === "state" && selState) openState(selState, false);
  if (drawerMode === "byo") openByo(false);
  if (drawerMode === "compare") openCompare(false);
}
const rankDelta = s => s.base_rank - s.rank;
// v1.9: rank changes are no longer shown anywhere (the sensitivity result lives on the About page).
const deltaHTML = s => "";
const _deltaHTML_old = s => { const d = rankDelta(s); return isDefaultW() || !d ? "" : `<span class="delta ${d > 0 ? "up" : "down"}" aria-label="${d > 0 ? "up" : "down"} ${Math.abs(d)} places from default">${d > 0 ? "▲" : "▼"}${Math.abs(d)}</span>`; };
function renderScoring() {
  const e = effWeights();
  $("#scorebody").innerHTML = LAYERS.map(([k, n, key]) => {
    const ok = hasData(key);
    return `<div class="sl${ok ? "" : " off"}"><label for="w-${k}">${n}</label><input type="range" id="w-${k}" min="0" max="100" step="5" value="${WTS[k]}" ${ok ? "" : "disabled"} aria-describedby="wo-${k}"><output id="wo-${k}" class="mono">${ok ? Math.round(e[k] * 100) + "%" : (k === "burden" ? "Not yet included" : "No data yet")}</output></div>`;
  }).join("") + `<p class="note" style="margin:8px 0 0">${esc(weightsLine())}. Weights re-normalise to 100% across layers that have data. Nothing is saved.</p>`;
}
$("#scorebtn").onclick = () => { const p = $("#scoring"); p.hidden = !p.hidden; $("#scorebtn").setAttribute("aria-expanded", String(!p.hidden)); if (!p.hidden) { renderScoring(); $("#scoring input:not([disabled])").focus(); } };
$("#scoreclose").onclick = () => { $("#scoring").hidden = true; $("#scorebtn").setAttribute("aria-expanded", "false"); $("#scorebtn").focus(); };
$("#scorereset").onclick = () => { WTS = {...DEFAULT_W}; renderScoring(); rescore(); };
$("#scoring").addEventListener("input", e => {
  const m = e.target.id.match(/^w-(\w+)$/); if (!m) return;
  WTS[m[1]] = +e.target.value;
  const ef = effWeights(); LAYERS.forEach(([k, , key]) => { const o = $("#wo-" + k); if (o && hasData(key)) o.textContent = Math.round(ef[k] * 100) + "%"; });
  $("#scorebody .note").textContent = weightsLine() + ". Weights re-normalise to 100% across layers that have data. Nothing is saved.";
  rescore();
});

/* ---------- C. Session lengths and capacity calculator ---------- */
const capState = {clinic: {rooms: 2, hours: 10, days: 5, weeks: 48, turn: 0.5}, state: {rooms: null, hours: 10, days: 5, weeks: 48, turn: 0.5}};
function capCalc(kind, roomsDefault) {
  const c = capState[kind]; if (kind === "state") c.rooms = c._for === selState ? c.rooms : roomsDefault, c._for = selState;
  const f = (id, label, v, step, min) => `<label class="cf"><span>${label}</span><input type="number" data-cap="${kind}" data-k="${id}" value="${v}" step="${step}" min="${min}" aria-label="${label}"></label>`;
  return `<details class="sec cap" data-kind="${kind}"><summary class="caps">Session capacity calculator (example values)</summary>
   <p class="note" style="margin:0 0 8px">Example values, change them. ${kind === "state" ? "Rooms default to 2 per clinic with 2+ companies in this state." : ""}</p>
   <div class="cfg">${f("rooms", "Rooms or chairs", c.rooms, 1, 0)}${f("hours", "Hours open per day", c.hours, 0.5, 1)}${f("days", "Days per week", c.days, 1, 1)}${f("weeks", "Weeks per year", c.weeks, 1, 1)}${f("turn", "Turnover hours", c.turn, 0.25, 0)}</div>
   <div class="capres" id="capres-${kind}">${capRows(kind)}</div></details>`;
}
function capRows(kind) {
  const c = capState[kind], res = SESSIONS.map(p => { const h = +p.in_clinic_hours, per = Math.floor(c.hours / (h + c.turn)); return {p, h, wk: per * c.rooms * c.days, yr: per * c.rooms * c.days * c.weeks}; });
  const mx = Math.max(1, ...res.map(r => r.yr));
  const badge = st => /^Sourced/.test(st) ? `<span class="badge ok">${esc(st)}</span>` : /Assumption/.test(st) ? `<span class="badge none">Assumption</span>` : `<span class="badge unv">Unverified</span>`;
  return `<table class="grid capt"><thead><tr><th>Programme</th><th class="n">Hours</th><th class="n">Per week</th><th class="n">Per year</th></tr></thead><tbody>${res.map(r => `<tr><td><b style="font-weight:500">${esc(r.p.programme)}</b><div class="capbar" aria-hidden="true"><span style="width:${(r.yr / mx * 100).toFixed(1)}%"></span></div><div class="note">${esc(r.p.drug)} &middot; ${badge(r.p.status)} <details><summary>Basis</summary>${esc(r.p.basis)} ${r.p.sources.split(" ; ").map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname.replace("www.", ""))}</a>`).join(" ")}</details></div></td><td class="n">${r.h}</td><td class="n">${fmt(r.wk)}</td><td class="n">${fmt(r.yr)}</td></tr>`).join("")}</tbody></table>
  <p class="note">Dosing sessions, not patients. Assumes each room runs back-to-back sessions of one programme with ${c.turn} h turnover, ${c.hours} h a day. Ignores preparation and integration visits, staffing, REMS rules and payer limits.</p>`;
}
document.addEventListener("input", e => {
  const el = e.target; if (!el.dataset || !el.dataset.cap) return;
  const v = parseFloat(el.value); if (!isFinite(v) || v < 0) return;
  capState[el.dataset.cap][el.dataset.k] = v; $("#capres-" + el.dataset.cap).innerHTML = capRows(el.dataset.cap);
});
/* ---------- D. Competition at a site ---------- */
// v1.6 (D44): recruiting at a clinic = the registry record for that location says RECRUITING. No fallback to the trial status.
const recruitingHere = (s, t) => s.site_status[t.nct] === "RECRUITING";
function competitionHTML(s) {
  const by = d3.group(s.trials, t => t.sponsor);
  const rows = [...by].map(([sp, ts]) => ({sp, ts, drugs: [...new Set(ts.flatMap(t => t.drugs))], rec: ts.filter(t => recruitingHere(s, t)).length})).sort((a, b) => b.rec - a.rec || b.ts.length - a.ts.length);
  const recTotal = rows.reduce((a, r) => a + r.rec, 0);
  return `<div class="sec"><h3 class="caps">Programmes at this clinic ${recTotal >= 2 ? '<span class="badge unv">Busy clinic</span>' : ""}</h3>
   <p class="note" style="margin:0 0 6px">${recTotal} trial${recTotal === 1 ? "" : "s"} recruiting here at the same time${recTotal >= 2 ? ", so new studies would compete for the same patients, rooms and staff" : ""}. Counts only trials whose registry record for this location says recruiting. ${s.n_site_status} of ${s.n_trials} trials here have a status for this location at all.</p>
   <table class="grid capt"><thead><tr><th>Sponsor</th><th>Drugs</th><th class="n">Trials</th><th class="n">Recruiting here</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(sponsorName(r.sp))}${SPNOTE[r.sp] ? `<br><span class="note">${esc(SPNOTE[r.sp])}</span>` : ""}</td><td>${esc(r.drugs.join(", "))}</td><td class="n">${r.ts.length}</td><td class="n">${r.rec}</td></tr>`).join("")}</tbody></table></div>`;
}

/* ---------- A. Bring your own sites ---------- */
let GZ = null;
const normPlace = n => String(n || "").toLowerCase().replace(/&/g, " and ").replace(/\bst\.?\s/g, "saint ").replace(/\bft\.?\s/g, "fort ").replace(/\bmt\.?\s/g, "mount ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function gaz() {
  if (GZ) return GZ;
  GZ = {zip: new Map(), place: new Map()};
  for (const r of GAZ.zips.split(";")) { const [z, la, lo, st] = r.split(","); GZ.zip.set(z, [+la, +lo, st]); }
  for (const r of GAZ.places.split(";")) { const [n, la, lo, st] = r.split(","); GZ.place.set(n + "|" + st, [+la, +lo, st]); }
  return GZ;
}
const ST_BY_NAME = Object.fromEntries(STATES.map(s => [s.name.toLowerCase(), s.abbr]));
function lev(a, b) { const m = a.length, n = b.length, d = Array.from({length: m + 1}, (_, i) => [i, ...Array(n).fill(0)]); for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
function parseState(raw) {
  let t = String(raw || "").trim(); if (!t) return [null, ""];
  const up = t.toUpperCase().replace(/\./g, "");
  if (byAbbr[up]) return [up, ""];
  let l = t.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").replace(/^n /, "north ").replace(/^s /, "south ").replace(/^w /, "west ").replace(/^wash dc|^washington dc|^d ?c$/, "district of columbia");
  if (ST_BY_NAME[l]) return [ST_BY_NAME[l], ""];
  const pre = Object.keys(ST_BY_NAME).filter(n => l.length >= 4 && n.startsWith(l)); if (pre.length === 1) return [ST_BY_NAME[pre[0]], `read "${t}" as ${pre[0].replace(/\b\w/g, c => c.toUpperCase())}`];
  let best = null, bd = 9; for (const n of Object.keys(ST_BY_NAME)) { const d = lev(l, n); if (d < bd) { bd = d; best = n; } }
  if (best && bd <= (best.length > 8 ? 2 : 1)) return [ST_BY_NAME[best], `read "${t}" as ${best.replace(/\b\w/g, c => c.toUpperCase())}`];
  return [null, `state "${t}" not recognised`];
}
const cleanZip = z => { const d = String(z || "").trim().split("-")[0].replace(/\D/g, ""); return d.length === 5 ? d : d.length === 4 || d.length === 3 ? d.padStart(5, "0") : ""; };
const stateCentroid = {}; fc.features.forEach(f => stateCentroid[byFips[f.id].abbr] = d3.geoCentroid(f));
function stateOfPoint(lon, lat) { const f = fc.features.find(f => d3.geoContains(f, [lon, lat])); return f ? byFips[f.id].abbr : null; }
const STOPW = /\b(the|inc|llc|pllc|pc|pa|corp|corporation|of|at|and|ltd|co)\b/g;
const normName = n => String(n || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(STOPW, " ").replace(/\s+/g, " ").trim();
const toks = n => new Set(normName(n).split(" ").filter(w => w.length > 1));
SITES.forEach(s => { s.tok = toks(s.facility + " " + (s.name_variants || "").split("; ").join(" ")); s.tokMain = toks(s.facility); s.ncity = normPlace(s.city); });
function matchSite(u) {
  if (!u.state) return null;
  const ut = toks(u.name); if (!ut.size) return null;
  let best = null;
  for (const s of SITES) {
    if (s.state !== u.state) continue;
    const inter = [...ut].filter(w => s.tok.has(w)).length; if (!inter) continue;
    const j = Math.max(inter / new Set([...ut, ...s.tokMain]).size, inter / Math.min(ut.size, s.tokMain.size) * 0.85);
    const sameCity = u.ncity && u.ncity === s.ncity;
    const conf = j >= 0.75 && sameCity ? "High" : (j >= 0.5 && sameCity) || j >= 0.75 ? "Medium" : j >= 0.34 && sameCity ? "Low" : null;
    if (!conf) continue;
    const sc = j + (sameCity ? 0.3 : 0);
    if (!best || sc > best.sc) best = {site: s, conf, sc, j};
  }
  return best;
}
const FIELDS = [["name", "Site name", /^(site|site ?n(a)?me?|name|account|account ?name|facility|clinic|practice|location ?name|site ?nm)$|name|site|account|facility|clinic/, true],
  ["city", "City", /city|town|municipal/], ["state", "State", /^(st\.?|state|province|region)$|state/], ["zip", "ZIP", /zip|postal|postcode/],
  ["lat", "Latitude (optional)", /^lat/], ["lon", "Longitude (optional)", /^(lon|lng|long)/], ["tier", "Tier (optional)", /tier|priority|segment|class/],
  ["status", "Status (optional)", /status|stage/], ["notes", "Notes (optional)", /note|comment|remark/]];
let BYO = null; // {label, fictional, rows:[...], header, data}
let byoShow = true, pending = null;
function autodetect(header) {
  const used = new Set(), map = {};
  for (const [k, , re] of FIELDS) {
    const h = header.findIndex((x, i) => !used.has(i) && re.test(String(x).trim().toLowerCase()));
    if (h >= 0) { map[k] = h; used.add(h); } else map[k] = -1;
  }
  return map;
}
function openByoDialog(step = "choose") {
  const d = $("#byodlg"); d.classList.add("open"); d.setAttribute("aria-hidden", "false");
  $("#byostep1").hidden = step !== "choose"; $("#byostep2").hidden = step !== "map";
  setTimeout(() => (step === "choose" ? $("#byofile") : $("#byogo")).focus(), 0);
}
function closeByoDialog() { const d = $("#byodlg"); d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
function byoError(msg) { $("#byoerr").textContent = msg; $("#byoerr").hidden = !msg; }
function readFile(file, label, fictional) {
  byoError("");
  if (!file) return;
  if (file.size === 0) { openByoDialog("choose"); return byoError(`"${file.name}" is empty. Add a header row and at least one site.`); }
  if (file.size > 5e6) { openByoDialog("choose"); return byoError("That file is over 5 MB. Please split it."); }
  Papa.parse(file, {skipEmptyLines: "greedy", complete: res => parsed(res.data, label || file.name, fictional), error: () => { openByoDialog("choose"); byoError("Could not read that file as CSV."); }});
}
function parsed(data, label, fictional) {
  data = data.filter(r => r.some(c => String(c).trim()));
  if (!data.length) { openByoDialog("choose"); return byoError("No rows found. The file needs a header row and at least one site."); }
  const header = data[0].map(h => String(h).trim()), body = data.slice(1);
  if (!body.length) { openByoDialog("choose"); return byoError("Only a header row was found. Add at least one site below it."); }
  if (body.length > 5000) { openByoDialog("choose"); return byoError(`${body.length} rows is more than this page handles (5,000).`); }
  pending = {header, body, label, fictional, map: autodetect(header)};
  $("#byomap").innerHTML = FIELDS.map(([k, n, , req]) => `<label class="cf"><span>${n}${req ? " (required)" : ""}</span><select data-f="${k}" aria-label="Column for ${n}"><option value="-1">Not in file</option>${header.map((h, i) => `<option value="${i}" ${pending.map[k] === i ? "selected" : ""}>${esc(h || "Column " + (i + 1))}</option>`).join("")}</select></label>`).join("");
  renderPreview();
  $("#byoname").textContent = `${label}: ${body.length} row${body.length === 1 ? "" : "s"}${fictional ? " (fictional sample)" : ""}`;
  openByoDialog("map");
}
function renderPreview() {
  const {header, body, map} = pending, cols = FIELDS.filter(([k]) => map[k] >= 0);
  $("#byoprev").innerHTML = `<thead><tr>${cols.map(([, n]) => `<th>${esc(n.replace(" (optional)", ""))}</th>`).join("")}</tr></thead><tbody>${body.slice(0, 5).map(r => `<tr>${cols.map(([k]) => `<td>${esc(r[map[k]] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
  $("#byogo").disabled = map.name < 0;
  $("#byomaperr").textContent = map.name < 0 ? "Choose which column holds the site name." : (map.city < 0 && map.zip < 0 && map.lat < 0 ? "No city, ZIP or lat/lon column: sites can only be placed at the state centre." : "");
}
$("#byomap").addEventListener("change", e => { const k = e.target.dataset.f; if (k) { pending.map[k] = +e.target.value; renderPreview(); } });
function locateRows() {
  const g = gaz(), {header, body, map, label, fictional} = pending, get = (r, k) => map[k] >= 0 ? String(r[map[k]] ?? "").trim() : "";
  const rows = body.map((r, i) => {
    const u = {row: i + 2, name: get(r, "name"), city: get(r, "city"), stateRaw: get(r, "state"), zipRaw: get(r, "zip"), tier: get(r, "tier"), status: get(r, "status"), notes: get(r, "notes"), issues: []};
    u.ncity = normPlace(u.city);
    let [st, stNote] = parseState(u.stateRaw); if (stNote) u.issues.push(stNote); u.state = st;
    const lat = parseFloat(get(r, "lat")), lon = parseFloat(get(r, "lon")), zip = cleanZip(u.zipRaw);
    if (u.zipRaw && !zip) u.issues.push(`ZIP "${u.zipRaw}" not valid`);
    if (zip && zip !== u.zipRaw.replace(/\D/g, "").slice(0, 5)) u.issues.push(`ZIP read as ${zip}`);
    if (isFinite(lat) && isFinite(lon) && lat > 17 && lat < 72 && lon > -180 && lon < -60) {
      u.lonlat = [lon, lat]; u.by = "Lat/lon"; const ps = stateOfPoint(lon, lat); if (ps && !u.state) u.state = ps; else if (ps && ps !== u.state) u.issues.push(`lat/lon falls in ${ps}`);
    } else if (zip && g.zip.has(zip)) {
      const [la, lo, zs] = g.zip.get(zip); u.lonlat = [lo, la]; u.by = "ZIP";
      if (!u.state) u.state = zs; else if (zs !== u.state) u.issues.push(`ZIP ${zip} is in ${zs}, file says ${u.state}`);
    } else if (u.ncity && u.state && g.place.has(u.ncity + "|" + u.state)) { const [la, lo] = g.place.get(u.ncity + "|" + u.state); u.lonlat = [lo, la]; u.by = "City"; if (zip) u.issues.push(`ZIP ${zip} not in the 2016 Census list`); }
    else if (u.state) { u.lonlat = stateCentroid[u.state]; u.by = "State"; if (u.city) u.issues.push(`city "${u.city}" not found in ${u.state}`); }
    if (!u.name) u.issues.push("no site name");
    if (u.lonlat) { u.p = proj(u.lonlat); if (!u.p) { u.by = null; u.issues.push("outside the mapped US"); } }
    if (!u.p) u.why = !u.state ? (u.stateRaw ? "no usable ZIP or lat/lon either" : "no state, ZIP or lat/lon") : "could not be placed";
    const m = u.p && u.name ? matchSite(u) : null;
    if (m) { u.match = m.site; u.conf = m.conf; u.accepted = m.conf === "High"; }
    return u;
  });
  BYO = {label, fictional, rows};
  const byP = d3.group(rows.filter(u => u.p), u => u.p.join(","));
  for (const [, arr] of byP) arr.forEach((u, i) => { const r = i === 0 ? 0 : 6 * Math.sqrt(i), a = i * 2.39996 + 2.2; u.dx = r * Math.cos(a); u.dy = r * Math.sin(a); });
  drawMine(); closeByoDialog(); byoShow = true; $("#byobtn").classList.add("on"); legend(); openByo(true);
}
$("#byogo").onclick = () => locateRows();
$("#byoback").onclick = () => openByoDialog("choose");
$("#byofile").addEventListener("change", e => { readFile(e.target.files[0]); e.target.value = ""; });
$("#byosample").onclick = () => { Papa.parse(SAMPLE_CSV, {skipEmptyLines: "greedy", complete: res => parsed(res.data, "Example Therapeutics", true)}); };
$("#byotemplate").onclick = () => copyText(TEMPLATE_CSV, "CSV template", false);
$("#byobtn").onclick = () => BYO ? openByo(true) : (byoError(""), openByoDialog("choose"));
$$("[data-byoclose]").forEach(b => b.onclick = closeByoDialog);
// Drag a CSV anywhere on the map.
let dragN = 0;
addEventListener("dragenter", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { dragN++; $("#dropzone").classList.add("on"); } });
addEventListener("dragleave", () => { dragN = Math.max(0, dragN - 1); if (!dragN) $("#dropzone").classList.remove("on"); });
addEventListener("dragover", e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) e.preventDefault(); });
addEventListener("drop", e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); dragN = 0; $("#dropzone").classList.remove("on"); readFile(e.dataTransfer.files[0]); });

const gMine = d3.select("#mine");
let mine = gMine.selectAll("g");
function drawMine() {
  const rows = BYO ? BYO.rows.filter(u => u.p) : [];
  mine = gMine.selectAll("g.mn").data(rows, u => u.row).join(enter => { const g = enter.append("g").attr("class", "mn"); g.append("path").attr("d", "M0,-6.5L6.5,0L0,6.5L-6.5,0Z"); return g; })
    .classed("matched", u => u.match && u.accepted)
    .on("click", (e, u) => { e.stopPropagation(); if (u.match && u.accepted) openSite(u.match.i); else if (u.state) openState(u.state); })
    .on("mousemove", (e, u) => tip(e, `<b>${esc(u.name || "(no name)")}</b> <span class="note">your site</span><br>${esc([u.city, u.state].filter(Boolean).join(", "))} &middot; located by ${u.by}${u.match ? `<br>${u.accepted ? "Matched" : u.conf + " match, not accepted"}: ${esc(u.match.facility)}` : ""}`))
    .on("mouseleave", hideTip);
  gMine.attr("display", byoShow ? null : "none");
  placeLights();
}
function placeMine() { const spread = Math.min(Math.max(T.k, 1), 3.2); mine.attr("transform", u => `translate(${T.applyX(u.p[0]) + u.dx * spread},${T.applyY(u.p[1]) + u.dy * spread})`); }
const accepted = () => BYO ? BYO.rows.filter(u => u.match && u.accepted) : [];
function byoStats() {
  const rows = BYO.rows, placed = rows.filter(u => u.p), acc = accepted(), myStates = new Set(placed.map(u => u.state));
  const matchedIds = new Set(acc.map(u => u.match.i));
  const sponsors = d3.rollups(acc.flatMap(u => u.match.companies), v => v.length, d => d).sort((a, b) => b[1] - a[1]);
  const prospects = SITES.filter(s => myStates.has(s.state) && s.n_companies >= 2 && !matchedIds.has(s.i)).sort((a, b) => b.n_companies - a.n_companies || b.n_trials - a.n_trials);
  const gaps = STATES.filter(s => !myStates.has(s.abbr)).sort((a, b) => b.readiness_score - a.readiness_score).filter(s => s.readiness_score >= 50).slice(0, 12);
  const byState = d3.rollups(placed, v => v, u => u.state).map(([st, v]) => ({s: byAbbr[st], n: v.length, exp: v.filter(u => u.match && u.accepted).length})).sort((a, b) => b.s.readiness_score - a.s.readiness_score);
  return {rows, placed, acc, sponsors, prospects, gaps, byState, review: rows.filter(u => u.match && !u.accepted), unplaced: rows.filter(u => !u.p)};
}
function openByo(fly) {
  if (!BYO) return;
  const S = byoStats(), cnt = k => S.placed.filter(u => u.by === k).length;
  const fict = BYO.fictional ? `<div class="warn">Example Therapeutics is a <b>fictional</b> company. Some rows reuse public clinic names from the atlas so you can see matching. This implies no real relationship with those clinics.</div>` : "";
  const confChip = u => `<span class="badge ${u.conf === "High" ? "ok" : u.conf === "Medium" ? "unv" : "none"}">${u.conf}</span>`;
  const matchRow = u => `<li class="mrow"><div><b style="font-weight:500">${esc(u.name)}</b> <span class="note">${esc(u.city)}${u.city ? ", " : ""}${u.state}</span><br><span class="note">Atlas:</span> <button class="linkish" data-site="${u.match.i}">${esc(u.match.facility)}</button> ${confChip(u)} <span class="note">${u.match.n_sponsors} sponsors</span></div>
    <div class="mbtns" role="group" aria-label="Match decision for ${esc(u.name)}"><button class="btn${u.accepted ? " primary" : ""}" data-acc="${u.row}" aria-pressed="${u.accepted}">Accept</button><button class="btn" data-rej="${u.row}" aria-pressed="${!u.accepted}">Reject</button></div></li>`;
  const body = `${fict}
  <p class="privacy">Your file is processed in this browser and is never uploaded or stored. <button class="linkish" id="byoclear">Clear</button> removes it.</p>
  <div class="sec"><div class="score"><span class="num">${S.rows.length}</span><span class="of">sites &middot; ${S.placed.length} placed &middot; ${S.acc.length} with trial experience</span></div>
   <div class="locby"><span class="chip">Lat/lon ${cnt("Lat/lon")}</span><span class="chip">ZIP ${cnt("ZIP")}</span><span class="chip">City ${cnt("City")}</span><span class="chip">State ${cnt("State")}</span>${S.unplaced.length ? `<span class="chip warnchip">Not placed ${S.unplaced.length}</span>` : ""}</div>
   <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn" id="byotoggle" aria-pressed="${byoShow}">${byoShow ? "Hide" : "Show"} my sites</button><button class="btn" id="byofit">Fit map</button><button class="btn" id="byonew">Load another file</button></div></div>
  <div class="sec"><h3 class="caps">Your sites by state</h3><table class="grid capt"><thead><tr><th>State</th><th class="n">Yours</th><th class="n">Experienced</th><th class="n">Score</th><th class="n">Rank</th></tr></thead><tbody>${S.byState.map(r => `<tr class="click" data-state="${r.s.abbr}"><td>${esc(r.s.name)}</td><td class="n">${r.n}</td><td class="n">${r.exp}</td><td class="n">${Math.round(r.s.readiness_score)}</td><td class="n">${r.s.rank}${deltaHTML(r.s)}</td></tr>`).join("")}</tbody></table></div>
  <div class="sec"><h3 class="caps">Trial experience on your list</h3>
   <p style="margin:0 0 6px"><b>${S.acc.length}</b> of ${S.rows.length} of your sites match an atlas clinic that has run psychedelic trials.${S.review.length ? ` ${S.review.length} more possible match${S.review.length === 1 ? "" : "es"} to review below.` : ""}</p>
   ${S.sponsors.length ? `<p class="note" style="margin:0 0 6px">Companies they have worked with: ${S.sponsors.map(([c, n]) => `${esc(sponsorName(c))} (${n})`).join(", ")}</p>` : ""}
   <ul class="list">${BYO.rows.filter(u => u.match).sort((a, b) => (b.accepted - a.accepted) || b.match.n_sponsors - a.match.n_sponsors).map(matchRow).join("") || '<li class="note" style="padding:6px 0">No matches with atlas clinics.</li>'}</ul>
   <button class="btn" data-copy="matched" style="margin-top:8px">Download matched list as CSV</button></div>
  <div class="sec"><h3 class="caps">Prospects (${S.prospects.length})</h3><p class="note" style="margin:0 0 6px">Atlas clinics with 2+ companies in your states that are not on your list. Facts only, not a rating.</p>
   <ul class="list">${S.prospects.slice(0, 15).map(s => `<li><button data-site="${s.i}"><span>${esc(s.facility)} <span class="note">${esc(s.city)}, ${s.state}</span></span><span class="n">${s.n_sponsors} sp &middot; ${s.n_trials} tr</span></button></li>`).join("")}</ul>
   ${S.prospects.length > 15 ? `<p class="note">${S.prospects.length - 15} more in the CSV.</p>` : ""}<button class="btn" data-copy="prospects" ${S.prospects.length ? "" : "disabled"}>Download prospects as CSV</button></div>
  <div class="sec"><h3 class="caps">Gaps (${S.gaps.length})</h3><p class="note" style="margin:0 0 6px">States scoring 50 or more where you have no sites, under the current weights.</p>
   <ul class="list">${S.gaps.map(s => `<li><button data-state="${s.abbr}"><span>${esc(s.name)} <span class="note">${s.n_sites_2plus} clinics with 2+ companies</span></span><span class="n">${Math.round(s.readiness_score)}</span></button></li>`).join("") || '<li class="note" style="padding:6px 0">None.</li>'}</ul>
   <button class="btn" data-copy="gaps" ${S.gaps.length ? "" : "disabled"}>Download gaps as CSV</button></div>
  ${S.unplaced.length || S.rows.some(u => u.issues.length) ? `<div class="sec"><h3 class="caps">Rows to check</h3><table class="grid capt"><thead><tr><th class="n">Row</th><th>Site</th><th>Located by</th><th>Note</th></tr></thead><tbody>${S.rows.filter(u => !u.p || u.issues.length).map(u => `<tr><td class="n">${u.row}</td><td>${esc(u.name || "(no name)")}</td><td>${u.p ? u.by : '<span class="badge unv">Not placed</span>'}</td><td class="note">${esc([u.why, ...u.issues].filter(Boolean).join("; "))}</td></tr>`).join("")}</tbody></table></div>` : ""}
  <p class="note">${esc(weightsLine())}. Matching uses name words and city within the same state.</p>`;
  openDrawer(`<div class="caps">Your sites</div><h2>${esc(BYO.label)}${BYO.fictional ? " (fictional)" : ""}</h2><div class="meta">${S.rows.length} rows from your file</div>`, body, "byo");
  if (fly) fitMine();
}
function fitMine() { const pts = BYO.rows.filter(u => u.p).map(u => u.p); if (!pts.length) return; flyTo(fitTransform([[d3.min(pts, p => p[0]), d3.min(pts, p => p[1])], [d3.max(pts, p => p[0]), d3.max(pts, p => p[1])]], 4, 40)); }
function clearByo() { BYO = null; pending = null; drawMine(); $("#byobtn").classList.remove("on"); legend(); closeDrawer(); toast("Your sites were cleared from this page"); }
$("#drawer").addEventListener("click", e => {
  const b = e.target.closest("#byoclear,#byotoggle,#byofit,#byonew,[data-acc],[data-rej],[data-copy]"); if (!b || !BYO && b.id !== "byonew") return;
  e.preventDefault(); e.stopPropagation();
  if (b.id === "byoclear") return clearByo();
  if (b.id === "byotoggle") { byoShow = !byoShow; gMine.attr("display", byoShow ? null : "none"); return openByo(false); }
  if (b.id === "byofit") return fitMine();
  if (b.id === "byonew") return openByoDialog("choose");
  if (b.dataset.acc || b.dataset.rej) { const u = BYO.rows.find(x => x.row === +(b.dataset.acc || b.dataset.rej)); u.accepted = !!b.dataset.acc; drawMine(); return openByo(false); }
  const S = byoStats(), k = b.dataset.copy;
  if (k === "matched") copyRows(S.rows.filter(u => u.match), [["your_site", u => u.name], ["city", u => u.city], ["state", u => u.state], ["located_by", u => u.by || "not placed"], ["atlas_clinic", u => u.match.facility], ["confidence", u => u.conf], ["accepted", u => u.accepted ? "yes" : "no"], ["atlas_sponsors", u => u.match.n_sponsors], ["atlas_companies", u => u.match.companies.map(sponsorName).join("; ")], ["state_score", u => Math.round(byAbbr[u.state].readiness_score)], ["your_notes", u => u.notes]], "matched sites");
  if (k === "prospects") copyRows(S.prospects, [["clinic", s => s.facility], ["city", s => s.city], ["state", s => s.state], ["n_sponsors", s => s.n_sponsors], ["companies", s => s.companies.map(sponsorName).join("; ")], ["drugs", s => s.drugs.join("; ")], ["n_trials", s => s.n_trials], ["status", s => s.sgroup], ["state_score", s => Math.round(byAbbr[s.state].readiness_score)], ["nct_ids", s => s.nct_ids.join("; ")]], "prospects");
  if (k === "gaps") copyRows(S.gaps, [["state", s => s.name], ["score", s => Math.round(s.readiness_score)], ["rank", s => s.rank], ["clinics", s => s.n_sites], ["clinics_2plus_sponsors", s => s.n_sites_2plus], ["legal_path", s => s.legal_category]], "gaps");
}, true);

/* ================= v1.4: company and clinic insights, old #for- links, credit and corrections ================= */
// v1.9.4: the per-reader landings are gone. Old #for-<slug> links open the same company or clinic view for everyone.
// Every number on a landing is computed here from the same data the map uses, so it matches the map,
// the strip, the lens panel and the CSV. "Recruiting" always means recruitingHere(): the registry's
// site-level status where given, otherwise the trial's overall status.

const plural = (n, one, many) => `${fmt(n)} ${n === 1 ? one : (many || one + "s")}`;
const isRecruitingSite = s => s.trials.some(t => recruitingHere(s, t));

function compStats(c) {
  const ss = SITES.filter(s => s.developers.includes(c));
  const recMine = ss.filter(s => s.trials.some(t => t.sponsor === c && recruitingHere(s, t)));
  const recOther = s => s.trials.filter(t => t.company && t.sponsor !== c && recruitingHere(s, t));
  const busy = ss.filter(s => recOther(s).length);
  const rivals = d3.rollups(busy.flatMap(s => [...new Set(recOther(s).map(t => t.sponsor))]), v => v.length, d => d).sort((a, b) => b[1] - a[1]);
  const shared = ss.filter(s => s.companies.some(o => o !== c));
  const fast = ss.filter(s => FAST.has(byAbbr[s.state].legal_category));
  return {c, ss, n: ss.length, states: new Set(ss.map(s => s.state)).size, recMine: recMine.length, busy, rivals, recOther, shared: shared.length, fast: fast.length,
    trials: Object.values(TRIALS).filter(t => t.sponsor === c)};
}
const NEAR_MILES = 250;
const miles = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 3958.8 * 2 * Math.asin(Math.sqrt(h)); };
function siteStats(s) {
  const nc = s.companies.length;
  const asMany = SITES.filter(x => x.companies.length >= nc).length;
  const recHere = s.trials.filter(t => recruitingHere(s, t)).length;
  // v1.6 (E): "nearby" is a distance, not a state boundary. For each company recruiting (site record) within
  // NEAR_MILES of this clinic, keep its nearest such location so the page can name the city and the distance.
  const nearest = new Map();
  for (const x of SITES) { if (x === s) continue; const d = miles(s, x); if (d > NEAR_MILES) continue;
    for (const t of x.trials) if (t.company && recruitingHere(x, t)) { const o = nearest.get(t.sponsor); if (!o || d < o.d) nearest.set(t.sponsor, {c: t.sponsor, x, d}); } }
  const recNear = [...nearest.keys()];
  const notYet = [...nearest.values()].filter(o => !s.companies.includes(o.c)).sort((a, b) => a.d - b.d);
  const peers = SITES.filter(x => x.state === s.state && x !== s && x.n_companies >= 2).length;
  return {nc, asMany, recHere, notYet, recNear, peers};
}

/* ---------- old #for- link slugs ---------- */
const OLD_SLUGS = {
  compass: {type: "company", key: "COMPASS Pathways"},
  definium: {type: "company", key: "Definium Therapeutics US, Inc."},
  helus: {type: "company", key: "Cybin IRL Limited"},
  cybin: {type: "company", key: "Cybin IRL Limited"},
  reunion: {type: "company", key: "Reunion Neuroscience Inc"},
  abbvie: {type: "company", key: "AbbVie"},
  atai: {type: "company", key: "atai Therapeutics, Inc."},
  ataibeckley: {type: "company", key: "atai Therapeutics, Inc."},
  beckley: {type: "company", key: "Beckley Psytech Limited"},
  resilient: {type: "company", key: "Resilient Pharmaceuticals"},
  gh: {type: "company", key: "GH Research Ireland Limited"},
  ghresearch: {type: "company", key: "GH Research Ireland Limited"},
  iit: {type: "clinic", key: "Institute for Integrative Therapies", city: "Eden Prairie"},
  sunstone: {type: "clinic", key: "Sunstone Medical, PC", city: "Rockville"},  // matched on the registry name
  mms: {type: "cro", name: "MMS"},
  cro: {type: "cro", name: ""},
  alpha: {type: "investor", name: "Psychedelic Alpha"},
  investor: {type: "investor", name: ""},
};

/* ---------- shared pieces ---------- */
function creditHTML() {
  // With no profile URL in builder.json, no profile link is rendered.
  const li = BUILDER.linkedin ? `<a href="${esc(BUILDER.linkedin)}" target="_blank" rel="noopener">${esc(BUILDER.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""))}</a>` : "";
  // v1.6.1: "Tell me" links to contact (email or URL) first, else the LinkedIn profile. check_numbers fails if both are empty.
  const c = (BUILDER.contact || "").trim(), reply = c ? (/^(https?:|mailto:)/.test(c) ? c : c.includes("@") ? "mailto:" + c : c) : (BUILDER.linkedin || "").trim();
  const tell = reply ? `<a href="${esc(reply)}" target="_blank" rel="noopener" id="tellme">Tell me</a>` : "Tell me";
  return `<div class="sec credit"><p>Built from public data. Spot something wrong? ${tell}.</p>
   <p class="note">Built by ${esc(BUILDER.name)}. ${esc(BUILDER.what)}${li ? " " + li : ""}</p></div>`;
}
// v1.9.4: one neutral line on how far the legal reading has got, wherever scores or legal figures appear.
const legalWarnHTML = () => `<p class="note" id="legalwarn">${legalLine()}</p>`;
const stat3 = items => `<div class="stat3">${items.map(([v, k]) => `<div><span class="v mono">${fmt(v)}</span><span class="k">${k}</span></div>`).join("")}</div>`;

/* ---------- company: insight at the top of the lens panel ---------- */
function lensInsight(c) {
  const k = compStats(c), name = esc(sponsorName(c));
  const who = `${name} trials have`;
  let ins;
  if (k.busy.length) {
    // v1.7.1: ties at the top count name every company at that count ("A and B, at 9 clinics each").
    const topN = k.rivals.length ? k.rivals[0][1] : 0, tied = k.rivals.filter(r => r[1] === topN).map(r => sponsorName(r[0])).sort((a, b) => a.localeCompare(b));
    const allNames = k.rivals.map(r => sponsorName(r[0])).sort((a, b) => a.localeCompare(b));
    ins = k.n === 1 ? `That clinic is recruiting for ${esc(andList(allNames))} right now.` : `${plural(k.busy.length, "of these clinics is", "of these clinics are")} recruiting for another company right now${topN ? `, most often for ${esc(andList(tied))}, ${tied.length > 1 ? `at ${topN} clinics each` : `at ${topN} of them`}` : ""}. A new study would compete there for patients and staff.`;
  } else if (k.shared) ins = k.n === 1 ? `That clinic has also run trials for ${plural(k.ss[0].n_companies - 1, "other company", "other companies")}.` : `${plural(k.shared, "of these clinics has", "of these clinics have")} also run trials for other companies.`;
  else ins = k.n === 1 ? `That clinic has not run a trial for another company.` : `None of these clinics has run a trial for another company.`;
  if (k.n <= 3) ins += ` <button class="linkish" id="gocro">See the ${SITES.filter(s => s.tier === 3).length} US clinics that have worked with 4 or more companies</button>.`;
  const busyList = k.busy.slice().sort((a, b) => k.recOther(b).length - k.recOther(a).length || a.facility.localeCompare(b.facility));
  return `<div class="sec ins">
    <p class="big">${who} used ${plural(k.n, "US clinic")} in ${plural(k.states, "state")}.</p>
    <p class="lede2">${ins}</p>
    ${stat3([[k.recMine, `recruiting for ${name} now (site record)`], [k.busy.length, "recruiting for another company now (site record)"], [k.fast, "in states whose legal path scores 75 or more"]])}
    ${legalWarnHTML()}
    ${busyList.length ? `<details class="busy"><summary>Which clinics, and for whom</summary><ul class="list">${busyList.map(s => `<li><button data-site="${s.i}"><span>${esc(s.facility)}<br><span class="note">${esc(s.city)}, ${s.state} &middot; ${[...new Set(k.recOther(s).map(t => sponsorName(t.sponsor)))].map(esc).join(", ")}</span></span><span class="n">${k.recOther(s).length}</span></button></li>`).join("")}</ul><button class="btn" id="busycopy">Copy this list as CSV</button></details>` : ""}
  </div>`;
}
/* ---------- clinic: insight at the top of the clinic panel ---------- */
function siteInsight(s) {
  const k = siteStats(s), st = byAbbr[s.state];
  const big = `This clinic has run ${plural(s.n_trials, "registered psychedelic trial")}${k.nc ? ` for ${plural(k.nc, "company", "companies")}` : ", none of them for a company"}.`;
  const rank = !k.nc ? "" : k.asMany === 1 ? `No other US clinic has worked with as many companies.` : `${k.asMany} of ${fmt(SITES.length)} US clinics have worked with ${plural(k.nc, "company", "companies")} or more, and this is one of them.`;
  const prospects = k.notYet.length ? `Companies recruiting within ${NEAR_MILES} miles that have not used this clinic yet: ${k.notYet.map(o => `<button class="linkish" data-lens="${esc(o.c)}">${esc(sponsorName(o.c))}</button> (nearest: ${esc(o.x.facility)}, ${esc(o.x.city)}, ${o.x.state}, ${Math.round(o.d)} miles in a straight line)`).join("; ")}.`
    : k.recNear.length ? `Every company recruiting within ${NEAR_MILES} miles has already used this clinic.` : "";
  return `<div class="sec ins">
    <p class="big">${big}</p>
    ${rank || prospects ? `<p class="lede2">${rank} ${prospects}</p>` : ""}
    ${stat3([[k.recHere, "trials recruiting here now (site record)"], [k.peers, `other ${esc(st.name)} clinics with 2+ companies`], [st.rank, `${esc(st.name)}'s readiness rank of 51`]])}
  </div>`;
}

/* ---------- CRO view: the most experienced clinics ---------- */
function openCro(fly = true) {
  const vets = SITES.filter(s => s.tier === 3).sort((a, b) => a.state.localeCompare(b.state) || b.n_companies - a.n_companies);
  const recN = s => s.trials.filter(t => recruitingHere(s, t)).length;
  const idle = vets.filter(s => !recN(s)), busy = vets.filter(s => recN(s) >= 2);
  const byS = d3.groups(vets, s => s.state).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const body = `<div class="sec ins">
    <p class="big">${plural(vets.length, "US clinic has", "US clinics have")} run psychedelic trials for 4 or more companies.</p>
    <p class="lede2">${plural(idle.length, "of them has", "of them have")} no trial whose site record says recruiting, so ${idle.length === 1 ? "it" : "they"} may have room for a new study. ${plural(busy.length, "is", "are")} running 2 or more recruiting trials at once.</p>
    ${stat3([[new Set(vets.map(s => s.state)).size, "states"], [vets.length - idle.length, "recruiting now"], [idle.length, "not recruiting now"]])}
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary" id="crocopy">Copy these clinics as CSV</button><button class="btn" id="croall">Show all ${fmt(SITES.length)} clinics</button></div></div>
  <div class="sec"><h3 class="caps">By state</h3>${byS.map(([st, arr]) => `<div class="caps" style="margin:10px 0 2px">${esc(byAbbr[st].name)} <span class="note">${arr.length}</span></div><ul class="list">${arr.map(s => `<li><button data-site="${s.i}"><span>${esc(s.facility)}<br><span class="note">${esc(s.city)} &middot; ${plural(s.n_companies, "company", "companies")}</span></span><span class="n">${recN(s) ? `${recN(s)} recruiting` : "not recruiting"}</span></button></li>`).join("")}</ul>`).join("")}</div>
`;
  openDrawer(`<div class="caps">For CROs and site selection</div><h2>The most experienced clinics</h2>`, body, "cro");
  if (fly) { const pts = vets.filter(s => s.p).map(s => s.p); flyTo(fitTransform([[d3.min(pts, p => p[0]), d3.min(pts, p => p[1])], [d3.max(pts, p => p[0]), d3.max(pts, p => p[1])]], 4, 40)); }
}
function croRows() { return SITES.filter(s => s.tier === 3); }

/* ---------- investor view: who is where ---------- */
function companyTable() {
  return DEVELOPERS.map(c => { const k = compStats(c); return {c, n: k.n, states: k.states, rec: k.recMine, trials: k.trials.length, p3: k.trials.filter(t => t.phases.includes("3")).length}; }).sort((a, b) => b.n - a.n);
}
function openInvestor(fly = true) {
  const rows = companyTable();
  const nTr = Object.keys(TRIALS).length, spAll = new Set(Object.values(TRIALS).map(t => t.sponsor)), others = spAll.size - DEVELOPERS.length;
  const grp = g => [...spAll].filter(n => spClass(n) === g && !DEVELOPERS.includes(n)).length;
  const both = SITES.filter(s => s.sponsors.includes("atai Therapeutics, Inc.") && s.sponsors.includes("Beckley Psytech Limited")).length;
  const top = rows[0], used = SITES.filter(s => s.companies.length), multi = used.filter(s => s.companies.length >= 2);
  const st5 = STATES.slice().sort((a, b) => a.rank - b.rank).slice(0, 5);
  const body = `<div class="sec ins">
    <p class="big">${plural(nTr, "registered psychedelic trial")} at ${plural(SITES.length, "US clinic")}, run by ${plural(COMPANIES.length, "company", "companies")}, ${plural(NONPROFIT_DEVS.length, "non-profit developer")} (${NONPROFIT_DEVS.map(n => esc(n)).join(", ")}) and ${fmt(others)} universities, hospitals, individual investigators, government bodies and other non-profits.</p>
    <p class="lede2">${esc(sponsorName(top.c))} has the widest US footprint, with ${plural(top.n, "clinic")} in ${plural(top.states, "state")}. ${fmt(multi.length)} of the ${fmt(used.length)} clinics used by any company have worked with two or more companies, so the field shares much of the same clinic base.</p></div>
  <div class="sec"><h3 class="caps">Developers by US clinic footprint</h3><div class="tscroll"><table class="grid fit" id="invtbl"><thead><tr><th>Company or non-profit</th><th class="n">Clinics</th><th class="n">States</th><th class="n" title="Clinics whose own registry record says recruiting for that developer">Recruiting</th><th class="n">Trials</th><th class="n" title="Phase 3 trials">Ph&nbsp;3</th></tr></thead>
    <tbody>${rows.map(r => `<tr class="click" data-lens="${esc(r.c)}"><td class="nm">${esc(sponsorName(r.c)).replace(/-/g, "‑")}</td><td class="n">${r.n}</td><td class="n">${r.states}</td><td class="n">${r.rec}</td><td class="n">${r.trials}</td><td class="n">${r.p3}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">Click a row to see its clinics. "Recruiting now" counts clinics whose own registry record says recruiting for that developer.</p>
    <p class="note" id="spgroups">Usona Institute is a non-profit, listed because it runs a Phase 3 psilocybin trial. Every other sponsor is classed on the page as an institution, an individual investigator, government or a non-profit: ${plural(grp("Institution"), "institution")} (universities, hospitals and clinics), ${plural(grp("Individual investigator"), "individual investigator")}, ${plural(grp("Government"), "government sponsor")} (VA and NIH) and ${plural(grp("Non-profit"), "other non-profit")}, such as Nautilus Sanctuary.</p>
    <p class="note" id="ataibeckley">atai and Beckley Psytech are now one company, AtaiBeckley, which Eli Lilly has agreed to acquire (announced 16 Jul 2026). They are shown as two rows because the registry lists them as separate sponsors. ${plural(both, "clinic has", "clinics have")} worked with both.</p>
    <button class="btn" id="invcopy">Copy this table as CSV</button></div>
  <div class="sec"><h3 class="caps">Top 5 states for launch readiness</h3>${legalWarnHTML()}<ul class="list">${st5.map(s => `<li><button data-state="${s.abbr}"><span class="mono" style="width:24px;color:var(--ink-3)">${s.rank}</span><span>${esc(s.name)}<br><span class="note">${s.n_sites} clinics &middot; ${esc(s.legal_category)}</span></span><span class="n">${Math.round(s.readiness_score)}</span></button></li>`).join("")}</ul></div>
`;
  openDrawer(`<div class="caps">For investors and analysts</div><h2>Who is running trials where</h2>`, body, "investor");
  if (fly) flyTo(fitTransform(homeBounds(), 8, 10, true));
}

/* ---------- drawer actions for the new panels ---------- */
$("#drawer").addEventListener("click", e => {
  const b = e.target.closest("#busycopy,#crocopy,#croall,#invcopy,#gocro,tr[data-lens]"); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.id === "busycopy") { const k = compStats(lens); copyRows(k.busy, [["clinic", s => s.facility], ["city", s => s.city], ["state", s => s.state], ["recruiting_for_other_companies", s => [...new Set(k.recOther(s).map(t => sponsorName(t.sponsor)))].join("; ")], ["other_company_trials_recruiting", s => k.recOther(s).length]], `${sponsorName(lens)} clinics recruiting for others`); }
  else if (b.id === "crocopy") copyCSV(croRows(), "clinics with 4+ companies");
  else if (b.id === "croall") { F.tier.clear(); update(); }
  else if (b.id === "gocro") { setLens(""); F.tier.clear(); F.tier.add("4+ companies"); update(); openCro(); }
  else if (b.id === "invcopy") copyRows(companyTable(), [["company", r => sponsorName(r.c)], ["registry_name", r => r.c], ["clinics", r => r.n], ["states", r => r.states], ["clinics_recruiting_now", r => r.rec], ["trials", r => r.trials], ["phase_3_trials", r => r.p3]], "companies by footprint");
  else if (b.dataset.lens) setLens(b.dataset.lens, true);
}, true);

/* v1.9: the first-load hint is replaced by the guided tour (app_v19.js). */

/* ---------- routing for #for-... ---------- */
function handleLanding(slug) {
  // v1.9.3 (D94): one site for everyone. Per-audience pages are gone; an old #for-<slug> link opens the same atlas.
  // A company slug opens that company's lens, a clinic slug opens the clinic; any other slug shows the map.
  const m = slug ? [null, slug] : location.hash.match(/^#for-([a-z0-9-]+)$/);
  if (!m) return false;
  const cfg = OLD_SLUGS[m[1].replace(/-/g, "")];
  history.replaceState(null, "", location.pathname + location.search + "#map");
  Object.values(F).forEach(x => x.clear()); setLens(""); update();
  if (!cfg || cfg.type === "cro" || cfg.type === "investor") { if (typeof closeDrawer === "function") closeDrawer(); return false; }
  if (cfg.type === "company") { setLens(cfg.key, true); }
  else if (cfg.type === "clinic") {
    const s = SITES.find(x => x.registry_facility === cfg.key && x.city === cfg.city) || SITES.find(x => x.registry_facility === cfg.key);
    if (!s) return false;
    openSite(s.i, false);
    // Zoom close enough to see the clinic's neighbours, not so close that the state disappears.
    const f = frame(); flyTo(d3.zoomIdentity.translate((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2).scale(isMobile() ? 3.2 : 4).translate(-s.p[0], -s.p[1]));
  }
  // v1.5 (DESIGN 19): no "What you can do here" hint on any #for- landing. The general map keeps it.
  return true;
}
addEventListener("hashchange", () => { if (/^#for-/.test(location.hash)) handleLanding(); });
// v1.7.2: the first-visit hint shows only on the plain map view, never on #methods, #states, #clinics or a landing.
// v1.9: the guided tour shows once, on a first visit to the plain map only (never on a landing or another page).
// v1.9.5a: the tour opens each time the atlas is opened at the map, once per browser session.
setTimeout(() => { if (!handleLanding() && /^(#map)?$/.test(location.hash) && !tourSeen.get()) { tourSeen.set(); startTour(true); } }, 60);

/* ================= v1.9: tour, glossary, routes, page counting ================= */

/* ---------- glossary: each word is defined once, here ---------- */
// v1.9.3 (D95): fuller glossary, plain language, one or two sentences each. Grouped so it reads top to bottom.
const GLOSS = [
  ["Clinic", "A place listed as a trial location on ClinicalTrials.gov. Names are merged within a city, so a large institution, such as Johns Hopkins in Baltimore, counts as one clinic."],
  ["Trial", "A registered interventional study on ClinicalTrials.gov that tests one of the drugs covered here, has a US location and has started."],
  ["Sponsor", "The organisation or person the registry names as responsible for a trial (the lead sponsor). It can be a company, a university, a hospital, a non-profit, a government body or an individual investigator."],
  ["Company", "A lead sponsor that the registry classes as industry. Usona Institute, a non-profit with a Phase 3 trial, is shown beside the companies but never counted as one."],
  ["Site record", "The registry's entry for one trial at one location. It may give a status for that location, such as recruiting, but most do not."],
  ["Recruiting", "The site record for that trial at that clinic says it is recruiting."],
  ["Not recruiting", "Every other case, including trials that give no status for this clinic. So the recruiting count can be lower than the truth, never higher."],
  ["Phase", "The stage of a drug's testing in people. Phase 1 checks safety, Phase 2 looks for an effect and the dose, and Phase 3 confirms the effect in larger groups before approval."],
  ["Compound", "The drug a trial tests. Where the registry gives a code, such as COMP360, it is shown with its drug class; otherwise only the class is shown."],
  ["Readiness score", `A 0 to 100 score for each state. It combines trial experience (${Math.round(effWeights().experience * 100)}%) and legal path (${Math.round(effWeights().legal * 100)}%); clinics are never scored.`],
  ["Trial experience", "How much psychedelic trial work a state has done: its clinics, its clinics that have worked with 2 or more companies, and its company trials, scaled across the 50 states and DC."],
  ["Legal path", "How a drug that the FDA approves and the federal government reschedules would become legal to use in a state. Each state is scored on the strongest mechanism its law has."],
  ["Own state program", "A state law or program that already allows use of a drug outside federal approval, such as Oregon's licensed services. It scores 100."],
  ["Trigger or conditional law", "A state law that takes effect by itself, or opens a pathway, once federal approval or rescheduling happens. It scores 100."],
  ["General follow-federal rule", "The state schedule changes with the federal one without any state official adopting a rule or order. A short waiting period or a right to object is allowed; each state's card gives its details. It scores 75."],
  ["Regulator must act", "An official or board must adopt a rule, regulation or order before the state schedule changes, even when that is required and has a deadline. It scores 50."],
  ["Legislature must act", "Only the legislature can change the state schedule, by passing a law. It scores 25."],
  ["Not yet checked", "Nobody has read the state's law for the atlas yet. It scores 0 on the legal path until it is read."],
  ["Which score a state gets", "Does the state schedule change with the federal one on its own? That is 75. Does an official or board have to adopt a rule or order first, even with a deadline? That is 50. Can only the legislature change it? That is 25. A state with its own program, or a law that switches on at FDA approval, is 100. If the statute says control follows after a waiting period unless the official objects, and it does not require a rule or order, the state is 75. If it says the official must adopt a rule, regulation or order, it is 50. A state is scored on its highest mechanism; the drugs covered are in small text on its card."],
  ["Drugs covered", "The drugs a state's law names, shown in small text on its card. The category and score depend on the mechanism, not on the drug."],
];
const glossDef = w => (GLOSS.find(g => g[0] === w) || [])[1] || "";
const glossHTML = () => `<dl class="gloss">${GLOSS.map(([w, d]) => `<dt>${w}</dt><dd>${d}</dd>`).join("")}</dl>`;
$("#glossbody").innerHTML = glossHTML();
if ($("#aboutgloss")) $("#aboutgloss").innerHTML = glossHTML();
let glossReturn = null;
function openGloss() { glossReturn = document.activeElement; $("#gloss").hidden = false; $("#glossclose").focus(); }
function closeGloss() { $("#gloss").hidden = true; if (glossReturn && glossReturn.focus) glossReturn.focus(); }
document.addEventListener("click", e => { if (e.target.closest("[data-gloss]")) { e.preventDefault(); openGloss(); } });
$("#glossclose").onclick = closeGloss;
$("#gloss").addEventListener("click", e => { if (e.target.id === "gloss") closeGloss(); });

/* ---------- guided tour ---------- */
// v1.9.5: seven stops in a fixed order: legend, map, filters, Your sites, States, Clinics, Next stage.
// v1.9.5a: opens by itself each time the atlas is opened at the map (once per browser session), and any time from "How to use".
// The legend is open only on its own step; the map step glows the outline of the map instead of drawing a box.
const TOUR = [
  {t: "The legend", p: "The legend explains the map: the shade scale for the states, what the clinic colours mean, and the legal path scores. Open or close it at any time.",
   el: () => { if (typeof lgOpen !== "undefined" && !lgOpen) { lgOpen = true; legend(); } const b = $("#legend").getBoundingClientRect(); return b.width ? b : null; }},
  {t: "The map", p: "Each light is a clinic that has run a registered psychedelic trial. States are shaded by a readiness score from 0 to 100; the legend shows which shade means a higher score.",
   glow: true, el: () => { const b = $("#states").getBoundingClientRect(); return b.width ? b : null; }},
  {t: "Filters", p: "Narrow the map by state, drug, phase, recruiting or company. Open a group to choose. A number on a group shows how many choices in it are on.",
   el: () => { if (isMobile()) return $("#mobfilters").getBoundingClientRect(); $("#rail").classList.remove("collapsed"); return $("#rail").getBoundingClientRect(); }},
  {t: "Your sites", p: "Upload a list of your own sites to see only those on the map, matched to clinics that have run psychedelic trials. The file stays in your browser.",
   el: () => $("#byobtn").getBoundingClientRect()},
  {t: "The States page", p: "Every state's score, its trial experience and its legal path once a drug is approved. Open a state for the law behind its legal path.",
   el: () => $('nav.views a[data-view="states"]').getBoundingClientRect()},
  {t: "The Clinics page", p: "Every clinic, one row each, with its status, trials, and each company with its compounds and trials there. Click a row to open the clinic's full page, or export the list as CSV.",
   el: () => $('nav.views a[data-view="clinics"]').getBoundingClientRect()},
  {t: "Next stage", p: "What is coming: a company comparison, a printable clinic summary, an end-of-life and palliative view, Spravato capacity and condition burden. Open Next stage at the foot of any page.",
   el: () => { const a = $('#foot a[href="#next"]'); const b = a && a.getBoundingClientRect(); return b && b.width ? b : null; }, last: true},
];
let tourI = -1, tourReturn = null, tourLg = null;
const tourSeen = {get() { try { return sessionStorage.getItem("atlas-tour-1"); } catch (e) { return "1"; } }, set() { try { sessionStorage.setItem("atlas-tour-1", "1"); } catch (e) {} }};
function placeTour() {
  const st = TOUR[tourI], box = $("#tour"), ring = $("#tourring");
  if (tourI > 0 && typeof lgOpen !== "undefined" && lgOpen) { lgOpen = false; legend(); }
  let r = null; try { r = st.el(); } catch (e) { r = null; }
  const pad = 6;
  $("#map").classList.toggle("tourglow", !!st.glow); document.body.classList.toggle("tourdim", !!st.glow);
  if (st.glow) {
    ring.hidden = true;
    const bw = box.offsetWidth, bh = box.offsetHeight, rail = $("#rail").getBoundingClientRect();
    const x = isMobile() || !rail.width ? (innerWidth - bw) / 2 : rail.right + 16, y = isMobile() ? innerHeight - bh - 40 : Math.max(120, rail.top + 16);
    box.style.left = Math.max(12, Math.min(innerWidth - bw - 12, x)) + "px"; box.style.top = Math.max(60, Math.min(innerHeight - bh - 32, y)) + "px";
    return;
  }
  if (r && r.width) {
    ring.hidden = false;
    Object.assign(ring.style, {left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + 2 * pad + "px", height: r.height + 2 * pad + "px"});
  } else { ring.hidden = false; Object.assign(ring.style, {left: innerWidth / 2 + "px", top: innerHeight / 2 + "px", width: "0px", height: "0px"}); }
  const bw = box.offsetWidth, bh = box.offsetHeight, m = 12;
  let x, y;
  if (!r || !r.width) { x = (innerWidth - bw) / 2; y = (innerHeight - bh) / 2; }
  else if (r.bottom + pad + m + bh < innerHeight - 30 && r.height < innerHeight * 0.5) { x = r.left; y = r.bottom + pad + m; }
  else if (r.top - pad - m - bh > 56) { x = r.left; y = r.top - pad - m - bh; }
  else if (r.right + pad + m + bw < innerWidth) { x = r.right + pad + m; y = r.top; }
  else if (r.left - pad - m - bw > 0) { x = r.left - pad - m - bw; y = r.top; }
  else { x = (innerWidth - bw) / 2; y = innerHeight - bh - 40; }
  box.style.left = Math.max(12, Math.min(innerWidth - bw - 12, x)) + "px";
  box.style.top = Math.max(60, Math.min(innerHeight - bh - 32, y)) + "px";
}
function showTourStep(i) {
  tourI = i; const st = TOUR[i], box = $("#tour");
  box.innerHTML = `<div class="caps">How to use</div><h2 id="tourtitle">${st.t}</h2><p>${st.p}</p>
    <div class="trow"><span class="tstep">${i + 1} of ${TOUR.length}</span>${i ? `<button class="btn" id="tourback">Back</button>` : `<button class="btn" id="tourskip">Skip</button>`}${st.last ? `<button class="btn primary" id="tourdone">Done</button>` : `<button class="btn primary" id="tournext">Next</button>`}</div>`;
  box.hidden = false; placeTour();
  const f = $("#tournext") || $("#tourdone"); if (f) f.focus();
}
function startTour(auto) {
  if (!$("#v-map") && document.body.classList.contains("pagemode")) return;
  if (location.hash && !/^#(map)?$/.test(location.hash)) { if (auto) return; location.hash = "#map"; }
  if (isMobile()) $("#rail").classList.remove("mopen");
  if ($("#drawer").classList.contains("open") && !auto) closeDrawer();
  tourReturn = auto ? null : document.activeElement; tourLg = typeof lgOpen !== "undefined" ? lgOpen : null;
  setTimeout(() => showTourStep(0), auto ? 0 : 80);
}
function endTour() {
  if (tourI < 0) return; tourI = -1; $("#tour").hidden = true; $("#tourring").hidden = true; tourSeen.set();
  $("#map").classList.remove("tourglow"); document.body.classList.remove("tourdim");
  if (tourLg !== null && typeof lgOpen !== "undefined" && lgOpen !== tourLg) { lgOpen = tourLg; legend(); }
  const back = tourReturn && tourReturn !== document.body && document.contains(tourReturn) ? tourReturn : $("#tourbtn"); back.focus();
}
$("#tourbtn").onclick = () => startTour(false);
$("#tour").addEventListener("click", e => {
  const id = e.target.id;
  if (id === "tournext") showTourStep(tourI + 1); else if (id === "tourback") showTourStep(tourI - 1);
  else if (id === "tourskip" || id === "tourdone") endTour();
});
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!$("#gloss").hidden) { closeGloss(); e.stopPropagation(); return; }
  if (tourI >= 0) { endTour(); e.stopPropagation(); }
}, true);
addEventListener("resize", () => { if (tourI >= 0) placeTour(); });
addEventListener("hashchange", () => { if (tourI >= 0 && !/^#(map)?$/.test(location.hash)) endTour(); });

/* ---------- visits: every view counts as a page in GoatCounter (website build only) ---------- */
function countView() {
  const gc = window.goatcounter; if (!gc || !gc.count || !location.hash || location.hash === "#map") return;
  gc.count({path: location.pathname + location.hash, title: document.title});
}
addEventListener("hashchange", countView);

/* ---------- v1.9 (D82): a clinic as its own page at #clinic/S0007. Same panel, full width, can open in a new tab. ---------- */
const siteById = id => SITES.find(s => s.id === id);
function pageRoute() {
  // v1.9.3 (D99): #clinic-S0007 works the same as #clinic/S0007 (some viewers pass only plain #name hashes).
  const m = location.hash.match(/^#clinic[\/-]([A-Za-z0-9_]+)$/), on = !!m && !!siteById(m[1]);
  const was = document.body.classList.contains("pagemode");
  document.body.classList.toggle("pagemode", on);
  if (!on) { if (m) location.replace("#map"); else if (was) { closeDrawer(); document.title = "Psychedelic Launch Readiness Atlas (US)"; route(); } return; }
  const s = siteById(m[1]); openSite(s.i, false);
  $("#dclose").setAttribute("aria-label", "Back to the map");
  document.title = `${s.facility}, ${s.city} - Psychedelic Launch Readiness Atlas (US)`;
  if (isMobile()) setSheet(innerHeight * 0.88);
}
function leavePage() { if (!document.body.classList.contains("pagemode")) return false; document.body.classList.remove("pagemode"); $("#dclose").setAttribute("aria-label", "Close details (Esc)"); history.replaceState(null, "", "#map"); document.title = "Psychedelic Launch Readiness Atlas (US)"; return true; }
// Any action inside the page (a company, a state, another clinic) returns to the map first, then runs as usual.
$("#drawer").addEventListener("click", e => { if (document.body.classList.contains("pagemode") && e.target.closest("[data-state],[data-site],[data-lens],[data-cmp],[data-filter-state]")) leavePage(); }, true);
$("#dclose").addEventListener("click", () => { if (leavePage()) closeDrawer(); }, true);
addEventListener("hashchange", pageRoute);
if (/^#clinic[\/-]/.test(location.hash)) setTimeout(pageRoute, 0);

/* ---------- v1.9 (D84): clinics a company shares with every other company, from the same data as the map. ---------- */
function overlapHTML(c) {
  const ss = SITES.filter(s => s.developers.includes(c)); if (!ss.length) return "";
  const others = [...new Set(ss.flatMap(s => s.developers))].filter(o => o !== c);
  const rows = others.map(o => [o, ss.filter(s => s.developers.includes(o))]).sort((a, b) => b[1].length - a[1].length || sponsorName(a[0]).localeCompare(sponsorName(b[0])));
  if (!rows.length) return `<div class="sec" id="overlap"><h3 class="caps">Clinics shared with other companies</h3><p class="note">None of these clinics has run a trial for another company.</p></div>`;
  const nm = esc(sponsorName(c));
  return `<div class="sec" id="overlap"><h3 class="caps">Clinics shared with other companies</h3>
   <p class="note" style="margin-top:0">Of the ${plural(ss.length, "US clinic")} ${nm} has used, how many have also run a registered trial for each other company, at any time.</p>
   ${rows.map(([o, sh]) => `<details class="ovl"><summary><span class="ovn">${esc(sponsorName(o))}</span><span class="ovbar" aria-hidden="true"><span style="width:${Math.round(100 * sh.length / ss.length)}%"></span></span><span class="n mono">${sh.length} of ${ss.length}</span></summary><ul class="list">${sh.sort((a, b) => a.facility.localeCompare(b.facility)).map(s => `<li><button data-site="${s.i}"><span>${esc(s.facility)}<br><span class="note">${esc(s.city)}, ${s.state}</span></span></button></li>`).join("")}</ul></details>`).join("")}</div>`;
}

// Esc on a full-width page goes back to the map (the panel's own Esc handler then closes it).
document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("pagemode") && tourI < 0 && !document.querySelector(".open#byodlg,.open#copyfb") && $("#gloss").hidden) leavePage(); }, true);

/* ---------- boot ---------- */
resize();
setTheme(store.get("atlas-theme") || "dark");
update(); route();
// v1.9.4: the weights quoted in Methods come from effWeights(), and the CSV note carries the data date.
{ const e = effWeights(); $$(".w-exp").forEach(x => x.textContent = Math.round(e.experience * 100)); $$(".w-leg").forEach(x => x.textContent = Math.round(e.legal * 100)); }
$$(".asofx").forEach(x => x.textContent = META.asof_label);
if (SITE_BUILD && location.search) $("#homelink").href = "index.html" + location.search;
if (SITE_BUILD) document.querySelectorAll(".siteurl").forEach(e => e.textContent = location.origin + location.pathname);
legend(); homeT = fitTransform(homeBounds(), 8, 10, true);
svg.call(zoom.transform, homeT);
requestAnimationFrame(() => {
  $("#boot").classList.add("done");
  statePaths.each(function (f) { const el = this, d = RM ? 0 : 120 + byFips[f.id].rank * 14; setTimeout(() => el.classList.remove("ghost"), d); });
  if (!RM) { lights.attr("opacity", 0).transition().delay(s => 700 + (4 - s.tier) * 120 + Math.random() * 200).duration(300).attr("opacity", 1); }
});
window.__atlas = {byo: () => BYO, weights: w => { Object.assign(WTS, w); renderScoring(); rescore(); }, SITES, STATES, setLens, openState, openSite, F, update, compare: () => compare, toggleCompare, openCompare, CSV_COLS, sponsorName};
})();
