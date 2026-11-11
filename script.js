/* ASCEND: script.js
   Google sign-in + per-user cloud storage via Firebase (free tier).
   1) Create a Firebase project  2) Enable Authentication > Google
   3) Create a Firestore database  4) Paste your web-app config below.
   Until you do, the app runs in "preview" mode and saves on this device only. */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc }
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoIQChWkcxxynq4m90dRDGOHVpLLLfR4Q",
  authDomain: "ascend-2d37d.firebaseapp.com",
  projectId: "ascend-2d37d",
  appId: "1:525768098246:web:507023ad132d30796932c7"
};

const configured = !Object.values(FIREBASE_CONFIG).some(v => String(v).startsWith("PASTE"));
let auth = null, fdb = null, uid = null, mode = "local";
if (configured) {
  const app = initializeApp(FIREBASE_CONFIG);
  auth = getAuth(app);
  fdb = getFirestore(app);
}

const $ = id => document.getElementById(id);
const KEY = "ascend-v3";

/* ---------- state ---------- */
const blank = () => ({ name: "", aff: 0, goals: [], vision: [], tasks: {}, habits: [], hlog: {}, mg: {}, ans: {}, wins: {} });
let S = blank(), lastV = [], tmr = null;

/* ---------- dates ---------- */
const ky = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const now = new Date(), TD = ky(now), MO = TD.slice(0, 7);
const dn = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(now.getFullYear(), 0, 0)) / 864e5);

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uidGen = () => Math.random().toString(36).slice(2, 9);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

/* ---------- content ---------- */
const AFF = [
  "I am already becoming who I’m meant to be. Today I only need to do the next thing.",
  "My discipline is a love letter to my future family.",
  "I don’t chase money. I build it, one hour at a time.",
  "The person who earned that rank is the same person sitting here today.",
  "I am safe to rest and I am hungry to rise.",
  "What is meant for me is moving toward me while I work.",
  "I keep promises to myself. That is my superpower.",
  "I earn well, I spend wisely, I give generously.",
  "Calm is my default. Focus is my habit.",
  "My family’s future is being built by my hands today.",
  "I don’t check. I create. The proof shows up on its own.",
  "I am allowed to be soft and unstoppable at once."
];
const QS = [
  "What would the version of me with the house and the dream car do in the next two hours?",
  "Which one task today would make tomorrow easier?",
  "What am I pretending I can’t do yet?",
  "Who is watching me grow, and what do I want them to see?",
  "What did I avoid yesterday, and what is it really about?",
  "If my income doubled, what would I stop doing and what would I start?",
  "What is one thing I can say no to today to protect my focus?",
  "What would I attempt this week if I knew I couldn’t fail?",
  "Which skill, if I got great at it, would change everything for my family?",
  "What story about money did I inherit that I’m ready to rewrite?",
  "How would a calm, disciplined version of me handle today’s hardest moment?",
  "What is the smallest brave action I can take before sunset?",
  "What am I proud of from this week that I haven’t celebrated?",
  "Where am I confusing being busy with being on track?",
  "What would a wild, unforgettable year look like, in specific adventures?",
  "What boundary would give me back an hour a day?",
  "Which habit am I closest to making automatic?",
  "What would I tell my younger self about who I became?",
  "What do I want from the person I like, and what am I building for myself either way?",
  "What would make me feel rich today, not later?",
  "Which rank, rate or number do I want to beat in the next 90 days?"
];
const GOAL_PH = ["Add your goal 1", "Add your goal 2", "Add your goal 3", "Add your goal 4", "Add your goal 5"];

/* ---------- normalise ---------- */
function normalize() {
  while (S.goals.length < 5) S.goals.push({ t: "", w: "", d: false });
  while (S.vision.length < 10) S.vision.push(null);
  for (let i = 0; i < 10; i++) if (S.vision[i] === undefined) S.vision[i] = null;
  if (!S.mg[MO]) S.mg[MO] = [0, 1, 2, 3, 4].map(() => ({ t: "", log: [] }));
  if (!S.tasks[TD]) S.tasks[TD] = [];
}

/* ---------- saving ---------- */
const stateRef = () => doc(fdb, "users", uid, "data", "state");
const photoRef = i => doc(fdb, "users", uid, "photos", "v" + i);

async function flush() {
  tmr = null;
  try {
    const st = { ...S }; delete st.vision;
    await setDoc(stateRef(), st);
    for (let i = 0; i < 10; i++) {
      if (S.vision[i] !== lastV[i]) {
        if (S.vision[i]) await setDoc(photoRef(i), { src: S.vision[i] });
        else await deleteDoc(photoRef(i));
        lastV[i] = S.vision[i];
      }
    }
    $("who").textContent = "Signed in. Everything is saved to your account.";
  } catch (e) {
    console.error(e);
    $("who").textContent = "Couldn’t save just now. Check your connection and keep this tab open.";
  }
}
function save() {
  if (mode === "cloud") { clearTimeout(tmr); tmr = setTimeout(flush, 700); }
  else {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { alert("Storage is full. Remove a vision photo or two and try again."); }
  }
}

