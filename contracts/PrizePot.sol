// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Rescuable} from "./Rescuable.sol";

/**
 * The weekly prize, held where nobody can spend it.
 *
 * A quarter of every mint, every royalty and every ranked match arrives here
 * from Splitter.sol. Each week it is awarded to whoever posted the best verified
 * score, and paid out.
 *
 * ── THE ONE THING THAT CANNOT BE PUT ON THE CHAIN ────────────────────────────
 *
 * Who won. That is decided by replaying submitted matches on the server — see
 * lib/tournament.ts — and no contract can do it. So something off-chain has to
 * say a name, and saying a name needs a key.
 *
 * What this contract does about that is make the key worth almost nothing to
 * steal. The publisher may do exactly one thing: name the winner of a week that
 * has not been closed yet. It cannot withdraw, cannot change a week already
 * closed, cannot reach the balance, and cannot pay itself except by naming
 * itself — which costs it one week's pot, in public, once, on a contract anybody
 * is watching. The owner can then rotate it.
 *
 * The alternative is a wallet on a server that holds the pot and sends it. That
 * key is worth the whole balance and every future deposit. TCG looked at that
 * and refused it in writing: "the tournament wallet's key is not on any server,
 * deliberately".
 *
 * ── WHY ANYONE CAN CLAIM ─────────────────────────────────────────────────────
 *
 * `claim` pays the winner, not the caller. So the winner does not have to do
 * anything, does not need to know this contract exists, and does not need gas —
 * a cron pushes it the moment a week closes, and if the cron is down, anybody
 * can. A prize that has to be fetched is a prize somebody forgets to fetch.
 */
contract PrizePot is Rescuable {
    struct Prize {
        address winner;
        uint256 amount;
        bool paid;
    }

    /// @notice The only address that may name a winner. Rotatable by the owner.
    address public publisher;

    /// @notice Weeks that have been closed, keyed by "2026-W38".
    mapping(bytes32 => Prize) public prizes;

    /**
     * @notice What is spoken for and must not be handed out twice.
     *
     * Without this, closing a second week before the first is paid would award
     * the same CRO again — the balance is still sitting here, and nothing about
     * it says it already belongs to somebody.
     */
    uint256 public allocated;

    event WeekClosed(bytes32 indexed week, address indexed winner, uint256 amount);
    event Paid(bytes32 indexed week, address indexed winner, uint256 amount);
    event PublisherChanged(address indexed from, address indexed to);

    error NotThePublisher();
    error WeekAlreadyClosed();
    error NoSuchWeek();
    error AlreadyPaid();
    error NothingToWin();
    error TransferFailed();

    constructor(address publisher_) Ownable(msg.sender) {
        if (publisher_ == address(0)) revert ZeroAddress();
        publisher = publisher_;
    }

    /// @notice Takes CRO from the splitter, or from anybody topping up the pot.
    receive() external payable {}

    /**
     * @notice Names the winner of a week and sets that week's prize aside.
     *
     * The prize is whatever has arrived and is not already spoken for. It is
     * fixed at this moment rather than read at payout, so a deposit that lands
     * between closing and paying belongs to the next week and not to a week that
     * has already been decided.
     */
    function closeWeek(bytes32 week, address winner) external {
        if (msg.sender != publisher) revert NotThePublisher();
        if (winner == address(0)) revert ZeroAddress();
        // A week is closed once. Without this the publisher could rename the
        // winner of a week it had already announced, which is the one thing that
        // would make the board worth less than the word of whoever holds the key.
        if (prizes[week].winner != address(0)) revert WeekAlreadyClosed();

        uint256 amount = address(this).balance - allocated;
        if (amount == 0) revert NothingToWin();

        prizes[week] = Prize({winner: winner, amount: amount, paid: false});
        allocated += amount;
        emit WeekClosed(week, winner, amount);
    }

    /**
     * @notice Pays a closed week to its winner. Anyone may call this.
     *
     * It pays the winner and not the caller, so there is nothing to gain by
     * being the one to call it and nothing to lose by being slow.
     */
    function claim(bytes32 week) external {
        Prize storage prize = prizes[week];
        if (prize.winner == address(0)) revert NoSuchWeek();
        if (prize.paid) revert AlreadyPaid();

        // Effects before interactions. A winner that calls back in finds a week
        // already marked paid and an allocation already released.
        prize.paid = true;
        uint256 amount = prize.amount;
        allocated -= amount;

        (bool sent, ) = payable(prize.winner).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit Paid(week, prize.winner, amount);
    }

    /**
     * @notice Replaces the publisher.
     *
     * The answer to a leaked key, and the reason the owner should be a wallet
     * that never touches a server. It cannot undo a week already closed — that
     * is deliberate, because a winner who has been told they won should not have
     * it taken back by a key rotation.
     */
    function setPublisher(address publisher_) external onlyOwner {
        if (publisher_ == address(0)) revert ZeroAddress();
        emit PublisherChanged(publisher, publisher_);
        publisher = publisher_;
    }

    /// @notice What the next week would pay, if it closed now.
    function unallocated() external view returns (uint256) {
        return address(this).balance - allocated;
    }
}
