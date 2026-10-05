import { edenLogo } from "./brand.js";
import { sandboxDocument, terminalSimulation } from "./components.js";
import { renderLessonBlock, renderLessonPage, renderStudentResult } from "./lesson-renderer.js";
import { installWorkshopInteractions } from "./workshop-runtime.js";
import { studentCopy, studentError } from "./student-copy.js";
const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const enc = encodeURIComponent;
const paths = {
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  calendar: "M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16 M8 14h2 M14 14h2 M8 18h2",
  book: "M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z M12 6v15",
  check: "M5 12l4 4L19 6",
  copy: "M8 8h12v13H8z M4 16H2V2h12v3",
  people:
    "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M14 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  spark:
    "m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3z M20 2v4 M18 4h4",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  plus: "M12 4v16 M4 12h16",
  chevron: "m9 5 7 7-7 7",
  alert: "m12 3 10 18H2z M12 9v5 M12 17v1",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  logout: "M9 4H3v16h6 M8 12h13 m-5-5 5 5-5 5",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
  folder: "M3 6h7l2 3h9v12H3z",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6",
  search: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 m5 12 6 6",
  code: "m8 5-7 7 7 7 M16 5l7 7-7 7 M14 2l-4 20",
  close: "m5 5 14 14 M19 5 5 19",
  refresh: "M20 7a9 9 0 1 0 1 9 M20 2v6h-6",
  mail: "M3 5h18v14H3z m0 0 9 8 9-8",
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.book}"/></svg>`;
const btn = (label, action, id = "", kind = "", ico = "") =>
  `<button type="button" class="btn ${kind}" data-action="${action}" data-id="${esc(id)}">${ico ? icon(ico) : ""}${label}</button>`;
const pill = (text, tone = "") =>
  `<span class="pill ${tone}">${esc(text)}</span>`;
const empty = (text, ico = "book") =>
  `<div class="empty">${icon(ico)}${text}</div>`;
