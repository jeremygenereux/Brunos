#!/usr/bin/env node
// =====================================================================
// Import d'une édition historique des Brunos depuis des CSV de bulletins.
//
//   node --env-file=.env.local scripts/import-edition.mjs <config.json> [--dry-run]
//
// ENTRÉES (voir supabase/backfill/*.json pour des configs réelles)
//   • votes_csv     — une ligne par (votant × question × joueur), avec un rang
//                     optionnel (absent = choix unique, rang 1).
//   • questions_csv — optionnel : donne le FORMAT de chaque question et si
//                     elle a été présentée au gala (→ is_selected_for_show),
//                     y compris pour les questions écartées.
//
// CE QU'IL FAIT
//   1. retrouve (ou crée) les `people` par nom — l'annuaire pérenne ;
//   2. crée l'édition en COMPILATION ;
//   3. crée les joueurs, les catégories, les votants ;
//   4. crée un compte de substitution pour les votants d'époque qui n'en ont
//      pas (participants.user_id est NOT NULL : voter EXIGE un compte) ;
//   5. écrit les bulletins.
//
// CE QU'IL NE FAIT PAS — volontairement : figer les résultats. Ça se fait
// dans l'admin via « Verrouiller l'édition » (COMPILATION → LOCKED), avec le
// vrai code de calcul. Puis « Passer en direct » et « Envoyer à l'archive ».
// =====================================================================

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const configPath = process.argv[2];

if (!configPath) {
  console.error("Usage : node --env-file=.env.local scripts/import-edition.mjs <config.json> [--dry-run]");
  process.exit(1);
}

const cfg = JSON.parse(readFileSync(configPath, "utf8"));
const baseDir = dirname(resolve(configPath));
const dataDir = cfg.data_dir ? resolve(baseDir, cfg.data_dir) : baseDir;

// ── CSV ──────────────────────────────────────────────────────────────
/** Parseur minimal mais correct : guillemets, virgules et sauts de ligne
 *  ÉCHAPPÉS (les énoncés des Brunos en contiennent), BOM, fins Windows. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Lit un CSV en objets, en résolvant une table de correspondance de colonnes. */
function readMapped(path, mapping) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {};
  for (const [key, name] of Object.entries(mapping)) {
    if (name == null) { idx[key] = -1; continue; }
    idx[key] = header.indexOf(String(name).trim().toLowerCase());
    if (idx[key] === -1) {
      console.error(`❌ ${path}\n   colonne « ${name} » introuvable. En-têtes : ${header.join(" | ")}`);
      process.exit(1);
    }
  }
  return rows.slice(1).map((r) => {
    const o = {};
    for (const key of Object.keys(mapping)) o[key] = idx[key] === -1 ? null : (r[idx[key]] ?? "").trim();
    return o;
  });
}

const norm = (s) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const uniqInOrder = (xs) => [...new Set(xs)];
const isOui = (v) => /^(oui|yes|true|1|x)$/i.test(String(v ?? "").trim());

// ── Bulletins ────────────────────────────────────────────────────────
const vc = cfg.columns ?? {};
const votes = readMapped(resolve(dataDir, cfg.votes_csv), {
  edition: vc.edition ?? null,
  votant: vc.votant ?? "votant",
  categorie: vc.categorie ?? "categorie",
  joueur: vc.joueur ?? "joueur",
  rang: vc.rang ?? null, // absent → choix unique
});

const ballots = votes
  .filter((r) => (cfg.edition_code && r.edition ? r.edition === cfg.edition_code : true))
  .map((r) => ({
    votant: r.votant,
    categorie: r.categorie,
    joueur: r.joueur,
    rang: r.rang == null || r.rang === "" ? 1 : Number(r.rang),
  }))
  .filter((b) => b.votant && b.categorie && b.joueur && Number.isFinite(b.rang));

if (!ballots.length) {
  console.error("❌ Aucun bulletin exploitable (vérifie edition_code et les colonnes).");
  process.exit(1);
}

