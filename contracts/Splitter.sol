// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * Every way money enters this game, divided the one way it is divided.
 *
 * Half to the people holding $CROCARD, a quarter burned, a quarter into the
 * weekly prize pot. lib/revenue.ts is where that split is written down for the
 * site; this is where it is written down for the money, and
 * contracts/test/Splitter.t.sol plus test/revenue.test.ts check the two agree.
 *
 * ── WHY THIS NEEDS NO KEY ────────────────────────────────────────────────────
 *
 * `release` is callable by anybody. That is not an oversight, it is the design:
 * the three destinations are immutable and set once at construction, and the
 * three shares are constants, so there is no input to this function and no
 * choice in what it does. A stranger calling it does exactly what the owner
 * calling it would do.
 *
 * Which means automating it costs nothing and risks nothing. A cron, a bot, a
 * bored person with a wallet — whoever calls it, the money goes where it was
 * always going to go. Nothing anywhere holds a key that could send it elsewhere,
 * because no key can.
 *
 * The alternative shape — a wallet on a server that reads balances and sends
 * transactions — automates the same job and puts everything this contract will
 * ever hold behind one secret. TCG looked at that and refused it in writing.
 *
 * ── WHAT IT ACCEPTS ──────────────────────────────────────────────────────────
 *
 * Anything. Mint proceeds pushed out of the NFT contract, royalties paid by a
 * marketplace that read ERC2981, a rake from a ranked match, or somebody sending
 * CRO to it by hand. It does not care where CRO came from and it cannot: a
 * marketplace does not announce itself.
 *
 * That is also why it accumulates rather than forwarding on receipt. A receive()
 * that pays three addresses is a receive() that can run out of gas, and a
 * royalty payment that reverts is a sale that reverts — which is a marketplace
 * quietly delisting you.
 */
contract Splitter {
    /// Basis points, out of 10_000. Constants: this split has no admin.
    uint256 public constant HOLDERS_BPS = 5_000;
    uint256 public constant BURN_BPS = 2_500;
    uint256 public constant POT_BPS = 2_500;

    /// @notice Where the holders' half goes to be claimed from.
    address payable public immutable holders;
    /// @notice Where the quarter that buys and burns $CROCARD goes.
    address payable public immutable burner;
    /// @notice The weekly prize pot.
    address payable public immutable pot;

    event Released(uint256 toHolders, uint256 burned, uint256 toPot);

    error NothingToRelease();
    error ZeroAddress();
    error TransferFailed(address to);

    constructor(address payable holders_, address payable burner_, address payable pot_) {
        // A zero address here is money sent to nowhere, forever, on every
        // release. Checked at construction because it cannot be fixed after.
        if (holders_ == address(0) || burner_ == address(0) || pot_ == address(0)) {
            revert ZeroAddress();
        }
        holders = holders_;
        burner = burner_;
        pot = pot_;
    }

    /// @notice Takes whatever has arrived, from anywhere.
    receive() external payable {}

    /**
     * @notice Divides everything held and sends it on. Anyone may call this.
     *
     * The remainder goes to the pot rather than being left behind. Three shares
     * of an odd number of wei leave up to two wei stranded, and "up to two wei,
     * every time, forever" is a balance that only ever grows and that nothing
     * can ever pay out — the exact shape of the leftover lib/revenue.ts refuses
     * a 99% split for.
     */
    function release() external {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToRelease();

        uint256 toHolders = (balance * HOLDERS_BPS) / 10_000;
        uint256 burned = (balance * BURN_BPS) / 10_000;
        uint256 toPot = balance - toHolders - burned;

        // Interactions last, and the balance is read once above — a recipient
        // that calls back in finds a contract that has already decided what it
        // is sending.
        _send(holders, toHolders);
        _send(burner, burned);
        _send(pot, toPot);

        emit Released(toHolders, burned, toPot);
    }

    function _send(address payable to, uint256 amount) private {
        if (amount == 0) return;
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed(to);
    }
}