const dateText = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${d}T12:00:00`))
    : "";
const shortDate = (d) =>
  d
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
      }).format(new Date(`${d}T12:00:00`))
    : "";
const stateLabel = (s) =>
  ({
    draft: "Préparé · brouillon",
    published: "Publié",
    completed: "Réalisé",
    planned: "Prévu",
    partially_completed: "Partiellement réalisé",
    postponed: "Reporté",
    cancelled: "Annulé",
    replaced: "Remplacé",
    not_completed: "Non réalisé",
    non_evaluable: "Non évaluable",
    review_required: "À relire",
    approved: "Validé",
    auto_corrected_to_review: "Pré-corrigé",
  })[s] || s;
const S = {
  user: null,
  data: null,
  view: "dashboard",
  lesson: null,
  session: null,
  student: null,
  step: 0,
  attempt: null,
  answers: {},
  loginRole: location.pathname === "/today" || location.pathname.startsWith("/play/") ? "student" : "teacher",
  filter: "",
};
async function api(path, { method = "GET", body, headers = {} } = {}) {
  let r;
  try { r = await fetch(path, {
    method,
    credentials: "same-origin",
    headers:
      body instanceof Blob
        ? headers
        : { "Content-Type": "application/json", ...headers },
    body:
      body === undefined
        ? undefined
        : body instanceof Blob
          ? body
          : JSON.stringify(body),
  }); } catch (error) { error.path = path; throw error; }
  let data;
  try {
    data = await r.json();
  } catch {
    throw Object.assign(Error("Réponse serveur illisible."), {path});
  }
  if (!r.ok) {
    const e = Error(data.error || `Erreur ${r.status}`);
    e.details = data.details;
    e.status = r.status;
    e.path = path;
    throw e;
  }
  return data;
}
const post = (path, body = {}) => api(path, { method: "POST", body });
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function modal(title, body) {
  $("#dialog").innerHTML =
    `<div class="modal-head"><h2 id="dialog-title">${title}</h2>${btn("Fermer", "close-modal", "", "subtle", "close")}</div><div class="modal-body">${body}</div>`;
  $("#dialog").setAttribute("aria-labelledby", "dialog-title");
  if (!$("#dialog").open) $("#dialog").showModal();
}
function closeModal() {
  $("#dialog").close();
}
async function busy(fn, message = "Préparation de votre séance…") {
  const div = document.createElement("div");
  div.className = "busy-screen";
  div.innerHTML = `<div><div class="spinner"></div><strong>${esc(message)}</strong><p class="subtitle" style="margin-top:10px">Le contexte, les sources et les fichiers restent liés à cette version.</p></div>`;
  document.body.append(div);
  try {
    return await fn();
  } finally {
    div.remove();
  }
}
function showError(e) {
  console.error(e);
  const student = S.user?.role === "student" || (!S.user && S.loginRole === "student");
  if (e.status === 401 && S.user) {
    S.loginRole = S.user.role;
    S.user = null;
    renderLogin();
  }
  modal(
    student ? "Action impossible" : "Une étape reste à résoudre",
    `<p role="alert">${esc(student ? studentError(e) : e.message)}</p>${!student && e.details ? `<pre class="block-content">${esc(JSON.stringify(e.details, null, 2))}</pre>` : ""}${btn("Compris", "close-modal", "", "primary")}`,
  );
}
const navItems = [
  ["dashboard", "dashboard", "Vue d’ensemble"],
  ["plan", "calendar", "Planification"],
  ["lessons", "book", "Mes séances"],
  ["corrections", "check", "Corrections"],
  ["remediation", "people", "Remédiation"],
  ["journal", "copy", "Cahier de texte"],
  ["resources", "folder", "Ressources"],
  ["settings", "settings", "Ma classe & réglages"],
];
function shell(content) {
  const active = navItems.find((n) => n[0] === S.view) || navItems[0];
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><div class="brand">${edenLogo}<small>TEACHER TWIN</small></div><div class="class-picker"><span class="class-badge">A1</span><div>Développement web<br><small class="muted">2026 — 2027</small></div><span style="margin-left:auto;color:#aaa">⌄</span></div><div class="nav-label">ESPACE PROFESSEUR</div><nav class="nav" aria-label="Navigation principale">${navItems.map(([id, ico, label]) => `<button class="${S.view === id ? "active" : ""}" data-action="nav" data-id="${id}" ${S.view === id ? 'aria-current="page"' : ""}>${icon(ico)}${label}</button>`).join("")}</nav><div class="sidebar-footer"><div class="twin-status"><span class="dot"></span>Twin connecté à votre classe<br><small>${S.data?.planVersion ? `Planification · version ${S.data.planVersion}` : "Importez votre planification"}</small></div><div class="profile"><span class="avatar">${esc(S.user.displayName.slice(0, 2).toUpperCase())}</span><div>${esc(S.user.displayName)}<br><small>Enseignant · ${esc(S.user.classId)}</small></div><button data-action="logout" title="Se déconnecter">${icon("logout")}</button></div></div></aside><div class="workspace"><header class="topbar"><div class="crumb">Mon espace <span>/</span><strong>${active[2]}</strong></div><div class="top-tools"><time>${dateText(S.session.date)}</time>${S.session.worldArcadeEnabled ? '<a class="btn small" href="/arcade">World Arcade</a>' : ""}${btn("Vue élève", "student-view", "", "small", "book")}</div></header><main id="main" class="content">${content}</main></div></div>`;
}
function heading(title, subtitle, action = "") {
  return `<div class="page-heading"><div><h1>${title}</h1><p class="subtitle">${subtitle}</p></div>${action}</div>`;
}
async function loadDashboard() {
  S.data = await api("/api/dashboard");
}
async function navigate(view) {
  S.view = view;
  S.filter = "";
  await loadDashboard();
  render();
}
function upcoming() {
  return S.data.entries
    .filter(
      (e) =>
        e.date >= S.session.date &&
        e.skills.length &&
        !["cancelled", "postponed"].includes(e.status),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}
function dashboard() {
  const d = S.data,
    next = upcoming()[0],
    lesson = next ? d.lessons.find((l) => l.date === next.date) : null,
    runs = d.runs.filter((r) => r.eligibleForDiagnostic),
    latest = runs.sort((a, b) => b.date.localeCompare(a.date))[0],
    pending = d.corrections.filter((c) => c.status !== "approved"),
    coverage = new Set(runs.flatMap((r) => r.coveredSkills));
  return (
    heading(
      "Chaque séance fait avancer la classe.",
      "Votre progression, vos élèves et la prochaine étape, au même endroit.",
      btn("Préparer une séance", "prepare", "", "primary", "plus"),
    ) +
    `<div class="metrics">${[
      [
        "calendar",
        "Séances réalisées",
        runs.length,
        `sur ${d.entries.filter((e) => e.skills.length).length} créneaux prévus`,
      ],
      [
        "check",
        "Critères abordés",
        coverage.size,
        `${d.criteria.length} critères au référentiel`,
      ],
      [
        "copy",
        "Copies à relire",
        pending.length,
        pending.length
          ? "Votre regard fait la différence"
          : "La file de correction est à jour",
      ],
      [
        "people",
        "Élèves accompagnés",
        d.learners.length,
        "Classe A1 · suivi individuel",
      ],
    ]
      .map(
        ([ico, label, note, sub]) =>
          `<div class="metric"><div class="metric-label">${icon(ico)}${label}</div><strong>${note}</strong><div class="under">${sub}</div></div>`,
      )
      .join("")}</div>
 <div class="dashboard-grid"><div><section class="card spaced"><div class="card-head"><h2>Votre prochaine séance</h2>${pill(next ? shortDate(next.date) : "À planifier", "brand-tone")}</div><div class="card-body">${next ? `<div class="lesson-feature"><div class="pills">${pill(next.sequence, "brand-tone")}${pill(next.category)}${pill(lesson ? stateLabel(lesson.status) : "Prévu", lesson?.status === "published" ? "green" : "")}</div><h2>${esc(next.objective.split("\n")[0])}</h2><p class="subtitle">${esc(next.objective.split("\n").slice(1).join(" ") || next.activity.split("\n")[0])}</p><div class="lesson-meta"><span>${icon("clock")}${next.duration} min${next.durationConfirmed ? "" : " · à confirmer"}</span><span>${icon("people")}Classe A1</span><span>${icon("book")}${next.skills.length} compétences</span></div><div class="pills">${next.skills.map((c) => pill(c, "brand-tone")).join("")}</div><div class="lesson-footer" style="margin-top:20px"><span>${lesson ? "Une version est disponible dans votre espace." : "Le Twin assemble votre contexte pédagogique."}</span>${lesson ? btn("Ouvrir la séance", "open-lesson", lesson.id, "primary", "arrow") : btn("Préparer avec le Twin", "generate-entry", next.id, "primary", "spark")}</div></div>` : empty("Importez votre classeur pour retrouver vos prochains créneaux.", "calendar")}
 <div class="diagnostic-source" style="margin-top:17px"><div class="flex" style="gap:8px;margin-bottom:5px">${icon("refresh")}<strong>Un diagnostic ancré dans le réel</strong></div>${latest ? `Source : séance clôturée du ${dateText(latest.date)} · ${latest.coveredSkills.map(esc).join(", ")}` : "Aucune séance clôturée. Le premier diagnostic sera explicitement un point de départ."}</div></div></section>
 <section class="card"><div class="card-head"><h2>Le fil des prochaines séances</h2>${btn("Tout le planning", "nav", "plan", "subtle small", "arrow")}</div><div class="card-body">${
   upcoming()
     .slice(0, 4)
     .map(
       (e) =>
         `<div class="list-row"><div class="date-tile"><span>${new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(new Date(e.date + "T12:00:00"))}</span><strong>${e.date.slice(-2)}</strong></div><div style="flex:1"><div class="row-title">${esc(e.objective.split("\n")[0])}</div><div class="row-sub">${esc(e.sequence)} · ${esc(e.module)}</div></div>${pill(d.lessons.some((l) => l.date === e.date) ? "Préparé" : "Prévu", d.lessons.some((l) => l.date === e.date) ? "brand-tone" : "")}${btn("", "generate-entry", e.id, "subtle small", "chevron")}</div>`,
     )
     .join("") || empty("Vos prochaines séances apparaîtront ici.", "calendar")
 }</div></section></div>
 <div class="right-column"><section class="card twin-card spaced"><div class="card-head"><div class="flex"><span class="twin-icon">${icon("spark")}</span><h2>Votre Teacher Twin</h2></div>${pill("A1")}</div><div class="card-body"><p>Une intention suffit.<br>Le Twin connaît votre plan et ce qui a réellement été travaillé.</p><form data-form="intent"><div class="intent-box"><textarea name="intent" aria-label="Votre intention pédagogique" placeholder="Prépare ma séance de jeudi…" required></textarea><button title="Préparer ma séance" type="submit">${icon("arrow")}</button></div></form><div class="quick-prompts"><button data-action="quick-intent" data-id="Prépare ma prochaine séance">Ma prochaine séance</button><button data-action="quick-intent" data-id="Prépare vendredi en remédiation">Remédiation du vendredi</button></div><div class="twin-foot">${icon("shield")}Vous gardez la main avant chaque publication.</div></div></section>
 <section class="card spaced"><div class="card-head"><h2>Points d’attention</h2>${icon("alert")}</div><div class="card-body"><div class="alert">${icon("alert")}<div><strong>${pending.length ? `${pending.length} copie(s) attendent votre relecture` : "Le réel nourrit votre prochaine séance"}</strong><br>${pending.length ? "Une pré-correction n’est pas encore une preuve validée." : "Clôturez vos séances pour que le diagnostic porte sur le contenu vraiment travaillé."}</div></div>${d.imports.at(-1)?.warnings?.length ? `<p class="section-note">${d.imports.at(-1).warnings.length} points signalés dans le dernier import. ${btn("Voir le rapport", "import-report", d.imports.at(-1).id, "subtle small")}</p>` : ""}</div></section>
 <section class="card"><div class="card-head"><h2>Chacun avance à son rythme</h2></div><div class="card-body"><div class="group-strip">${["G0", "G1", "G2", "G3"].map((g, i) => `<div class="group-mini"><small>${g}</small><strong>${d.remediation?.groups.find((x) => x.id === g)?.members.length || 0}</strong><small>${["Reprise", "Guidé", "Consolider", "Transférer"][i]}</small></div>`).join("")}</div><p class="section-note">Des groupes proposés par critère, toujours ajustables.</p>${btn("Voir la remédiation", "nav", "remediation", "subtle small", "arrow")}</div></section></div></div>`
  );
}
function planView() {
  const entries = S.data.entries.filter((e) =>
    `${e.date} ${e.objective} ${e.sequence} ${e.skills.join(" ")}`
      .toLowerCase()
      .includes(S.filter),
  );
  return (
    heading(
      "La planification reste vivante.",
      "Prévu, préparé, réalisé et maîtrisé : quatre états distincts.",
      btn("Historiques Excel", "reconcile-import", "", "", "book") +
        btn("Organiser les créneaux", "structure-plan", "", "", "calendar") +
        btn("Importer le classeur", "import", "", "primary", "download"),
    ) +
    `<div class="filters"><input class="search" id="plan-search" placeholder="Rechercher une date, séquence, compétence…" aria-label="Rechercher dans le planning" value="${esc(S.filter)}">${pill(`Version ${S.data.planVersion}`, "brand-tone")}${pill(`${entries.length} créneaux`)}</div><div class="card table-wrap"><table><thead><tr><th>Date</th><th>Objectif / séquence</th><th>Compétences</th><th>État</th><th>Actions</th></tr></thead><tbody>${entries
      .map((e) => {
        const l = S.data.lessons.find((l) => l.date === e.date);
        return `<tr draggable="true" data-plan-entry="${esc(e.id)}" data-plan-date="${e.date}"><td style="white-space:nowrap"><strong>${shortDate(e.date)}</strong><br><small>${e.day} · ${e.duration} min${e.durationConfirmed ? "" : " ?"}</small></td><td><strong>${esc(e.objective.split("\n")[0])}</strong><br><small>${esc(e.sequence)} · ${esc(e.module)}</small></td><td><div class="pills">${e.skills.map((c) => pill(c)).join("")}</div></td><td>${pill(l ? stateLabel(l.status) : stateLabel(e.status), l?.status === "completed" ? "green" : l ? "brand-tone" : "")}</td><td><div class="flex">${btn("Modifier", "edit-plan", e.id, "small") + btn("Organiser", "structure-plan", e.id, "small")}${e.skills.length ? (l ? btn("Ouvrir", "open-lesson", l.id, "small") : btn("Préparer", "generate-entry", e.id, "small primary")) : ""}</div></td></tr>`;
      })
      .join(
        "",
      )}</tbody></table>${entries.length ? "" : empty("Aucun créneau importé.")}</div>`
  );
}
function lessonsView() {
  return (
    heading(
      "Vos séances, prêtes à prendre vie.",
      "Des versions relues, des ressources reliées, un seul espace élève.",
      btn("Préparer une séance", "prepare", "", "primary", "plus"),
    ) +
    `<div class="grid-two">${S.data.lessons.map((l) => `<article class="card pad"><div class="flex between">${pill(stateLabel(l.status), l.status === "completed" ? "green" : "brand-tone")}<small class="muted">${shortDate(l.date)} · v${l.version}</small></div><h2 style="margin-top:20px">${esc(l.title)}</h2><p class="subtitle">${l.provider === "openai" ? "Préparé avec le Teacher Twin" : "Composé depuis votre bibliothèque pédagogique"}</p><div class="flex between" style="margin-top:23px">${btn("Ouvrir la séance", "open-lesson", l.id, "primary", "arrow")}${l.status === "published" ? btn("Clôturer", "close-lesson", l.id, "small", "check") : ""}</div></article>`).join("")}</div>${S.data.lessons.length ? "" : `<div class="card">${empty("Votre première séance commence par une intention.", "spark")}</div>`}`
  );
}
function lessonView() {
  const l = S.lesson,
    s = l.spec;
  return (
    heading(
      esc(s.title),
      `${dateText(s.date)} · ${s.sequence} · version ${s.lessonVersion}`,
      btn("Retour aux séances", "nav", "lessons", "", "arrow"),
    ) +
    `<div class="flex wrap spaced">${pill(stateLabel(l.status), "brand-tone")}${btn("Aperçu élève", "preview", l.id, "", "book")}${btn("Corpus complet", "corpus", l.id, "", "folder")}${l.status === "draft" ? btn("Modifier le contenu", "edit-lesson", l.id, "", "settings") + btn("Mission de jeu", "choose-mission", l.id, "small") + btn("Plus pratique", "adapt-practice", l.id, "small") + btn("Différencier", "adapt-remediation", l.id, "small") + btn("Publier cette version", "publish", l.id, "primary", "check") : l.status === "published" ? btn("Adapter la suite", "adapt-remediation", l.id, "small") + btn("Clôturer la séance", "close-lesson", l.id, "primary", "check") : ""}</div><div class="lesson-layout"><div><div class="card pad spaced"><div class="eyebrow">La séance en un regard</div><h2>Ce que l’élève saura faire</h2><ul class="block-content">${s.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ul><div class="pills">${s.skills.map((c) => pill(c, "brand-tone")).join("")}</div></div><div class="card pad spaced"><h2>Le déroulé · ${s.blocks.reduce((a, b) => a + b.minutes, 0)} minutes</h2>${s.blocks.map((b) => `<div class="timeline-row"><div class="timeline-time">${b.minutes} min</div><div><strong>${esc(b.title)}</strong><p>${esc(b.content).slice(0, 600)}</p></div></div>`).join("")}</div><div class="card pad"><h2>Guide d’animation</h2><div class="block-content">${esc(s.teacherGuide)}</div></div></div><aside><div class="card pad spaced"><h2>Avant de publier</h2>${l.quality.checks.map((c) => `<div class="check ${c.ok ? "" : "bad"}"><b>${c.ok ? "✓" : "○"}</b>${esc(c.message)}</div>`).join("")}<p class="section-note">La publication vérifie à nouveau le plan et la dernière séance clôturée.</p></div><div class="card pad spaced"><div class="eyebrow">Diagnostic · ${s.diagnostic.duration} min</div><h2>${s.diagnostic.kind === "baseline" ? "Point de départ" : "La dernière séance réelle"}</h2><p class="subtitle">${s.diagnostic.sourceLessonRunId ? esc(s.diagnostic.sourceLessonRunId) : "Aucune séance précédente n’est présumée réalisée."}</p><div class="pills" style="margin-top:14px">${s.diagnostic.criteria.map((c) => pill(c)).join("")}</div>${btn("Consignes et grille /20", "diagnostic", l.id, "subtle small", "arrow")}</div><div class="card pad"><div class="eyebrow">Activité native EDEN</div><h2>${s.codeStation ? "CODE//STATION" : "Transfert autonome"}</h2><p class="subtitle">${s.codeStation ? "Mission du catalogue PédagoLab · tests et preuve finale." : "Une activité de transfert remplace le jeu lorsqu’aucune mission n’est compatible avec les critères."}</p></div></aside></div>`
  );
}
function correctionsView() {
  return (
    heading(
      "Observer avant de conclure.",
      "Les productions sont figées. Votre validation transforme la correction en preuve.",
    ) +
    `<div class="card table-wrap"><table><thead><tr><th>Élève</th><th>Séance</th><th>Note /20</th><th>Niveau</th><th>Statut</th><th></th></tr></thead><tbody>${S.data.corrections.map((c) => `<tr><td><strong>${esc(S.data.learners.find((l) => l.id === c.learnerId)?.displayName || c.learnerId)}</strong></td><td>${esc(S.data.lessons.find((l) => l.id === c.lessonId)?.title || c.lessonId)}</td><td>${c.score ?? "—"}</td><td>${pill(c.level, c.level === "NE" ? "amber" : "brand-tone")}</td><td>${pill(stateLabel(c.status), c.status === "approved" ? "green" : "amber")}</td><td>${(c.status !== "approved" && S.data.integrations.openai ? btn("Pré-corriger", "precorrect", c.id, "small") : "") + btn("Relire", "review", c.id, "small", "arrow")}</td></tr>`).join("")}</tbody></table>${S.data.corrections.length ? "" : empty("Les diagnostics remis par les élèves apparaîtront ici.", "check")}</div>`
  );
}
function gameReviews() {
  return S.data.gameEvidence.length
    ? `<div class="section-header"><h2>Productions PédagoLab</h2></div><div class="card"><div class="card-body" style="padding-top:20px">${S.data.gameEvidence.map((p) => `<div class="list-row"><div><div class="row-title">${esc(S.data.learners.find((l) => l.id === p.learnerId)?.displayName || p.learnerId)}</div><div class="row-sub">${esc(p.missionId)} · ${esc(stateLabel(p.status))}</div></div>${p.approved ? pill("Preuve validée", "green") : btn("Relire la production", "review-game", p.id, "small")}</div>`).join("")}</div></div>`
    : "";
}
function remediationView() {
  const r = S.data.remediation;
  return (
    heading(
      "Un appui juste, au bon moment.",
      "Les groupes sont proposés par critère. Le niveau d’une preuve ne vaut pas maîtrise durable.",
      btn("Accès aux mondes", "game-access", "", "", "code") +
        btn("Observer", "observe-learner", "", "", "plus") +
        (r
          ? btn("Stabiliser la semaine", "stabilize-groups", "", "", "check")
          : "") +
        btn(
          "Actualiser les groupes",
          "compute-remediation",
          "",
          "primary",
          "refresh",
        ),
    ) +
    (r
      ? `<div class="grid-three">${r.groups.map((g) => `<section class="card pad"><div class="flex between">${pill(g.id, "brand-tone")}<small class="muted">${g.members.length} élève(s)</small></div><h2 style="margin-top:18px">${esc(g.title)}</h2>${g.members.map((m) => `<div class="list-row"><span class="avatar">${esc((S.data.learners.find((l) => l.id === m.learnerId)?.displayName || "?").slice(0, 2))}</span><div><div class="row-title">${esc(S.data.learners.find((l) => l.id === m.learnerId)?.displayName || m.learnerId)}</div><div class="row-sub">${m.criteria.map(esc).join(", ") || "Pas encore de preuve"}</div></div>${btn("", "move-group", m.learnerId, "small subtle", "arrow")}</div>`).join("") || '<p class="subtitle">Aucun élève dans ce groupe.</p>'}</section>`).join("")}</div>`
      : `<div class="card">${empty("Calculez les groupes à partir des premières corrections.", "people")}</div>`)
  );
}
function journalView() {
  return (
    heading(
      "Ce qui a vraiment été travaillé.",
      "La clôture alimente le diagnostic suivant et préserve les versions utilisées.",
    ) +
    `<div class="card table-wrap"><table><thead><tr><th>Date</th><th>Séance</th><th>Réalisation</th><th>Contenu couvert</th><th></th></tr></thead><tbody>${S.data.runs
      .slice()
      .reverse()
      .map(
        (r) =>
          `<tr><td>${shortDate(r.date)}</td><td>${esc(S.data.lessons.find((l) => l.id === r.lessonId)?.title || r.lessonId)}</td><td>${pill(stateLabel(r.status), r.eligibleForDiagnostic ? "green" : "")}</td><td><small>${esc(r.coveredContent || "À renseigner")}</small><div class="pills">${r.coveredSkills.map((c) => pill(c)).join("")}</div></td><td>${!r.closedAt ? btn("Clôturer", "close-lesson", r.lessonId, "small primary") : btn("Détails", "journal-detail", r.id, "small")}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table>${S.data.runs.length ? "" : empty("Publiez une séance pour ouvrir son cahier de texte.", "copy")}</div>`
  );
}
function settingsView() {
  const d = S.data;
  return (
    heading(
      "Votre classe, vos repères.",
      "Accès individuels, intégrations et historique des imports.",
    ) +
    `<div class="grid-three spaced">${[
      [
        "Mémoire métier",
        d.integrations.storage === "postgres"
          ? "PostgreSQL / Neon connecté"
          : "SQLite local persistant",
        "Les versions, rendus et preuves sont conservés en base.",
      ],
      [
        "Génération",
        d.integrations.openai ? "OpenAI configuré" : "Bibliothèque pédagogique",
        "La génération IA s’active avec OPENAI_API_KEY et OPENAI_MODEL côté serveur.",
      ],
      [
        "Google Drive",
        d.integrations.drive ? "Connecté" : "Non configuré",
        "Les secrets restent côté serveur. Associez ensuite chaque élève à son dossier Drive.",
      ],
    ]
      .map(
        ([title, status, desc]) =>
          `<div class="card pad"><h2>${title}</h2>${pill(status, "brand-tone")}<p class="section-note">${desc}</p></div>`,
      )
      .join(
        "",
      )}</div><div class="card spaced"><div class="card-head"><h2>Planification et référentiel</h2>${btn("Importer un classeur", "import", "", "primary", "download")}</div><div class="card-body">${d.imports.map((i) => `<div class="list-row"><div><div class="row-title">Import ${i.status === "applied" ? "appliqué" : "en attente"} · ${i.mapping.length} feuilles</div><div class="row-sub">${i.sha256.slice(0, 24)}… · ${i.warnings.length} avertissements</div></div>${btn("Rapport", "import-report", i.id, "small")}</div>`).join("") || '<p class="subtitle">Le classeur fourni dans le projet est prêt à être importé.</p>'}</div></div><div class="card"><div class="card-head"><h2>Élèves · ${d.learners.length}</h2></div><div class="table-wrap"><table><thead><tr><th>Identité</th><th>Identifiant</th><th>Accès</th><th>Drive</th><th></th></tr></thead><tbody>${d.learners.map((l) => `<tr><td><strong>${esc(l.displayName)}</strong></td><td>${esc(l.username)}</td><td>${pill(l.hasAccess ? "Activé" : "À créer", l.hasAccess ? "green" : "amber")}</td><td>${btn(l.driveFolderId ? "Dossier associé" : "Associer un dossier", "link-drive", l.id, "small")}</td><td>${btn("Code d’accès", "learner-access", l.id, "small")}${btn("Maîtrise", "learner-mastery", l.id, "small subtle")}</td></tr>`).join("")}</tbody></table></div></div>`
  );
}
function render() {
  if (!S.user) return renderLogin();
  if (S.user.role === "student") return renderStudent();
  const renderers = {
    dashboard,
    plan: planView,
    lessons: () => (S.lesson ? lessonView() : lessonsView()),
    corrections: () => correctionsView() + gameReviews(),
    remediation: remediationView,
    journal: journalView,
    settings: settingsView,
    resources: () =>
      heading(
        "La bibliothèque de votre Twin.",
        "Les ressources PédagoLab préservées et reliées au référentiel.",
      ) +
      `<div class="filters"><input class="search" id="resource-search" placeholder="Rechercher : boucle, Git, HTML…" aria-label="Rechercher une ressource"><span class="muted" id="resource-count"></span></div><div class="grid-three" id="resource-list"></div>`,
  };
  shell((renderers[S.view] || dashboard)());
  if (S.view === "resources") loadResources("");
}
async function loadResources(q) {
  const rows = await api("/api/resources?q=" + enc(q));
  if (!$("#resource-list")) return;
  $("#resource-count").textContent = `${rows.length} ressources`;
  $("#resource-list").innerHTML = rows
    .map(
      (r) =>
        `<article class="card resource-card">${pill(r.code, "brand-tone")}<h3>${esc(r.title)}</h3><p>${esc(r.opening)}</p>${btn("Explorer la ressource", "resource", r.code, "subtle small", "arrow")}</article>`,
    )
    .join("");
}
function renderLogin() {
  const setup = S.session?.setupRequired, student = !setup && S.loginRole === "student";
  document.title = student ? "EDEN · Connexion" : "EDEN · Teacher Twin";
  $("#app").innerHTML =
    `<main id="main" class="login"><div class="login-card"><div class="brand">${edenLogo}${student ? "" : "<small>TEACHER TWIN</small>"}</div><h1>${student ? studentCopy.login : setup ? "Bienvenue dans votre espace." : "Reprendre le fil."}</h1>${student ? "" : `<p class="subtitle">${setup ? "Créez votre accès professeur pour connecter votre planification." : "Une classe. Une progression. Le bon prochain pas."}</p>`}${setup ? "" : `<div class="tabs"><button data-action="login-role" data-id="teacher" aria-pressed="${S.loginRole === "teacher"}" class="${S.loginRole === "teacher" ? "active" : ""}">Professeur</button><button data-action="login-role" data-id="student" aria-pressed="${student}" class="${student ? "active" : ""}">Élève</button></div>`}<form data-form="login">${setup ? "" : `<div class="field"><label for="username">Identifiant</label><input id="username" name="username" autocomplete="username" value="${S.loginRole === "teacher" ? "professeur" : ""}" required></div>`}<div class="field"><label for="password">${setup ? "Choisissez un mot de passe (12 caractères minimum)" : studentCopy.password}</label><input id="password" name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" ${setup ? 'minlength="12"' : ""} required></div><button class="btn primary" type="submit">${setup ? "Créer mon espace" : studentCopy.signIn} ${icon("arrow")}</button></form></div></main>`;
}
function showImport(report) {
  S.importReport = report;
  modal(
    "Prévisualiser l’import",
    `<div class="pills">${pill(`${report.mapping.length} feuilles`, "brand-tone")}${pill(`${report.counts?.criteria || "—"} critères`)}${pill(`${report.counts?.entries || "—"} créneaux`)}</div><p class="section-note">SHA-256 : ${esc(report.sha256)}</p><h3 style="margin-top:24px">Le diff proposé</h3><p class="subtitle">${report.diff.added.length} ajouts · ${report.diff.changed.length} modifications · ${report.diff.removed.length} suppressions · ${report.conflicts.length} conflits</p><details style="margin-top:20px"><summary>${report.warnings.length} points à vérifier</summary><ul class="block-content">${report.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></details>${report.conflicts.length ? '<p class="error">Des modifications EDEN entrent en conflit. Corrigez le fichier avant de le réimporter.</p>' : ""}<p class="section-note">Aucune date planifiée ne sera considérée comme une séance réalisée. Les feuilles d’historique sont préservées pour réconciliation.</p><div class="modal-actions">${btn("Fermer", "close-modal")}${report.status === "applied" ? pill("Déjà appliqué", "green") : report.conflicts.length ? "" : btn("Valider cet import", "apply-import", report.id, "primary", "check")}</div>`,
  );
}
async function openLesson(id) {
  S.lesson = await api("/api/lessons/" + enc(id));
  S.view = "lessons";
  render();
}
async function generateEntry(id, intent = "Prépare cette séance") {
  const entry = S.data.entries.find((e) => e.id === id);
  if (entry && !entry.durationConfirmed) return editPlanDialog(id, true);
  closeModal();
  await busy(async () => {
    const lesson = await post("/api/lessons/generate", {
      intent,
      entryId: id || undefined,
    });
    await loadDashboard();
    await openLesson(lesson.id);
  });
  toast("Séance préparée et corpus compilé. Relisez avant publication.");
}
function editPlanDialog(id, prepareAfter = false) {
  const e = S.data.entries.find((e) => e.id === id);
  S.prepareAfter = prepareAfter;
  modal(
    prepareAfter ? "Confirmer le créneau" : "Proposer une modification du plan",
    `<p class="subtitle spaced">${prepareAfter ? "La durée de séance n’est pas précisée dans le classeur. Confirmez-la avant la préparation." : "Le Twin analyse les dépendances avant que vous validiez la nouvelle version."}</p><form data-form="plan-change" data-id="${esc(id)}"><div class="form-grid"><div class="field"><label for="entry-date">Date</label><input id="entry-date" type="date" name="date" value="${e.date}" required></div><div class="field"><label for="duration">Durée du créneau (minutes)</label><input id="duration" type="number" name="duration" min="30" max="600" value="${e.duration}" required></div></div><div class="field"><label for="objective">Objectif</label><textarea id="objective" name="objective" required>${esc(e.objective)}</textarea></div><div class="field"><label for="reason">Justification</label><input id="reason" name="reason" value="${prepareAfter ? "Confirmation de la durée du créneau" : ""}" required></div><div class="modal-actions"><button class="btn primary" type="submit">Analyser la modification ${icon("arrow")}</button></div></form>`,
  );
}
async function startStudent(date) {
  const result = await api("/api/today" + (date ? "?date=" + enc(date) : ""));
  S.student = result.lesson;
  S.studentEvents = result.events || [];
  S.completed = result.progress?.completed || [];
  S.attempt = result.attempt;
  S.step = result.progress?.stepId
    ? Math.max(
        0,
        result.lesson.spec.blocks.findIndex(
          (b) => b.id === result.progress.stepId,
        ),
      )
    : 0;
  S.answers = {
    ...(result.progress?.answers || {}),
    ...(result.attempt?.answers || {}),
  };
  if (S.student && S.user.role === "student") {
    S.attempt = await post("/api/assessments/" + enc(S.student.id) + "/start");
    S.answers = {
      ...(result.progress?.answers || {}),
      ...(S.attempt.answers || {}),
    };
    const key = `eden:${S.user.id}:${S.student.versionId}`;
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved) {
      const localActivities = Object.fromEntries(
        Object.entries(saved.answers || {}).filter(([id]) =>
          S.student.spec.activities.some((a) => a.id === id),
        ),
      );
      if (!result.progress?.savedAt || saved.at > result.progress.savedAt)
        S.answers = { ...S.answers, ...localActivities };
      if (!S.attempt.submissionId)
        S.answers = {
          ...S.answers,
          ...Object.fromEntries(
            Object.entries(saved.answers || {}).filter(([id]) =>
              S.student.spec.diagnostic.tasks.some((a) => a.id === id),
            ),
          ),
        };
      S.step = Math.min(saved.step || 0, S.student.spec.blocks.length - 1);
    }
    const diagnosticStep = S.student.spec.blocks.findIndex(b => b.type === "Diagnostic");
    if (!S.attempt.submissionId && diagnosticStep >= 0 && S.step > diagnosticStep)
      S.step = diagnosticStep;
  }
  renderStudent();
}
function studentBlock(spec, index, preview = false) {
  return renderLessonBlock(spec, index, {
    preview,
    answers: preview ? {} : S.answers,
    submitted: !preview && !!S.attempt?.submissionId,
  });
}
function renderStudent() {
  document.title = "EDEN · Aujourd’hui";
  const l = S.student;
  if (!l) {
    $("#app").innerHTML =
      `<main id="main" class="student-shell"><div class="student-header"><div class="brand">${edenLogo}</div>${S.session.worldArcadeEnabled ? '<a class="btn" href="/arcade">World Arcade</a>' : ""}${btn("Se déconnecter", "logout")}</div><div class="card">${empty(studentCopy.empty, "calendar")}</div></main>`;
    return;
  }
  $("#app").innerHTML = renderLessonPage(l.spec, S.step, {
    answers: S.answers,
    submitted: !!S.attempt?.submissionId,
    displayName: S.user.displayName,
    completed: S.completed || [],
  });
  if (S.session.worldArcadeEnabled) $(".lesson-topbar > div")?.insertAdjacentHTML("beforeend", '<a class="btn small" href="/arcade">World Arcade</a>');
}
function focusStudentStage() {
  requestAnimationFrame(() =>
    $(".lesson-stage h1")?.focus({ preventScroll: false }),
  );
}
function persistLocal() {
  if (!S.student) return;
  localStorage.setItem(
    `eden:${S.user.id}:${S.student.versionId}`,
    JSON.stringify({
      answers: S.answers,
      step: S.step,
      at: new Date().toISOString(),
    }),
  );
  const el = $("#save-status");
  if (el) el.textContent = studentCopy.localSaved;
}
async function studentEvent(type, activityId, payload = {}) {
  return post("/api/events", {
    eventId: crypto.randomUUID(),
    lessonId: S.student.id,
    lessonVersionId: S.student.versionId,
    type,
    activityId,
    payload,
  });
}
const actions = {
  "close-modal": () => closeModal(),
  nav: async (id) => {
    S.lesson = null;
    await navigate(id);
  },
  logout: async () => {
    await post("/api/logout");
    location.href = "/";
  },
  "login-role": (id) => {
    S.loginRole = id;
    renderLogin();
  },
  "student-view": () => {
    modal(
      "L’espace élève",
      `<p>Chaque élève se connecte avec son identifiant et son mot de passe à <a href="/today" target="_blank">/today</a>. Pour examiner une séance avant publication, utilisez son aperçu élève.</p>${btn("Ouvrir mes séances", "modal-lessons", "", "primary", "arrow")}`,
    );
  },
  "modal-lessons": async () => {
    closeModal();
    S.lesson = null;
    await navigate("lessons");
  },
  prepare: () =>
    modal(
      "Une intention, une séance.",
      `<form data-form="prepare"><div class="field"><label for="prepare-intent">Que souhaitez-vous préparer ?</label><textarea id="prepare-intent" name="intent" required placeholder="Prépare ma séance de jeudi">Prépare ma prochaine séance</textarea></div><div class="field"><label for="prepare-entry">Créneau à préparer</label><select id="prepare-entry" name="entryId" style="width:100%">${S.data.entries
        .filter((e) => e.skills.length)
        .map(
          (e) =>
            `<option value="${esc(e.id)}" ${e.id === upcoming()[0]?.id ? "selected" : ""}>${e.date} · ${esc(e.objective.split("\n")[0])}</option>`,
        )
        .join(
          "",
        )}</select></div><p class="section-note">Le Twin utilisera le plan, le référentiel et la dernière séance réellement clôturée. Vous relirez la séance avant publication.</p><div class="modal-actions"><button class="btn primary" type="submit">${icon("spark")} Préparer la séance</button></div></form>`,
    ),
  "quick-intent": (id) => {
    actions.prepare();
    $("#prepare-intent").value = id;
  },
  "generate-entry": (id) => generateEntry(id),
  "open-lesson": (id) => openLesson(id),
  "edit-plan": (id) => editPlanDialog(id),
  "apply-change": async (id) => {
    const change = await post(`/api/plans/A1/changes/${enc(id)}/apply`, {
      confirmed: true,
    });
    closeModal();
    await loadDashboard();
    if (S.prepareAfter) {
      S.prepareAfter = false;
      const intent = S.pendingIntent || "Prépare cette séance";
      S.pendingIntent = null;
      await generateEntry(change.entryId, intent);
    } else {
      render();
      toast("Nouvelle version de planification enregistrée.");
    }
  },
  import: () =>
    modal(
      "Importer votre planification",
      `<p class="subtitle spaced">Le classeur est analysé avant application. Chaque feuille est conservée, chaque modification est comparée au plan EDEN.</p><div class="flex wrap spaced">${btn("Analyser le classeur fourni", "import-source", "", "primary", "book")}</div><div class="field"><label for="workbook-file">Ou choisir un fichier Excel</label><input id="workbook-file" type="file" accept=".xlsx"></div>${btn("Analyser mon fichier", "import-file", "", "", "download")}`,
    ),
  "import-source": () =>
    busy(
      async () => showImport(await post("/api/imports/planning/source")),
      "Analyse du classeur…",
    ),
  "import-file": async () => {
    const file = $("#workbook-file").files[0];
    if (!file) throw Error("Choisissez un classeur XLSX.");
    await busy(
      async () =>
        showImport(
          await api("/api/imports/planning", {
            method: "POST",
            body: new Blob([file], {
              type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            headers: {
              "Content-Type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            },
          }),
        ),
      "Analyse du classeur…",
    );
  },
  "apply-import": async (id) => {
    await busy(async () => {
      await post(`/api/imports/${enc(id)}/apply`, { confirmed: true });
      closeModal();
      await loadDashboard();
      render();
    }, "Import et versionnement…");
    toast("La planification est maintenant enregistrée dans EDEN.");
  },
  "import-report": (id) => showImport(S.data.imports.find((r) => r.id === id)),
  preview: async (id) => {
    const spec = await post(`/api/lessons/${enc(id)}/preview`);
    S.previewSpec = spec;
    S.previewStep = 0;
    modal(
      "Aperçu élève",
      `<div id="preview-body" class="lesson-view">${studentBlock(spec, 0, true)}</div><div class="modal-actions">${btn("Étape précédente", "preview-prev")}${btn("Étape suivante", "preview-next", "", "primary", "arrow")}</div>`,
    );
  },
  "preview-prev": () => {
    S.previewStep = Math.max(0, S.previewStep - 1);
    $("#preview-body").innerHTML = studentBlock(
      S.previewSpec,
      S.previewStep,
      true,
    );
  },
  "preview-next": () => {
    S.previewStep = Math.min(
      S.previewSpec.blocks.length - 1,
      S.previewStep + 1,
    );
    $("#preview-body").innerHTML = studentBlock(
      S.previewSpec,
      S.previewStep,
      true,
    );
  },
  diagnostic: () => {
    const d = S.lesson.spec.diagnostic;
    modal(
      "Diagnostic · consignes, grille et références",
      `${d.tasks.map((a) => `<div class="block-card"><h3>${esc(a.title)}</h3><p class="block-content">${esc(a.instruction)}</p><details><summary>Référence professeur</summary><p class="block-content">${esc(a.reference)}<br>${esc(a.expectedAnswer)}</p></details></div>`).join("")}<table><thead><tr><th>Critère</th><th>Max</th><th>A1</th><th>A2</th></tr></thead><tbody>${d.rubric.map((i) => `<tr><td>${esc(i.criterion)}</td><td>${i.max}</td><td>${i.a1}</td><td>${i.a2}</td></tr>`).join("")}</tbody></table>`,
    );
  },
  publish: async (id) => {
    const l = await api("/api/lessons/" + enc(id));
    S.lesson = l;
    if (!l.quality.publishable) {
      render();
      throw Error(
        "Résolvez les contrôles signalés avant la publication. Si le plan a changé, régénérez la séance.",
      );
    }
    modal(
      "Publier cette séance ?",
      `<h3>${esc(l.title)}</h3><p>La version ${l.version} sera visible aux élèves pour le ${dateText(l.date)}. Le diagnostic, sa grille et le corpus sont liés à cette version.</p><div class="modal-actions">${btn("Relire encore", "close-modal")}${btn("Valider et publier", "confirm-publish", id, "primary", "check")}</div>`,
    );
  },
  "confirm-publish": async (id) => {
    await post(`/api/lessons/${enc(id)}/publish`, {
      confirmed: true,
      version: S.lesson.version,
    });
    closeModal();
    await loadDashboard();
    await openLesson(id);
    toast("Séance publiée. Le cahier de texte est ouvert.");
  },
  "edit-lesson": () => {
    const s = S.lesson.spec;
    modal(
      "Ajuster le déroulé",
      `<form data-form="edit-lesson"><div class="field"><label for="edit-title">Titre</label><input id="edit-title" name="title" value="${esc(s.title)}" required></div>${s.blocks
        .filter((b) => b.type !== "Diagnostic")
        .map(
          (b) =>
            `<details class="block-card"><summary>${esc(b.title)}</summary><div class="field" style="margin-top:16px"><label>Titre du bloc<input name="title:${esc(b.id)}" value="${esc(b.title)}" required></label></div><div class="field"><label>Contenu<textarea name="content:${esc(b.id)}">${esc(b.content)}</textarea></label></div><label>Durée (minutes)<input type="number" min="1" name="minutes:${esc(b.id)}" value="${b.minutes}" required></label></details>`,
        )
        .join(
          "",
        )}<h3>Consignes et productions</h3>${s.activities.map((a) => `<details class="block-card"><summary>${esc(a.title)}</summary><div class="field"><label>Consigne<textarea name="instruction:${esc(a.id)}">${esc(a.instruction)}</textarea></label></div><div class="field"><label>Production attendue<input name="evidence:${esc(a.id)}" value="${esc(a.expectedEvidence)}"></label></div><div class="field"><label>Support de départ<textarea name="starter:${esc(a.id)}">${esc(a.starter)}</textarea></label></div><div class="field"><label>Correction professeur<textarea name="reference:${esc(a.id)}">${esc(a.reference)}</textarea></label></div><div class="field"><label>Réponse attendue<textarea name="expected:${esc(a.id)}">${esc(a.expectedAnswer)}</textarea></label></div></details>`).join("")}<div class="field"><label for="edit-reason">Justification</label><input id="edit-reason" name="reason" required></div><div class="modal-actions"><button class="btn primary">Enregistrer une nouvelle version</button></div></form>`,
    );
  },
  corpus: async (id) => {
    const manifest = await api(`/api/corpus/${enc(id)}/manifest`);
    modal(
      "Le corpus de votre séance",
      `<div class="pills">${pill(manifest.lessonId, "brand-tone")}${pill(`Version ${manifest.lessonVersion}`)}${pill(`${manifest.files.length} fichiers`)}</div><p class="section-note">Le ZIP complet contient les corrections : il est réservé au professeur. La publication élèves distribue uniquement leurs ressources.</p><div class="modal-actions"><a class="btn primary" href="/api/corpus/${enc(id)}/download">${icon("download")}Télécharger le ZIP complet</a>${btn("Distribuer sur Drive", "drive-publish", id, "", "folder")}${btn("Suivi des distributions", "publication-jobs")}</div><div class="file-list" style="margin-top:24px">${manifest.files.map((f) => `<div><span>${esc(f.path)}</span>${pill(f.audience === "student" ? "Élève" : "Professeur", f.audience === "student" ? "green" : "")}</div>`).join("")}</div>`,
    );
  },
  "close-lesson": async (id) => {
    const l = await api("/api/lessons/" + enc(id));
    S.closingLesson = l;
    modal(
      "Clôturer : noter le réel",
      `<p class="subtitle spaced">${esc(l.title)} · ${dateText(l.date)}</p><form data-form="close-lesson" data-id="${esc(id)}"><div class="field"><label for="run-status">Ce qui s’est passé</label><select id="run-status" name="status"><option value="completed">Séance réalisée</option><option value="partially_completed">Partiellement réalisée</option><option value="postponed">Reportée</option><option value="cancelled">Annulée</option><option value="replaced">Remplacée</option><option value="not_completed">Non réalisée</option><option value="non_evaluable">Événement non évaluable</option></select></div><div class="field"><label>Critères réellement travaillés</label>${l.spec.skills.map((c) => `<label class="check-label"><input type="checkbox" name="coveredSkills" value="${esc(c)}" checked>${esc(c)}</label>`).join("")}</div><div class="field"><label for="covered">Contenu réellement couvert</label><textarea id="covered" name="coveredContent" placeholder="Précisez les activités et notions réellement travaillées."></textarea></div><div class="form-grid"><div class="field"><label for="difficulties">Difficultés</label><textarea id="difficulties" name="difficulties"></textarea></div><div class="field"><label for="next-action">Prochaine étape</label><textarea id="next-action" name="nextAction"></textarea></div></div><div class="field"><label for="journal-comment">Commentaire professeur</label><textarea id="journal-comment" name="comment"></textarea></div><div class="modal-actions"><button class="btn primary">${icon("check")} Clôturer et alimenter le Twin</button></div></form>`,
    );
  },
  "journal-detail": (id) => {
    const r = S.data.runs.find((r) => r.id === id);
    modal(
      "Cahier de texte · " + dateText(r.date),
      `${pill(stateLabel(r.status), "brand-tone")}<h3 style="margin-top:22px">Contenu couvert</h3><p class="block-content">${esc(r.coveredContent || "Aucun")}</p><h3>Non couvert</h3><p class="block-content">${r.notCoveredSkills.map(esc).join(", ") || "Aucun"}</p><h3>Difficultés et suite</h3><p class="block-content">${esc(r.difficulties)}<br>${esc(r.nextAction)}<br>${esc(r.comment)}</p>`,
    );
  },
  review: async (id) => {
    const data = await api("/api/teacher/submissions/" + enc(id));
    S.review = data;
    const { submission: s, correction: c } = data;
    modal(
      "Relire la copie",
      `<div class="flex between"><span>${esc(S.data.learners.find((l) => l.id === s.learnerId)?.displayName || s.learnerId)}</span>${pill(`${c.score ?? "NE"} /20 · ${c.level}`, "brand-tone")}<a class="btn small" href="/api/teacher/submissions/${enc(id)}/export">${icon("download")} Dossier élève</a></div><p class="section-note">Copie figée le ${new Date(s.submittedAt).toLocaleString("fr-FR")} · SHA ${s.sha256.slice(0, 16)}…</p><form data-form="correction" data-id="${esc(id)}">${c.items
        .map((i) => {
          const task = s.diagnostic.tasks.find((t) => t.id === i.taskId);
          return `<div class="block-card"><h3>${esc(task.title)}</h3><p class="block-content">${esc(task.instruction)}</p><pre class="console">${esc(s.answers[i.taskId] || "(non répondu)")}</pre><details><summary>Référence et preuves attendues</summary><p class="block-content">${esc(task.reference)}<br>${esc(task.expectedAnswer)}</p></details><div class="form-grid" style="margin-top:17px"><label>Points / ${i.max}<input type="number" min="0" max="${i.max}" step="0.01" name="points:${i.id}" value="${i.points ?? ""}" required></label><label>Commentaire<input name="feedback:${i.id}" value="${esc(i.feedback)}"></label></div></div>`;
        })
        .join(
          "",
        )}<details class="spaced"><summary>Premier / dernier essai · ${s.history.length} événements</summary><pre class="block-content">${esc(JSON.stringify(s.history, null, 2))}</pre></details><div class="field"><label>Feedback global<textarea name="feedback">${esc(c.feedback)}</textarea></label></div><label class="check-label"><input type="checkbox" name="autonomous" ${c.autonomous ? "checked" : ""}>Autonomie observée et confirmée</label><label class="check-label"><input type="checkbox" name="transfer" ${c.transfer ? "checked" : ""}>Situation de transfert confirmée</label><div class="field" style="margin-top:20px"><label>Justification de la validation<input name="reason" required></label></div><div class="modal-actions">${btn("Réouvrir une tentative", "reopen", id, "")}<button class="btn primary">Valider cette correction</button></div></form>`,
    );
  },
  reopen: (id) =>
    modal(
      "Réouvrir sans effacer",
      `<form data-form="reopen" data-id="${esc(id)}"><p>Une nouvelle tentative sera créée. La copie originale et sa correction resteront intactes.</p><label>Justification<input name="reason" required></label><div class="modal-actions"><button class="btn primary">Créer une nouvelle tentative</button></div></form>`,
    ),
  "compute-remediation": async () => {
    await post("/api/remediation/compute");
    await loadDashboard();
    render();
    toast("Groupes recalculés. Les élèves sans preuve restent à observer.");
  },
  "move-group": (id) =>
    modal(
      "Ajuster l’accompagnement",
      `<form data-form="move-group" data-id="${esc(id)}"><div class="field"><label>Groupe<select name="group" style="width:100%">${S.data.remediation.groups.map((g) => `<option value="${g.id}">${g.id} · ${esc(g.title)}</option>`).join("")}</select></label></div><div class="field"><label>Critères à déplacer (vides : tous)<input name="criteria" placeholder="N3.1, N3.2"></label></div><div class="field"><label>Justification<input name="reason" required></label></div><button class="btn primary">Enregistrer le déplacement</button></form>`,
    ),
  resource: async (id) => {
    const rows = await api("/api/resources?q=" + enc(id)),
      r = rows.find((r) => r.code === id);
    modal(
      esc(r.title),
      `${pill(r.code, "brand-tone")}<p class="block-content" style="margin-top:20px">${esc(r.lesson)}</p><pre class="console">${esc(r.example)}</pre><h3>À pratiquer</h3><p class="block-content">${esc(r.task)}</p><h3>Transfert</h3><p class="block-content">${esc(r.transfer)}</p>`,
    );
  },
  "review-game": async (id) => {
    const p = await api("/api/teacher/game-evidence/" + enc(id));
    S.gameProof = p;
    modal(
      "Relire la production de jeu",
      `<h3>${esc(p.mission.title)}</h3><p>${esc(p.mission.brief)}</p>${Object.entries(
        p.production,
      )
        .map(
          ([name, code]) =>
            `<h3>${esc(name)}</h3><pre class="console">${esc(code)}</pre>`,
        )
        .join(
          "",
        )}<form data-form="game-proof" data-id="${esc(id)}">${p.mission.competencies.map((c) => `<div class="field"><label>${esc(c)}<select name="${esc(c)}" required><option value="">Attribuer un niveau</option>${["NA", "EC", "A1", "A2"].map((l) => `<option>${l}</option>`).join("")}</select></label></div>`).join("")}<label class="check-label"><input type="checkbox" name="autonomous">Autonomie observée</label><label class="check-label"><input type="checkbox" name="transfer">Transfert observé</label><div class="field" style="margin-top:18px"><label>Justification<input name="reason" required></label></div><button class="btn primary">Valider la preuve pédagogique</button></form>`,
    );
  },
  "learner-access": async (id) => {
    modal(
      "Créer un nouveau code d’accès ?",
      `<p>Le code précédent de ${esc(S.data.learners.find((l) => l.id === id).displayName)} sera remplacé. Le nouveau code sera affiché une seule fois.</p><div class="modal-actions">${btn("Annuler", "close-modal")}${btn("Créer le code", "confirm-access", id, "primary")}</div>`,
    );
  },
  "confirm-access": async (id) => {
    const access = await post(`/api/teacher/learners/${enc(id)}/access`);
    await loadDashboard();
    render();
    modal(
      "Accès élève créé",
      `<p>Transmettez ces informations à l’élève.</p><label>Identifiant<input readonly value="${esc(access.username)}"></label><label style="margin-top:20px">Mot de passe<input readonly value="${esc(access.password)}"></label><p class="section-note">Connexion sur /today. Ce mot de passe ne sera pas réaffiché.</p>`,
    );
  },
  "learner-mastery": async (id) => {
    const rows = await api("/api/mastery/" + enc(id));
    modal(
      "Maîtrise durable",
      `<p class="subtitle spaced">Deux preuves autonomes espacées d’au moins 7 jours, dont une en transfert. Les notes seules ne suffisent pas.</p><table><thead><tr><th>Critère</th><th>Preuves</th><th>Autonomie</th><th>Maîtrise</th></tr></thead><tbody>${rows
        .filter((r) => r.proofCount)
        .map(
          (r) =>
            `<tr><td>${r.criterion}</td><td>${r.proofCount}</td><td>${r.autonomousCount}</td><td>${pill(r.durable ? "Maîtrisé" : "En développement", r.durable ? "green" : "amber")}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table>${rows.some((r) => r.proofCount) ? "" : empty("Aucune preuve validée pour cet élève.")}`,
    );
  },
  "link-drive": async (id) => {
    const folders = await api("/api/integrations/drive/students");
    modal(
      "Associer un dossier Drive",
      `<form data-form="link-drive" data-id="${esc(id)}"><label>Dossier de l’élève<select name="driveFolderId" style="width:100%">${folders.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></label><div class="modal-actions"><button class="btn primary">Associer</button></div></form>`,
    );
  },
  "drive-publish": async (id) => {
    const status = await api("/api/integrations/drive/status");
    if (!status.configured)
      throw Error(
        "Google Drive n’est pas configuré. Renseignez les identifiants serveur du compte de service, puis associez les dossiers élèves.",
      );
    modal(
      "Distribuer sur Drive",
      `<form data-form="drive-publish" data-id="${esc(id)}"><div class="field"><label>Destination<select name="audience"><option value="student">Ressources élèves</option><option value="teacher">Corpus complet professeur</option><option value="individual">Dossiers individuels corrigés</option></select></label></div><p>Les dossiers individuels contiennent uniquement la copie et la correction validée de chaque destinataire.</p><div class="field"><label>Matière<input name="subject" value="01 - Tech" required></label></div>${S.data.learners.map((l) => `<label class="check-label"><input type="checkbox" name="students" value="${esc(l.id)}" ${l.driveFolderId ? "checked" : ""}>${esc(l.displayName)} ${l.driveFolderId ? "" : "· dossier non associé"}</label>`).join("")}<div class="modal-actions"><button class="btn primary">Confirmer les destinataires et publier</button></div></form>`,
    );
  },
  "drive-retry": async (id) => {
    const report = await busy(
      () =>
        post(`/api/integrations/drive/publications/${enc(id)}/retry`, {
          confirmed: true,
        }),
      "Nouvel essai des destinataires en erreur…",
    );
    showDriveReport(report);
  },
  "student-step": async (id) => {
    const target = Number(id),
      diagnostic = S.student.spec.blocks.findIndex(
        (b) => b.type === "Diagnostic",
      );
    if (target > diagnostic && !S.attempt?.submissionId)
      throw Error(
        studentCopy.diagnosticGate,
      );
    S.step = target;
    await studentEvent("step_started", S.student.spec.blocks[S.step].id);
    persistLocal();
    renderStudent();
    focusStudentStage();
  },
  "student-prev": () => {
    S.step = Math.max(0, S.step - 1);
    persistLocal();
    renderStudent();
    focusStudentStage();
  },
  "student-next": async () => {
    const b = S.student.spec.blocks[S.step];
    if (b.type === "Diagnostic" && !S.attempt?.submissionId)
      throw Error(studentCopy.diagnosticGate);
    await studentEvent("step_completed", b.id);
    S.completed = [...new Set([...(S.completed || []), b.id])];
    if (S.step === S.student.spec.blocks.length - 1) {
      await studentEvent("lesson_submitted", b.id, { answers: S.answers });
      renderStudent();
      toast("Bilan envoyé.");
      return;
    }
    S.step++;
    await studentEvent("step_started", S.student.spec.blocks[S.step].id);
    persistLocal();
    renderStudent();
    focusStudentStage();
  },
  "save-answers": async () => {
    const label = $("#save-status"), sentAnswers = JSON.stringify(S.answers);
    label.textContent = "Enregistrement en cours…";
    try {
      await post(`/api/assessments/${enc(S.attempt.id)}/save`, { answers: S.answers });
      label.textContent = sentAnswers === JSON.stringify(S.answers) ? studentCopy.saved : studentCopy.localSaved;
    } catch (error) {
      label.textContent = studentError(error);
      throw error;
    }
  },
  "submit-answers": () =>
    modal(
      studentCopy.submit,
      `<p>Tu ne pourras plus modifier ce travail après l’envoi. Tu peux rendre une réponse incomplète.</p><div class="modal-actions">${btn("Continuer à travailler", "close-modal")}${btn("Confirmer l’envoi", "confirm-submit", "", "primary", "check")}</div>`,
    ),
  "confirm-submit": async () => {
    const r = await post(`/api/assessments/${enc(S.attempt.id)}/submit`, {
      answers: S.answers,
    });
    S.attempt.submissionId = r.submissionId;
    closeModal();
    toast(studentCopy.submitted);
    renderStudent();
  },
  "student-result": async () => {
    const r = await api(`/api/assessments/${enc(S.attempt.id)}/result`);
    modal("Mon résultat", renderStudentResult(r));
  },
  "run-code": async (id) => {
    const area = $(`[data-answer="${id}"]`),
      code = area.value;
    S.answers[id] = code;
    persistLocal();
    autosaveActivity(id);
    const isDiagnostic = S.student.spec.diagnostic.tasks.some(
      (a) => a.id === id,
    );
    const r = await post(
      isDiagnostic
        ? `/api/assessments/${enc(S.attempt.id)}/test`
        : "/api/code/run",
      {
        code,
        taskId: id,
        lessonId: S.student.id,
        lessonVersionId: S.student.versionId,
      },
    );
    const el = $("#console-" + id);
    el.hidden = false;
    el.textContent =
      [...r.logs, r.error || "", r.ok ? "Exécution terminée." : ""]
        .filter(Boolean)
        .join("\n") || "(Aucune sortie console)";
  },
  "complete-activity": async (id) => {
    await studentEvent("step_completed", id, { answer: S.answers[id] || "" });
    S.completed = [...new Set([...(S.completed || []), id])];
    renderStudent();
    toast("Activité terminée.");
  },
  "launch-game": async () => {
    const mission = S.student.spec.codeStation;
    const run = await post("/api/game/runs", {
      lessonId: S.student.id,
      missionId: mission.missionId,
    });
    S.gameRun = run;
    const ctx = await api(`/api/game/runs/${enc(run.id)}/context`);
    S.gameContext = ctx;
    modal(
      "EDEN · " + ctx.worlds[ctx.worldId].title,
      `<iframe class="game-frame" title="Mission PédagoLab" sandbox="allow-scripts" src="/game/index.html"></iframe>`,
    );
  },
};
function showDriveReport(r) {
  modal(
    "Rapport de publication Drive",
    `<h2>${r.success} / ${r.total} élèves servis</h2>${r.students.map((s) => `<div class="list-row"><div>${esc(S.data.learners.find((l) => l.id === s.studentId)?.displayName || s.studentId)}<p class="row-sub">${s.filesCreated} fichier(s) créés · ${s.filesSkipped} ignorés${s.error ? " · " + esc(s.error) : ""}</p></div>${pill(s.status, s.status === "success" ? "green" : "red")}</div>`).join("")}${r.failed ? btn("Réessayer uniquement les erreurs", "drive-retry", r.id, "primary", "refresh") : ""}`,
  );
}
const forms = {
  login: async (f, data) => {
    const result = await post(
      S.session.setupRequired ? "/api/setup" : "/api/login",
      {
        username: data.username,
        password: data.password,
        role: S.loginRole,
        classId: "A1",
      },
    );
    S.user = result.user;
    S.session.setupRequired = false;
    await boot();
  },
  prepare: async (f, data) => generateEntry(data.entryId, data.intent),
  intent: async (f, data) => {
    const weekday = [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ].findIndex((day) => data.intent.toLowerCase().includes(day));
    const target =
      weekday < 0
        ? upcoming()[0]
        : upcoming().find(
            (e) => new Date(e.date + "T12:00:00").getDay() === weekday,
          );
    if (!target)
      throw Error("Aucun créneau correspondant. Consultez la planification.");
    await generateEntry(target.id, data.intent);
  },
  "plan-change": async (f, data) => {
    const change = await post("/api/plans/A1/changes/propose", {
      entryId: f.dataset.id,
      patch: {
        date: data.date,
        duration: Number(data.duration),
        durationConfirmed: true,
        objective: data.objective,
      },
      reason: data.reason,
    });
    modal(
      "L’impact de votre modification",
      `<p><strong>${esc(change.oldValue.date)} → ${esc(change.newValue.date)}</strong> · ${change.newValue.duration} minutes</p><p class="block-content">${esc(change.newValue.objective)}</p><div class="alert info">${icon("shield")}${change.impact.warnings.length ? change.impact.warnings.map(esc).join("<br>") : "Aucune dépendance explicite bloquante détectée."}</div><p class="section-note">${change.impact.assessments.length} évaluation(s) concernée(s). Le plan passera de la version ${change.baseVersion} à ${change.baseVersion + 1}.</p><div class="modal-actions">${btn("Annuler", "close-modal")}${btn("Valider cette modification", "apply-change", change.id, "primary", "check")}</div>`,
    );
  },
  "edit-lesson": async (f, data) => {
    const spec = structuredClone(S.lesson.spec);
    spec.title = data.title;
    for (const b of spec.blocks) {
      if (b.type === "Diagnostic") continue;
      b.title = data["title:" + b.id];
      b.content = data["content:" + b.id];
      b.minutes = Number(data["minutes:" + b.id]);
    }
    for (const a of spec.activities) {
      a.instruction = data["instruction:" + a.id];
      a.expectedEvidence = data["evidence:" + a.id];
      a.starter = data["starter:" + a.id];
      a.reference = data["reference:" + a.id];
      a.expectedAnswer = data["expected:" + a.id];
    }
    spec.timeline = spec.blocks.map((b) => ({
      blockId: b.id,
      minutes: b.minutes,
    }));
    spec.slides = spec.blocks
      .filter((b) => !["Pause", "Diagnostic"].includes(b.type))
      .map((b) => ({ title: b.title, body: b.content }));
    await api("/api/lessons/" + enc(S.lesson.id), {
      method: "PUT",
      body: { version: S.lesson.version, spec, reason: data.reason },
    });
    await busy(
      () => post(`/api/corpus/${enc(S.lesson.id)}/compile`),
      "Compilation de la nouvelle version…",
    );
    closeModal();
    await openLesson(S.lesson.id);
  },
  "close-lesson": async (f, data) => {
    await post(`/api/lessons/${enc(f.dataset.id)}/close`, {
      ...data,
      coveredSkills: new FormData(f).getAll("coveredSkills"),
    });
    closeModal();
    S.lesson = null;
    await navigate("journal");
    toast("Cahier de texte clôturé. Le Twin utilisera désormais ce réel.");
  },
  correction: async (f, data) => {
    const c = S.review.correction;
    await post(`/api/teacher/submissions/${enc(f.dataset.id)}/correction`, {
      version: c.version,
      items: c.items.map((i) => ({
        id: i.id,
        points: Number(data["points:" + i.id]),
        feedback: data["feedback:" + i.id],
      })),
      feedback: data.feedback,
      reason: data.reason,
      autonomous: data.autonomous === "on",
      transfer: data.transfer === "on",
    });
    closeModal();
    await loadDashboard();
    render();
    toast("Correction validée, preuves et groupes actualisés.");
  },
  reopen: async (f, data) => {
    await post(`/api/teacher/submissions/${enc(f.dataset.id)}/reopen`, data);
    closeModal();
    toast("Une nouvelle tentative est ouverte.");
  },
  "move-group": async (f, data) => {
    await api("/api/remediation/groups/" + enc(data.group), {
      method: "PATCH",
      body: {
        learnerId: f.dataset.id,
        reason: data.reason,
        version: S.data.remediation.version,
        criteria: (data.criteria || "")
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      },
    });
    closeModal();
    await loadDashboard();
    render();
  },
  "game-proof": async (f, data) => {
    await post("/api/teacher/game-evidence/" + enc(f.dataset.id) + "/approve", {
      criteria: S.gameProof.mission.competencies.map((criterion) => ({
        criterion,
        level: data[criterion],
      })),
      autonomous: data.autonomous === "on",
      transfer: data.transfer === "on",
      reason: data.reason,
    });
    closeModal();
    await loadDashboard();
    render();
    toast("Preuve de jeu validée.");
  },
  "link-drive": async (f, data) => {
    await api("/api/teacher/learners/" + enc(f.dataset.id), {
      method: "PATCH",
      body: data,
    });
    closeModal();
    await loadDashboard();
    render();
    toast("Dossier Drive associé.");
  },
  "drive-publish": async (f, data) => {
    const job = await post("/api/integrations/drive/jobs", {
      lessonId: f.dataset.id,
      audience: data.audience,
      subject: data.subject,
      students: new FormData(f).getAll("students"),
      confirmed: true,
      requestId: crypto.randomUUID(),
    });
    showPublicationJob(job);
  },
};
function showPublicationJob(job) {
  modal(
    "Publication enregistrée",
    `<p>La distribution continue côté serveur. Vous pouvez fermer cette fenêtre.</p><p>État : <strong>${esc(job.status)}</strong> · tentative ${job.attempts}</p>${job.error ? `<p class="error">${esc(job.error)}</p>` : ""}<div class="modal-actions">${btn("Actualiser", "publication-status", job.id)}${job.reportId ? btn("Voir le rapport", "publication-report", job.reportId) : ""}${job.status === "failed" ? btn("Reprendre les échecs", "publication-retry", job.id, "primary") : ""}</div>`,
  );
}
function planProposal(change) {
  S.prepareAfter = false;
  modal(
    "Relire la nouvelle planification",
    `<p>${esc(change.reason)}</p>${(change.changes || [change]).map((c) => `<div class="block-card"><strong>${esc(c.newValue.objective)}</strong><p>${esc(c.oldValue?.date || "Nouveau créneau")} → ${esc(c.newValue.date)} · ${c.newValue.duration} min · ${esc(c.newValue.status)}</p><div class="pills">${c.newValue.skills.map((c) => pill(c)).join("")}</div></div>`).join("")}<div class="alert info">${change.impact.warnings.map(esc).join("<br>") || "Aucune dépendance explicite signalée."}</div><p>Version ${change.baseVersion} → ${change.baseVersion + 1} · ${change.impact.assessments.length} évaluation(s) concernée(s).</p><div class="modal-actions">${btn("Annuler", "close-modal")}${btn("Valider cette modification", "apply-change", change.id, "primary")}</div>`,
  );
}
function planStructureDialog(id = "", draft = null) {
  const entries = S.data.entries.filter(
    (e) => !["replaced", "cancelled", "postponed"].includes(e.status),
  );
  const source = entries.find((e) => e.id === id) || entries[0];
  S.structureDraft = draft;
  modal(
    "Organiser les créneaux",
    `<form data-form="plan-structure"><div class="field"><label>Opération<select name="operation"><option value="insert" ${draft ? "selected" : ""}>Insérer une séance</option><option value="split" ${id ? "selected" : ""}>Diviser un créneau</option><option value="merge">Fusionner deux créneaux</option><option value="swap">Permuter deux créneaux</option><option value="postpone">Marquer comme reporté</option></select></label></div><div class="form-grid"><div class="field"><label>Créneau source<select name="source">${entries.map((e) => `<option value="${esc(e.id)}" ${e.id === source?.id ? "selected" : ""}>${e.date} · ${esc(e.objective.slice(0, 70))}</option>`).join("")}</select></label></div><div class="field"><label>Second créneau (fusion / permutation)<select name="other">${entries.map((e) => `<option value="${esc(e.id)}">${e.date} · ${esc(e.objective.slice(0, 70))}</option>`).join("")}</select></label></div></div><div class="form-grid"><div class="field"><label>Date de destination<input name="date" type="date" value="${esc(draft?.date || source?.date || S.data.date)}" required></label></div><div class="field"><label>Durée de destination<input name="duration" type="number" min="30" max="600" value="175" required></label></div></div><div class="field"><label>Objectif de la nouvelle séance<input name="objective" value="${esc(draft?.objective || source?.objective || "")}" required></label></div><div class="field"><label>Critères N3 (séparés par des virgules)<input name="skills" value="${esc(source?.skills.join(", ") || "")}"></label></div><div class="field"><label>Séquence<input name="sequence" value="${esc(source?.sequence || "")}"></label></div><details><summary>Deuxième partie d’une division</summary><div class="form-grid"><div class="field"><label>Date<input name="secondDate" type="date" value="${source?.date || S.data.date}"></label></div><div class="field"><label>Durée<input name="secondDuration" type="number" value="90" min="30" max="600"></label></div></div><div class="field"><label>Objectif<input name="secondObjective" value="Approfondir et transférer"></label></div></details><div class="field"><label>Justification<input name="reason" required value="${esc(draft?.objective || "")}"></label></div><p class="section-note">Les créneaux remplacés et les séances déjà réalisées restent dans l’historique. Relisez les impacts avant validation.</p><button class="btn primary">Analyser la proposition</button></form>`,
  );
}
async function handleIntent(intent, entryId) {
  let result;
  await busy(async () => {
    result = await post("/api/twin/intent", { intent, entryId });
  }, "Analyse de votre intention…");
  if (result.kind === "plan_selector") return planStructureDialog();
  if (result.kind === "reorder_choice") {
    S.reorderIntent = result;
    return modal(
      "Réordonner les séances",
      `<p>${esc(result.message)}</p><form data-form="reorder-intent"><div class="field"><label>Séance à avancer<select name="source">${result.sources.map((e) => `<option value="${esc(e.id)}">${e.date} · ${esc(e.objective)}</option>`).join("")}</select></label></div><div class="field"><label>Créneau à permuter<select name="target">${result.targets.map((e) => `<option value="${esc(e.id)}">${e.date} · ${esc(e.objective)}</option>`).join("")}</select></label></div><button class="btn primary">Analyser la permutation</button></form>`,
    );
  }
  if (result.kind === "plan_proposal") return planProposal(result.proposal);
  if (result.kind === "confirm_duration") {
    S.pendingIntent = intent;
    return editPlanDialog(result.entryId, true);
  }
  if (result.kind === "unplanned_draft") return planStructureDialog("", result);
  if (
    ["clarification", "journal_proposal", "adaptation_request"].includes(
      result.kind,
    )
  ) {
    S.intentText = intent;
    const action =
      result.kind === "journal_proposal"
        ? "close-lesson"
        : result.kind === "adaptation_request"
          ? "adapt-practice"
          : "intent-entry";
    return modal(
      "Préciser la séance",
      `<p>${esc(result.message)}</p>${(result.candidates || []).map((c) => `<div class="list-row"><div style="flex:1">${esc(c.date)} · ${esc(c.objective)}</div>${btn("Choisir", action, c.id, "small")}</div>`).join("")}${btn("Ouvrir la planification", "nav", "plan", "subtle")}`,
    );
  }
  await loadDashboard();
  await openLesson(result.id);
  toast("Séance préparée. Relisez avant publication.");
}
async function adaptLesson(id, strategy) {
  const lesson = await api("/api/lessons/" + enc(id));
  const p = await post("/api/lessons/" + enc(id) + "/adapt/propose", {
    strategy,
    version: lesson.version,
  });
  S.adaptation = p;
  modal(
    "Relire l’adaptation",
    `<ul>${p.changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul><p>Le diagnostic et les copies restent figés. ${p.live ? "Seuls les ateliers non commencés seront remplacés après validation." : "Une nouvelle version du brouillon sera créée."}</p><div class="modal-actions">${btn("Annuler", "close-modal")}${btn("Valider l’adaptation", "apply-adaptation", id, "primary")}</div>`,
  );
}
async function showReconciliation() {
  const applied = S.data.imports.filter((r) => r.status === "applied").at(-1);
  if (!applied) throw Error("Importez le classeur avant réconciliation.");
  S.reconciliation = await api(
    "/api/imports/" + enc(applied.id) + "/reconciliation",
  );
  const r = S.reconciliation;
  modal(
    "Relire les historiques Excel",
    `<p>Chaque ligne reste une source à confirmer. Les dates planifiées seules ne prouvent aucune réalisation.</p>${[
      ["assessment", r.history],
      ["journal", r.journal],
    ]
      .map(
        ([kind, rows]) =>
          `<h3>${kind === "assessment" ? "Évaluations" : "Cahier de texte"}</h3>${rows.map((row) => `<div class="list-row"><span style="flex:1">${esc(row.source.date)} · ${esc(row.source.learner || row.source.sequence)} · ${esc(row.source.comment || row.source.status || "")}</span>${row.reconciled ? pill("Réconcilié", "green") : btn("Relire", "reconcile-row", kind + ":" + row.index, "small")}</div>`).join("") || "<p>Aucune ligne historique.</p>"}`,
      )
      .join("")}`,
  );
}
Object.assign(actions, {
  "choose-mission": async (id) => {
    const missions = await api("/api/game/missions"),
      spec = S.lesson.spec;
    S.missionChoices = missions.filter(
      (m) =>
        m.status !== "draft" &&
        m.competencies.every((c) =>
          [...spec.skills, ...spec.reactivation].includes(c),
        ),
    );
    modal(
      "Choisir ou adapter une mission",
      `<form data-form="choose-mission" data-id="${esc(id)}"><div class="field"><label>Mission compatible<select name="missionId">${S.missionChoices.map((m) => `<option value="${esc(m.id)}">${esc(m.world)} · ${esc(m.title)}</option>`).join("")}</select></label></div><details><summary>Adapter le contexte de la mission</summary><div class="field"><label>Titre personnalisé<input name="title"></label></div><div class="field"><label>Nouveau contexte<textarea name="brief"></textarea></label></div><p>Les fichiers, tests et critères du template seront conservés.</p></details><div class="field"><label>Justification<input name="reason" required></label></div><button class="btn primary">Prévisualiser la mission</button></form>`,
    );
  },
  "confirm-mission": async () => {
    const p = S.missionProposal;
    await busy(async () => {
      if (p.mission.status === "draft")
        await post("/api/game/missions/" + enc(p.mission.id) + "/validate", {
          confirmed: true,
          reason: p.reason,
        });
      await post("/api/lessons/" + enc(p.lessonId) + "/mission", {
        confirmed: true,
        missionId: p.mission.id,
        version: p.version,
        reason: p.reason,
      });
    });
    closeModal();
    await openLesson(p.lessonId);
  },
  "refresh-student": () => startStudent(S.student?.date),
  "game-access": async () => {
    const worlds = await api("/api/game/worlds");
    modal(
      "Ouvrir un monde",
      `<form data-form="game-access"><div class="field"><label>Élève<select name="learnerId">${S.data.learners.map((l) => `<option value="${esc(l.id)}">${esc(l.displayName)}</option>`).join("")}</select></label></div><div class="field"><label>Monde<select name="worldId">${worlds.map((w) => `<option value="${esc(w.id)}">${esc(w.title)}</option>`).join("")}</select></label></div><div class="field"><label>Décision<select name="enabled"><option value="yes">Ouvrir l’accès</option><option value="no">Revenir aux prérequis normaux</option></select></label></div><div class="field"><label>Justification<input name="reason" required></label></div><p>Cette ouverture ne valide aucune compétence.</p><button class="btn primary">Enregistrer</button></form>`,
    );
  },
  precorrect: async (id) => {
    const r = await api("/api/teacher/submissions/" + enc(id));
    await busy(
      () =>
        post("/api/teacher/submissions/" + enc(id) + "/precorrect", {
          version: r.correction.version,
        }),
      "Analyse du barème et des preuves…",
    );
    closeModal();
    await loadDashboard();
    render();
  },
  "reconcile-import": showReconciliation,
  "reconcile-row": (id) => {
    const [kind, n] = id.split(":"),
      row = (
        kind === "assessment"
          ? S.reconciliation.history
          : S.reconciliation.journal
      )[Number(n)];
    S.reconciliationRow = { kind, index: Number(n), source: row.source };
    const source = row.source;
    modal(
      "Confirmer la lecture historique",
      `<p>${esc(source.date)} · ${esc(source.comment || source.morning || "")}</p><form data-form="reconcile-row">${kind === "assessment" ? `<div class="field"><label>Élève source : ${esc(source.learner)}<select name="learnerId">${S.data.learners.map((l) => `<option value="${esc(l.id)}" ${l.displayName === source.learner ? "selected" : ""}>${esc(l.displayName)}</option>`).join("")}</select></label></div>${source.criteria.map((c) => `<div class="field"><label>${esc(c.criterion)} · valeur source ${esc(c.levelValue)}<select name="level:${esc(c.criterion)}">${["NE", "NA", "EC", "A1", "A2"].map((l) => `<option>${l}</option>`).join("")}</select></label></div>`).join("")}<label class="check-label"><input type="checkbox" name="autonomous">Autonomie attestée</label><label class="check-label"><input type="checkbox" name="transfer">Transfert attesté</label>` : `<div class="field"><label>Réalisation<select name="status">${["non_evaluable", "not_completed", "completed", "partially_completed", "cancelled", "postponed"].map((status) => `<option value="${status}">${esc(stateLabel(status))}</option>`).join("")}</select></label></div>${source.skills.map((c) => `<label class="check-label"><input type="checkbox" name="skills" value="${esc(c)}">${esc(c)} réellement travaillé</label>`).join("")}<div class="field"><label>Contenu réellement travaillé<textarea name="coveredContent">${esc(source.morning + " " + source.afternoon)}</textarea></label></div>`}<div class="field"><label>Justification<textarea name="reason" required></textarea></label></div><button class="btn primary">Valider cette ligne</button></form>`,
    );
  },
  "publication-status": async (id) =>
    showPublicationJob(await api("/api/integrations/drive/jobs/" + enc(id))),
  "publication-report": async (id) =>
    showDriveReport(
      await api("/api/integrations/drive/publications/" + enc(id)),
    ),
  "publication-retry": async (id) =>
    showPublicationJob(
      await post("/api/integrations/drive/jobs/" + enc(id) + "/retry", {
        confirmed: true,
      }),
    ),
  "publication-jobs": async () => {
    const jobs = await api("/api/integrations/drive/jobs");
    modal(
      "Distributions Drive",
      jobs
        .map(
          (j) =>
            `<div class="list-row"><span>${esc(j.lessonId)} · ${esc(j.status)}</span>${btn("Ouvrir", "publication-status", j.id)}</div>`,
        )
        .join("") || "<p>Aucune distribution.</p>",
    );
  },
  "structure-plan": (id) => planStructureDialog(id),
  "intent-entry": (id) => handleIntent(S.intentText, id),
  "adapt-practice": (id) => adaptLesson(id, "practice"),
  "adapt-remediation": (id) => adaptLesson(id, "remediation"),
  "apply-adaptation": async (id) => {
    await busy(async () =>
      post("/api/lessons/" + enc(id) + "/adapt/apply", {
        confirmed: true,
        proposalId: S.adaptation.id,
      }),
    );
    closeModal();
    await loadDashboard();
    await openLesson(id);
  },
  "stabilize-groups": async () => {
    await post("/api/remediation/stabilize", {
      confirmed: true,
      version: S.data.remediation.version,
    });
    await loadDashboard();
    render();
  },
  "observe-learner": () =>
    modal(
      "Ajouter une observation",
      `<form data-form="observation"><div class="field"><label>Élève<select name="learnerId">${S.data.learners.map((l) => `<option value="${esc(l.id)}">${esc(l.displayName)}</option>`).join("")}</select></label></div><div class="field"><label>Critère<select name="criterion">${S.data.criteria.map((c) => `<option value="${esc(c.n3_code)}">${esc(c.n3_code)} · ${esc(c.observable_criterion)}</option>`).join("")}</select></label></div><div class="field"><label>Niveau<select name="level">${["NE", "NA", "EC", "A1", "A2"].map((c) => `<option>${c}</option>`).join("")}</select></label></div><div class="field"><label>Date<input type="date" name="date" value="${S.data.date}" max="${S.data.date}" required></label></div><div class="field"><label>Ce que vous avez observé<textarea name="note" required></textarea></label></div><p class="section-note">Cette observation affine l’accompagnement ; elle ne constitue pas à elle seule une preuve de maîtrise.</p><button class="btn primary">Enregistrer</button></form>`,
    ),
});
Object.assign(forms, {
  "choose-mission": async (f, d) => {
    let mission = S.missionChoices.find((m) => m.id === d.missionId);
    if (!mission) throw Error("Aucune mission compatible.");
    if (d.title || d.brief)
      mission = await post("/api/game/missions/" + enc(mission.id) + "/adapt", {
        title: d.title || mission.title,
        brief: d.brief || mission.brief,
        reason: d.reason,
      });
    S.missionProposal = {
      lessonId: f.dataset.id,
      version: S.lesson.version,
      mission,
      reason: d.reason,
    };
    modal(
      "Relire la mission",
      `<h3>${esc(mission.title)}</h3><p>${esc(mission.brief)}</p>${Object.entries(
        mission.files,
      )
        .map(
          ([name, code]) =>
            `<h4>${esc(name)}</h4><pre class="code">${esc(code)}</pre>`,
        )
        .join(
          "",
        )}<h4>Scénarios de validation</h4><pre class="code">${esc(JSON.stringify(mission.scenarios, null, 2))}</pre><div class="modal-actions">${btn("Annuler", "close-modal")}${btn("Valider et affecter", "confirm-mission", "", "primary")}</div>`,
    );
  },
  "reorder-intent": async (f, d) =>
    planProposal(
      await post("/api/plans/A1/changes/propose", {
        reason: S.reorderIntent.reason,
        operations: [
          { type: "swap", entryId: d.source, otherEntryId: d.target },
        ],
      }),
    ),
  "game-access": async (f, d) => {
    await post("/api/teacher/learners/" + enc(d.learnerId) + "/game-override", {
      worldId: d.worldId,
      enabled: d.enabled === "yes",
      reason: d.reason,
    });
    closeModal();
    toast("Accès enregistré sans preuve pédagogique.");
  },
  "reconcile-row": async (f, d) => {
    const row = S.reconciliationRow;
    await post(
      "/api/imports/" + enc(S.reconciliation.importId) + "/reconciliation",
      {
        confirmed: true,
        kind: row.kind,
        index: row.index,
        learnerId: d.learnerId,
        criteria:
          row.kind === "assessment"
            ? row.source.criteria.map((c) => ({
                criterion: c.criterion,
                level: d["level:" + c.criterion],
              }))
            : [],
        autonomous: d.autonomous === "on",
        transfer: d.transfer === "on",
        status: d.status,
        coveredSkills: new FormData(f).getAll("skills"),
        coveredContent: d.coveredContent,
        reason: d.reason,
      },
    );
    await loadDashboard();
    await showReconciliation();
  },
  intent: async (f, data) => handleIntent(data.intent),
  "plan-structure": async (f, d) => {
    const entry = {
      date: d.date,
      duration: Number(d.duration),
      durationConfirmed: true,
      objective: d.objective,
      skills: d.skills
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      sequence: d.sequence,
    };
    let operation;
    if (d.operation === "insert") operation = { type: "insert", entry };
    else if (d.operation === "split")
      operation = {
        type: "split",
        entryId: d.source,
        parts: [
          entry,
          {
            ...entry,
            date: d.secondDate,
            duration: Number(d.secondDuration),
            objective: d.secondObjective,
          },
        ],
      };
    else if (d.operation === "merge")
      operation = { type: "merge", entryIds: [d.source, d.other], entry };
    else if (d.operation === "swap")
      operation = { type: "swap", entryId: d.source, otherEntryId: d.other };
    else operation = { type: "postpone", entryId: d.source };
    planProposal(
      await post("/api/plans/A1/changes/propose", {
        reason: d.reason,
        operations: [operation],
      }),
    );
  },
  observation: async (f, d) => {
    await post("/api/teacher/observations", d);
    await post("/api/remediation/compute");
    closeModal();
    await loadDashboard();
    render();
  },
});

const answerTimers = new Map();
function autosaveActivity(id) {
  if (
    !S.student ||
    S.user.role !== "student" ||
    !S.student.spec.activities.some((a) => a.id === id)
  )
    return;
  clearTimeout(answerTimers.get(id));
  const lessonId = S.student.id,
    lessonVersionId = S.student.versionId,
    answer = S.answers[id];
  answerTimers.set(
    id,
    setTimeout(async () => {
      const event = {
        eventId: crypto.randomUUID(),
        lessonId,
        lessonVersionId,
        type: "answer_saved",
        activityId: id,
        payload: { answer },
      };
      try {
        await post("/api/events", event);
        // This activity acknowledgement must not confirm a different, currently open evaluation.
      } catch {
        toast("L’enregistrement en ligne n’a pas pu être confirmé. Ta réponse reste sur cet appareil.");
      }
    }, 700),
  );
}
function activeActivity(id) {
  return [
    ...(S.student?.spec.activities || []),
    ...(S.student?.spec.diagnostic.tasks || []),
    ...(S.previewSpec?.activities || []),
  ].find((a) => a.id === id);
}
installWorkshopInteractions({ getActivity: activeActivity });
function reorder(id, from, to) {
  const a = activeActivity(id);
  if (!a) return;
  let order;
  try {
    order = JSON.parse(S.answers[id]);
  } catch {
    order = [...a.options];
  }
  if (!Array.isArray(order)) order = [...a.options];
  if (to < 0 || to >= order.length) return;
  order.splice(to, 0, order.splice(from, 1)[0]);
  S.answers[id] = JSON.stringify(order);
  persistLocal();
  autosaveActivity(id);
  if (S.user.role === "student") renderStudent();
}
document.addEventListener("click", (e) => {
  const sort = e.target.closest("[data-sort]");
  if (sort) {
    reorder(
      sort.dataset.sort,
      Number(sort.dataset.index),
      Number(sort.dataset.index) + Number(sort.dataset.direction),
    );
    return;
  }
  const preview = e.target.closest("[data-preview-html]");
  if (preview) {
    const id = preview.dataset.previewHtml;
    document.querySelector(`[data-preview-frame="${CSS.escape(id)}"]`).srcdoc =
      sandboxDocument(S.answers[id] || activeActivity(id)?.starter || "");
  }
  const terminal = e.target.closest("[data-terminal]");
  if (terminal) {
    const id = terminal.dataset.terminal;
    document.querySelector(
      `[data-terminal-output="${CSS.escape(id)}"]`,
    ).textContent = terminalSimulation(S.answers[id] || "");
  }
});
let draggedPlanEntry;
document.addEventListener("dragstart", (e) => {
  const row = e.target.closest("[data-plan-entry]");
  if (row) draggedPlanEntry = row.dataset.planEntry;
});
document.addEventListener("dragover", (e) => {
  if (draggedPlanEntry && e.target.closest("[data-plan-date]"))
    e.preventDefault();
});
document.addEventListener("drop", async (e) => {
  const row = e.target.closest("[data-plan-date]");
  if (!row || !draggedPlanEntry) return;
  e.preventDefault();
  const id = draggedPlanEntry;
  draggedPlanEntry = null;
  try {
    planProposal(
      await post("/api/plans/A1/changes/propose", {
        reason: "Déplacement par glisser-déposer, à relire",
        operations: [{ type: "move", entryId: id, date: row.dataset.planDate }],
      }),
    );
  } catch (error) {
    showError(error);
  }
});
let dragItem;
document.addEventListener("dragstart", (e) => {
  const item = e.target.closest("[data-sort-item]");
  if (item)
    dragItem = {
      id: item.closest("[data-sort-list]").dataset.sortList,
      index: Number(item.dataset.sortItem),
    };
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest("[data-sort-item]")) e.preventDefault();
});
document.addEventListener("drop", (e) => {
  const item = e.target.closest("[data-sort-item]");
  if (
    item &&
    dragItem &&
    item.closest("[data-sort-list]").dataset.sortList === dragItem.id
  ) {
    e.preventDefault();
    reorder(dragItem.id, dragItem.index, Number(item.dataset.sortItem));
    dragItem = null;
  }
});
document.addEventListener("input", (e) => {
  const id = e.target.dataset.answerPart;
  if (!id) return;
  let value;
  try {
    value = JSON.parse(S.answers[id] || "{}");
  } catch {
    value = {};
  }
  value[e.target.dataset.part] = e.target.value;
  S.answers[id] = JSON.stringify(value);
  persistLocal();
  autosaveActivity(id);
  const output = e.target.closest("[data-simulator]")?.querySelector("output");
  if (output) output.textContent = JSON.stringify(value);
});
document.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  const action = actions[button.dataset.action];
  if (!action) return;
  button.disabled = true;
  try {
    await action(button.dataset.id);
  } catch (err) {
    showError(err);
  } finally {
    button.disabled = false;
  }
});
document.addEventListener("submit", async (e) => {
  const f = e.target.closest("[data-form]");
  if (!f) return;
  e.preventDefault();
  const b = f.querySelector("[type=submit],button:not([type])");
  if (b) b.disabled = true;
  try {
    await forms[f.dataset.form](f, Object.fromEntries(new FormData(f)));
  } catch (err) {
    showError(err);
  } finally {
    if (b) b.disabled = false;
  }
});
let searchTimer;
document.addEventListener("input", (e) => {
  const a = e.target.dataset.answer;
  if (a) {
    S.answers[a] = e.target.value;
    persistLocal();
    autosaveActivity(a);
  }
  if (e.target.id === "plan-search") {
    const pos = e.target.selectionStart;
    S.filter = e.target.value.toLowerCase();
    shell(planView());
    $("#plan-search").focus();
    $("#plan-search").setSelectionRange(pos, pos);
  }
  if (e.target.id === "resource-search") {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(
      () => loadResources(e.target.value).catch(showError),
      250,
    );
  }
});
window.addEventListener("message", async (e) => {
  const frame = $(".game-frame");
  if (!frame || e.source !== frame.contentWindow || !S.gameRun) return;
  try {
    if (e.data?.type === "eden:ready")
      frame.contentWindow.postMessage(S.gameContext, "*");
    if (e.data?.type === "eden:close") closeModal();
    if (e.data?.type === "eden:event")
      await post(`/api/game/runs/${enc(S.gameRun.id)}/events`, {
        eventId: crypto.randomUUID(),
        type: e.data.eventType,
        payload: e.data.payload,
      });
    if (e.data?.type === "eden:progress") {
      await post(`/api/game/runs/${enc(S.gameRun.id)}/progress`, {
        progress: e.data.progress,
      });
      toast("Progression enregistrée.");
    }
  } catch (err) {
    toast(studentError(err));
  }
});
async function boot() {
  S.session = await api("/api/session");
  S.user = S.session.user;
  if (!S.user) return renderLogin();
  if (S.user.role === "student") return startStudent();
  await loadDashboard();
  render();
}
boot().catch(showError);