// Les NOMMÉS ne se déduisent pas des votes : un joueur peut n'avoir reçu
// aucune voix (Vincent Beaulieu en 2024P) et doit malgré tout figurer dans
// l'édition — il était un choix de réponse possible. D'où un effectif
// explicite, complété par tout nom apparaissant dans les bulletins.
let roster = [];
if (cfg.players_csv) {
  const pc = cfg.players_columns ?? {};
  roster = readMapped(resolve(dataDir, cfg.players_csv), { nom: pc.nom ?? "nom_canonique" })
    .map((r) => r.nom)
    .filter(Boolean);
} else if (Array.isArray(cfg.players)) {
  roster = cfg.players;
}
// `players_exclude` : quelqu'un de l'effectif de référence qui n'était PAS de
// cette édition-là (absent, pas nommé). Sans ça, l'effectif global le
// réintroduirait à chaque ré-import.
const exclus = new Set((cfg.players_exclude ?? []).map(norm));
const joueurs = uniqInOrder([...roster, ...ballots.map((b) => b.joueur)]).filter(
  (n) => !exclus.has(norm(n)),
);
const exclusPresents = [...exclus].filter((e) =>
  ballots.some((b) => norm(b.joueur) === e || norm(b.votant) === e),
);
if (exclusPresents.length) {
  console.error(
    `\n❌ players_exclude contient ${exclusPresents.length} nom(s) qui apparaissent pourtant ` +
      `dans les bulletins. Retire-les des votes d'abord.\n`,
  );
  process.exit(1);
}
const votants = uniqInOrder(ballots.map((b) => b.votant));

// ── Catégories : depuis le fichier de questions si fourni, sinon déduites ──
let categories; // [{ prompt, format, presente, ordre }]
if (cfg.questions_csv) {
  const qc = cfg.questions_columns ?? {};
  const qrows = readMapped(resolve(dataDir, cfg.questions_csv), {
    edition: qc.edition ?? "edition",
    enonce: qc.enonce ?? "enonce",
    format: qc.format ?? "format",
    presente: qc.presente ?? "presente_au_gala",
    no: qc.no ?? null,
  }).filter((r) => (cfg.edition_code ? r.edition === cfg.edition_code : true));

  categories = qrows
    .filter((r) => r.enonce)
    .map((r, i) => ({
      prompt: r.enonce,
      format: r.format || "single_choice",
      presente: isOui(r.presente),
      ordre: r.no ? Number(r.no) : i + 1,
    }))
    .sort((a, b) => a.ordre - b.ordre);
} else {
  categories = uniqInOrder(ballots.map((b) => b.categorie)).map((prompt, i) => {
    const perVoter = new Map();
    for (const b of ballots.filter((x) => x.categorie === prompt)) {
      perVoter.set(b.votant, (perVoter.get(b.votant) ?? 0) + 1);
    }
    return {
      prompt,
      format: Math.max(...perVoter.values()) > 1 ? "ranking" : "single_choice",
      presente: true,
      ordre: i + 1,
    };
  });
}

const catByPrompt = new Map(categories.map((c) => [norm(c.prompt), c]));

console.log(`\n📄 ${cfg.votes_csv}${cfg.edition_code ? `  [${cfg.edition_code}]` : ""}`);
console.log(`   ${ballots.length} lignes de bulletins`);
console.log(`   ${joueurs.length} joueurs · ${categories.length} catégories · ${votants.length} votants`);
console.log(`   présentées au gala : ${categories.filter((c) => c.presente).length}/${categories.length}`);
console.log(`   formats : ${uniqInOrder(categories.map((c) => c.format)).join(", ")}`);
console.log(`\n🎬 ${cfg.name} (${cfg.year}) — ${cfg.drink_rule}, shooter = ${cfg.shooter_value}`);

const jury = cfg.jury ?? {};
for (const v of Object.keys(jury)) console.log(`   entourage : ${v} → ${jury[v].joueur} (${jury[v].relation})`);

// ── Validations — échouer ici plutôt qu'à mi-parcours d'écriture ─────
const problemes = [];
const joueurSet = new Set(joueurs.map(norm));

for (const b of ballots) {
  if (!catByPrompt.has(norm(b.categorie))) {
    problemes.push(`question absente du fichier de questions : « ${b.categorie.slice(0, 70)} »`);
  }
}
for (const [votant, j] of Object.entries(jury)) {
  if (!votants.includes(votant)) problemes.push(`entourage « ${votant} » : ne vote nulle part.`);
  if (!j?.joueur || !joueurSet.has(norm(j.joueur))) {
    problemes.push(`entourage « ${votant} » : joueur lié « ${j?.joueur ?? "?"} » absent des joueurs.`);
  }
  if (!j?.relation?.trim()) problemes.push(`entourage « ${votant} » : lien de parenté obligatoire.`);
}
for (const c of categories) {
  for (const v of votants) {
    const rangs = ballots.filter((b) => norm(b.categorie) === norm(c.prompt) && b.votant === v).map((b) => b.rang);
    if (!rangs.length) continue;
    if (new Set(rangs).size !== rangs.length) problemes.push(`« ${v} » : rangs en double dans « ${c.prompt.slice(0, 50)} »`);
    if (c.format === "single_choice" && rangs.length > 1) {
      problemes.push(`« ${v} » : ${rangs.length} réponses pour un choix unique — « ${c.prompt.slice(0, 50)} »`);
    }
  }
}

