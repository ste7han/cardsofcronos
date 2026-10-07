"use client";

// Talking to an EVM wallet, without a wallet library.
//
// The old dapp reached for Reown AppKit. Signing in needs one method,
// `personal_sign`, and every wallet on Cronos injects an EIP-1193 provider that
// has it — a provider tree, a modal and a chain adapter for one signature is a
// lot of dependency for one signature, and AppKit talks to this same injected
// object underneath anyway.
//
// ── AND NOW A QR CODE, WHICH IS HALF OF THAT DECISION REVERSED ───────────────
//
// A player asked for it: a phone wallet connected to the site on a desktop,
// which is what WalletConnect is for and what an injected provider cannot do.
// The argument above was never wrong — it was about paying for a modal nobody
// had asked for. Somebody has now asked.
//
// What is NOT reversed is the rest of it. There is no AppKit, no provider tree
// and no chain adapter: @walletconnect/ethereum-provider hands back an
// EIP-1193 object, which is the same shape this file already speaks to, so the
// whole of the integration is which object `active()` returns. It is imported
// dynamically, so a desktop with MetaMask downloads none of it.
//
// ── THE QR IS RENDERED HERE AND NOWHERE ELSE ─────────────────────────────────
//
// A WalletConnect URI carries the symmetric key for the pairing. Handing it to
// an image service to be drawn would be handing that service the session, so
// the QR is drawn in the browser from a local library. There is no version of
// this that is worth one fewer dependency.
//
// ── IT SENDS ONE TRANSACTION NOW ─────────────────────────────────────────────
//
// This file used to say nothing here sends a transaction, and that when
// something did, that would be the point where a wallet library earns its place.
// Claiming from contracts/HolderDrop.sol is that something, and the library
// still does not earn it: one `eth_sendTransaction` with hand-encoded calldata,
// plus asking the wallet to be on the right chain first.
//
// What that changes about the risk is the part worth stating. `personal_sign`
// cannot move anything — a wallet will not turn a signature over plain bytes
// into a transfer. `eth_sendTransaction` can, so everything below that builds
// calldata does it from arguments this file was given. It can also send CRO
// now, for the paid mint — see sendCall, where a value of zero is left out of
// the request rather than sent as one, so a call that was never meant to pay
// cannot pay by accident.

import { challenge, newNonce, type WalletProof } from "@/lib/session";
import { bytesToHex, normalise } from "@/lib/address";

interface Eip1193 {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isMetaMask?: boolean;
  /** MetaMask's convention when more than one extension is installed. */
  providers?: Eip1193[];
}

interface Injected {
  ethereum?: Eip1193;
  /** Crypto.com's wallet, which is the one this game's players are likeliest to have. */
  deficonnectProvider?: Eip1193;
}

/**
 * The wallet this browser has, if it has one.
 *
 * `window.ethereum` is a single slot that every extension writes to, and the
 * last one to load wins. When several are installed MetaMask publishes the whole
 * list on `.providers`, so prefer that over whoever happened to load last.
 */
export function provider(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Injected;
  const injected = w.ethereum;
  if (injected?.providers?.length) {
    return injected.providers[0] ?? injected;
  }
  return injected ?? w.deficonnectProvider ?? null;
}

/**
 * The WalletConnect project this site pairs under.
 *
 * In the source and not in an environment variable, for the reason lib/links.ts
 * gives about the Telegram bot's name: it is public — it ships in the browser
 * bundle, so anybody who opens the site can read it — it does not change, and
 * a NEXT_PUBLIC_ variable is inlined at build time, which means a build with it
 * missing produces a site where the QR silently never appears.
 *
 * It is not nothing, though. Somebody else can point their own site at this id
 * and spend this project's relay quota, so the allowed domains are set to
 * cardsofcronos.com in the Reown dashboard. That restriction is the protection;
 * hiding the id was never going to be.
 *
 * It is the same project the first dapp used, which is why that dashboard warns
 * that an AppKit SDK is out of date. Nothing here is AppKit — see the header.
 */
export const WALLETCONNECT_PROJECT = "8d7572d8e272d20865722c1fe193e098";

