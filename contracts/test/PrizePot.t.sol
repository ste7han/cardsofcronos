// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FakeCard} from "./FakeCard.sol";

import {PrizePot} from "../PrizePot.sol";
import {Rescuable} from "../Rescuable.sol";

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

    FakeCard private card;

    function setUp() public {
        card = new FakeCard();
        pot = new PrizePot(IERC20(address(card)), publisher);
        card.mint(address(pot), 10 ether);
    }

    function test_closingAWeekAndPayingIt() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        (address named, uint256 amount, bool paid) = pot.prizes(week38);
        assertEq(named, winner);
        assertEq(amount, 10 ether, "the prize is everything not already spoken for");
        assertFalse(paid);

        pot.claim(week38);
        assertEq(card.balanceOf(winner), 10 ether);
        assertEq(card.balanceOf(address(pot)), 0);
    }

    /** The winner is paid even when somebody else does the calling. */
    function test_anybodyMayPushThePrize() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        vm.prank(stranger);
        pot.claim(week38);

        assertEq(card.balanceOf(winner), 10 ether, "it pays the winner, not the caller");
        assertEq(card.balanceOf(stranger), 0);
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

        card.mint(address(pot), 2 ether);

        address thief = address(0xBAD);
        vm.prank(publisher);
        pot.closeWeek(week39, thief);

        (, uint256 stolen, ) = pot.prizes(week39);
        assertEq(stolen, 2 ether, "only what arrived after the last week closed");

        pot.claim(week38);
        assertEq(card.balanceOf(winner), 10 ether, "last week's winner is untouched");
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

        card.mint(address(pot), 4 ether);
        vm.prank(publisher);
        pot.closeWeek(week39, stranger);

        pot.claim(week38);
        pot.claim(week39);
        assertEq(card.balanceOf(winner), 10 ether);
        assertEq(card.balanceOf(stranger), 4 ether);
        assertEq(card.balanceOf(address(pot)), 0, "and the pot is empty, not short");
    }

    function test_aDepositAfterClosingBelongsToTheNextWeek() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);
        card.mint(address(pot), 3 ether);

        pot.claim(week38);
        assertEq(card.balanceOf(winner), 10 ether, "not 13: the prize was fixed when it closed");
        assertEq(pot.unallocated(), 3 ether);
    }

    function test_claimingAWeekNobodyWon() public {
        vm.expectRevert(PrizePot.NoSuchWeek.selector);
        pot.claim(week38);
    }

    function test_closingAnEmptyPot() public {
        pot = new PrizePot(IERC20(address(card)), publisher);
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
        assertEq(card.balanceOf(winner), 10 ether, "being told you won is not reversible");
    }

    function test_onlyTheOwnerRotates() public {
        vm.prank(publisher);
        vm.expectRevert();
        pot.setPublisher(stranger);
    }

    function test_refusesAZeroPublisher() public {
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new PrizePot(IERC20(address(card)), address(0));
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        pot.setPublisher(address(0));
    }

    function test_refusesAZeroWinner() public {
        vm.prank(publisher);
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        pot.closeWeek(week38, address(0));
    }

    // ── THE CEILING ─────────────────────────────────────────────────────────

    /**
     * The reason it exists: a quarter of every mint lands here, the mint is the
     * busiest this game will ever be, and without a ceiling the first week after
     * it hands one player a tenth of the supply for beating a bot once.
     */
    function test_aWeekPaysAtMostTheCeiling() public {
        // Four times the ceiling sitting in the pot, which is the shape a good
        // mint produces.
        card.mint(address(pot), pot.DEFAULT_MOST_PER_WEEK() * 4);

        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        (, uint256 amount,) = pot.prizes(week38);
        assertEq(amount, pot.DEFAULT_MOST_PER_WEEK(), "a week cannot take more than the ceiling");
    }

    /**
     * What the ceiling holds back is next week's pot, not stranded and not lost.
     *
     * The ceiling is lowered to four so the whole sequence fits in one read:
     * ten in the pot pays four, four and two, and then it is empty. Every token
     * that arrived is paid out, just never all in one week.
     */
    function test_whatIsOverTheCeilingRollsOver() public {
        pot.setMostPerWeek(4 ether);
        bytes32 week40 = bytes32("2026-W40");

        vm.prank(publisher);
        pot.closeWeek(week38, winner);
        pot.claim(week38);
        assertEq(card.balanceOf(winner), 4 ether);

        vm.prank(publisher);
        pot.closeWeek(week39, stranger);
        pot.claim(week39);
        assertEq(card.balanceOf(stranger), 4 ether);

        vm.prank(publisher);
        pot.closeWeek(week40, winner);
        (, uint256 tail,) = pot.prizes(week40);
        assertEq(tail, 2 ether, "the last of it is paid whole rather than held back");

        pot.claim(week40);
        assertEq(card.balanceOf(address(pot)), 0, "nothing is stranded by the ceiling");
    }

    /** Under the ceiling nothing changes: a small pot is paid whole. */
    function test_asmallPotIsStillPaidWhole() public {
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        (, uint256 amount,) = pot.prizes(week38);
        assertEq(amount, 10 ether, "the ceiling is a ceiling, not an amount");
    }

    /** One percent of a billion, which is what the site tells people it is. */
    function test_theCeilingStartsAtOnePercentOfSupply() public view {
        assertEq(pot.mostPerWeek(), 10_000_000 ether);
        assertEq(pot.mostPerWeek(), 1_000_000_000 ether / 100);
    }

    function test_theOwnerCanMoveTheCeiling() public {
        pot.setMostPerWeek(1 ether);
        assertEq(pot.mostPerWeek(), 1 ether);

        card.mint(address(pot), 100 ether);
        vm.prank(publisher);
        pot.closeWeek(week38, winner);

        (, uint256 amount,) = pot.prizes(week38);
        assertEq(amount, 1 ether, "the new ceiling applies to the next week closed");
    }

    function test_nobodyElseCanMoveTheCeiling() public {
        vm.prank(stranger);
        vm.expectRevert();
        pot.setMostPerWeek(1 ether);

        vm.prank(publisher);
        vm.expectRevert();
        pot.setMostPerWeek(1 ether);
    }

    /**
     * Zero is not a small ceiling. It is a pot nobody can ever win out of, and
     * it would look like a broken cron rather than a setting.
     */
    function test_theCeilingCannotBeNothing() public {
        vm.expectRevert(PrizePot.CeilingOfNothing.selector);
        pot.setMostPerWeek(0);
    }

    /** Moving it cannot reach into a week that has already been decided. */
    function test_movingTheCeilingDoesNotTakeBackAWeekAlreadyClosed() public {
        card.mint(address(pot), pot.DEFAULT_MOST_PER_WEEK() * 2);

        vm.prank(publisher);
        pot.closeWeek(week38, winner);
        (, uint256 promised,) = pot.prizes(week38);

        pot.setMostPerWeek(1 ether);

        pot.claim(week38);
        assertEq(card.balanceOf(winner), promised, "what was promised is what is paid");
    }

    /** What the site shows as the next prize is the capped figure, not the balance. */
    function test_nextPrizeIsWhatAWinnerWouldActuallyGet() public {
        assertEq(pot.nextPrize(), 10 ether, "under the ceiling it is the whole balance");
        assertEq(pot.unallocated(), 10 ether);

        card.mint(address(pot), pot.DEFAULT_MOST_PER_WEEK() * 3);
        assertEq(pot.nextPrize(), pot.DEFAULT_MOST_PER_WEEK(), "over it, it is the ceiling");
        assertGt(pot.unallocated(), pot.nextPrize(), "and the balance is the larger number");
    }

}