const uniques = uniqInOrder(problemes);
if (uniques.length) {
  console.error(`\n❌ ${uniques.length} problème(s) :`);
  for (const p of uniques.slice(0, 15)) console.error(`   • ${p}`);
  if (uniques.length > 15) console.error(`   … et ${uniques.length - 15} autre(s)`);
  console.error("");
  process.exit(1);
}

if (DRY) {
  console.log(`\n🔍 --dry-run : tout est cohérent, rien n'a été écrit.\n`);
  process.exit(0);
}

// ── Cible ────────────────────────────────────────────────────────────
// On lit le fichier .env NOUS-MÊMES, et ses valeurs PRIMENT sur celles déjà
// présentes dans l'environnement. Raison : `node --env-file` n'écrase PAS une
// variable déjà exportée par le shell. Un NEXT_PUBLIC_SUPABASE_URL traînant
// dans le profil (celui d'un autre projet local, par exemple) détournerait
// silencieusement l'import vers la mauvaise base.
function readEnvFile(path) {
  const out = {};
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return out; }
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const envArg = process.argv.indexOf("--env");
const envPath = envArg !== -1 ? process.argv[envArg + 1] : ".env.local";
const fileEnv = readEnvFile(resolve(process.cwd(), envPath));

const URL = fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = fileEnv.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error(`❌ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY introuvables (lu : ${envPath}).`);
  process.exit(1);
}

const ambiant = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (ambiant && ambiant !== URL) {
  console.log(`\n⚠️  Le shell exporte NEXT_PUBLIC_SUPABASE_URL=${ambiant}`);
  console.log(`   → ignoré ; on utilise la valeur de ${envPath}.`);
}

const local = /^https?:\/\/(127\.0\.0\.1|localhost)\b/.test(URL);
console.log(`\n🎯 Cible : ${URL}${local ? "  (locale)" : "  ⚠️  DISTANTE"}`);
if (!local && !process.argv.includes("--confirm-remote")) {
  console.error("\n❌ Cible distante. Relance avec --confirm-remote si c'est bien voulu.\n");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const die = (label, error) => { if (error) { console.error(`\n❌ ${label} :`, error.message ?? error); process.exit(1); } };

const { data: existingPeople, error: peopleErr } = await db.from("people").select("id, display_name");
die("lecture des personnes", peopleErr);
const personByName = new Map((existingPeople ?? []).map((p) => [norm(p.display_name), p.id]));

const manquants = uniqInOrder([...joueurs, ...votants]).filter((n) => !personByName.has(norm(n)));
if (manquants.length) {
  const { data: created, error } = await db.from("people")
    .insert(manquants.map((display_name) => ({ display_name }))).select("id, display_name");
  die("création des personnes", error);
  for (const p of created ?? []) personByName.set(norm(p.display_name), p.id);
  console.log(`\n👤 ${manquants.length} personne(s) créée(s) : ${manquants.join(", ")}`);
}

// Garde-fou : l'import n'est PAS idempotent (chaque exécution crée une
// nouvelle édition). Le rejouer par mégarde — typiquement sur la prod — ferait
// apparaître un doublon complet, pénible à démêler ensuite.
const { data: deja } = await db
  .from("editions")
  .select("id, state")
  .eq("name", cfg.name)
  .eq("year", cfg.year);
if ((deja ?? []).length > 0 && !process.argv.includes("--force")) {
  console.error(
    `\n❌ « ${cfg.name} » (${cfg.year}) existe déjà sur cette base :` +
      `\n   ${deja.map((e) => `${e.id} [${e.state}]`).join("\n   ")}` +
      `\n\n   L'import créerait un DOUBLON. Supprime l'édition existante, ou relance` +
      `\n   avec --force si tu veux vraiment une seconde copie.\n`,
  );
  process.exit(1);
}

// On crée en CONSTRUCTION : le trigger `questions_edit_lock` interdit de créer
// des questions dès que l'édition a quitté cet état. La bascule vers
// COMPILATION se fait tout à la fin, une fois les bulletins écrits.
const { data: edition, error: edErr } = await db.from("editions").insert({
  name: cfg.name, year: cfg.year, event_at: cfg.event_at ?? null,
  venue_name: cfg.venue_name ?? null, description: cfg.description ?? null,
  state: "CONSTRUCTION", drink_rule: cfg.drink_rule ?? "ESCALATION",
  shooter_value: cfg.shooter_value ?? 8,
}).select("id").single();
die("création de l'édition", edErr);
console.log(`\n🎬 Édition créée : ${edition.id}`);

const { data: playerRows, error: plErr } = await db.from("players").insert(
  joueurs.map((nom, i) => ({ edition_id: edition.id, person_id: personByName.get(norm(nom)), display_order: i + 1 })),
).select("id, person_id");
die("création des joueurs", plErr);
const playerIdByName = new Map(joueurs.map((nom) => [
  norm(nom), playerRows.find((r) => r.person_id === personByName.get(norm(nom))).id,
]));

// `position` = rang dans le pool de l'édition (toutes les questions).
// `show_order` = rang DANS LA PRÉSENTATION, et uniquement pour les questions
// retenues : la contrainte questions_show_order_consistency_chk impose
// show_order NULL dès que is_selected_for_show est faux.
let showOrder = 0;
const { data: questionRows, error: qErr } = await db.from("questions").insert(
  categories.map((c, i) => ({
    edition_id: edition.id,
    prompt: c.prompt,
    format: c.format,
    position: i + 1,
    is_selected_for_show: c.presente,
    show_order: c.presente ? ++showOrder : null,
  })),
).select("id, prompt");
die("création des catégories", qErr);
const questionIdByPrompt = new Map(questionRows.map((q) => [norm(q.prompt), q.id]));

const { data: profiles, error: prErr } = await db.from("profiles").select("user_id, person_id");
die("lecture des profils", prErr);
const userByPerson = new Map((profiles ?? []).map((p) => [p.person_id, p.user_id]));

const userIdByVoter = new Map();
for (const v of votants) {
  const personId = personByName.get(norm(v));
  let userId = userByPerson.get(personId);
  if (!userId) {
    const slug = norm(v).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "");
    const email = `${slug}+${cfg.year}@${cfg.substitute_email_domain ?? "brunos.invalid"}`;
    const { data: made, error } = await db.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { display_name: v },
    });
    die(`compte de substitution pour ${v}`, error);
    userId = made.user.id;
    // handle_new_user a créé une NOUVELLE fiche ; on la fusionne vers la fiche
    // historique pour ne pas dédoubler l'annuaire.
    const { data: mp } = await db.from("profiles").select("person_id").eq("user_id", userId).maybeSingle();
    if (mp && mp.person_id !== personId) {
      die("rattachement", (await db.from("profiles").update({ person_id: personId }).eq("user_id", userId)).error);
      die("fiche en double", (await db.from("people").delete().eq("id", mp.person_id)).error);
      die("liaison", (await db.from("people").update({ auth_user_id: userId }).eq("id", personId)).error);
    }
    userByPerson.set(personId, userId);
    console.log(`   compte de substitution : ${v} → ${email}`);
  }
  userIdByVoter.set(v, userId);
}

