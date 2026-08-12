/**
 * Ruimt lobbies op.
 *
 * Twee redenen om dit te draaien:
 *   1. Eenmalig: lobbies van vóór de regel-update hebben geen hostUid/guestUid
 *      en voldoen niet aan de nieuwe regels. Ze zijn onbruikbaar maar staan wel
 *      in de lijst zolang hun status 'waiting' is.
 *   2. Doorlopend: elke gespeelde match laat een lobbydocument achter met een
 *      volledig battleResult (finalFields + logs) erin. Die worden nooit
 *      opgeruimd en groeien onbeperkt door. De match zelf blijft bewaard in de
 *      `matches`-collectie — die raakt dit script niet aan.
 *
 * Draaien (standaard dry-run, verwijdert niets):
 *
 *   node scripts/cleanup-lobbies.mjs                     # laat zien wat er weg zou gaan
 *   node scripts/cleanup-lobbies.mjs --delete            # alles
 *   node scripts/cleanup-lobbies.mjs --delete --legacy   # alleen die zonder hostUid
 *   node scripts/cleanup-lobbies.mjs --delete --older-than 24h
 *
 * Vereist admin-credentials, bijvoorbeeld:
 *   gcloud auth application-default login
 *   of: export GOOGLE_APPLICATION_CREDENTIALS=/pad/naar/serviceaccount.json
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const doDelete = args.includes('--delete');
const legacyOnly = args.includes('--legacy');

const olderThanArg = args[args.indexOf('--older-than') + 1];
let cutoff = null;
if (args.includes('--older-than')) {
  const m = /^(\d+)([hd])$/.exec(olderThanArg || '');
  if (!m) {
    console.error('--older-than verwacht iets als 24h of 7d');
    process.exit(1);
  }
  const ms = Number(m[1]) * (m[2] === 'h' ? 3600e3 : 86400e3);
  cutoff = new Date(Date.now() - ms);
}

const projectId =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  'my-project-1472564361903';

if (!getApps().length) {
  try {
    initializeApp({ credential: applicationDefault(), projectId });
  } catch (e) {
    console.error('Kon geen admin-credentials vinden.');
    console.error('Draai eerst:  gcloud auth application-default login');
    process.exit(1);
  }
}

const db = getFirestore();

const asDate = (v) => (v && typeof v.toDate === 'function' ? v.toDate() : null);

async function main() {
  const snap = await db.collection('lobbies').get();
  if (snap.empty) {
    console.log('Geen lobbies gevonden.');
    return;
  }

  const targets = [];
  const byStatus = {};

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    byStatus[data.status || 'onbekend'] = (byStatus[data.status || 'onbekend'] || 0) + 1;

    const isLegacy = !data.hostUid;
    const created = asDate(data.createdAt);
    const tooOld = cutoff ? !created || created < cutoff : true;

    if (legacyOnly && !isLegacy) return;
    if (!tooOld) return;

    targets.push({
      id: docSnap.id,
      status: data.status,
      legacy: isLegacy,
      created: created ? created.toISOString().slice(0, 16).replace('T', ' ') : '—',
      hasResult: !!data.battleResult,
    });
  });

  console.log(`\n${snap.size} lobbies in totaal:`);
  for (const [status, n] of Object.entries(byStatus)) console.log(`   ${status}: ${n}`);

  console.log(`\n${targets.length} komen in aanmerking om te verwijderen:`);
  for (const t of targets.slice(0, 25)) {
    const tags = [t.legacy ? 'geen hostUid' : null, t.hasResult ? 'met battleResult' : null]
      .filter(Boolean).join(', ');
    console.log(`   ${t.id}  ${String(t.status).padEnd(15)} ${t.created}  ${tags}`);
  }
  if (targets.length > 25) console.log(`   … en nog ${targets.length - 25}`);

  if (!doDelete) {
    console.log('\nDry-run — er is niets verwijderd. Voeg --delete toe om het echt te doen.');
    return;
  }

  let deleted = 0;
  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    for (const t of targets.slice(i, i + 400)) {
      batch.delete(db.collection('lobbies').doc(t.id));
    }
    await batch.commit();
    deleted += Math.min(400, targets.length - i);
    console.log(`   ${deleted}/${targets.length} verwijderd…`);
  }
  console.log(`\nKlaar. ${deleted} lobbies verwijderd. De matches-collectie is niet aangeraakt.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