/* ---------- rendering ---------- */
function render() {
  const h = now.getHours();
  $("date").textContent = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("greet").textContent = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  $("name").value = S.name;
  $("aff").textContent = "“" + AFF[(dn + S.aff) % AFF.length] + "”";

  $("goals").innerHTML = S.goals.map((g, i) =>
    `<div class="g${g.d ? " done" : ""}"><span class="tag">${g.d ? "Claimed" : "Waiting for you"}</span>
     <input class="t" data-g="${i}" data-k="t" value="${esc(g.t)}" placeholder="${GOAL_PH[i]}" aria-label="Goal ${i + 1}">
     <input class="w" data-g="${i}" data-k="w" value="${esc(g.w)}" placeholder="By when? (e.g. Dec 2027)" aria-label="Deadline">
     <button class="ghost" data-claim="${i}">${g.d ? "Unclaim" : "Mark claimed"}</button></div>`).join("");

  $("vision").innerHTML = S.vision.map((v, i) => v
    ? `<div class="v has" data-v="${i}"><img alt="Vision ${i + 1}" src="${v}"><button class="x" data-rv="${i}" aria-label="Remove photo">×</button></div>`
    : `<div class="v" data-v="${i}" tabindex="0" role="button">+ ${i + 1}</div>`).join("");

  renderToday(); renderHabits(); renderQs(); renderMG(); renderStats();
}

function renderToday() {
  const t = S.tasks[TD], d = t.filter(x => x.d).length, p = pct(d, t.length);
  $("tasks").innerHTML = t.map(x =>
    `<div class="task${x.d ? " d" : ""}"><input type="checkbox" class="ck" data-t="${x.id}"${x.d ? " checked" : ""} aria-label="Done"><span>${esc(x.t)}</span><button class="rm" data-dt="${x.id}" aria-label="Delete">×</button></div>`).join("")
    || '<div class="sub">No tasks yet. Add your first one below.</div>';
  $("tl").textContent = d + " of " + t.length + " done";
  $("tp").textContent = p + "%";
  $("tb").style.width = p + "%";
  $("rp").textContent = p + "%";
  $("rc").style.strokeDashoffset = 326.7 * (1 - p / 100);
}

const hdone = d => S.hlog[d] || [];
const hday = d => S.habits.length ? hdone(d).filter(i => S.habits.some(h => h.id === i)).length / S.habits.length : 0;

function streak() {
  let n = 0; const d = new Date(now);
  if (hday(ky(d)) < 1) d.setDate(d.getDate() - 1);
  while (hday(ky(d)) >= .5 && n < 999) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function renderHabits() {
  if (!S.habits.length) { $("habits").innerHTML = '<tr><td class="sub">No habits yet. Add your first one below.</td></tr>'; return; }
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push(d); }
  const L = "SMTWTFS";
  const head = "<tr><th></th>" + days.map(d => `<th>${L[d.getDay()]}</th>`).join("") + "<th></th></tr>";
  $("habits").innerHTML = head + S.habits.map(hb => {
    const c = days.filter(d => hdone(ky(d)).includes(hb.id)).length;
    return `<tr><td>${esc(hb.n)}</td>` + days.map(d => {
      const k = ky(d);
      return `<td><input type="checkbox" class="ck" data-h="${hb.id}" data-d="${k}"${hdone(k).includes(hb.id) ? " checked" : ""} aria-label="${esc(hb.n)} ${k}"></td>`;
    }).join("") + `<td class="cnt">${c}/7</td></tr>`;
  }).join("");
}

function renderQs() {
  const a = S.ans[TD] || ["", "", ""];
  $("qs").innerHTML = [0, 1, 2].map(k =>
    `<div class="q"><h3>${QS[(dn * 3 + k * 7) % QS.length]}</h3><textarea data-q="${k}" placeholder="Write honestly. Nobody’s grading this.">${esc(a[k])}</textarea></div>`).join("");
}

function renderMG() {
  $("mt").textContent = now.toLocaleDateString(undefined, { month: "long" }) + ": my five";
  $("mg").innerHTML = S.mg[MO].map((g, i) =>
    `<div class="mg"><input class="goal" data-mg="${i}" value="${esc(g.t)}" placeholder="Goal ${i + 1} for this month">
     <div class="sub" style="margin:8px 0 0">What did I do this month to get closer?</div>
     ${g.log.length ? '<ul class="log">' + g.log.slice(-3).map(l => `<li>${esc(l.d.slice(5))}: ${esc(l.t)}</li>`).join("") + "</ul>" : ""}
     <div class="add"><input data-ml="${i}" placeholder="Log one thing you did"><button class="ghost" data-mla="${i}">Log it</button></div></div>`).join("");
}

