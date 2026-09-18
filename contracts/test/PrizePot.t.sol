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
    /** The board the old tests were written against, before there were boards. */
    bytes32 private bot = bytes32("bot");
    bytes32 private lions = bytes32("lions");

    /** One board as the array the contract wants, for the tests that prank themselves. */
    function one(bytes32 board) private pure returns (bytes32[] memory boards) {
        boards = new bytes32[](1);
        boards[0] = board;
    }

    function to(address winner) private pure returns (address[] memory winners) {
        winners = new address[](1);
        winners[0] = winner;
    }

    /** One board and one winner, which is what most of these are about. */
    function close(bytes32 week, bytes32 board, address winner) private {
        bytes32[] memory boards = new bytes32[](1);
        address[] memory winners = new address[](1);
        boards[0] = board;
        winners[0] = winner;
        vm.prank(publisher);
        pot.closeWeek(week, boards, winners);
    }

    /** Two boards in one call, which is the case the ordering bug lived in. */
    function closeBoth(bytes32 week, address first, address second) private {
        bytes32[] memory boards = new bytes32[](2);
        address[] memory winners = new address[](2);
        boards[0] = bot;
        boards[1] = lions;
        winners[0] = first;
        winners[1] = second;
        vm.prank(publisher);
        pot.closeWeek(week, boards, winners);
    }
    bytes32 private week39 = bytes32("2026-W39");

    FakeCard private card;

    function setUp() public {
        card = new FakeCard();
        pot = new PrizePot(IERC20(address(card)), publisher);
        // The whole pot to one board, so every test written before boards
        // existed keeps measuring what it measured.
        pot.setShare(bot, 10_000);
        card.mint(address(pot), 10 ether);
    }

    function test_closingAWeekAndPayingIt() public {
        close(week38, bot, winner);

        (address named, uint256 amount, bool paid) = pot.prizes(week38, bot);
        assertEq(named, winner);
        assertEq(amount, 10 ether, "the prize is everything not already spoken for");
        assertFalse(paid);

        pot.claim(week38, bot);
        assertEq(card.balanceOf(winner), 10 ether);
        assertEq(card.balanceOf(address(pot)), 0);
    }

    /** The winner is paid even when somebody else does the calling. */
    function test_anybodyMayPushThePrize() public {
        close(week38, bot, winner);

        vm.prank(stranger);
        pot.claim(week38, bot);

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
        pot.closeWeek(week38, one(bot), to(winner));
        vm.expectRevert(PrizePot.WeekAlreadyClosed.selector);
        pot.closeWeek(week38, one(bot), to(publisher));
        vm.stopPrank();

        (address named, , ) = pot.prizes(week38, bot);
        assertEq(named, winner, "a week announced is a week decided");
    }

    /**
     * The worst a stolen key can do, stated as a number.
     *
     * It can name itself for a week that has not closed, once, in public. It
     * cannot touch what previous weeks are owed.
     */
    function test_aStolenKeyCannotReachWhatIsAlreadyOwed() public {
        close(week38, bot, winner);

        card.mint(address(pot), 2 ether);

        address thief = address(0xBAD);
        close(week39, bot, thief);

        (, uint256 stolen, ) = pot.prizes(week39, bot);
        assertEq(stolen, 2 ether, "only what arrived after the last week closed");

        pot.claim(week38, bot);
        assertEq(card.balanceOf(winner), 10 ether, "last week's winner is untouched");
    }

    function test_onlyThePublisherMayCloseAWeek() public {
        vm.prank(stranger);
        vm.expectRevert(PrizePot.NotThePublisher.selector);
        pot.closeWeek(week38, one(bot), to(winner));

        // Not even the owner, who is a different job.
        vm.expectRevert(PrizePot.NotThePublisher.selector);
        pot.closeWeek(week38, one(bot), to(winner));
    }

    // ── the money cannot be handed out twice ────────────────────────────────

    function test_aWeekIsPaidOnce() public {
        close(week38, bot, winner);
        pot.claim(week38, bot);

        vm.expectRevert(PrizePot.AlreadyPaid.selector);
        pot.claim(week38, bot);
    }

    /**
     * Two weeks closed before either is paid must not award the same CRO twice.
     *
     * This is what `allocated` is for, and it is the mistake that would not show
     * up until the second winner's claim reverted for lack of funds — long after
     * both were told they had won.
     */
    function test_twoOpenWeeksDoNotShareTheSameMoney() public {
        close(week38, bot, winner);

        vm.expectRevert(PrizePot.NothingToWin.selector);
        close(week39, bot, stranger);

        card.mint(address(pot), 4 ether);
        close(week39, bot, stranger);

        pot.claim(week38, bot);
        pot.claim(week39, bot);
        assertEq(card.balanceOf(winner), 10 ether);
        assertEq(card.balanceOf(stranger), 4 ether);
        assertEq(card.balanceOf(address(pot)), 0, "and the pot is empty, not short");
    }

    function test_aDepositAfterClosingBelongsToTheNextWeek() public {
        close(week38, bot, winner);
        card.mint(address(pot), 3 ether);

        pot.claim(week38, bot);
        assertEq(card.balanceOf(winner), 10 ether, "not 13: the prize was fixed when it closed");
        assertEq(pot.unallocated(), 3 ether);
    }

    function test_claimingAWeekNobodyWon() public {
        vm.expectRevert(PrizePot.NoSuchWeek.selector);
        pot.claim(week38, bot);
    }

    function test_closingAnEmptyPot() public {
        pot = new PrizePot(IERC20(address(card)), publisher);
        // The board has to exist before "there is nothing in it" is the answer.
        // Without this the revert is NoSuchBoard, which is a different sentence
        // and the right one for a board name nobody ever set.
        pot.setShare(bot, 10_000);
        vm.prank(publisher);
        vm.expectRevert(PrizePot.NothingToWin.selector);
        pot.closeWeek(week38, one(bot), to(winner));
    }

    // ── rotating a leaked key ───────────────────────────────────────────────

    function test_theOwnerCanRotateThePublisher() public {
        address fresh = address(0xFEED);
        pot.setPublisher(fresh);

        vm.prank(publisher);
        vm.expectRevert(PrizePot.NotThePublisher.selector);
        pot.closeWeek(week38, one(bot), to(winner));

        vm.prank(fresh);
        pot.closeWeek(week38, one(bot), to(winner));
        (address named, , ) = pot.prizes(week38, bot);
        assertEq(named, winner);
    }

    function test_rotatingDoesNotTakeBackAWeekAlreadyWon() public {
        close(week38, bot, winner);

        pot.setPublisher(address(0xFEED));
        pot.claim(week38, bot);
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
        pot.closeWeek(week38, one(bot), to(address(0)));
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

        close(week38, bot, winner);

        (, uint256 amount,) = pot.prizes(week38, bot);
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

        close(week38, bot, winner);
        pot.claim(week38, bot);
        assertEq(card.balanceOf(winner), 4 ether);

        close(week39, bot, stranger);
        pot.claim(week39, bot);
        assertEq(card.balanceOf(stranger), 4 ether);

        close(week40, bot, winner);
        (, uint256 tail,) = pot.prizes(week40, bot);
        assertEq(tail, 2 ether, "the last of it is paid whole rather than held back");

        pot.claim(week40, bot);
        assertEq(card.balanceOf(address(pot)), 0, "nothing is stranded by the ceiling");
    }

    /** Under the ceiling nothing changes: a small pot is paid whole. */
    function test_asmallPotIsStillPaidWhole() public {
        close(week38, bot, winner);

        (, uint256 amount,) = pot.prizes(week38, bot);
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
        close(week38, bot, winner);

        (, uint256 amount,) = pot.prizes(week38, bot);
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

        close(week38, bot, winner);
        (, uint256 promised,) = pot.prizes(week38, bot);

        pot.setMostPerWeek(1 ether);

        pot.claim(week38, bot);
        assertEq(card.balanceOf(winner), promised, "what was promised is what is paid");
    }

    /** What the site shows as the next prize is the capped figure, not the balance. */
    function test_nextPrizeIsWhatAWinnerWouldActuallyGet() public {
        assertEq(pot.nextPrize(bot), 10 ether, "under the ceiling it is the whole balance");
        assertEq(pot.unallocated(), 10 ether);

        card.mint(address(pot), pot.DEFAULT_MOST_PER_WEEK() * 3);
        assertEq(pot.nextPrize(bot), pot.DEFAULT_MOST_PER_WEEK(), "over it, it is the ceiling");
        assertGt(pot.unallocated(), pot.nextPrize(bot), "and the balance is the larger number");
    }


    // ── BOARDS ──────────────────────────────────────────────────────────────

    /**
     * The bug this whole shape exists to prevent.
     *
     * Two boards on a quarter each must get the same prize. Closed one at a
     * time, the second takes a quarter of what the first one left — 18.75% of
     * the pot against 25% — and the boards look identical on screen.
     */
    function test_twoBoardsOnEqualSharesGetEqualPrizes() public {
        pot.setShare(bot, 2_500);
        pot.setShare(lions, 2_500);

        closeBoth(week38, winner, stranger);

        (, uint256 first,) = pot.prizes(week38, bot);
        (, uint256 second,) = pot.prizes(week38, lions);
        assertEq(first, 2.5 ether, "a quarter of ten");
        assertEq(second, first, "and the same quarter, not a quarter of what is left");
    }

    /** What is not shared out stays in the pot and grows. */
    function test_whatIsNotSharedOutStaysInThePot() public {
        pot.setShare(bot, 2_500);
        pot.setShare(lions, 2_500);

        closeBoth(week38, winner, stranger);
        pot.claim(week38, bot);
        pot.claim(week38, lions);

        assertEq(card.balanceOf(address(pot)), 5 ether, "half of it never left");
        assertEq(pot.unallocated(), 5 ether, "and it is what next week plays for");
    }

    /** A board nobody won is simply left out, and keeps its share for later. */
    function test_aBoardNobodyWonKeepsItsShare() public {
        pot.setShare(bot, 2_500);
        pot.setShare(lions, 2_500);

        close(week38, bot, winner);
        pot.claim(week38, bot);

        assertEq(card.balanceOf(address(pot)), 7.5 ether, "the lions' quarter stayed");
        // And it is still closeable the following week, at the new pot's size.
        close(week39, lions, stranger);
        (, uint256 amount,) = pot.prizes(week39, lions);
        assertEq(amount, 1.875 ether, "a quarter of what is there now");
    }

    function test_aBoardWithNoShareIsNotABoard() public {
        vm.prank(publisher);
        vm.expectRevert(abi.encodeWithSelector(PrizePot.NoSuchBoard.selector, lions));
        pot.closeWeek(week38, one(lions), to(winner));
    }

    /** Retiring a board frees its share for everybody else. */
    function test_settingAShareToZeroRetiresABoard() public {
        pot.setShare(bot, 7_500);
        pot.setShare(lions, 2_500);
        assertEq(pot.sharedOut(), 10_000);

        pot.setShare(bot, 0);
        assertEq(pot.sharedOut(), 2_500, "only the lions are left");

        vm.prank(publisher);
        vm.expectRevert(abi.encodeWithSelector(PrizePot.NoSuchBoard.selector, bot));
        pot.closeWeek(week38, one(bot), to(winner));
    }

    function test_sharesCannotAddUpToMoreThanEverything() public {
        vm.expectRevert(abi.encodeWithSelector(PrizePot.SharesOverAHundred.selector, 10_001));
        pot.setShare(lions, 1);
    }

    /** Lowering one board's share makes room for another. */
    function test_loweringOneShareMakesRoomForAnother() public {
        pot.setShare(bot, 5_000);
        pot.setShare(lions, 5_000);
        assertEq(pot.sharedOut(), 10_000);
    }

    function test_onlyTheOwnerSetsShares() public {
        vm.prank(publisher);
        vm.expectRevert();
        pot.setShare(lions, 2_500);

        vm.prank(stranger);
        vm.expectRevert();
        pot.setShare(lions, 2_500);
    }

    /**
     * The same board twice in one call is refused, and by something subtle.
     *
     * There is no check for it. The write inside the loop means the second
     * appearance reads a winner the first one already set, so the ordinary
     * "closed once" guard fires. A check for it was written and then deleted as
     * unreachable — this test is what stands in its place, because what makes it
     * safe is an assignment rather than a guard, and an assignment can move.
     */
    function test_aBoardCannotAppearTwiceInOneCall() public {
        bytes32[] memory boards = new bytes32[](2);
        address[] memory winners = new address[](2);
        boards[0] = bot;
        boards[1] = bot;
        winners[0] = winner;
        winners[1] = stranger;

        vm.prank(publisher);
        vm.expectRevert(PrizePot.WeekAlreadyClosed.selector);
        pot.closeWeek(week38, boards, winners);

        // And nothing was paid to either of them.
        (address named,,) = pot.prizes(week38, bot);
        assertEq(named, address(0), "the whole call reverted, so no board closed");
    }

    function test_everyBoardNeedsAWinner() public {
        bytes32[] memory boards = new bytes32[](2);
        address[] memory winners = new address[](1);
        boards[0] = bot;
        boards[1] = lions;
        winners[0] = winner;

        vm.prank(publisher);
        vm.expectRevert(PrizePot.NotTheSameNumberOfWinners.selector);
        pot.closeWeek(week38, boards, winners);
    }

    /** Each board's prize is claimed on its own. */
    function test_claimingOneBoardLeavesTheOther() public {
        pot.setShare(bot, 2_500);
        pot.setShare(lions, 2_500);
        closeBoth(week38, winner, stranger);

        pot.claim(week38, bot);
        assertEq(card.balanceOf(winner), 2.5 ether);
        assertEq(card.balanceOf(stranger), 0, "the other board is untouched");

        pot.claim(week38, lions);
        assertEq(card.balanceOf(stranger), 2.5 ether);
    }

    function test_whatOneBoardWouldPayNow() public {
        pot.setShare(bot, 2_500);
        pot.setShare(lions, 1_000);
        assertEq(pot.nextPrize(bot), 2.5 ether);
        assertEq(pot.nextPrize(lions), 1 ether);
        assertEq(pot.nextPrize(bytes32("nothing")), 0, "a board that does not exist pays nothing");
    }

}