/** How this browser last connected. Remembered, for the reason below. */
export type How = "injected" | "walletconnect";

const HOW = "coc.wallet.how";

export function howConnected(): How | null {
  if (typeof window === "undefined") return null;
  const kept = window.localStorage.getItem(HOW);
  return kept === "injected" || kept === "walletconnect" ? kept : null;
}

function remember(how: How): void {
  if (typeof window !== "undefined") window.localStorage.setItem(HOW, how);
}

export function forgetHow(): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(HOW);
}

/**
 * The WalletConnect provider for this page, once there is one.
 *
 * Module-level and deliberately: a second init would be a second pairing, and
 * the SDK keeps its session in localStorage, so asking it again after a reload
 * restores the same session rather than starting one.
 */
let linked: Eip1193 | null = null;

/** The WalletConnect provider, in the shape this file uses it. */
interface Linked extends Eip1193 {
  on(event: string, handler: (uri: string) => void): void;
  off?(event: string, handler: (uri: string) => void): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  session?: unknown;
  /** True while a pairing is waiting for a phone. The guard against duplicates. */
  connecting?: boolean;
}

/** The same provider, typed for the calls below. */
async function linkedProvider(): Promise<Linked> {
  return (await walletConnect()) as unknown as Linked;
}

/** The SDK, loaded the first time somebody actually wants it and never before. */
async function walletConnect(): Promise<Eip1193> {
  if (linked !== null) return linked;

  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  const wc = await EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT,
    // Cronos, and only Cronos. A wallet that offers to connect on a chain this
    // game cannot use is a wallet that connects and then fails at the first
    // transaction.
    chains: [25],
    // Ours, from lib/wallet.ts. Their modal is the dependency this file is
    // written to avoid — see the header.
    showQrModal: false,
    metadata: {
      name: "Cards of Cronos",
      description: "A card game on Cronos. Highest market cap wins.",
      url: "https://cardsofcronos.com",
      icons: ["https://cardsofcronos.com/icon.png"],
    },
  });
  linked = wc as unknown as Eip1193;
  return linked;
}

/**
 * The wallet this page should be talking to.
 *
 * ── WHY THIS IS NOT JUST `provider()` ────────────────────────────────────────
 *
 * Somebody who connected a phone by QR may also have MetaMask installed. The
 * signed proof in localStorage names ONE address, and sending a transaction
 * through the other wallet would either fail or — worse — send from an account
 * the person did not mean to use. So the choice is remembered and honoured:
 * whichever wallet was signed in with is the one every later call goes to.
 *
 * Async, which it can afford to be: every caller inside this file is already
 * async, and nothing outside it calls this at all.
 */
export async function active(): Promise<Eip1193 | null> {
  if (howConnected() === "walletconnect") {
    try {
      return await walletConnect();
    } catch {
      // The session is gone, or the SDK would not load. Not the injected
      // wallet as a fallback: that is a different address.
      return null;
    }
  }
  return provider();
}

/**
 * Connect, then ask the wallet to sign a challenge naming itself.
 *
 * Two steps and not one: connecting tells us which address is offering itself,
 * and signing is what makes that claim worth anything. The address alone is
 * public — see lib/session.ts for why that matters here more than usual.
 */
export async function connectAndProve(): Promise<WalletProof> {
  // The INJECTED one, not `active()`. Somebody who connected by QR last time
  // and is now pressing the browser-wallet button means the browser wallet —
  // honouring the remembered choice here would quietly reconnect the phone.
  // `remember` is called below, once this has worked, which is what makes the
  // two buttons mean two different things.
  const wallet = provider();
  if (!wallet) {
    throw new Error(
      "No wallet found in this browser. MetaMask and the Crypto.com wallet both work — " +
        "or connect a phone wallet with the QR code.",
    );
  }
  const proof = await proveWith(wallet);
  // Only once it has worked. Remembering a choice that failed would send every
  // later call at a wallet nobody is signed in to.
  remember("injected");
  return proof;
}

