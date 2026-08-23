/**
 * Test de Firestore-regels voor lobbies tegen de emulator.
 *
 * Vereist Java (voor de emulator). Draaien:
 *
 *   npx firebase emulators:start --only firestore,auth --project demo-coc
 *   node scripts/test-rules.mjs
 *
 * Gebruikt de firebase-SDK die al in het project zit, dus geen extra dependency.
 *
 * Let op: bij elke geweigerde update/delete logt de SDK iets als
 *   "evaluation error at L99:24 for 'update' @ L99, false for 'update' @ L99"
 * Dat is ruis van de emulator, geen kapotte regel. De emulator evalueert de
 * regel twee keer — merk op dat er twee uitkomsten in die ene melding staan —
 * en in de tweede evaluatie is `resource` niet beschikbaar, waardoor elke
 * expressie die resource.data aanraakt daar struikelt. Nagegaan met een
 * geïsoleerde reproductie: `request.auth.uid == 'literal'` weigert zonder
 * fout, `request.auth.uid == resource.data.hostUid` weigert mét fout, en
 * `resource.data.hostUid is string` staat gewoon toe. De uitkomst klopt in
 * alle gevallen; alleen de diagnostiek is verwarrend.
 */
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';

const PROJECT_ID = 'demo-coc';
const FIRESTORE_HOST = '127.0.0.1';
const FIRESTORE_PORT = 8080;
const AUTH_URL = 'http://127.0.0.1:9099';

let passed = 0;
let failed = 0;

async function expectAllowed(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${label}\n       verwacht: toegestaan, kreeg: ${e.code || e.message}`);
    failed++;
  }
}

async function expectDenied(label, fn) {
  try {
    await fn();
    console.log(`  ❌ ${label}\n       verwacht: geweigerd, maar het mocht`);
    failed++;
  } catch (e) {
    if (e.code === 'permission-denied') {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ⚠️  ${label}\n       geweigerd, maar met een andere fout: ${e.code || e.message}`);
      failed++;
    }
  }
}

async function makeUser(name) {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-api-key' }, name);
  const auth = getAuth(app);
  connectAuthEmulator(auth, AUTH_URL, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, FIRESTORE_HOST, FIRESTORE_PORT);
  const cred = await signInAnonymously(auth);
  return { app, db, uid: cred.user.uid };
}

const deck = (prefix) => Array.from({ length: 11 }, (_, i) => `${prefix}_${i}`);

async function main() {
  const host = await makeUser('host');
  const guest = await makeUser('guest');
  const stranger = await makeUser('stranger');

  const id = `lobby_${Date.now()}`;
  const hostRef = doc(host.db, 'lobbies', id);
  const guestRef = doc(guest.db, 'lobbies', id);
  const strangerRef = doc(stranger.db, 'lobbies', id);

  const baseLobby = {
    hostAddress: '0xhost', hostUid: host.uid, wager: 100, status: 'waiting',
    createdAt: new Date(), hostDeck: null, guestDeck: null,
    guestAddress: null, guestUid: null,
  };

  console.log('\nLobby aanmaken');
  await expectDenied('een lobby aanmaken op andermans uid mag niet',
    () => setDoc(strangerRef, { ...baseLobby, hostUid: host.uid }));
  await expectDenied('een lobby aanmaken die meteen op battling staat mag niet',
    () => setDoc(hostRef, { ...baseLobby, status: 'battling' }));
  await expectAllowed('host maakt zijn eigen lobby aan',
    () => setDoc(hostRef, baseLobby));

  console.log('\nDeck vastleggen');
  await expectDenied('een vreemde kan het hostDeck niet schrijven',
    () => updateDoc(strangerRef, { hostDeck: deck('x') }));
  await expectAllowed('host legt zijn eigen deck vast',
    () => updateDoc(hostRef, { hostDeck: deck('h') }));
  await expectDenied('host kan zijn deck niet opnieuw wisselen',
    () => updateDoc(hostRef, { hostDeck: deck('h2') }));
  await expectDenied('een deck van 5 kaarten wordt geweigerd',
    () => updateDoc(guestRef, { guestDeck: ['a', 'b', 'c', 'd', 'e'] }));

  console.log('\nJoinen');
  await expectDenied('host kan zijn eigen lobby niet joinen',
    () => updateDoc(hostRef, { guestAddress: '0xhost', guestUid: host.uid, status: 'selecting_decks' }));
  await expectAllowed('gast neemt de open plek in',
    () => updateDoc(guestRef, { guestAddress: '0xguest', guestUid: guest.uid, status: 'selecting_decks' }));
  await expectDenied('een tweede gast kan de plek niet overnemen',
    () => updateDoc(strangerRef, { guestAddress: '0xstranger', guestUid: stranger.uid, status: 'selecting_decks' }));

  console.log('\nDeck van de gast');
  await expectDenied('host kan het guestDeck niet schrijven',
    () => updateDoc(hostRef, { guestDeck: deck('sabotage') }));
  await expectAllowed('gast legt zijn eigen deck vast',
    () => updateDoc(guestRef, { guestDeck: deck('g') }));

  console.log('\nUitslag vervalsen — dit is waar het om draait');
  const fakeResult = {
    winner: 'Player 2', finalScores: { p1: 0, p2: 99999 },
    finalFields: { p1: [], p2: [] }, logs: [],
  };
  await expectDenied('gast kan geen battleResult schrijven',
    () => updateDoc(guestRef, { status: 'finished', battleResult: fakeResult }));
  await expectDenied('host kan geen battleResult schrijven',
    () => updateDoc(hostRef, { status: 'finished', battleResult: fakeResult }));
  await expectDenied('een vreemde kan geen battleResult schrijven',
    () => updateDoc(strangerRef, { status: 'finished', battleResult: fakeResult }));
  await expectDenied('niemand kan de status handmatig op battling zetten',
    () => updateDoc(hostRef, { status: 'battling' }));

  console.log('\nOpruimen');
  await expectDenied('een vreemde kan de lobby niet verwijderen',
    () => deleteDoc(strangerRef));
  await expectAllowed('host ruimt zijn eigen lobby op',
    () => deleteDoc(hostRef));

  console.log('\nMatches zijn read-only voor clients');
  await expectDenied('een client kan geen match schrijven',
    () => setDoc(doc(host.db, 'matches', 'forged'), { winner: 'Player 1' }));
  await expectAllowed('een match is wel leesbaar',
    () => getDoc(doc(host.db, 'matches', 'whatever')));

  console.log(`\n${passed} geslaagd, ${failed} gezakt`);
  await Promise.all([deleteApp(host.app), deleteApp(guest.app), deleteApp(stranger.app)]);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('\nKon de test niet draaien. Draait de emulator?');
  console.error(e);
  process.exit(1);
});