function mstats(m) {
  let tk = 0, td = 0, hs = 0, hn = 0;
  Object.keys(S.tasks).forEach(d => { if (d.slice(0, 7) === m) S.tasks[d].forEach(x => { tk++; if (x.d) td++; }); });
  const ds = {};
  Object.keys(S.hlog).forEach(d => { if (d.slice(0, 7) === m) ds[d] = 1; });
  Object.keys(S.tasks).forEach(d => { if (d.slice(0, 7) === m) ds[d] = 1; });
  Object.keys(ds).forEach(d => { hs += hday(d); hn++; });
  const lg = (S.mg[m] || []).reduce((a, g) => a + g.log.length, 0);
  return { tk, td, hp: pct(hs, hn), lg, days: hn };
}

function renderStats() {
  const m = mstats(MO);
  let all = 0; Object.keys(S.tasks).forEach(d => S.tasks[d].forEach(x => { if (x.d) all++; }));
  const claimed = S.goals.filter(g => g.d).length;
  $("stats").innerHTML = [
    [streak(), "day habit streak"],
    [m.hp + "%", "habit consistency this month"],
    [all, "tasks finished, all time"],
    [m.lg, "steps logged toward monthly goals"],
    [m.days, "days you showed up this month"],
    [pct(m.td, m.tk) + "%", "tasks done this month"],
    [S.vision.filter(Boolean).length + "/10", "vision frames filled"],
    [claimed + "/5", "big goals claimed"]
  ].map(s => `<div class="s"><b>${s[0]}</b><small>${s[1]}</small></div>`).join("");

  $("wins").value = S.wins[MO] || "";
  const ms = {};
  [S.tasks, S.hlog, S.mg].forEach(o => Object.keys(o).forEach(k => { ms[k.slice(0, 7)] = 1; }));
  const past = Object.keys(ms).filter(k => k < MO).sort().reverse();
  $("months").innerHTML = past.map(k => {
    const x = mstats(k), dt = new Date(k + "-01T12:00:00");
    return `<div class="m"><b>${dt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><span>${x.td}/${x.tk} tasks · ${x.hp}% habits · ${x.lg} goal steps</span>${S.wins[k] ? `<span style="flex-basis:100%;color:var(--mute)">${esc(S.wins[k])}</span>` : ""}</div>`;
  }).join("");
}

/* ---------- events ---------- */
const fi = document.createElement("input");
fi.type = "file"; fi.accept = "image/*"; fi.hidden = true; document.body.appendChild(fi);

fi.addEventListener("change", () => {
  const f = fi.files[0], i = +fi.dataset.i;
  if (!f) return;
  const im = new Image(), u = URL.createObjectURL(f);
  im.onload = () => {
    const s = Math.min(1, 560 / Math.max(im.width, im.height)), c = document.createElement("canvas");
    c.width = im.width * s; c.height = im.height * s;
    c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
    S.vision[i] = c.toDataURL("image/jpeg", .72);
    URL.revokeObjectURL(u); fi.value = ""; save(); render();
  };
  im.src = u;
});

document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "name") { S.name = t.value.trim(); save(); }
  else if (t.dataset.g !== undefined) { S.goals[t.dataset.g][t.dataset.k] = t.value; save(); renderStats(); }
  else if (t.dataset.t) { S.tasks[TD].forEach(x => { if (x.id === t.dataset.t) x.d = t.checked; }); save(); renderToday(); renderStats(); }
  else if (t.dataset.h) {
    const l = S.hlog[t.dataset.d] = S.hlog[t.dataset.d] || [], i = l.indexOf(t.dataset.h);
    if (t.checked && i < 0) l.push(t.dataset.h);
    if (!t.checked && i > -1) l.splice(i, 1);
    save(); renderStats();
  }
  else if (t.dataset.mg !== undefined) { S.mg[MO][t.dataset.mg].t = t.value; save(); }
});

document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.q !== undefined) { const a = S.ans[TD] = S.ans[TD] || ["", "", ""]; a[t.dataset.q] = t.value; save(); }
  if (t.id === "wins") { S.wins[MO] = t.value; save(); }
});

function addTask() {
  const v = $("nt").value.trim(); if (!v) return;
  S.tasks[TD].push({ id: uidGen(), t: v, d: false });
  $("nt").value = ""; save(); renderToday(); renderStats();
}

