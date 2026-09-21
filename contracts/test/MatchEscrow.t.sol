// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FakeCard} from "./FakeCard.sol";
import {MatchEscrow} from "../MatchEscrow.sol";

/**
 * Two people's money, held by a contract, handed to one of them.
 *
 * What these have to prove is not that addition works. It is that nobody can
 * take what is not theirs: not the publisher, who may only name a winner; not
 * the owner, who may only rotate that key; not a loser, who may not walk out
 * with their stake; and not a winner twice.
 *
 * The one that matters most is the abandonment exit, because it is the only
 * path where money leaves without anybody having won. It has to be impossible
 * to reach early, impossible to use on somebody else's deposit, and impossible
 * to use twice.
 */
contract MatchEscrowTest is Test {
    MatchEscrow private escrow;
    FakeCard private card;

    address private splitter = address(0x5911);
    address private publisher = address(0x9AB1);
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);

    bytes32 private constant ID = keccak256("match-1");

    function setUp() public {
        card = new FakeCard();
        escrow = new MatchEscrow(payable(splitter), publisher);
        escrow.setDiscountToken(IERC20(address(card)));

        vm.deal(alice, 10_000 ether);
        vm.deal(bob, 10_000 ether);
    }

    function fill(uint256 stake) private {
        vm.prank(alice);
        escrow.open{value: stake}(ID);
        vm.prank(bob);
        escrow.join{value: stake}(ID);
    }

    // ------------------------------------------------------------- the seats

    function test_openingAndJoiningHoldsBothStakes() public {
        fill(100 ether);
        assertEq(address(escrow).balance, 200 ether, "the pot is both stakes");

        (address opener, address joiner, uint256 stake, , MatchEscrow.State state, , ) =
            escrow.wagerOf(ID);
        assertEq(opener, alice);
        assertEq(joiner, bob);
        assertEq(stake, 100 ether);
        assertEq(uint256(state), uint256(MatchEscrow.State.Full));
    }

    function test_joiningWithTheWrongAmountIsRefused() public {
        vm.prank(alice);
        escrow.open{value: 100 ether}(ID);

        // Not "at least". An overpayment would have to be refunded, and a
        // refund inside a join is a second way for joining to fail.
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MatchEscrow.WrongStake.selector, 100 ether, 101 ether));
        escrow.join{value: 101 ether}(ID);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MatchEscrow.WrongStake.selector, 100 ether, 99 ether));
        escrow.join{value: 99 ether}(ID);
    }

    function test_youCannotSitDownOppositeYourself() public {
        vm.prank(alice);
        escrow.open{value: 100 ether}(ID);
        vm.prank(alice);
        vm.expectRevert(MatchEscrow.CannotPlayYourself.selector);
        escrow.join{value: 100 ether}(ID);
    }

    function test_aSeatCannotBeOpenedTwice() public {
        vm.prank(alice);
        escrow.open{value: 100 ether}(ID);
        vm.prank(bob);
        vm.expectRevert(MatchEscrow.AlreadyExists.selector);
        escrow.open{value: 100 ether}(ID);
    }

    function test_openingWithNothingIsRefused() public {
        vm.prank(alice);
        vm.expectRevert(MatchEscrow.NothingStaked.selector);
        escrow.open{value: 0}(ID);
    }

    function test_theOpenerTakesBackAnUnfilledSeat() public {
        uint256 before = alice.balance;
        vm.prank(alice);
        escrow.open{value: 100 ether}(ID);
        vm.prank(alice);
        escrow.cancel(ID);
        assertEq(alice.balance, before, "every wei back");
    }

    function test_nobodyElseCancelsYourSeat() public {
        vm.prank(alice);
        escrow.open{value: 100 ether}(ID);
        vm.prank(bob);
        vm.expectRevert(MatchEscrow.NotAPlayer.selector);
        escrow.cancel(ID);
    }

    function test_aFilledSeatCannotBeCancelled() public {
        fill(100 ether);
        vm.prank(alice);
        vm.expectRevert(MatchEscrow.NotOpen.selector);
        escrow.cancel(ID);
    }

    // ------------------------------------------------------------ the result

    function test_onlyThePublisherNamesAWinner() public {
        fill(100 ether);
        for (uint256 i = 0; i < 3; i++) {
            address who = [alice, bob, escrow.owner()][i];
            vm.prank(who);
            vm.expectRevert(MatchEscrow.NotThePublisher.selector);
            escrow.settle(ID, alice);
        }
    }

    function test_theWinnerHasToHaveBeenPlaying() public {
        fill(100 ether);
        vm.prank(publisher);
        vm.expectRevert(MatchEscrow.NotAPlayer.selector);
        escrow.settle(ID, address(0xDEAD));
    }

    function test_aMatchCannotBeSettledTwice() public {
        fill(100 ether);
        vm.prank(publisher);
        escrow.settle(ID, alice);
        vm.prank(publisher);
        vm.expectRevert(MatchEscrow.NotFull.selector);
        escrow.settle(ID, bob);
    }

    function test_theWinnerIsPaidThePotLessTheCut() public {
        fill(100 ether);
        uint256 before = alice.balance;

        vm.prank(publisher);
        escrow.settle(ID, alice);
        escrow.claim(ID);

        // Retail: 25% of a 200 pot.
        assertEq(splitter.balance, 50 ether, "the cut went to the splitter");
        assertEq(alice.balance, before + 150 ether, "the rest went to the winner");
        assertEq(address(escrow).balance, 0, "nothing left behind");
    }

    function test_holdingMoreKeepsMoreOfWhatYouWin() public {
        // The same ladder as the mint discount and the profile page.
        uint256[4] memory held = [uint256(0), 100_000e18, 1_000_000e18, 10_000_000e18];
        uint256[4] memory cut = [uint256(2_500), 1_500, 1_000, 500];

        for (uint256 i = 0; i < 4; i++) {
            card.mint(alice, held[i] - card.balanceOf(alice));
            assertEq(escrow.cutFor(alice), cut[i], "the rung");
        }
        // And one under a rung is the rung below.
        assertEq(escrow.cutFor(bob), 2_500);
    }

    function test_theCutIsReadWhenItIsPaidAndNotWhenItIsNamed() public {
        fill(100 ether);
        vm.prank(publisher);
        escrow.settle(ID, alice);

        // Bought between the two. Holding more should count, and the amount in
        // the Settled event is a note rather than a promise.
        card.mint(alice, 10_000_000e18);

        uint256 before = alice.balance;
        escrow.claim(ID);
        assertEq(splitter.balance, 10 ether, "5% of 200, not 25%");
        assertEq(alice.balance, before + 190 ether);
    }

    function test_anybodyMayClaimAndTheWinnerIsPaid() public {
        fill(100 ether);
        vm.prank(publisher);
        escrow.settle(ID, alice);

        uint256 before = alice.balance;
        // A stranger, spending their own gas. The winner does not have to be
        // watching to be paid.
        vm.prank(address(0xBEEF));
        escrow.claim(ID);
        assertEq(alice.balance, before + 150 ether);
    }

    function test_aPotCannotBeTakenTwice() public {
        fill(100 ether);
        vm.prank(publisher);
        escrow.settle(ID, alice);
        escrow.claim(ID);
        vm.expectRevert(MatchEscrow.AlreadyPaid.selector);
        escrow.claim(ID);
    }

    function test_nothingIsPaidBeforeItIsSettled() public {
        fill(100 ether);
        vm.expectRevert(MatchEscrow.NotSettledYet.selector);
        escrow.claim(ID);
    }

    // ------------------------------------------------------- walking away

    function test_youCannotWalkAwayEarly() public {
        fill(100 ether);
        vm.warp(block.timestamp + 29 days);
        vm.prank(alice);
        vm.expectRevert();
        escrow.walkAway(ID);
    }

    function test_afterLongEnoughEachSideTakesItsOwnBack() public {
        fill(100 ether);
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        escrow.walkAway(ID);
        vm.prank(bob);
        escrow.walkAway(ID);

        assertEq(alice.balance, aliceBefore + 100 ether, "her own, not his");
        assertEq(bob.balance, bobBefore + 100 ether);
        assertEq(address(escrow).balance, 0);
    }

    function test_walkingAwayTwiceTakesNothingExtra() public {
        fill(100 ether);
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        escrow.walkAway(ID);
        vm.prank(alice);
        vm.expectRevert(MatchEscrow.AlreadyPaid.selector);
        escrow.walkAway(ID);
    }

    function test_astrangerCannotWalkAwayWithSomebodyElsesStake() public {
        fill(100 ether);
        vm.warp(block.timestamp + 31 days);
        vm.prank(address(0xBEEF));
        vm.expectRevert(MatchEscrow.NotAPlayer.selector);
        escrow.walkAway(ID);
    }

    function test_walkingAwayIsNotAWayOutOfALoss() public {
        // Settled is not Full, so the exit is shut the moment a winner exists —
        // even thirty days later. Otherwise a loser waits a month and takes
        // half the pot back out of a match they lost.
        fill(100 ether);
        vm.prank(publisher);
        escrow.settle(ID, alice);
        vm.warp(block.timestamp + 90 days);
        vm.prank(bob);
        vm.expectRevert(MatchEscrow.NotFull.selector);
        escrow.walkAway(ID);
    }

    // ------------------------------------------------------------- the keys

    function test_theOwnerRotatesThePublisherAndNothingElse() public {
        address next = address(0xAC1D);
        escrow.setPublisher(next);
        assertEq(escrow.publisher(), next);

        fill(100 ether);
        vm.prank(publisher);
        vm.expectRevert(MatchEscrow.NotThePublisher.selector);
        escrow.settle(ID, alice);
    }

    function test_onlyTheOwnerRotatesIt() public {
        vm.prank(alice);
        vm.expectRevert();
        escrow.setPublisher(alice);
    }

    function test_theCutCannotBeMoved() public {
        // Constants, no setters. A cut somebody can be moved onto after they
        // staked is not a deal.
        assertEq(escrow.RETAIL_BPS(), 2_500);
        assertEq(escrow.WHALE_BPS(), 500);
    }

    function test_theSplitterCannotBePointedSomewhereElse() public view {
        assertEq(escrow.splitter(), splitter);
    }

    // ------------------------------------------------- getting stuck CRO out

    function test_theOwnerCannotTouchALiveStake() public {
        // The whole reason this contract does not inherit Rescuable. Two people
        // are mid-match; there is nothing here that is not theirs.
        fill(100 ether);
        assertEq(escrow.committed(), 200 ether);
        assertEq(escrow.stuck(), 0, "nothing is loose");

        vm.expectRevert(MatchEscrow.NothingStuck.selector);
        escrow.sweepStuck(address(this));
        assertEq(address(escrow).balance, 200 ether, "untouched");
    }

    function test_anOpenSeatIsAlsoOutOfReach() public {
        vm.prank(alice);
        escrow.open{value: 100 ether}(ID);
        assertEq(escrow.stuck(), 0);
        vm.expectRevert(MatchEscrow.NothingStuck.selector);
        escrow.sweepStuck(address(this));
    }

    function test_croThatBelongsToNoMatchCanBeTakenOut() public {
        fill(100 ether);
        // Forced in, which is the case a hatch exists for: no function of this
        // contract accounted for it and nobody can ever ask for it back.
        vm.deal(address(escrow), address(escrow).balance + 7 ether);

        assertEq(escrow.stuck(), 7 ether, "the loose part and not a wei more");

        address to = address(0x0FF1CE);
        escrow.sweepStuck(to);
        assertEq(to.balance, 7 ether);
        assertEq(address(escrow).balance, 200 ether, "the match still has its pot");
    }

    function test_onlyTheOwnerSweeps() public {
        vm.deal(address(escrow), 7 ether);
        vm.prank(alice);
        vm.expectRevert();
        escrow.sweepStuck(alice);

        vm.prank(publisher);
        vm.expectRevert();
        escrow.sweepStuck(publisher);
    }

    function test_whatIsOwedFallsAsItIsPaidOut() public {
        fill(100 ether);
        vm.prank(publisher);
        escrow.settle(ID, alice);
        escrow.claim(ID);

        assertEq(escrow.committed(), 0, "nothing is owed once it is paid");
        assertEq(address(escrow).balance, 0);
    }

    function test_whatIsOwedFallsWhenSomebodyWalksAway() public {
        fill(100 ether);
        vm.warp(block.timestamp + 31 days);
        vm.prank(alice);
        escrow.walkAway(ID);
        assertEq(escrow.committed(), 100 ether, "his half is still his");
        vm.prank(bob);
        escrow.walkAway(ID);
        assertEq(escrow.committed(), 0);
    }

    function test_severalMatchesAtOnceAreEachOthersFloor() public {
        fill(100 ether);
        bytes32 second = keccak256("match-2");
        vm.prank(bob);
        escrow.open{value: 500 ether}(second);
        vm.prank(alice);
        escrow.join{value: 500 ether}(second);

        assertEq(escrow.committed(), 1_200 ether);
        vm.deal(address(escrow), address(escrow).balance + 3 ether);
        assertEq(escrow.stuck(), 3 ether);

        // Settling one does not make the other's pot sweepable.
        vm.prank(publisher);
        escrow.settle(ID, alice);
        escrow.claim(ID);
        assertEq(escrow.committed(), 1_000 ether, "the second match keeps its pot");
        assertEq(escrow.stuck(), 3 ether);
    }

    function test_aTokenSentHereByMistakeCanComeBackOut() public {
        // Stakes are CRO. Anything in a token arrived by accident and there is
        // no accounting to protect.
        card.mint(address(escrow), 1_000e18);
        address to = address(0x0FF1CE);
        escrow.sweepToken(IERC20(address(card)), to);
        assertEq(card.balanceOf(to), 1_000e18);
    }

    function test_sweepingToNowhereIsRefused() public {
        vm.deal(address(escrow), 7 ether);
        vm.expectRevert(MatchEscrow.SendFailed.selector);
        escrow.sweepStuck(address(0));
    }
}
