"use strict";
// Aplicație de antrenamente pentru portar de handbal.
// Totul rulează local: fără server, fără cont, fără API-uri. Datele stau în localStorage.

const EX = Object.fromEntries(window.EXERCISES.map((e) => [e.id, e]));
const STORE_KEY = "portar-v1";

const DAY_NAMES = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const STATES = { liber: "Liber", meci: "Meci", handbal: "Handbal", sala: "Sală" };
const ZONES = { picioare: "Picioare", adductori: "Adductori", spate: "Spate", umar: "Umăr", trunchi: "Trunchi", brate: "Brațe" };
const TYPES = ["forta", "completare", "explozie"]; // ordinea rotației
const TYPE_LABEL = { forta: "Forță grea", completare: "Completare", explozie: "Explozie (portar)" };
const CAT_LABEL = { forta: "Forță", completare: "Completare", explozie: "Explozie", mobilitate: "Mobilitate" };
const COND_LABEL = { bine: "Bine", obosit: "Obosit", durere: "Mă doare ceva" };

// Serii / repetări pe tip (punctul 5). work/rest = secunde, pentru estimarea duratei.
const RX = {
  forta:      { sets: [3, 4], reps: [4, 6],   work: 40, rest: 150 },
  completare: { sets: [3, 3], reps: [8, 12],  work: 40, rest: 75, sec: [30, 45] },
  explozie:   { sets: [3, 5], reps: [3, 5],   work: 20, rest: 90 },
  mobilitate: { sets: [2, 2], reps: [8, 8],   work: 40, rest: 20, sec: [30, 30] },
};
const TRANSITION = 60; // secunde între exerciții
const MIN_TOTAL = 60;  // minute

// ---------- stocare ----------
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (d && d.days && d.workouts) return { settings: {}, ...d };
  } catch (_) {}
  return { days: {}, workouts: {}, settings: { adductorHeavyOk: false } };
}
let db = load();
let storageOk = true;
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); storageOk = true; }
  catch (_) { storageOk = false; }
}

