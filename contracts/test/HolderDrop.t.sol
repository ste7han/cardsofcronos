// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FakeCard} from "./FakeCard.sol";

import {HolderDrop} from "../HolderDrop.sol";
import {Rescuable} from "../Rescuable.sol";

/**
 * The cumulative drop.
 *
 * Two trees against the same contract, built by OpenZeppelin's merkle-tree
 * package rather than by hand: the proofs have to match what it produces, and
 * "written to match" is a claim this project does not accept anywhere else. The
 * second tree is the first one grown, which is the whole mechanism: a holder's
 * leaf is everything they have ever earned, and a claim pays the difference.
 *
 * What is worth testing is what would be wrong in a way nobody sees: a tree
 * promising more than has arrived, a republish taking back what somebody has
 * already been paid, a second claim paying twice, and a stolen publisher key
 * getting past the delay.
 */
contract HolderDropTest is Test {
    HolderDrop private drop;
    FakeCard private card;

    address private publisher = address(0xBEEF);
    address private stranger = address(0x5A);

    string private first;
    string private grown;

    address private a11 = 0x0000000000000000000000000000000000000a11;
    address private b22 = 0x0000000000000000000000000000000000000b22;

    function setUp() public {
        card = new FakeCard();
        first = vm.readFile("data/drop-fixture.json");
        grown = vm.readFile("data/drop-fixture-grown.json");

        drop = new HolderDrop(IERC20(address(card)), publisher);
        card.mint(address(drop), 10 ether);
    }

    function rootOf(string memory json) private pure returns (bytes32) {
        return vm.parseJsonBytes32(json, ".root");
    }

    function totalOf(string memory json) private pure returns (uint256) {
        return vm.parseJsonUint(json, ".total");
    }

    function proofFor(string memory json, uint256 i) private pure returns (bytes32[] memory) {
        return
            vm.parseJsonBytes32Array(json, string.concat(".entries[", vm.toString(i), "].proof"));
    }

    /** Proposes a tree and lets the delay run out. */
    function makeLive(string memory json) private {
        vm.prank(publisher);
        drop.propose(rootOf(json), totalOf(json));
        vm.warp(block.timestamp + drop.PUBLISH_DELAY());
        drop.adopt();
    }

    // ── THE ORDINARY PATH ───────────────────────────────────────────────────

    function test_aHolderTakesWhatTheTreeSaysTheyHaveEarned() public {
        makeLive(first);

        drop.claim(a11, 5 ether, proofFor(first, 0));
        assertEq(card.balanceOf(a11), 5 ether, "the amount the tree says, to the wei");
        assertEq(drop.taken(a11), 5 ether);
        assertEq(drop.paidOut(), 5 ether);
    }

    /** Everybody in the tree can take theirs, and together it is the whole of it. */
    function test_everyShareAddsUpToWhatWasPromised() public {
        makeLive(first);

        drop.claim(a11, 5 ether, proofFor(first, 0));
        drop.claim(b22, 3 ether, proofFor(first, 1));
        drop.claim(0x0000000000000000000000000000000000000c33, 1.5 ether, proofFor(first, 2));
        drop.claim(0x0000000000000000000000000000000000000d44, 0.5 ether, proofFor(first, 3));

        assertEq(card.balanceOf(address(drop)), 0, "it paid out exactly");
        assertEq(drop.outstanding(), 0);
    }

    /** It pays the holder in the proof, never the caller. */
    function test_anybodyMayPushAShare() public {
        makeLive(first);

        vm.prank(stranger);
        drop.claim(a11, 5 ether, proofFor(first, 0));

        assertEq(card.balanceOf(a11), 5 ether);
        assertEq(card.balanceOf(stranger), 0, "the caller gets nothing for calling");
    }

    // ── WHAT MAKES IT CUMULATIVE ────────────────────────────────────────────

    /**
     * The point of the whole design: a holder who waits claims once and gets
     * everything, and a holder who claimed early gets only what is new.
     */
    function test_asecondTreePaysTheDifferenceAndNotTheWhole() public {
        makeLive(first);
        drop.claim(a11, 5 ether, proofFor(first, 0));

        // More arrives and the tree grows: a11 has now earned nine in total.
        card.mint(address(drop), 8 ether);
        makeLive(grown);

        drop.claim(a11, 9 ether, proofFor(grown, 0));
        assertEq(card.balanceOf(a11), 9 ether, "nine earned, nine held");
        assertEq(drop.taken(a11), 9 ether);

        // And b22, who never claimed the first tree, takes all five at once.
        drop.claim(b22, 5 ether, proofFor(grown, 1));
        assertEq(card.balanceOf(b22), 5 ether, "one transaction, both trees' worth");
    }

    /** Claiming twice against the same tree pays nothing and says so. */
    function test_thesameProofTwiceIsRefused() public {
        makeLive(first);
        drop.claim(a11, 5 ether, proofFor(first, 0));

        vm.expectRevert(HolderDrop.NothingToClaim.selector);
        drop.claim(a11, 5 ether, proofFor(first, 0));
        assertEq(card.balanceOf(a11), 5 ether, "and it did not pay twice");
    }

    /** A proof from an old tree is refused once a new one is live. */
    function test_anOldProofStopsWorkingWhenTheTreeMoves() public {
        makeLive(first);
        card.mint(address(drop), 8 ether);
        makeLive(grown);

        vm.expectRevert(HolderDrop.BadProof.selector);
        drop.claim(a11, 5 ether, proofFor(first, 0));
    }

    function test_somebodyElsesProof() public {
        makeLive(first);
        vm.expectRevert(HolderDrop.BadProof.selector);
        drop.claim(stranger, 5 ether, proofFor(first, 0));
    }

    function test_inflatingTheAmountBreaksTheProof() public {
        makeLive(first);
        vm.expectRevert(HolderDrop.BadProof.selector);
        drop.claim(a11, 6 ether, proofFor(first, 0));
    }

    // ── THE INVARIANT ───────────────────────────────────────────────────────

    /**
     * `promised <= paidOut + balance`, checked when a root is proposed.
     *
     * Without it a tree could promise ten times what is here, the early claimers
     * would be paid out of the late claimers' share, and the last holder to press
     * the button would find an empty contract and a valid proof.
     */
    function test_atreeCannotPromiseWhatHasNotArrived() public {
        // Ten in the contract, a tree that says eighteen.
        vm.prank(publisher);
        vm.expectRevert(
            abi.encodeWithSelector(HolderDrop.PromisesWhatIsNotHere.selector, 18 ether, 10 ether)
        );
        drop.propose(rootOf(grown), totalOf(grown));
    }

    /** What has been paid out still counts as arrived. */
    function test_whatWasPaidOutStillCountsTowardsWhatMayBePromised() public {
        makeLive(first);
        drop.claim(a11, 5 ether, proofFor(first, 0));
        assertEq(card.balanceOf(address(drop)), 5 ether, "half of it has left");

        // Eight more arrives, so thirteen has ever been here plus the five paid:
        // eighteen, which is exactly what the grown tree promises.
        card.mint(address(drop), 8 ether);
        makeLive(grown);
        assertEq(drop.promised(), 18 ether);

        // And everybody can still be paid in full.
        drop.claim(a11, 9 ether, proofFor(grown, 0));
        drop.claim(b22, 5 ether, proofFor(grown, 1));
        drop.claim(0x0000000000000000000000000000000000000c33, 2.5 ether, proofFor(grown, 2));
        drop.claim(0x0000000000000000000000000000000000000d44, 1.5 ether, proofFor(grown, 3));
        assertEq(card.balanceOf(address(drop)), 0);
    }

    /** A cumulative total cannot go down. */
    function test_atreeCannotPromiseLessThanTheOneBeforeIt() public {
        card.mint(address(drop), 8 ether);
        makeLive(grown);

        vm.prank(publisher);
        vm.expectRevert(
            abi.encodeWithSelector(
                HolderDrop.PromisesLessThanBefore.selector, 10 ether, 18 ether
            )
        );
        drop.propose(rootOf(first), totalOf(first));
    }

    // ── THE DELAY ───────────────────────────────────────────────────────────

    /**
     * What a stolen publisher key is worth, which is the reason for the delay.
     *
     * It can propose. It cannot make anything live, and the owner — a wallet
     * that never touches a server — throws it away in one transaction.
     */
    function test_apendingRootDoesNothingUntilItHasWaited() public {
        vm.prank(publisher);
        drop.propose(rootOf(first), totalOf(first));

        assertEq(drop.root(), bytes32(0), "nothing is live yet");
        vm.expectRevert(
            abi.encodeWithSelector(HolderDrop.NotReadyYet.selector, block.timestamp + 24 hours)
        );
        drop.adopt();

        vm.warp(block.timestamp + 24 hours);
        drop.adopt();
        assertEq(drop.root(), rootOf(first), "and now it is");
    }

    function test_theOwnerCanThrowAwayAPendingRoot() public {
        vm.prank(publisher);
        drop.propose(rootOf(first), totalOf(first));

        drop.dropPending();
        assertEq(drop.pendingAt(), 0);

        vm.warp(block.timestamp + 48 hours);
        vm.expectRevert(HolderDrop.NothingPending.selector);
        drop.adopt();
        assertEq(drop.root(), bytes32(0), "the thief's tree never went live");
    }

    function test_thePublisherCannotThrowAwayARoot() public {
        vm.prank(publisher);
        drop.propose(rootOf(first), totalOf(first));

        vm.prank(publisher);
        vm.expectRevert();
        drop.dropPending();
    }

    function test_onlyThePublisherProposes() public {
        vm.prank(stranger);
        vm.expectRevert(HolderDrop.NotThePublisher.selector);
        drop.propose(rootOf(first), totalOf(first));
    }

    /** One at a time, so a second proposal cannot quietly replace a pending one. */
    function test_onePendingRootAtATime() public {
        vm.prank(publisher);
        drop.propose(rootOf(first), totalOf(first));

        card.mint(address(drop), 8 ether);
        vm.prank(publisher);
        vm.expectRevert();
        drop.propose(rootOf(grown), totalOf(grown));
    }

    /** Anyone may adopt. There is nothing left to decide by the time they can. */
    function test_anybodyMayAdoptOnceItHasWaited() public {
        vm.prank(publisher);
        drop.propose(rootOf(first), totalOf(first));
        vm.warp(block.timestamp + 24 hours);

        vm.prank(stranger);
        drop.adopt();
        assertEq(drop.root(), rootOf(first));
    }

    // ── THE REST ────────────────────────────────────────────────────────────

    function test_nothingCanBeClaimedBeforeThereIsATree() public {
        vm.expectRevert(HolderDrop.NoRoot.selector);
        drop.claim(a11, 5 ether, proofFor(first, 0));
    }

    function test_theOwnerCanRotateThePublisher() public {
        drop.setPublisher(stranger);
        assertEq(drop.publisher(), stranger);

        vm.prank(publisher);
        vm.expectRevert(HolderDrop.NotThePublisher.selector);
        drop.propose(rootOf(first), totalOf(first));
    }

    function test_refusesAZeroPublisher() public {
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new HolderDrop(IERC20(address(card)), address(0));
    }

    /** What is here and promised to nobody yet is what the next tree may add. */
    function test_whatIsNotPromisedYet() public {
        assertEq(drop.unpromised(), 10 ether, "all of it, before any tree");
        makeLive(first);
        assertEq(drop.unpromised(), 0, "and none of it after");

        card.mint(address(drop), 4 ether);
        assertEq(drop.unpromised(), 4 ether, "what arrived since");
    }

    function test_theRescueHatchIsHereToo() public {
        drop.announceRescue(stranger);
        vm.warp(block.timestamp + 2 days);
        drop.rescueToken(IERC20(address(card)));
        assertEq(card.balanceOf(stranger), 10 ether);
    }
}
