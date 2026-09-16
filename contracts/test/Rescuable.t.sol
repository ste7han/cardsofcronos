// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {PrizePot} from "../PrizePot.sol";
import {Rescuable} from "../Rescuable.sol";

/**
 * The way out, and the two days that make it defensible.
 *
 * A rescue is the one thing in this design that CAN move everything, so what
 * these check is not that it works — that is two lines — but that it cannot be
 * done quietly, cannot be done quickly, and cannot be done by the key that lives
 * on a server.
 *
 * Tested through PrizePot because Rescuable is abstract and this is how it will
 * actually be reached.
 */
contract RescuableTest is Test {
    PrizePot private pot;

    address private publisher = address(0xBEEF);
    address private safe = address(0x5AFE);
    address private stranger = address(0xDEAD);

    function setUp() public {
        pot = new PrizePot(publisher);
        vm.deal(address(pot), 10 ether);
    }

    function test_waitsTwoDaysAndThenWorks() public {
        pot.announceRescue(safe);
        assertEq(pot.rescueTo(), safe);
        assertEq(pot.rescueAt(), block.timestamp + 2 days);

        vm.expectRevert(
            abi.encodeWithSelector(Rescuable.RescueNotReady.selector, pot.rescueAt())
        );
        pot.rescue();

        // One second short is still short.
        vm.warp(pot.rescueAt() - 1);
        vm.expectRevert(
            abi.encodeWithSelector(Rescuable.RescueNotReady.selector, pot.rescueAt())
        );
        pot.rescue();

        vm.warp(pot.rescueAt());
        pot.rescue();
        assertEq(safe.balance, 10 ether);
        assertEq(address(pot).balance, 0);
    }

    /**
     * The whole point of the wait: a stolen owner key announces itself first.
     *
     * Two days is not a guarantee, it is a chance. What it buys is that the
     * theft is a public event on a contract anybody can watch, rather than one
     * transaction that is over before it is noticed.
     */
    function test_aRescueCannotHappenQuietly() public {
        vm.recordLogs();
        pot.announceRescue(safe);
        assertEq(vm.getRecordedLogs().length, 1, "announcing is an event or it is nothing");
    }

    function test_theOwnerCanCancelWhatWasAnnounced() public {
        pot.announceRescue(stranger);
        pot.cancelRescue();

        assertEq(pot.rescueTo(), address(0));
        assertEq(pot.rescueAt(), 0);

        vm.warp(block.timestamp + 3 days);
        vm.expectRevert(Rescuable.NoRescueAnnounced.selector);
        pot.rescue();
    }

    /**
     * A second announcement does not inherit the first one's clock.
     *
     * Without this, announcing a harmless address, waiting out the two days, and
     * then re-announcing the real destination would be a rescue with no wait at
     * all — which is the whole protection, removed by a second transaction.
     */
    function test_aNewDestinationCannotInheritAnOldClock() public {
        pot.announceRescue(safe);
        vm.warp(block.timestamp + 2 days);

        vm.expectRevert(
            abi.encodeWithSelector(Rescuable.RescueAlreadyAnnounced.selector, safe, pot.rescueAt())
        );
        pot.announceRescue(stranger);

        // Cancelling first is allowed, and starts a fresh two days.
        pot.cancelRescue();
        pot.announceRescue(stranger);
        assertEq(pot.rescueAt(), block.timestamp + 2 days);
        vm.expectRevert(
            abi.encodeWithSelector(Rescuable.RescueNotReady.selector, pot.rescueAt())
        );
        pot.rescue();
    }

    // ── who cannot do it ────────────────────────────────────────────────────

    function test_thePublisherCannotRescue() public {
        // The key that lives in a Worker. It may name a winner and nothing else.
        vm.startPrank(publisher);
        vm.expectRevert();
        pot.announceRescue(publisher);
        vm.expectRevert();
        pot.rescue();
        vm.stopPrank();
    }

    function test_aStrangerCannotRescue() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        pot.announceRescue(stranger);
        vm.expectRevert();
        pot.cancelRescue();
        vm.stopPrank();
    }

    function test_refusesAZeroDestination() public {
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        pot.announceRescue(address(0));
    }

    function test_rescuingWithNothingAnnounced() public {
        vm.expectRevert(Rescuable.NoRescueAnnounced.selector);
        pot.rescue();
        vm.expectRevert(Rescuable.NoRescueAnnounced.selector);
        pot.cancelRescue();
    }

    function test_rescuingAnEmptyContract() public {
        pot = new PrizePot(publisher);
        pot.announceRescue(safe);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(Rescuable.NothingToRescue.selector);
        pot.rescue();
    }

    /** Rescuing clears the announcement, so it is not a standing licence. */
    function test_aRescueIsSpentWhenItIsUsed() public {
        pot.announceRescue(safe);
        vm.warp(block.timestamp + 2 days);
        pot.rescue();

        assertEq(pot.rescueAt(), 0);
        vm.deal(address(pot), 1 ether);
        vm.expectRevert(Rescuable.NoRescueAnnounced.selector);
        pot.rescue();
    }
}