/**
 * The same thing, with a phone.
 *
 * `onUri` is handed the WalletConnect URI the moment the SDK produces one,
 * which is what gets drawn as the QR. It is called before `connect()` resolves,
 * because `connect()` does not resolve until the phone has approved — so a flow
 * that waited for it would show nothing to scan.
 */
export async function connectByQrAndProve(onUri: (uri: string) => void): Promise<WalletProof> {
  const wc = await linkedProvider();

  if (wc.session === undefined || wc.session === null) {
    // ── NEVER TWO PROPOSALS AT ONCE ──────────────────────────────────────────
    //
    // A player reported this from a wallet that refused to connect while
    // MetaMask worked:
    //
    //   Cannot handle a session proposal: UNIQUE constraint failed:
    //   ProposalDao.request_id (code 1555)
    //
    // That is the WALLET's own database. ProposalDao is from WalletConnect's
    // Kotlin SDK, and it had already stored a proposal with that id — so a
    // second one arrived carrying the same id on the same pairing topic.
    //
    // It is ours to prevent. The dropdown closes when you click outside it,
    // which unmounts the QR panel while `connect()` is still waiting for a
    // phone; opening it again called `connect()` on the same provider, and the
    // SDK re-used the live pairing rather than starting a new one. MetaMask
    // tolerates the duplicate. A wallet that keeps proposals in a table with a
    // unique key cannot.
    if (wc.connecting) {
      throw new Error(
        "There is already a code waiting to be scanned. Scan that one, or close this and start again.",
      );
    }

    const show = (uri: string) => onUri(uri);
    wc.on("display_uri", show);
    try {
      await wc.connect();
    } finally {
      wc.off?.("display_uri", show);
    }
  }

  const proof = await proveWith(wc as unknown as Eip1193);
  remember("walletconnect");
  return proof;
}

/**
 * Give up on a pairing nobody answered.
 *
 * Called when the QR goes away without a session — the panel closed, the
 * dropdown was dismissed, somebody pressed TRY AGAIN. Without it the pairing
 * stays live and the next attempt re-uses it, which is what sends a wallet the
 * same proposal id twice. See the note above.
 *
 * Both calls, and in this order: `abortPairingAttempt` stops the one in flight,
 * `cleanupPendingPairings` clears the ones that were never activated. Neither
 * throws usefully, and a failure here only means the next attempt is the one
 * that has to work.
 */
export function abandonPairing(): void {
  if (linked === null) return;
  const wc = linked as unknown as {
    session?: unknown;
    signer?: { abortPairingAttempt(): void; cleanupPendingPairings(): Promise<void> };
  };
  if (wc.session) return;
  try {
    wc.signer?.abortPairingAttempt();
  } catch {
    // Nothing in flight. Fine.
  }
  void wc.signer?.cleanupPendingPairings().catch(() => {
    // Storage that would not clear. The next connect makes a new pairing
    // regardless; this only keeps the old ones from piling up.
  });
}

/** Hangs up a WalletConnect session, so the next sign-in is a fresh pairing. */
export async function disconnectWallet(): Promise<void> {
  if (howConnected() === "walletconnect" && linked !== null) {
    try {
      await (linked as unknown as { disconnect(): Promise<void> }).disconnect();
    } catch {
      // Already gone on the other end. Nothing to do about it here.
    }
    linked = null;
  }
  forgetHow();
}

/** Ask for an account and a signature over the challenge. The half both share. */
async function proveWith(wallet: Eip1193): Promise<WalletProof> {
  const accounts = await wallet.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
    throw new Error("The wallet connected but named no account.");
  }
  // Normalised before it is signed, so the address inside the message and the
  // address the site stores are the same string. A wallet that hands back a
  // checksummed address and a database that keys on lowercase is two of one
  // player, and it looks like nothing until somebody counts.
  const address = normalise(accounts[0]);

  const unsigned = { address, issuedAt: Date.now(), nonce: newNonce() };
  const message = challenge(unsigned);

  // Hex rather than the plain string. Wallets accept both, but a message that
  // begins with 0x — or that a wallet decides looks like hex — is ambiguous, and
  // the ambiguity is resolved differently by different wallets.
  const hex = "0x" + bytesToHex(new TextEncoder().encode(message));
  const signature = await wallet.request({ method: "personal_sign", params: [hex, address] });

  if (typeof signature !== "string") {
    throw new Error("The wallet returned a signature in a shape this site cannot read.");
  }

  return { ...unsigned, signature };
}