// ---------- date (ora locală, nu UTC) ----------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); };
const fmtDate = (s) => { const d = parseYmd(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dayName = (s) => DAY_NAMES[(parseYmd(s).getDay() + 6) % 7];

function dayState(date) {
  if (db.days[date]) return db.days[date];
  const wd = parseYmd(date).getDay();
  return wd === 2 || wd === 4 ? "sala" : "liber"; // sala de obicei marți și joi
}

// ---------- utilitare ----------
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (arr) => arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
const roundTo = (x, step) => (step ? Math.round(x / step) * step : x);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function workoutsBefore(date) {
  return Object.values(db.workouts).filter((w) => w.date < date).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ultima înregistrare (serii făcute) pentru un exercițiu, înainte de o dată
function lastLog(exId, date) {
  for (const w of workoutsBefore(date)) {
    for (const b of w.blocks) for (const it of b.items) {
      if (it.id === exId && it.log && it.log.some((s) => s.r !== "" && s.r != null)) return { item: it, date: w.date };
    }
  }
  return null;
}
function lastPrescription(exId, date) {
  for (const w of workoutsBefore(date)) for (const b of w.blocks) for (const it of b.items) if (it.id === exId) return it;
  return null;
}

// ---------- generarea antrenamentului ----------
function generate(date, condition, painZones) {
  const prev = workoutsBefore(date)[0];
  const planned = prev ? TYPES[(TYPES.indexOf(prev.planned) + 1) % TYPES.length] : "forta";
  const tired = condition === "obosit";
  const type = tired && planned === "forta" ? "completare" : planned;

  const recent = new Set();
  if (prev) prev.blocks.forEach((b) => b.items.forEach((it) => it.id && recent.add(it.id)));
  const lastUsed = {};
  workoutsBefore(date).slice().reverse().forEach((w) => w.blocks.forEach((b) => b.items.forEach((it) => { if (it.id) lastUsed[it.id] = w.date; })));

  const ok = (e) =>
    !e.zones.some((z) => painZones.includes(z)) &&
    !(e.onlyIfWell && condition !== "bine") &&
    !(e.heavyAdductor && !db.settings.adductorHeavyOk);

  const used = new Set();
  const pick = (cat, n) => {
    const pool = shuffle(window.EXERCISES.filter((e) => e.cat === cat && ok(e) && !used.has(e.id)));
    pool.sort((a, b) => (recent.has(a.id) - recent.has(b.id)) || ((lastUsed[a.id] || "") < (lastUsed[b.id] || "") ? -1 : (lastUsed[a.id] || "") > (lastUsed[b.id] || "") ? 1 : 0));
    const out = pool.slice(0, n);
    out.forEach((e) => used.add(e.id));
    return out;
  };

  const rx = (e, cat) => prescribe(e, cat, date, tired);

  const warm = [{ text: "Cardio ușor (bicicletă, coardă sau alergare ușoară)", min: 5 }, ...pick("mobilitate", 2).map((e) => rx(e, "mobilitate"))];
  const mainCount = { forta: 3, completare: 4, explozie: 3 }[type];
  const main = pick(type, mainCount).map((e) => rx(e, type));
  const extra = [];
  let coolMob = pick("mobilitate", 2);
  // dacă nu mai sunt exerciții de mobilitate noi, le reluăm pe cele de la încălzire
  if (!coolMob.length) coolMob = warm.filter((it) => it.id).map((it) => EX[it.id]);
  const cool = [...coolMob.map((e) => rx(e, "mobilitate")), { text: "Mers ușor și respirație lentă", min: 3 }];

  const blocks = () => [
    { title: "Încălzire", items: warm },
    { title: "Partea principală", items: main },
    { title: "Exerciții de completare", items: extra },
    { title: "Revenire", items: cool },
  ];
  // completăm până se atinge durata minimă
  while (totalMinutes(blocks()) < MIN_TOTAL) {
    const next = pick("completare", 1)[0];
    if (!next) break;
    extra.push(rx(next, "completare"));
  }
  const notes = [];
  const total = totalMinutes(blocks());
  if (total < MIN_TOTAL) notes.push(`Din cauza zonelor bifate au rămas puține exerciții: ~${total} min. Poți adăuga serii la exercițiile rămase.`);
  if (tired && planned === "forta") notes.push("Ești obosit: forța grea a fost înlocuită cu completare.");
  if (tired) notes.push("Sesiune mai ușoară: cu o serie mai puțin și greutăți cu ~10% mai mici.");
  if (painZones.length) notes.push("Exercițiile pentru " + painZones.map((z) => ZONES[z].toLowerCase()).join(", ") + " au fost scoase.");
  if (painZones.includes("adductori") || condition !== "bine") notes.push("Adductori: maximum 3 serii, oprește-te la durere.");
  const tomorrow = ymd(addDays(parseYmd(date), 1));
  if (dayState(tomorrow) === "meci") notes.push("Mâine e meci. Ia în calcul o sesiune mai scurtă.");

  return { date, planned, type, condition, painZones, blocks: blocks(), notes, done: false, created: Date.now() };
}

function prescribe(e, cat, date, tired) {
  const r = RX[cat];
  const timed = !!e.timed && !!r.sec;
  const prev = lastPrescription(e.id, date);
  let sets, reps;
  // numere diferite față de data trecută, dacă intervalul permite
  for (let i = 0; i < 8; i++) {
    sets = rand(r.sets[0], r.sets[1]);
    reps = timed ? rand(r.sec[0] / 5, r.sec[1] / 5) * 5 : rand(r.reps[0], r.reps[1]);
    if (!prev || prev.sets !== sets || prev.reps !== reps) break;
  }
  if (tired) sets = Math.max(2, sets - 1);
  if (e.zones.includes("adductori")) sets = Math.min(sets, 3);

  const item = { id: e.id, cat, sets, reps, timed, hint: "", weight: "" };
  const ll = lastLog(e.id, date);
  const top = timed ? r.sec[1] : r.reps[1];

  if (ll && e.weighted && cat !== "mobilitate") {
    const logs = ll.item.log.filter((s) => s.r !== "" && s.r != null);
    const w = Math.max(...logs.map((s) => Number(s.w) || 0));
    const allTop = logs.length >= ll.item.sets && logs.every((s) => Number(s.r) >= RX[ll.item.cat].reps[1]);
    let next = allTop ? w + e.step : w;
    let hint = allTop ? `Data trecută (${fmtDate(ll.date)}): toate seriile la maxim, crește la ${next} kg.` : `Data trecută (${fmtDate(ll.date)}): ${w} kg. Rămâi la aceeași greutate.`;
    if (tired && next) { next = roundTo(next * 0.9, e.step); hint += ` Obosit: ${next} kg.`; }
    item.weight = next || "";
    item.hint = hint;
  } else if (ll && !e.weighted && cat !== "explozie" && cat !== "mobilitate") {
    const best = Math.max(...ll.item.log.map((s) => Number(s.r) || 0));
    if (best) {
      const target = Math.min(best + (timed ? 5 : 1), top + (timed ? 30 : 5));
      if (!tired) item.reps = Math.max(item.reps, target);
      item.hint = `Data trecută: maxim ${best}${timed ? " s" : " rep"}. Fără greutate: crești prin ${timed ? "timp" : "repetări"}.`;
    }
  } else if (e.weighted && cat !== "mobilitate") {
    item.hint = "Prima dată: alege o greutate cu care faci toate seriile corect.";
  }
  if (cat === "explozie") item.hint = "Fiecare repetare la viteză maximă. Pauză completă.";
  item.log = Array.from({ length: item.sets }, () => ({ w: item.weight, r: "" }));
  return item;
}

function itemSeconds(it) {
  if (!it.id) return it.min * 60;
  const r = RX[it.cat];
  const work = it.timed ? it.reps : r.work;
  return it.sets * (work + r.rest) + TRANSITION;
}
const totalMinutes = (blocks) => Math.round(blocks.reduce((s, b) => s + b.items.reduce((t, it) => t + itemSeconds(it), 0), 0) / 60);

// ---------- interfață ----------
const $ = (sel) => document.querySelector(sel);
let weekStart = mondayOf(new Date());

// navigare între ecrane (fără adrese, ca să meargă și în pagini găzduite în cadru)
let view = { name: "week" };
function go(name, date) { view = { name, date }; route(); window.scrollTo(0, 0); }
function route() {
  if (view.name === "workout") return renderWorkout(view.date);
  if (view.name === "settings") return renderSettings();
  renderWeek();
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-go]");
  if (a) { e.preventDefault(); go(a.dataset.go); }
});

function renderWeek() {
  const today = ymd(new Date());
  const end = addDays(weekStart, 6);
  const rows = Array.from({ length: 7 }, (_, i) => {
    const date = ymd(addDays(weekStart, i));
    const st = dayState(date);
    const w = db.workouts[date];
    const tag = w ? `<span class="tag ${w.done ? "done" : ""}">${w.done ? "✓ " : ""}${TYPE_LABEL[w.type]}</span>` : "";
    return `<button class="day ${date === today ? "today" : ""}" data-date="${date}">
      <span class="dname">${DAY_NAMES[i]}<small>${fmtDate(date)}</small></span>
      <span class="right">${tag}<span class="chip s-${st}">${STATES[st]}</span></span>
    </button>`;
  }).join("");
  $("#app").innerHTML = `
    <header class="top">
      <h1>PORTAR<span>.</span></h1>
      <button class="icon" data-go="settings" aria-label="Setări">⚙</button>
    </header>
    <div class="weeknav">
      <button class="btn ghost" id="prev" aria-label="Săptămâna trecută">‹</button>
      <div class="wlabel">${fmtDate(ymd(weekStart))} – ${fmtDate(ymd(end))}${ymd(weekStart) === ymd(mondayOf(new Date())) ? "<small>săptămâna asta</small>" : `<small><a href="#" id="now">înapoi la săptămâna asta</a></small>`}</div>
      <button class="btn ghost" id="next" aria-label="Săptămâna viitoare">›</button>
    </div>
    <div class="week">${rows}</div>
    <p class="muted center">Apasă pe o zi ca să schimbi starea sau să faci antrenament.</p>`;
  $("#prev").onclick = () => { weekStart = addDays(weekStart, -7); renderWeek(); };
  $("#next").onclick = () => { weekStart = addDays(weekStart, 7); renderWeek(); };
  const now = $("#now"); if (now) now.onclick = (ev) => { ev.preventDefault(); weekStart = mondayOf(new Date()); renderWeek(); };
  document.querySelectorAll(".day").forEach((b) => (b.onclick = () => openDay(b.dataset.date)));
}

// confirmare în pagină (unele browsere/cadre blochează confirm() și alert())
function askConfirm(msg, okLabel, onOk, danger) {
  const dlg = sheet(`<h2>Sigur?</h2><p>${esc(msg)}</p>
    <button class="btn ${danger ? "danger" : "primary"} block" id="cok">${esc(okLabel)}</button>
    <button class="btn ghost block" id="cno">Renunță</button>`);
  $("#cno").onclick = () => dlg.close();
  $("#cok").onclick = () => { dlg.close(); onOk(); };
}

// ---------- foaia unei zile ----------
function sheet(html) {
  const dlg = $("#sheet");
  dlg.innerHTML = `<div class="sheet-inner">${html}</div>`;
  if (!dlg.open) dlg.showModal();
  dlg.onclick = (e) => { if (e.target === dlg) dlg.close(); };
  return dlg;
}

function openDay(date) {
  const st = dayState(date);
  const w = db.workouts[date];
  const canTrain = st === "liber" || st === "sala";
  const dlg = sheet(`
    <h2>${dayName(date)} <small>${fmtDate(date)}</small></h2>
    <p class="label">Starea zilei</p>
    <div class="seg">${Object.entries(STATES).map(([k, v]) => `<button class="${k === st ? "on" : ""}" data-st="${k}">${v}</button>`).join("")}</div>
    ${w ? `<button class="btn primary block" id="open">Vezi antrenamentul</button>`
        : canTrain ? `<button class="btn primary block" id="train">Fă antrenament</button>`
        : `<p class="muted">Zi de ${STATES[st].toLowerCase()}. Pentru antrenament la sală, schimbă starea pe Liber sau Sală.</p>`}
    <button class="btn ghost block" id="close">Închide</button>`);
  dlg.querySelectorAll("[data-st]").forEach((b) => (b.onclick = () => { db.days[date] = b.dataset.st; save(); renderWeek(); openDay(date); }));
  $("#close").onclick = () => dlg.close();
  if ($("#open")) $("#open").onclick = () => { dlg.close(); go("workout", date); };
  if ($("#train")) $("#train").onclick = () => askCondition(date);
}

function askCondition(date) {
  let cond = "bine";
  const dlg = sheet(`
    <h2>Cum te simți?</h2>
    <div class="seg" id="cond">${Object.entries(COND_LABEL).map(([k, v]) => `<button data-c="${k}" class="${k === "bine" ? "on" : ""}">${v}</button>`).join("")}</div>
    <div id="zones" hidden>
      <p class="label">Unde te doare? Exercițiile pentru zonele bifate dispar.</p>
      <div class="zones">${Object.entries(ZONES).map(([k, v]) => `<label class="zone"><input type="checkbox" value="${k}"><span>${v}</span></label>`).join("")}</div>
    </div>
    <p id="zerr" class="err" hidden>Bifează cel puțin o zonă.</p>
    <button class="btn primary block" id="gen">Generează antrenamentul</button>
    <button class="btn ghost block" id="back">Înapoi</button>`);
  dlg.querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => {
    cond = b.dataset.c;
    dlg.querySelectorAll("[data-c]").forEach((x) => x.classList.toggle("on", x === b));
    $("#zones").hidden = cond !== "durere";
  }));
  $("#back").onclick = () => openDay(date);
  $("#gen").onclick = () => {
    const zones = cond === "durere" ? [...dlg.querySelectorAll(".zones input:checked")].map((i) => i.value) : [];
    if (cond === "durere" && !zones.length) { $("#zerr").hidden = false; return; }
    db.workouts[date] = generate(date, cond, zones);
    db.days[date] = "sala";
    save();
    dlg.close();
    go("workout", date);
  };
}