die("création des votants", (await db.from("participants").upsert(
  votants.map((v) => {
    const j = jury[v];
    return {
      edition_id: edition.id, user_id: userIdByVoter.get(v),
      kind: j ? "jury" : "player",
      linked_player_id: j ? playerIdByName.get(norm(j.joueur)) : null,
      relation_label: j ? j.relation : null,
    };
  }), { onConflict: "edition_id,user_id" },
)).error);

const { data: partRows, error: partErr } = await db.from("participants").select("id, user_id").eq("edition_id", edition.id);
die("relecture des votants", partErr);
const participantIdByVoter = new Map(votants.map((v) => [v, partRows.find((p) => p.user_id === userIdByVoter.get(v)).id]));

const { data: voteRows, error: vErr } = await db.from("votes").insert(
  votants.map((v) => ({ edition_id: edition.id, participant_id: participantIdByVoter.get(v) })),
).select("id, participant_id");
die("création des bulletins", vErr);
const voteIdByVoter = new Map(votants.map((v) => [v, voteRows.find((r) => r.participant_id === participantIdByVoter.get(v)).id]));

// vote_answers.edition_id est rempli par un trigger : on ne l'envoie pas.
const answers = ballots.map((b) => ({
  vote_id: voteIdByVoter.get(b.votant),
  question_id: questionIdByPrompt.get(norm(b.categorie)),
  player_id: playerIdByName.get(norm(b.joueur)),
  rank: b.rang,
}));
for (let i = 0; i < answers.length; i += 500) {
  die("écriture des réponses", (await db.from("vote_answers").insert(answers.slice(i, i + 500))).error);
  process.stdout.write(`\r   réponses écrites : ${Math.min(i + 500, answers.length)}/${answers.length}`);
}

// Tout est en place : on amène l'édition à l'état d'où l'admin la verrouillera.
die("passage en COMPILATION", (await db.from("editions")
  .update({ state: "COMPILATION" }).eq("id", edition.id)).error);

console.log(`\n\n✅ Import terminé.\n`);
console.log(`   /admin/editions/${edition.id} puis :`);
console.log(`     1. « Verrouiller l'édition »  → calcule et fige les classements`);
console.log(`     2. « Passer en direct »`);
console.log(`     3. « Envoyer à l'archive »\n`);