/** What went wrong, in words a person can act on. */
export function reasonFor(error: unknown): string {
  const code = (error as { code?: number } | null)?.code;
  // 4001 is the EIP-1193 code for "the user said no".
  if (code === 4001) return "You turned down the signature. Nothing happened.";
  // -32002 is a request already sitting in the wallet, unanswered. Telling
  // somebody to look at their extension is more use than telling them it failed.
  if (code === -32002) return "The wallet is already asking. Open it and answer there.";
  if (error instanceof Error && error.message) return error.message;
  return "The wallet did not answer.";
}

/** Cronos mainnet, as a wallet wants to hear it. */
const CRONOS = "0x19";

/**
 * Cronos as a wallet that has never heard of it wants to hear it.
 *
 * Only used when `wallet_switchEthereumChain` comes back with 4902, which is a
 * wallet saying it does not know this chain. The RPC is a public one and the
 * explorer is the one every link on this site points at.
 */
const CRONOS_CHAIN = {
  chainId: CRONOS,
  chainName: "Cronos",
  nativeCurrency: { name: "Cronos", symbol: "CRO", decimals: 18 },
  rpcUrls: ["https://evm.cronos.org"],
  blockExplorerUrls: ["https://cronoscan.com"],
};

/**
 * Makes sure the wallet is on Cronos, asking to switch if it is not.
 *
 * Before sending and not after. A transaction sent on the wrong chain does not
 * fail — it goes somewhere, to an address that on that chain is either nothing
 * or somebody else's contract, and the wallet shows a perfectly ordinary
 * confirmation while it happens.
 */
export async function ensureCronos(): Promise<void> {
  const wallet = await active();
  if (wallet === null) throw new Error("No wallet in this browser.");

  const on = (await wallet.request({ method: "eth_chainId" })) as string;
  if (on?.toLowerCase() === CRONOS) return;

  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CRONOS }] });
  } catch (error) {
    // 4902 is "this wallet does not have that chain". Anything else — including
    // the person saying no — is theirs to have said, and is passed on.
    if ((error as { code?: number } | null)?.code !== 4902) throw error;
    await wallet.request({ method: "wallet_addEthereumChain", params: [CRONOS_CHAIN] });
  }
}

/** A value as a thirty-two byte ABI word, without the 0x. */
function word(value: bigint | string): string {
  const hex =
    typeof value === "bigint" ? value.toString(16) : value.replace(/^0x/, "").toLowerCase();
  if (hex.length > 64) throw new Error(`That does not fit in a word: ${hex}`);
  return hex.padStart(64, "0");
}

/**
 * Waits for a transaction to land, and says which tokens it minted.
 *
 * Asked through the wallet's own provider rather than a public RPC. It is
 * already connected to Cronos and already trusted with sending the thing —
 * adding a second endpoint here would be a second thing to be rate-limited by,
 * for an answer the first one has.
 *
 * ── WHY IT READS THE LOGS RATHER THAN COUNTING ───────────────────────────────
 *
 * "You asked for five, so you got the next five" is right until it is not: two
 * people minting in the same block get interleaved ids, and the second one
 * would be shown the first one's cards. The Transfer logs say exactly which
 * tokens went to which address, which is the only answer that cannot be wrong.
 *
 * Returns an empty array rather than throwing when the receipt never arrives.
 * The tokens are minted either way — this is about what to show, and showing
 * nothing is better than showing somebody else's cards.
 */
