// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {PrizePot} from "../PrizePot.sol";

/**
 * What a stolen publisher key is worth, and what it is not.
 *
 * The whole reason this contract exists rather than a wallet on a server is that
 * the key which decides a winner cannot spend anything. That claim is worth its
 * tests and nothing else, so most of these are about what the publisher CANNOT
 * do.
 */
contract PrizePotTest is Test {
    PrizePot private pot;

    address private publisher = address(0xBEEF);
    address private winner = address(0xD1CE);
    address private stranger = address(0x5A);

    bytes32 private week38 = bytes32("2026-W38");
    bytes32 private week39 = bytes32("2026-W39");

    function setUp() public {
        pot = new PrizePot(publisher);
        vm.deal(address(pot), 10 ether);
    }

    function test_closingAWeekAndPayingIt() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        (address named, uint256 amount, bool paid) = pot.prizes(week38);
        assertEq(named, winner);
        assertEq(amount, 10 ether, "the prize is everything not already spoken for");
        assertFalse(paid);

        pot.claim(week38);
        assertEq(winner.balance, 10 ether);
        assertEq(address(pot).balance, 0);
    }

    /** The winner is paid even when somebody else does the calling. */
    function test_anybodyMayPushThePrize() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        vm.prank(stranger);
        pot.claim(week38);

        assertEq(winner.balance, 10 ether, "it pays the winner, not the caller");
        assertEq(stranger.balance, 0);
    }

    // ── what the publisher cannot do ────────────────────────────────────────

    function test_thePublisherCannotWithdraw() public view {
        // There is no function to call. If one is ever added this stops
        // compiling, which is the point of asserting on an absence.
        assertEq(pot.publisher(), publisher);
    }

    function test_thePublisherCannotReopenAWeek() public {
        vm.startPrank(publisher);
        pot.closeWeek(week38, winner);
        vm.expectRevert(PrizePot.WeekAlreadyClosed.selector);
        pot.closeWeek(week38, publisher);
        vm.stopPrank();

        (address named, , ) = pot.prizes(week38);
        assertEq(named, winner, "a week announced is a week decided");
    }

    /**
     * The worst a stolen key can do, stated as a number.
     *
     * It can name itself for a week that has not closed, once, in public. It
     * cannot touch what previous weeks are owed.
     */
    function test_aStolenKeyCannotReachWhatIsAlreadyOwed() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        vm.deal(address(pot), address(pot).balance + 2 ether);

        address thief = address(0xBAD);
        vm.prank(publisher);
        pot.closeWeek(week39, thief);

        (, uint256 stolen, ) = pot.prizes(week39);
        assertEq(stolen, 2 ether, "only what arrived after the last week closed");

        pot.claim(week38);
        assertEq(winner.balance, 10 ether, "last week's winner is untouched");
    }

    function test_onlyThePublisherMayCloseAWeek() public {
        vm.prank(stranger);
        vm.expectRevert(PrizePot.NotThePublisher.selector);
        pot.closeWeek(week38, winner);

        // Not even the owner, who is a different job.
        vm.expectRevert(PrizePot.NotThePublisher.selector);
        pot.closeWeek(week38, winner);
    }

    // ── the money cannot be handed out twice ────────────────────────────────

    function test_aWeekIsPaidOnce() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);
        pot.claim(week38);

        vm.expectRevert(PrizePot.AlreadyPaid.selector);
        pot.claim(week38);
    }

    /**
     * Two weeks closed before either is paid must not award the same CRO twice.
     *
     * This is what `allocated` is for, and it is the mistake that would not show
     * up until the second winner's claim reverted for lack of funds — long after
     * both were told they had won.
     */
    function test_twoOpenWeeksDoNotShareTheSameMoney() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        vm.expectRevert(PrizePot.NothingToWin.selector);
        vm.prank(publisher);
        pot.closeWeek(week39, stranger);

        vm.deal(address(pot), address(pot).balance + 4 ether);
        vm.prank(publisher);
        pot.closeWeek(week39, stranger);

        pot.claim(week38);
        pot.claim(week39);
        assertEq(winner.balance, 10 ether);
        assertEq(stranger.balance, 4 ether);
        assertEq(address(pot).balance, 0, "and the pot is empty, not short");
    }

    function test_aDepositAfterClosingBelongsToTheNextWeek() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);
        vm.deal(address(pot), address(pot).balance + 3 ether);

        pot.claim(week38);
        assertEq(winner.balance, 10 ether, "not 13: the prize was fixed when it closed");
        assertEq(pot.unallocated(), 3 ether);
    }

    function test_claimingAWeekNobodyWon() public {
        vm.expectRevert(PrizePot.NoSuchWeek.selector);
        pot.claim(week38);
    }

    function test_closingAnEmptyPot() public {
        pot = new PrizePot(publisher);
        vm.prank(publisher);
        vm.expectRevert(PrizePot.NothingToWin.selector);
        pot.closeWeek(week38, winner);
    }

    // ── rotating a leaked key ───────────────────────────────────────────────

    function test_theOwnerCanRotateThePublisher() public {
        address fresh = address(0xFEED);
        pot.setPublisher(fresh);

        vm.prank(publisher);
        vm.expectRevert(PrizePot.NotThePublisher.selector);
        pot.closeWeek(week38, winner);

        vm.prank(fresh);
        pot.closeWeek(week38, winner);
        (address named, , ) = pot.prizes(week38);
        assertEq(named, winner);
    }

    function test_rotatingDoesNotTakeBackAWeekAlreadyWon() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        pot.setPublisher(address(0xFEED));
        pot.claim(week38);
        assertEq(winner.balance, 10 ether, "being told you won is not reversible");
    }

    function test_onlyTheOwnerRotates() public {
        vm.prank(publisher);
        vm.expectRevert();
        pot.setPublisher(stranger);
    }

    function test_refusesAZeroPublisher() public {
        vm.expectRevert(PrizePot.ZeroAddress.selector);
        new PrizePot(address(0));
        vm.expectRevert(PrizePot.ZeroAddress.selector);
        pot.setPublisher(address(0));
    }

    function test_refusesAZeroWinner() public {
        vm.prank(publisher);
        vm.expectRevert(PrizePot.ZeroAddress.selector);
        pot.closeWeek(week38, address(0));
    }
}
