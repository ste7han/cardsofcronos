// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * A way out, for when the contract holding the money turns out to be wrong.
 *
 * ── WHY THIS EXISTS, WHEN THE REST OF THE DESIGN IS ABOUT REMOVING KEYS ──────
 *
 * Splitter and PrizePot are built so that no key can move what they hold. That
 * is the right shape and it has one failure mode: a bug in them is unrecoverable.
 * Nothing here is audited — 48 tests is not an audit — and unaudited code that
 * holds money with no way out trades "somebody could steal it" for "nobody can
 * ever have it", which is not obviously the better trade.
 *
 * So there is a way out, and it is shaped to be as small as the job allows.
 *
 * ── WHY IT WAITS ─────────────────────────────────────────────────────────────
 *
 * A rescue is announced, with its destination, and can only be carried out two
 * days later. The owner can cancel in between.
 *
 * Without the wait, the owner key IS the money: one leak and everything is gone
 * in a single transaction with nobody able to react. With it, a stolen key
 * announces itself on a contract anybody can watch, and there are two days to
 * notice, to shout, and to cancel from a key the thief does not have.
 *
 * The wait costs nothing in the case it is actually for. The emergency this
 * answers is money STUCK — an accounting bug, a destination that reverts, a week
 * that cannot be closed — and stuck money does not run away while you wait. The
 * emergency it does NOT answer is an active drain, and no timelock would: an
 * attacker emptying a contract is not going to wait two days either.
 *
 * ── WHO HOLDS IT ─────────────────────────────────────────────────────────────
 *
 * The owner, which should be a wallet that never touches a server — not the
 * publisher key, which lives in a Worker and is allowed to name a winner and
 * nothing else. Two keys with two jobs, and the one that can reach the money is
 * the one that is hardest to reach.
 */
abstract contract Rescuable is Ownable {
    /// @notice How long an announced rescue has to wait.
    uint256 public constant RESCUE_DELAY = 2 days;

    /// @notice Where an announced rescue would send everything. Zero when none.
    address public rescueTo;

    /// @notice The earliest a rescue may be carried out. Zero when none.
    uint256 public rescueAt;

    event RescueAnnounced(address indexed to, uint256 at);
    event RescueCancelled(address indexed to);
    event Rescued(address indexed to, uint256 amount);

    error NoRescueAnnounced();
    error RescueNotReady(uint256 readyAt);
    error RescueAlreadyAnnounced(address to, uint256 at);
    error NothingToRescue();
    error ZeroAddress();
    error RescueFailed();

    /**
     * @notice Announces where everything would go, and starts the clock.
     *
     * The destination is fixed here rather than at the moment of rescuing, so
     * that the two days are spent watching a specific address. "Somebody may
     * move the money somewhere in two days" is not a warning anybody can act on.
     */
    function announceRescue(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        // Cancel first. Re-announcing silently would let a new destination
        // inherit an old clock that has nearly run out.
        if (rescueAt != 0) revert RescueAlreadyAnnounced(rescueTo, rescueAt);

        rescueTo = to;
        rescueAt = block.timestamp + RESCUE_DELAY;
        emit RescueAnnounced(to, rescueAt);
    }

    function cancelRescue() external onlyOwner {
        if (rescueAt == 0) revert NoRescueAnnounced();
        emit RescueCancelled(rescueTo);
        rescueTo = address(0);
        rescueAt = 0;
    }

    /// @notice Sends everything to the announced destination, once the wait is up.
    function rescue() external onlyOwner {
        if (rescueAt == 0) revert NoRescueAnnounced();
        if (block.timestamp < rescueAt) revert RescueNotReady(rescueAt);

        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToRescue();

        address to = rescueTo;
        rescueTo = address(0);
        rescueAt = 0;

        (bool sent, ) = payable(to).call{value: amount}("");
        if (!sent) revert RescueFailed();
        emit Rescued(to, amount);
    }
}