document.addEventListener("click", e => {
  const t = e.target, b = t.closest("button"), v = t.closest("[data-v]");
  if (t.closest("#aff")) { S.aff++; save(); $("aff").textContent = "“" + AFF[(dn + S.aff) % AFF.length] + "”"; return; }
  if (b && b.dataset.rv !== undefined) { S.vision[b.dataset.rv] = null; save(); render(); return; }
  if (b && b.dataset.claim !== undefined) { const g = S.goals[b.dataset.claim]; g.d = !g.d; save(); render(); return; }
  if (b && b.dataset.dt) { S.tasks[TD] = S.tasks[TD].filter(x => x.id !== b.dataset.dt); save(); renderToday(); renderStats(); return; }
  if (b && b.dataset.mla !== undefined) {
    const i = b.dataset.mla, inp = document.querySelector(`[data-ml="${i}"]`);
    if (inp.value.trim()) { S.mg[MO][i].log.push({ d: TD, t: inp.value.trim() }); save(); renderMG(); renderStats(); }
    return;
  }
  if (b && b.id === "ant") addTask();
  if (b && b.id === "anh") {
    const n = $("nh").value.trim();
    if (n) { S.habits.push({ id: uidGen(), n }); $("nh").value = ""; save(); renderHabits(); }
  }
  if (b && b.id === "brb") breathe();
  if (v && !t.closest(".x") && !v.classList.contains("has")) { fi.dataset.i = v.dataset.v; fi.click(); }
});

document.addEventListener("keydown", e => {
  const t = e.target;
  if (e.key === "Enter" && t.id === "nt") addTask();
  if (e.key === "Enter" && t.dataset && t.dataset.ml !== undefined) document.querySelector(`[data-mla="${t.dataset.ml}"]`).click();
  if ((e.key === "Enter" || e.key === " ") && t.classList && (t.classList.contains("v") && !t.classList.contains("has") || t.id === "aff")) { e.preventDefault(); t.click(); }
});

/* ---------- 60-second breathing ---------- */
let bt = null;
function breathe() {
  const btn = $("brb"), label = "Breathe for 60 seconds";
  if (bt) { clearInterval(bt); bt = null; $("brt").textContent = ""; btn.textContent = label; return; }
  let s = 60, i = 0, c = 0; const ph = ["Breathe in…", "Hold…", "Breathe out…"], pl = [4, 4, 6];
  btn.textContent = "Stop";
  const step = () => {
    if (s <= 0) { clearInterval(bt); bt = null; $("brt").textContent = "You’re back. Next task."; btn.textContent = label; return; }
    $("brt").textContent = ph[i] + " " + s + "s"; c++; s--;
    if (c >= pl[i]) { c = 0; i = (i + 1) % 3; }
  };
  step(); bt = setInterval(step, 1000);
}

/* ---------- login / logout ---------- */
function show(on) { $("gate").style.display = on ? "none" : "flex"; $("app").hidden = !on; }

async function startSession(user) {
  S = blank(); mode = "local"; uid = null;
  if (user && configured) {
    try {
      uid = user.uid;
      const res = await Promise.all([getDoc(stateRef()), ...[...Array(10).keys()].map(i => getDoc(photoRef(i)))]);
      if (res[0].exists()) S = { ...blank(), ...res[0].data() };
      S.vision = res.slice(1).map(d => d.exists() ? d.data().src : null);
      if (!S.name && user.displayName) S.name = user.displayName.split(" ")[0];
      mode = "cloud";
      $("who").textContent = "Signed in as " + (user.email || user.displayName) + ". Everything is saved to your account.";
    } catch (e) {
      console.error(e); uid = null;
      $("gm").textContent = "Couldn’t load your data. Check your Firestore rules and try again.";
      show(false); $("gb").disabled = false; return;
    }
  } else {
    try { const r = localStorage.getItem(KEY); if (r) S = { ...blank(), ...JSON.parse(r) }; } catch (e) {}
    $("who").textContent = "Preview mode: saved on this device only.";
  }
  normalize(); lastV = S.vision.slice(); render(); show(true);
  $("gb").disabled = false; $("gm").textContent = "";
}

$("gb").onclick = async () => {
  if (!configured) { $("gm").textContent = "Add your Firebase config in script.js to enable Google sign-in."; return; }
  $("gb").disabled = true;
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { $("gb").disabled = false; $("gm").textContent = "Sign-in was cancelled or blocked. Please try again."; }
};
$("gp").onclick = () => startSession(null);

$("lo").onclick = async () => {
  if (tmr) { clearTimeout(tmr); await flush(); }
  if (configured && auth.currentUser) await signOut(auth);
  S = blank(); mode = "local"; uid = null;
  show(false); window.scrollTo(0, 0);
  $("gm").textContent = "You’re logged out. Your data is safe in your account.";
};

show(false);
if (configured) onAuthStateChanged(auth, u => { if (u) startSession(u); else show(false); });
else $("gp").hidden = false;