// ---------- ecranul antrenamentului ----------
function renderWorkout(date) {
  const w = db.workouts[date];
  if (!w) { go("week"); return; }
  const total = totalMinutes(w.blocks);
  let n = 0;
  const blocks = w.blocks.filter((b) => b.items.length).map((b, bi) => `
    <section class="block">
      <h3>${b.title}</h3>
      ${b.items.map((it, ii) => it.id ? exCard(it, w.blocks.indexOf(b), ii, ++n) : `<div class="card generic"><b>${esc(it.text)}</b><span class="muted">${it.min} min</span></div>`).join("")}
    </section>`).join("");
  $("#app").innerHTML = `
    <header class="top">
      <button class="icon" data-go="week" aria-label="Înapoi">‹</button>
      <h1 class="small">${dayName(date)}, ${fmtDate(date)}</h1>
      <span></span>
    </header>
    <div class="hero">
      <div class="type">${TYPE_LABEL[w.type]}</div>
      <div class="meta">~${total} min · ${COND_LABEL[w.condition]}${w.done ? " · <b class='ok'>terminat</b>" : ""}</div>
    </div>
    ${w.notes.length ? `<ul class="notes">${w.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${blocks}
    <div class="actions">
      <button class="btn primary block" id="finish">${w.done ? "Marchează ca neterminat" : "Termină antrenamentul"}</button>
      <button class="btn ghost block" id="regen">Generează din nou</button>
      <button class="btn danger block" id="del">Șterge antrenamentul</button>
    </div>
    <p class="muted small center">Aplicația nu dă sfaturi medicale. La durere, te oprești.</p>`;

  document.querySelectorAll("input[data-b]").forEach((inp) => (inp.onchange = () => {
    const it = w.blocks[inp.dataset.b].items[inp.dataset.i];
    it.log[inp.dataset.s][inp.dataset.f] = inp.value === "" ? "" : Number(inp.value);
    save();
  }));
  $("#finish").onclick = () => { w.done = !w.done; save(); renderWorkout(date); window.scrollTo(0, 0); };
  $("#regen").onclick = () => askConfirm("Generezi alt antrenament pentru ziua asta? Ce ai notat se pierde.", "Generează din nou", () => {
    db.workouts[date] = generate(date, w.condition, w.painZones); save(); renderWorkout(date); window.scrollTo(0, 0);
  });
  $("#del").onclick = () => askConfirm("Ștergi antrenamentul?", "Șterge", () => {
    delete db.workouts[date]; save(); go("week");
  }, true);
}

function exCard(it, bi, ii, n) {
  const e = EX[it.id];
  const unit = it.timed ? "s" : "rep";
  const range = it.cat === "mobilitate" ? `${it.sets} × ${it.timed ? "30 s" : "8 rep"}`
    : `${it.sets} serii × ${it.reps} ${unit}${it.cat === "forta" ? ` <small>(interval 4–6)</small>` : it.cat === "completare" && !it.timed ? ` <small>(interval 8–12)</small>` : ""}`;
  const showW = e.weighted && it.cat !== "mobilitate";
  const rows = it.cat === "mobilitate" ? "" : it.log.map((s, si) => `
    <div class="set">
      <span class="sn">${si + 1}</span>
      ${showW ? `<label><input type="number" inputmode="decimal" step="0.5" min="0" data-b="${bi}" data-i="${ii}" data-s="${si}" data-f="w" value="${s.w}" placeholder="kg"><small>kg</small></label>` : ""}
      <label><input type="number" inputmode="numeric" min="0" data-b="${bi}" data-i="${ii}" data-s="${si}" data-f="r" value="${s.r}" placeholder="${it.reps}"><small>${unit}</small></label>
    </div>`).join("");
  return `<article class="card ex">
    <div class="exhead"><span class="num">${n}</span><div><h4>${esc(e.name)}</h4><span class="cat c-${it.cat}">${CAT_LABEL[it.cat]}</span> <span class="muted small">${esc(e.equip)}</span></div></div>
    <div class="rx">${range}${showW && it.weight !== "" ? ` · <b>${it.weight} kg</b>` : ""}</div>
    ${it.hint ? `<p class="hint">${esc(it.hint)}</p>` : ""}
    <details><summary>Tehnică și video</summary><p>${esc(e.note)}</p>
      <a class="yt" href="${e.link}" target="_blank" rel="noopener">▶ ${e.linkNote ? "Video YouTube (" + esc(e.linkNote) + ")" : "Caută pe YouTube"}</a></details>
    ${rows ? `<div class="sets">${rows}</div>` : ""}
  </article>`;
}

// ---------- setări ----------
function renderSettings() {
  $("#app").innerHTML = `
    <header class="top"><button class="icon" data-go="week" aria-label="Înapoi">‹</button><h1 class="small">Setări</h1><span></span></header>
    <section class="card">
      <h3>Calendarul echipei</h3>
      <p class="muted small">Lipește programul lunii, câte o zi pe rând: <code>2026-12-03 meci</code> sau <code>03.12.2026 handbal</code>. Stări: liber, meci, handbal, sala. Zilele care nu apar rămân neschimbate.</p>
      <textarea id="cal" rows="8" placeholder="2026-12-01 handbal&#10;2026-12-02 sala&#10;2026-12-06 meci"></textarea>
      <button class="btn primary block" id="imp">Salvează programul</button>
      <p id="impres" class="muted small"></p>
    </section>
    <section class="card">
      <h3>Adductori</h3>
      <label class="toggle"><input type="checkbox" id="heavy" ${db.settings.adductorHeavyOk ? "checked" : ""}><span>Kinetoterapeutul a confirmat exerciții grele pe adductori (ex: sărituri laterale)</span></label>
      <p class="muted small">Oprit = săriturile laterale nu apar. Exercițiile pe adductori au oricum maximum 3 serii.</p>
    </section>
    <section class="card">
      <h3>Copie de siguranță</h3>
      <p class="muted small">Datele stau doar pe telefonul ăsta. Salvează din când în când o copie.</p>
      <button class="btn ghost block" id="exp">Arată copia</button>
      <div id="expbox" hidden>
        <p class="muted small">Copiază textul și păstrează-l undeva (de exemplu, trimite-l ție pe mail sau în notițe).</p>
        <textarea id="exptext" rows="5" readonly></textarea>
        <button class="btn primary block" id="copy">Copiază</button>
      </div>
      <p class="label">Ca să refaci datele, lipește aici o copie salvată:</p>
      <textarea id="imptext" rows="4" placeholder="Lipește copia aici"></textarea>
      <button class="btn ghost block" id="restore">Încarcă copia</button>
      <p id="bkres" class="muted small"></p>
    </section>
    <p class="muted small center">Fără cont, fără server, fără costuri. Aplicația nu dă sfaturi medicale.</p>
    ${storageOk ? "" : `<p class="err center">Browserul nu permite salvarea datelor. Nu folosi o fereastră privată.</p>`}`;
  $("#heavy").onchange = (e) => { db.settings.adductorHeavyOk = e.target.checked; save(); };
  $("#imp").onclick = () => {
    const { count, bad } = importCalendar($("#cal").value);
    save();
    $("#impres").textContent = `Salvate: ${count} zile.` + (bad.length ? ` Rânduri neînțelese: ${bad.slice(0, 5).join(" | ")}` : "");
  };
  $("#exp").onclick = () => { $("#exptext").value = JSON.stringify(db); $("#expbox").hidden = false; };
  $("#copy").onclick = () => {
    const t = $("#exptext");
    const done = () => { $("#copy").textContent = "Copiat"; };
    const fallback = () => { t.focus(); t.select(); $("#copy").textContent = "Textul e selectat: copiază-l"; };
    try { navigator.clipboard.writeText(t.value).then(done, fallback); } catch (_) { fallback(); }
  };
  $("#restore").onclick = () => {
    let d;
    try { d = JSON.parse($("#imptext").value); if (!d || !d.days || !d.workouts) throw new Error(); }
    catch (_) { $("#bkres").textContent = "Textul lipit nu e o copie validă. Copiază tot textul copiei, de la { până la }."; return; }
    askConfirm("Înlocuiești datele de pe telefon cu copia lipită?", "Înlocuiește", () => {
      db = { settings: {}, ...d }; save(); renderSettings(); $("#bkres").textContent = "Copia a fost încărcată.";
    });
  };
}

function importCalendar(text) {
  let count = 0; const bad = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().toLowerCase();
    if (!line) continue;
    let m = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/), date = null;
    if (m) date = `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    else if ((m = line.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/))) date = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    const st = /meci/.test(line) ? "meci" : /handbal|antrenament/.test(line) ? "handbal" : /sal[aă]/.test(line) ? "sala" : /liber/.test(line) ? "liber" : null;
    if (!date || !st || isNaN(parseYmd(date))) { bad.push(raw.trim()); continue; }
    db.days[date] = st; count++;
  }
  return { count, bad };
}

try {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !window.PORTAR_SINGLE) navigator.serviceWorker.register("sw.js").catch(() => {});
} catch (_) {}
route();