export async function mintedBy(
  hash: string,
  who: string,
  contract: string,
  transfer: string,
): Promise<number[]> {
  const wallet = await active();
  if (wallet === null) return [];

  interface Receipt {
    logs?: { address: string; topics: string[] }[];
  }

  for (let tries = 0; tries < 40; tries++) {
    let receipt: Receipt | null = null;
    try {
      receipt = (await wallet.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      })) as Receipt | null;
    } catch {
      // A node that has not seen it yet is not an error to report.
    }

    if (receipt?.logs) {
      const mine = normalise(who);
      return receipt.logs
        .filter(
          (log) =>
            normalise(log.address) === normalise(contract) &&
            log.topics[0] === transfer &&
            // Minted, not moved: an ERC721 Transfer from the zero address.
            BigInt(log.topics[1] ?? "0x0") === 0n &&
            normalise("0x" + (log.topics[2] ?? "").slice(-40)) === mine,
        )
        .map((log) => Number(BigInt(log.topics[3]!)))
        .sort((a, b) => a - b);
    }

    await new Promise((wake) => setTimeout(wake, 750));
  }
  return [];
}

/**
 * The calldata for `claim(address,uint256,bytes32[])`.
 *
 * Hand-encoded, and the one thing this file knows how to call. The proof is a
 * dynamic array, so the third argument is an OFFSET to where the array lives
 * rather than the array — 0x60, because three arguments have gone before it —
 * and the array itself is its length followed by its elements.
 *
 * The selector is passed in rather than computed here. lib/evm-tx.ts already
 * knows how to hash a signature and it is the file the cron uses, so having a
 * second one would be two answers to what four bytes mean.
 */
export function claimData(
  selector: string,
  holder: string,
  earned: bigint,
  proof: readonly string[],
): string {
  return (
    selector +
    word(holder) +
    word(earned) +
    word(0x60n) +
    word(BigInt(proof.length)) +
    proof.map((step) => word(step)).join("")
  );
}

/**
 * Sends one call to a contract from the signed-in wallet. Returns the hash.
 *
 * No gas and no gas price: the wallet estimates both and shows them to the
 * person before they agree. Guessing here would mean a number in somebody\'s
 * confirmation screen that this project chose and they did not.
 *
 * `value` is CRO, in wei, and it is the one argument here that can lose
 * somebody money by being wrong. It is left out of the request entirely when it
 * is zero rather than sent as "0x0", so a call that was never meant to pay
 * cannot pay by a formatting accident — and every caller that does pay has to
 * say so at the call site.
 */
export async function sendCall(
  from: string,
  to: string,
  data: string,
  value: bigint = 0n,
): Promise<string> {
  const wallet = await active();
  if (wallet === null) throw new Error("No wallet in this browser.");
  if (value < 0n) throw new Error("A transaction cannot send a negative amount.");

  await ensureCronos();
  const hash = await wallet.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data, ...(value > 0n ? { value: "0x" + value.toString(16) } : {}) }],
  });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction.");
  return hash;
}

/**
 * Waits until a transaction has been mined, and says whether it worked.
 *
 * `sendCall` hands back a hash the moment the wallet submits it, which is the
 * right thing for a transaction nothing waits on. It is the wrong thing when the
 * next step asks a server to read the result: the round trip is faster than a
 * block, so the server looks, sees nothing yet, and refuses.
 *
 * That is how a ranked seat took somebody's ten CRO and gave them no match on
 * 3 October 2026 — the deposit landed a second after the join had already been
 * turned away for not existing.
 *
 * Polls through the wallet's own provider rather than a public endpoint: it is
 * already connected to the right chain, and an endpoint that lags behind the one
 * the wallet broadcast to would reintroduce the same race one layer down.
 */
export async function waitForTx(hash: string, tries = 40): Promise<boolean> {
  const wallet = await active();
  if (wallet === null) throw new Error("No wallet in this browser.");
  for (let i = 0; i < tries; i++) {
    const receipt = (await wallet
      .request({ method: "eth_getTransactionReceipt", params: [hash] })
      .catch(() => null)) as { status?: string } | null;
    // Null is a real answer for a transaction still in the pool, and not an
    // error — see the same note in lib/cronos.ts.
    if (receipt !== null && receipt !== undefined) {
      return BigInt(receipt.status ?? "0x0") === 1n;
    }
    await new Promise((wake) => setTimeout(wake, 1_500));
  }
  return false;
}
